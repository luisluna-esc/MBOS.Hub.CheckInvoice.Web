import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReportService } from '../../../reports/report.service';
import { AccountReceivable, AccountReceivableFilters } from '../account-receivable.models';
import { AccountReceivableService } from '../account-receivable.service';
import { RegisterPaymentDialog, RegisterPaymentDialogData } from '../register-payment-dialog/register-payment-dialog';

const MANAGE_CAPABLE_ROLES = ['Contador', 'Auxiliar Contador', 'M-BOS'];

@Component({
  selector: 'app-account-receivables-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './account-receivables-list.html',
})
export class AccountReceivablesList {
  private readonly accountReceivableService = inject(AccountReceivableService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<AccountReceivable[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly clients = signal<CatalogItem[]>([]);

  private currentFilters: AccountReceivableFilters = {};

  protected readonly canManage = computed(() => MANAGE_CAPABLE_ROLES.includes(this.authService.activeRole() ?? ''));

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'clientName',
      label: this.languageService.t('accountReceivables.filters.client'),
      type: 'text',
    },
    {
      key: 'status',
      label: this.languageService.t('accountReceivables.filters.status'),
      type: 'select',
      options: [
        { value: 'pending', label: this.languageService.t('accountReceivables.status.pending') },
        { value: 'paid', label: this.languageService.t('accountReceivables.status.paid') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<AccountReceivable>[]>(() => {
    const clientNames = this.nameMap(this.clients());

    return [
      {
        key: 'issueId',
        header: this.languageService.t('accountReceivables.columns.issue'),
        format: (value) => (value != null ? String(value).padStart(5, '0') : '—'),
      },
      {
        key: 'issueDate',
        header: this.languageService.t('accountReceivables.columns.issueDate'),
        format: (value) => (value ? new Date(value as string).toLocaleDateString() : '—'),
      },
      {
        key: 'clientId',
        header: this.languageService.t('accountReceivables.columns.client'),
        format: (value) => (value ? (clientNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'paymentType',
        header: this.languageService.t('accountReceivables.columns.paymentType'),
        format: (value) => {
          const translated = this.languageService.t(`accountReceivables.paymentTypes.${value}`);
          return translated === `accountReceivables.paymentTypes.${value}` ? String(value) : translated;
        },
      },
      {
        key: 'paymentDetail',
        header: this.languageService.t('accountReceivables.columns.paymentDetail'),
        format: (value) => (value as string) || '—',
      },
      {
        key: 'dueDate',
        header: this.languageService.t('accountReceivables.columns.dueDate'),
        format: (value) => (value ? new Date(value as string).toLocaleDateString() : '—'),
      },
      {
        key: 'totalAmount',
        header: this.languageService.t('accountReceivables.columns.total'),
        align: 'right',
        format: (value) => Number(value).toFixed(2),
      },
      {
        key: 'outstandingBalance',
        header: this.languageService.t('accountReceivables.columns.outstandingBalance'),
        align: 'right',
        format: (value) => Number(value).toFixed(2),
      },
      {
        key: 'status',
        header: this.languageService.t('accountReceivables.columns.status'),
        align: 'center',
        format: (value) => this.languageService.t(`accountReceivables.status.${value}`),
      },
    ];
  });

  protected readonly actions = computed<TableAction<AccountReceivable>[]>(() => [
    {
      label: this.languageService.t('accountReceivables.actions.viewDetails'),
      icon: 'view',
      onClick: (row) => void this.openDetails(row),
    },
    {
      label: this.languageService.t('accountReceivables.actions.registerPayment'),
      disabled: (row) => row.status === 'paid' || !this.canManage(),
      disabledReason: (row) => {
        if (!this.canManage()) {
          return this.languageService.t('accountReceivables.actions.readOnlyRole');
        }
        if (row.status === 'paid') {
          return this.languageService.t('accountReceivables.actions.alreadyPaid');
        }
        return null;
      },
      onClick: (row) => this.openRegisterPayment(row),
    },
  ]);

  constructor() {
    void this.loadCatalogs();
    void this.load();
  }

  private nameMap(items: CatalogItem[]): Record<number, string> {
    return Object.fromEntries(items.map((item) => [item.id, item.name]));
  }

  private async loadCatalogs(): Promise<void> {
    this.clients.set(await this.catalogService.getClients());
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.accountReceivableService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(values: FilterValues): void {
    this.currentFilters = {
      clientName: values['clientName'] || undefined,
      status: values['status'] ?? undefined,
    };
    this.pageNumber.set(1);
    void this.load();
  }

  protected onClear(): void {
    this.currentFilters = {};
    this.pageNumber.set(1);
    void this.load();
  }

  protected onPageChange(page: number): void {
    this.pageNumber.set(page);
    void this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    void this.load();
  }

  // Se abre la pestaña en blanco de forma síncrona al hacer clic, antes del fetch async del
  // PDF — así el navegador no la trata como un popup no solicitado y la bloquea.
  protected async openDetails(row: AccountReceivable): Promise<void> {
    const newTab = window.open('', '_blank');
    try {
      const blob = await this.reportService.getAccountReceivableVoucherPdfBlob(row.accountReceivableId);
      const url = URL.createObjectURL(blob);
      if (newTab) {
        newTab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch {
      newTab?.close();
      this.toastService.show(this.languageService.t('accountReceivables.detailError'));
    }
  }

  protected openRegisterPayment(row: AccountReceivable): void {
    const ref = this.dialogService.open<boolean, RegisterPaymentDialogData, RegisterPaymentDialog>(RegisterPaymentDialog, {
      data: { accountReceivableId: row.accountReceivableId, outstandingBalance: row.outstandingBalance },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.load();
      }
    });
  }
}
