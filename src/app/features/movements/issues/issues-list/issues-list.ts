import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReportService } from '../../../reports/report.service';
import {
  IssueVoidRequestDialog,
  IssueVoidRequestDialogData,
} from '../../issue-void-requests/issue-void-request-dialog/issue-void-request-dialog';
import { IssueDetailsDialog, IssueDetailsDialogData } from '../issue-details-dialog/issue-details-dialog';
import { IssuePrintDialog, IssuePrintDialogResult } from '../issue-print-dialog/issue-print-dialog';
import { Issue, IssueFilters } from '../issue.models';
import { IssueService } from '../issue.service';

@Component({
  selector: 'app-issues-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './issues-list.html',
})
export class IssuesList {
  private readonly issueService = inject(IssueService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rows = signal<Issue[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly clients = signal<CatalogItem[]>([]);
  protected readonly issueTypes = signal<CatalogItem[]>([]);

  private currentFilters: IssueFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'warehouseId',
      label: this.languageService.t('issues.filters.warehouse'),
      type: 'select',
      options: this.warehouses().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'clientName',
      label: this.languageService.t('issues.filters.client'),
      type: 'text',
    },
    {
      key: 'issueTypeId',
      label: this.languageService.t('issues.filters.issueType'),
      type: 'select',
      options: this.issueTypes().map((item) => ({ value: String(item.id), label: item.name })),
    },
  ]);

  protected readonly columns = computed<TableColumn<Issue>[]>(() => {
    const clientNames = this.nameMap(this.clients());

    return [
      {
        key: 'issueId',
        header: this.languageService.t('issues.columns.rowNumber'),
        align: 'center',
        format: (_value, _row, index) => String((this.pageNumber() - 1) * this.pageSize() + index + 1),
      },
      {
        key: 'issueId',
        header: this.languageService.t('issues.columns.voucherNumber'),
        format: (value) => String(value).padStart(5, '0'),
      },
      {
        key: 'clientId',
        header: this.languageService.t('issues.columns.client'),
        format: (value) => (value ? (clientNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'isVoided',
        header: this.languageService.t('issues.columns.status'),
        align: 'center',
        format: (value, row) => {
          if (value) {
            return this.languageService.t('issues.columns.statusVoided');
          }
          if ((row as Issue).hasPendingVoidRequest) {
            return this.languageService.t('issues.columns.statusVoidPending');
          }
          return this.languageService.t('issues.columns.statusNormal');
        },
        tooltip: (_value, row) => {
          const issue = row as Issue;
          if (!issue.isVoided && !issue.hasPendingVoidRequest) {
            return null;
          }
          const reason = issue.voidReasonName ?? '—';
          const key = issue.isVoided ? 'issues.columns.statusVoidedTooltip' : 'issues.columns.statusVoidPendingTooltip';
          const base = this.languageService.t(key, { reason });
          return issue.voidDetail ? `${base} (${issue.voidDetail})` : base;
        },
      },
      {
        key: 'issueDate',
        header: this.languageService.t('issues.columns.issueDate'),
        format: (value) => new Date(value as string).toLocaleDateString(),
      },
      {
        key: 'createdAt',
        header: this.languageService.t('issues.columns.createdAt'),
        format: (value) => new Date(value as string).toLocaleString(),
      },
      {
        key: 'total',
        header: this.languageService.t('issues.columns.total'),
        align: 'right',
        format: (value) => (value != null ? Number(value).toFixed(2) : '—'),
      },
      {
        key: 'createdByFullName',
        header: this.languageService.t('issues.columns.createdBy'),
        format: (value) => (value as string) || '—',
      },
    ];
  });

  protected readonly actions = computed<TableAction<Issue>[]>(() => [
    {
      label: this.languageService.t('issues.actions.viewDetails'),
      icon: 'view',
      onClick: (row) => this.openDetails(row),
    },
    {
      label: this.languageService.t('issues.actions.print'),
      icon: 'print',
      onClick: (row) => void this.printVoucher(row),
    },
    {
      label: this.languageService.t('issues.actions.requestVoid'),
      icon: 'void',
      variant: 'danger',
      disabled: (row) => row.isVoided || row.hasPendingVoidRequest,
      disabledReason: (row) => {
        if (row.isVoided) {
          return this.languageService.t('issues.actions.requestVoidDisabledVoided');
        }
        if (row.hasPendingVoidRequest) {
          return this.languageService.t('issues.actions.requestVoidDisabledPending');
        }
        return null;
      },
      onClick: (row) => this.openVoidRequest(row),
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
    const [warehouses, clients, issueTypes] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getClients(),
      this.catalogService.getIssueTypes(),
    ]);
    this.warehouses.set(warehouses);
    this.clients.set(clients);
    this.issueTypes.set(issueTypes);
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.issueService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      warehouseId: values['warehouseId'] ? Number(values['warehouseId']) : undefined,
      clientName: values['clientName'] || undefined,
      issueTypeId: values['issueTypeId'] ? Number(values['issueTypeId']) : undefined,
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

  protected openCreate(): void {
    void this.router.navigate(['/issues/new']);
  }

  protected openDetails(row: Issue): void {
    this.dialogService.open<void, IssueDetailsDialogData, IssueDetailsDialog>(IssueDetailsDialog, {
      data: { issueId: row.issueId },
    });
  }

  // Al reimprimir desde la lista (a diferencia del formulario de creación, que ya tiene su
  // propio selector de Tipo de Impresión) no hay un formulario visible donde elegir el
  // formato, así que se pregunta con un diálogo — permite reimprimir una Salida guardada
  // en "Impresion Hoja" con el formato "Impresion Rollo" si el cliente lo pide después.
  protected printVoucher(row: Issue): void {
    const ref = this.dialogService.open<IssuePrintDialogResult | null, undefined, IssuePrintDialog>(IssuePrintDialog);
    ref.closed.subscribe((result) => {
      if (result) {
        void this.generateVoucher(row, result.printTypeId, result.newTab);
      }
    });
  }

  private async generateVoucher(row: Issue, printTypeId: number, newTab: Window | null): Promise<void> {
    try {
      const blob = await this.reportService.getIssueVoucherPdfBlob(row.issueId, printTypeId);
      const url = URL.createObjectURL(blob);
      if (newTab) {
        newTab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch {
      newTab?.close();
      this.toastService.show(this.languageService.t('issues.printError'));
    }
  }

  protected openVoidRequest(row: Issue): void {
    const ref = this.dialogService.open<boolean, IssueVoidRequestDialogData, IssueVoidRequestDialog>(
      IssueVoidRequestDialog,
      { data: { issueId: row.issueId } }
    );
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.load();
      }
    });
  }
}
