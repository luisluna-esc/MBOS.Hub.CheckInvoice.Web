import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { formatCalendarDate } from '../../../../core/dates/calendar-date';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AccountReceivable, PaymentLine } from '../account-receivable.models';
import { AccountReceivableService } from '../account-receivable.service';
import {
  PastorPaymentDialog,
  PastorPaymentDialogData,
} from '../pastor-payment-dialog/pastor-payment-dialog';

interface AccountWithLines {
  account: AccountReceivable;
  lines: PaymentLine[];
}

/**
 * Cuentas por cobrar de un pastor: se busca por nombre y sale todo lo que debe, de todas sus
 * salidas, con cada material pagado o pendiente, los totales y el botón para pagar desde aquí.
 */
@Component({
  selector: 'app-pastor-account',
  imports: [FormsModule, Select, LoadingSkeleton, TranslatePipe, DecimalPipe],
  templateUrl: './pastor-account.html',
})
export class PastorAccount {
  readonly clients = input.required<CatalogItem[]>();
  readonly canManage = input(false);

  private readonly accountReceivableService = inject(AccountReceivableService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly clientId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly accounts = signal<AccountWithLines[]>([]);
  /** Ver también las salidas ya pagadas (por defecto solo lo pendiente). */
  protected readonly showPaid = signal(false);

  protected readonly clientOptions = computed<SelectOption[]>(() =>
    this.clients().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly pastorName = computed(
    () => this.clients().find((item) => String(item.id) === this.clientId())?.name ?? ''
  );

  protected readonly visibleAccounts = computed(() =>
    this.accounts().filter((item) => this.showPaid() || item.account.status !== 'paid')
  );

  protected readonly totals = computed(() => {
    const all = this.accounts();
    const total = all.reduce((sum, item) => sum + item.account.totalAmount, 0);
    const pending = all.reduce((sum, item) => sum + item.account.outstandingBalance, 0);
    return { total, paid: total - pending, pending };
  });

  /** Lo que se puede pagar por Caja: pendiente y no retrasado (lo retrasado se descuenta del sueldo). */
  protected readonly payable = computed(() =>
    this.accounts().filter((item) => item.account.status === 'pending' && item.account.outstandingBalance > 0)
  );
  protected readonly lateCount = computed(() => this.accounts().filter((item) => item.account.status === 'late').length);

  protected onClientChange(value: string | null): void {
    this.clientId.set(value);
    void this.load();
  }

  protected async load(): Promise<void> {
    const id = Number(this.clientId());
    if (!id) {
      this.accounts.set([]);
      return;
    }
    this.loading.set(true);
    try {
      const result = await this.accountReceivableService.list(1, 200, { clientId: id });
      const withLines = await Promise.all(
        result.items.map(async (account) => {
          try {
            return { account, lines: (await this.accountReceivableService.getPaymentLines(account.accountReceivableId)).lines };
          } catch {
            return { account, lines: [] };
          }
        })
      );
      // Lo pendiente primero, después por fecha de salida.
      withLines.sort(
        (a, b) =>
          Number(a.account.status === 'paid') - Number(b.account.status === 'paid') ||
          (a.account.issueDate ?? '').localeCompare(b.account.issueDate ?? '')
      );
      this.accounts.set(withLines);
    } catch {
      this.toastService.error(this.languageService.t('accountReceivables.pastor.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(value: string | null): string {
    return formatCalendarDate(value);
  }

  protected issueLabel(account: AccountReceivable): string {
    return account.noteNumber ?? (account.issueId != null ? String(account.issueId).padStart(5, '0') : '—');
  }

  protected openPayment(): void {
    const ref = this.dialogService.open<boolean, PastorPaymentDialogData, PastorPaymentDialog>(PastorPaymentDialog, {
      data: { pastorName: this.pastorName(), accounts: this.payable() },
    });
    ref.closed.subscribe((changed) => {
      if (changed) {
        void this.load();
      }
    });
  }
}
