import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AccountReceivable, PaymentLine } from '../account-receivable.models';
import { AccountReceivableService } from '../account-receivable.service';

export interface PastorPaymentAccount {
  account: AccountReceivable;
  lines: PaymentLine[];
}

export interface PastorPaymentDialogData {
  pastorName: string;
  /** Cuentas que se pueden pagar por Caja (pendientes, no retrasadas). */
  accounts: PastorPaymentAccount[];
}

interface PayRow {
  accountReceivableId: number;
  noteNumber: string;
  line: PaymentLine;
  control: FormControl<string>;
}

/**
 * Pago de un pastor de todo lo que debe, de todas sus salidas juntas: cada casilla es lo que paga
 * de ese material. Al guardar se registra un depósito por cada salida que tenga algo pagado
 * (con el mismo método y nota), igual que si se pagara salida por salida.
 */
@Component({
  selector: 'app-pastor-payment-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, TranslatePipe, DecimalPipe],
  templateUrl: './pastor-payment-dialog.html',
})
export class PastorPaymentDialog {
  protected readonly data = inject<PastorPaymentDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, PastorPaymentDialog>);
  private readonly accountReceivableService = inject(AccountReceivableService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);

  protected readonly paymentMethodOptions: SelectOption[] = [
    { value: 'transfer', label: this.languageService.t('accountReceivables.payment.methodTransfer') },
    { value: 'cash', label: this.languageService.t('accountReceivables.payment.methodCash') },
  ];

  protected readonly rows: PayRow[] = this.data.accounts.flatMap((item) =>
    item.lines
      .filter((line) => line.remainingAmount > 0)
      .map((line) => ({
        accountReceivableId: item.account.accountReceivableId,
        noteNumber: item.account.noteNumber ?? String(item.account.issueId ?? item.account.accountReceivableId),
        line,
        control: new FormControl('', { nonNullable: true }),
      }))
  );

  protected readonly form = new FormGroup({
    paymentMethod: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true }),
    ...Object.fromEntries(this.rows.map((row, index) => [`line${index}`, row.control])),
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {
    initialValue: this.form.value,
  });

  protected readonly pendingTotal = this.rows.reduce((sum, row) => sum + row.line.remainingAmount, 0);

  protected readonly depositTotal = computed(() => {
    this.formValue();
    return this.rows.reduce((sum, row) => sum + (Number(row.control.value) || 0), 0);
  });

  protected exceeds(row: PayRow): boolean {
    const amount = Number(row.control.value) || 0;
    return Math.round(amount * 100) > Math.round(row.line.remainingAmount * 100);
  }

  protected readonly anyExceeds = computed(() => {
    this.formValue();
    return this.rows.some((row) => this.exceeds(row));
  });

  protected readonly saveDisabled = computed(
    () => this.saving() || this.depositTotal() <= 0 || this.anyExceeds() || !this.formValue().paymentMethod
  );

  protected lineError(row: PayRow): string | null {
    return this.exceeds(row)
      ? this.languageService.t('accountReceivables.payment.lineExceeds', { name: row.line.name, amount: row.line.remainingAmount.toFixed(2) })
      : null;
  }

  protected fill(row: PayRow): void {
    row.control.setValue(row.line.remainingAmount.toFixed(2));
  }

  /** Paga todo lo pendiente de todas las salidas. */
  protected fillAll(): void {
    for (const row of this.rows) {
      this.fill(row);
    }
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const method = this.form.controls.paymentMethod.value;
    const notes = this.form.controls.notes.value || null;
    let saved = 0;
    try {
      for (const item of this.data.accounts) {
        const details = this.rows
          .filter((row) => row.accountReceivableId === item.account.accountReceivableId)
          .map((row) => ({ issueDetailId: row.line.issueDetailId, amount: Number(row.control.value) || 0 }))
          .filter((detail) => detail.amount > 0);
        const amount = details.reduce((sum, detail) => sum + detail.amount, 0);
        if (amount <= 0) {
          continue;
        }
        await this.accountReceivableService.createPayment({
          accountReceivableId: item.account.accountReceivableId,
          amount: Math.round(amount * 100) / 100,
          paymentMethod: method,
          notes,
          details,
        });
        saved++;
      }
      this.toastService.success(this.languageService.t('accountReceivables.pastor.paid', { count: saved }));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]?.description;
      this.toastService.error(this.languageService.t('accountReceivables.payment.error'), message);
      // Lo que ya se registró queda registrado: se cierra para volver a cargar los saldos.
      if (saved > 0) {
        this.dialogRef.close(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
