import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AccountReceivableService } from '../account-receivable.service';

export interface RegisterPaymentDialogData {
  accountReceivableId: number;
  outstandingBalance: number;
}

@Component({
  selector: 'app-register-payment-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, TranslatePipe],
  templateUrl: './register-payment-dialog.html',
})
export class RegisterPaymentDialog {
  protected readonly data = inject<RegisterPaymentDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, RegisterPaymentDialog>);
  private readonly accountReceivableService = inject(AccountReceivableService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    amount: new FormControl('', { nonNullable: true }),
    paymentMethod: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  protected readonly saveDisabled = computed(() => this.saving());

  protected async onSave(): Promise<void> {
    const amount = Number(this.form.controls.amount.value);
    if (!amount || amount <= 0) {
      this.toastService.show(this.languageService.t('accountReceivables.payment.amountRequired'));
      return;
    }

    this.saving.set(true);
    try {
      await this.accountReceivableService.createPayment({
        accountReceivableId: this.data.accountReceivableId,
        amount,
        paymentMethod: this.form.controls.paymentMethod.value || null,
        notes: this.form.controls.notes.value || null,
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
