import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { DialogService } from '../../../core/dialog/dialog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { IssueDetailsDialog, IssueDetailsDialogData } from '../../movements/issues/issue-details-dialog/issue-details-dialog';
import { PortalAccountReceivable, PortalDateRangeFilters, PortalIssue, PortalPayment } from '../portal.models';
import { PortalService } from '../portal.service';

function paginate<T>(items: T[], pageNumber: number, pageSize: number): T[] {
  const start = (pageNumber - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

type MyAccountTab = 'receivables' | 'payments' | 'issues';

@Component({
  selector: 'app-my-account',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './my-account.html',
})
export class MyAccount {
  private readonly portalService = inject(PortalService);
  private readonly languageService = inject(LanguageService);
  private readonly dialogService = inject(DialogService);

  protected readonly accountReceivables = signal<PortalAccountReceivable[]>([]);
  protected readonly payments = signal<PortalPayment[]>([]);
  protected readonly issues = signal<PortalIssue[]>([]);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly activeTab = signal<MyAccountTab>('receivables');

  private currentDateRange: PortalDateRangeFilters = {};

  protected readonly receivablesFilters = signal<FilterValues>({});
  protected readonly paymentsFilters = signal<FilterValues>({});

  protected readonly receivablesPageNumber = signal(1);
  protected readonly receivablesPageSize = signal(5);
  protected readonly paymentsPageNumber = signal(1);
  protected readonly paymentsPageSize = signal(5);
  protected readonly issuesPageNumber = signal(1);
  protected readonly issuesPageSize = signal(5);

  protected readonly pendingReceivables = computed(() => this.accountReceivables().filter((a) => a.status !== 'paid'));

  /** Pendientes primero, ordenadas por fecha límite (la más próxima primero); pagadas al final. */
  protected readonly sortedReceivables = computed(() => {
    const dueTime = (a: PortalAccountReceivable) => (a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER);
    return [...this.accountReceivables()].sort((a, b) => {
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      if (a.status !== 'paid' && b.status === 'paid') return -1;
      return dueTime(a) - dueTime(b);
    });
  });

  protected readonly totalOutstanding = computed(() =>
    this.pendingReceivables().reduce((sum, a) => sum + a.outstandingBalance, 0)
  );

  /** Cantidad en vez de "próxima fecha límite": con varias deudas pendientes, una sola
   * fecha suelta sugiere que aplica a todas. La fecha de cada una ya se ve en la tabla,
   * ordenada de la más próxima a la más lejana. */
  protected readonly pendingCount = computed(() => this.pendingReceivables().length);

  /** Cantidad en vez de "fecha de última entrega": con varias entregas, una sola fecha
   * suelta no deja claro a cuál se refiere. La fecha de cada una ya se ve en la tabla,
   * ordenada de la más reciente a la más antigua. */
  protected readonly deliveryCount = computed(() => this.issues().length);

  private readonly issueIdByReceivable = computed<Record<number, number | null>>(() =>
    Object.fromEntries(this.accountReceivables().map((a) => [a.accountReceivableId, a.issueId]))
  );

  /** Pagos más recientes primero, para que el pastor vea de inmediato el último abono. */
  protected readonly sortedPayments = computed(() =>
    [...this.payments()].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
  );

  protected readonly filteredReceivables = computed(() => {
    const { issue, status } = this.receivablesFilters();
    return this.sortedReceivables().filter((a) => {
      const matchesIssue = !issue || (a.issueId != null && String(a.issueId).padStart(5, '0').includes(issue));
      const matchesStatus = !status || a.status === status;
      return matchesIssue && matchesStatus;
    });
  });

  protected readonly filteredPayments = computed(() => {
    const { issue, dateFrom, dateTo } = this.paymentsFilters();
    const issueIdByReceivable = this.issueIdByReceivable();
    return this.sortedPayments().filter((p) => {
      const issueId = issueIdByReceivable[p.accountReceivableId];
      const matchesIssue = !issue || (issueId != null && String(issueId).padStart(5, '0').includes(issue));
      const paymentTime = new Date(p.paymentDate).getTime();
      const matchesFrom = !dateFrom || paymentTime >= new Date(dateFrom).getTime();
      const matchesTo = !dateTo || paymentTime <= new Date(`${dateTo}T23:59:59.999`).getTime();
      return matchesIssue && matchesFrom && matchesTo;
    });
  });

  protected readonly pagedReceivables = computed(() =>
    paginate(this.filteredReceivables(), this.receivablesPageNumber(), this.receivablesPageSize())
  );
  protected readonly pagedPayments = computed(() =>
    paginate(this.filteredPayments(), this.paymentsPageNumber(), this.paymentsPageSize())
  );
  protected readonly pagedIssues = computed(() => paginate(this.issues(), this.issuesPageNumber(), this.issuesPageSize()));

  protected readonly receivablesFilterFields = computed<FilterField[]>(() => [
    { key: 'issue', label: this.languageService.t('portal.myAccount.filters.issue'), type: 'text' },
    {
      key: 'status',
      label: this.languageService.t('portal.myAccount.columns.status'),
      type: 'select',
      options: [
        { value: 'pending', label: this.languageService.t('accountReceivables.status.pending') },
        { value: 'paid', label: this.languageService.t('accountReceivables.status.paid') },
      ],
    },
  ]);

  protected readonly paymentsFilterFields = computed<FilterField[]>(() => [
    { key: 'issue', label: this.languageService.t('portal.myAccount.filters.issue'), type: 'text' },
    { key: 'dateFrom', label: this.languageService.t('portal.myAccount.filters.dateFrom'), type: 'date' },
    { key: 'dateTo', label: this.languageService.t('portal.myAccount.filters.dateTo'), type: 'date' },
  ]);

  protected readonly dateRangeFields = computed<FilterField[]>(() => [
    { key: 'dateFrom', label: this.languageService.t('portal.myAccount.filters.dateFrom'), type: 'date' },
    { key: 'dateTo', label: this.languageService.t('portal.myAccount.filters.dateTo'), type: 'date' },
  ]);

  protected readonly receivableColumns = computed<TableColumn<PortalAccountReceivable>[]>(() => [
    {
      key: 'issueId',
      header: this.languageService.t('portal.myAccount.columns.issue'),
      format: (value) => (value != null ? String(value).padStart(5, '0') : '—'),
    },
    {
      key: 'issueDate',
      header: this.languageService.t('portal.myAccount.columns.issueDate'),
      format: (value) => (value ? new Date(value as string).toLocaleDateString() : '—'),
    },
    {
      key: 'dueDate',
      header: this.languageService.t('portal.myAccount.columns.dueDate'),
      format: (value) => (value ? new Date(value as string).toLocaleDateString() : '—'),
    },
    {
      key: 'outstandingBalance',
      header: this.languageService.t('portal.myAccount.columns.outstandingBalance'),
      align: 'right',
      format: (value) => Number(value).toFixed(2),
    },
    {
      key: 'status',
      header: this.languageService.t('portal.myAccount.columns.status'),
      format: (value) => this.languageService.t(`accountReceivables.status.${value}`),
    },
  ]);

  protected readonly paymentColumns = computed<TableColumn<PortalPayment>[]>(() => {
    const issueIdByReceivable = this.issueIdByReceivable();

    return [
      {
        key: 'accountReceivableId',
        header: this.languageService.t('portal.myAccount.columns.issue'),
        format: (value) => {
          const issueId = issueIdByReceivable[value as number];
          return issueId != null ? String(issueId).padStart(5, '0') : '—';
        },
      },
      {
        key: 'paymentDate',
        header: this.languageService.t('portal.myAccount.columns.paymentDate'),
        format: (value) => new Date(value as string).toLocaleDateString(),
      },
      {
        key: 'amount',
        header: this.languageService.t('portal.myAccount.columns.paymentAmount'),
        align: 'right',
        format: (value) => Number(value).toFixed(2),
      },
      {
        key: 'paymentMethod',
        header: this.languageService.t('portal.myAccount.columns.paymentMethod'),
        format: (value) => (value as string) || '—',
      },
    ];
  });

  protected readonly issueColumns = computed<TableColumn<PortalIssue>[]>(() => [
    {
      key: 'issueId',
      header: this.languageService.t('portal.myAccount.columns.issue'),
      format: (value) => String(value).padStart(5, '0'),
    },
    {
      key: 'issueDate',
      header: this.languageService.t('portal.myAccount.columns.issueDate'),
      format: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: 'total',
      header: this.languageService.t('portal.myAccount.columns.total'),
      align: 'right',
      format: (value) => Number(value).toFixed(2),
    },
  ]);

  protected readonly receivableActions = computed<TableAction<PortalAccountReceivable>[]>(() => [
    {
      label: this.languageService.t('portal.myAccount.actions.viewProducts'),
      icon: 'view',
      disabled: (row) => row.issueId == null,
      onClick: (row) => this.openIssueDetails(row.issueId),
    },
  ]);

  protected readonly paymentActions = computed<TableAction<PortalPayment>[]>(() => {
    const issueIdByReceivable = this.issueIdByReceivable();
    return [
      {
        label: this.languageService.t('portal.myAccount.actions.viewProducts'),
        icon: 'view',
        disabled: (row) => issueIdByReceivable[row.accountReceivableId] == null,
        onClick: (row) => this.openIssueDetails(issueIdByReceivable[row.accountReceivableId]),
      },
    ];
  });

  protected readonly issueActions = computed<TableAction<PortalIssue>[]>(() => [
    {
      label: this.languageService.t('portal.myAccount.actions.viewProducts'),
      icon: 'view',
      onClick: (row) => this.openIssueDetails(row.issueId),
    },
  ]);

  constructor() {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const [accountReceivables, payments, issues] = await Promise.all([
        this.portalService.getMyAccountReceivables(),
        this.portalService.getMyPayments(),
        this.portalService.getMyIssues(this.currentDateRange),
      ]);
      this.accountReceivables.set(accountReceivables);
      this.payments.set(payments);
      this.issues.set(issues);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected onDateRangeSearch(values: FilterValues): void {
    this.currentDateRange = { dateFrom: values['dateFrom'] ?? undefined, dateTo: values['dateTo'] ?? undefined };
    this.issuesPageNumber.set(1);
    void this.loadAll();
  }

  protected onDateRangeClear(): void {
    this.currentDateRange = {};
    this.issuesPageNumber.set(1);
    void this.loadAll();
  }

  protected onReceivablesFilterSearch(values: FilterValues): void {
    this.receivablesFilters.set(values);
    this.receivablesPageNumber.set(1);
  }

  protected onReceivablesFilterClear(): void {
    this.receivablesFilters.set({});
    this.receivablesPageNumber.set(1);
  }

  protected onPaymentsFilterSearch(values: FilterValues): void {
    this.paymentsFilters.set(values);
    this.paymentsPageNumber.set(1);
  }

  protected onPaymentsFilterClear(): void {
    this.paymentsFilters.set({});
    this.paymentsPageNumber.set(1);
  }

  protected onReceivablesPageChange(page: number): void {
    this.receivablesPageNumber.set(page);
  }

  protected onReceivablesPageSizeChange(size: number): void {
    this.receivablesPageSize.set(size);
    this.receivablesPageNumber.set(1);
  }

  protected onPaymentsPageChange(page: number): void {
    this.paymentsPageNumber.set(page);
  }

  protected onPaymentsPageSizeChange(size: number): void {
    this.paymentsPageSize.set(size);
    this.paymentsPageNumber.set(1);
  }

  protected onIssuesPageChange(page: number): void {
    this.issuesPageNumber.set(page);
  }

  protected onIssuesPageSizeChange(size: number): void {
    this.issuesPageSize.set(size);
    this.issuesPageNumber.set(1);
  }

  protected setActiveTab(tab: MyAccountTab): void {
    this.activeTab.set(tab);
  }

  protected openIssueDetails(issueId: number | null): void {
    if (issueId == null) {
      return;
    }
    this.dialogService.open<void, IssueDetailsDialogData, IssueDetailsDialog>(IssueDetailsDialog, {
      data: { issueId },
    });
  }
}
