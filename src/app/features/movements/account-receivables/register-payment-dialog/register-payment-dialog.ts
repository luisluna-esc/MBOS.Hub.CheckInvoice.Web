import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentLine } from '../account-receivable.models';
import { AccountReceivableService } from '../account-receivable.service';

export interface RegisterPaymentDialogData {
  accountReceivableId: number;
  outstandingBalance: number;
}

// Caja reparte el depósito entre los productos de la salida: cada casilla es lo que se deposita
// de ese producto, y no puede pasar de lo que falta pagar de él. Productos en 0 se dejan para
// otro depósito. Si la cuenta no tiene salida (creada a mano), se registra un monto general.
@Component({
  selector: 'app-register-payment-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, Select, TranslatePipe, DecimalPipe],
  templateUrl: './register-payment-dialog.html',
})
export class RegisterPaymentDialog {
  protected readonly data = inject<RegisterPaymentDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, RegisterPaymentDialog>);
  private readonly accountReceivableService = inject(AccountReceivableService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly loadingLines = signal(true);
  protected readonly lines = signal<PaymentLine[]>([]);
  protected readonly hasProducts = signal(false);

  protected readonly paymentMethodOptions: SelectOption[] = [
    { value: 'transfer', label: this.languageService.t('accountReceivables.payment.methodTransfer') },
    { value: 'cash', label: this.languageService.t('accountReceivables.payment.methodCash') },
  ];

  protected readonly lineAmounts = new FormArray<FormControl<string>>([]);

  protected readonly form = new FormGroup({
    amount: new FormControl('', { nonNullable: true }),
    paymentMethod: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true }),
    lineAmounts: this.lineAmounts,
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {
    initialValue: this.form.value,
  });

  protected readonly depositTotal = computed(() => {
    const value = this.formValue();
    if (!this.hasProducts()) {
      return Number(value.amount) || 0;
    }
    return (value.lineAmounts ?? []).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  });

  protected readonly anyLineExceeds = computed(() => {
    this.formValue();
    return this.lines().some((_, index) => this.lineExceeds(index));
  });

  protected readonly saveDisabled = computed(
    () =>
      this.saving() ||
      this.loadingLines() ||
      this.depositTotal() <= 0 ||
      this.anyLineExceeds() ||
      !this.formValue().paymentMethod
  );

  constructor() {
    void this.loadLines();
  }

  private async loadLines(): Promise<void> {
    try {
      const result = await this.accountReceivableService.getPaymentLines(this.data.accountReceivableId);
      this.lines.set(result.lines);
      this.hasProducts.set(result.hasProducts);
      for (const _ of result.lines) {
        this.lineAmounts.push(new FormControl('', { nonNullable: true }));
      }
    } catch {
      this.toastService.show(this.languageService.t('accountReceivables.payment.linesError'));
    } finally {
      this.loadingLines.set(false);
    }
  }

  protected lineExceeds(index: number): boolean {
    const line = this.lines()[index];
    const amount = Number(this.lineAmounts.at(index)?.value) || 0;
    // Se compara en centavos para no fallar por decimales de punto flotante.
    return !!line && Math.round(amount * 100) > Math.round(line.remainingAmount * 100);
  }

  protected lineError(index: number): string | null {
    const line = this.lines()[index];
    if (!line || !this.lineExceeds(index)) {
      return null;
    }
    return this.languageService.t('accountReceivables.payment.lineExceeds', {
      name: line.name,
      amount: line.remainingAmount.toFixed(2),
    });
  }

  /** Llena la casilla con todo lo que falta de ese producto. */
  protected fillRemaining(index: number): void {
    const line = this.lines()[index];
    if (line) {
      this.lineAmounts.at(index).setValue(line.remainingAmount.toFixed(2));
    }
  }

  protected async onSave(): Promise<void> {
    if (!this.form.controls.paymentMethod.value) {
      this.form.controls.paymentMethod.markAsTouched();
      this.toastService.show(this.languageService.t('accountReceivables.payment.methodRequired'));
      return;
    }
    if (this.depositTotal() <= 0) {
      this.toastService.show(this.languageService.t('accountReceivables.payment.amountRequired'));
      return;
    }

    const details = this.hasProducts()
      ? this.lines()
          .map((line, index) => ({ issueDetailId: line.issueDetailId, amount: Number(this.lineAmounts.at(index).value) || 0 }))
          .filter((detail) => detail.amount > 0)
      : [];

    this.saving.set(true);
    try {
      await this.accountReceivableService.createPayment({
        accountReceivableId: this.data.accountReceivableId,
        amount: this.depositTotal(),
        paymentMethod: this.form.controls.paymentMethod.value || null,
        notes: this.form.controls.notes.value || null,
        details,
      });
      this.toastService.show(this.languageService.t('accountReceivables.payment.success'));
      this.dialogRef.close(true);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('accountReceivables.payment.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
