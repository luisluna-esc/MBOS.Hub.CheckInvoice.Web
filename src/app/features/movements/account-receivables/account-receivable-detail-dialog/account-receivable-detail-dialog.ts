import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AccountReceivable, Payment } from '../account-receivable.models';
import { AccountReceivableService } from '../account-receivable.service';

export interface AccountReceivableDetailDialogData {
  accountReceivable: AccountReceivable;
  clientName: string | null;
}

export interface PaymentRow {
  payment: Payment;
  balanceAfter: number;
}

@Component({
  selector: 'app-account-receivable-detail-dialog',
  imports: [Dialog, TranslatePipe],
  templateUrl: './account-receivable-detail-dialog.html',
})
export class AccountReceivableDetailDialog {
  protected readonly data = inject<AccountReceivableDetailDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, AccountReceivableDetailDialog>);
  private readonly accountReceivableService = inject(AccountReceivableService);
  private readonly languageService = inject(LanguageService);

  protected readonly loading = signal(true);
  protected readonly payments = signal<Payment[]>([]);

  // Ordenados del más antiguo al más reciente para poder mostrar cuánto quedaba
  // pendiente después de cada pago (arranca en el total y va bajando pago a pago).
  protected readonly paymentRows = computed<PaymentRow[]>(() => {
    const chronological = [...this.payments()].sort(
      (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    );
    let balance = this.data.accountReceivable.totalAmount;
    return chronological.map((payment) => {
      balance = Math.max(balance - payment.amount, 0);
      return { payment, balanceAfter: balance };
    });
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.payments.set(await this.accountReceivableService.listPayments(this.data.accountReceivable.accountReceivableId));
    } finally {
      this.loading.set(false);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected paddedIssueId(issueId: number | null): string {
    return issueId === null ? '—' : String(issueId).padStart(5, '0');
  }

  protected formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  protected formatPaymentType(paymentType: string): string {
    const translated = this.languageService.t(`accountReceivables.paymentTypes.${paymentType}`);
    return translated === `accountReceivables.paymentTypes.${paymentType}` ? paymentType : translated;
  }
}
