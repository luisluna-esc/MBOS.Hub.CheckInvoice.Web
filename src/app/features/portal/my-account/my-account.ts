import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { formatCalendarDate } from '../../../core/dates/calendar-date';
import { LanguageService } from '../../../core/i18n/language.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PortalStatementAccount } from '../portal.models';
import { PortalService } from '../portal.service';

type StatementFilter = 'open' | 'paid' | 'all';

// Mi Cuenta del Pastor en una sola vista, sin pestañas: cuánto debe en total y, por cada salida
// a crédito, qué productos recibió, cuánto pagó de cada uno y cuánto le falta, más los depósitos
// que registró Caja. Las cuentas que debe van primero (el backend ya las ordena).
@Component({
  selector: 'app-my-account',
  imports: [ErrorState, TranslatePipe, DecimalPipe],
  templateUrl: './my-account.html',
})
export class MyAccount {
  private readonly portalService = inject(PortalService);
  private readonly languageService = inject(LanguageService);

  protected readonly accounts = signal<PortalStatementAccount[]>([]);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly filter = signal<StatementFilter>('open');

  protected readonly openAccounts = computed(() => this.accounts().filter((a) => a.status !== 'paid'));
  protected readonly lateCount = computed(() => this.accounts().filter((a) => a.status === 'late').length);
  protected readonly totalOwed = computed(() => this.openAccounts().reduce((sum, a) => sum + a.outstandingBalance, 0));
  protected readonly totalPaid = computed(() => this.accounts().reduce((sum, a) => sum + a.paidAmount, 0));

  protected readonly visibleAccounts = computed(() => {
    switch (this.filter()) {
      case 'open':
        return this.openAccounts();
      case 'paid':
        return this.accounts().filter((a) => a.status === 'paid');
      default:
        return this.accounts();
    }
  });

  protected readonly filters: StatementFilter[] = ['open', 'paid', 'all'];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      this.accounts.set(await this.portalService.getMyStatement());
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected issueNumber(account: PortalStatementAccount): string {
    return account.issueId != null ? String(account.issueId).padStart(5, '0') : '—';
  }

  protected calendarDate(value: string | null): string {
    return formatCalendarDate(value);
  }

  protected paymentDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected paymentMethodLabel(paymentMethod: string | null): string {
    switch (paymentMethod) {
      case 'cash':
        return this.languageService.t('accountReceivables.payment.methodCash');
      case 'transfer':
        return this.languageService.t('accountReceivables.payment.methodTransfer');
      default:
        return paymentMethod || '—';
    }
  }

  protected totalQuantity(account: PortalStatementAccount): number {
    return account.lines.reduce((sum, line) => sum + line.quantity, 0);
  }
}
