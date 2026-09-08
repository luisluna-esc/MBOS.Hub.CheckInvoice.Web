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
  ReceiptVoidRequestDialog,
  ReceiptVoidRequestDialogData,
} from '../../receipt-void-requests/receipt-void-request-dialog/receipt-void-request-dialog';
import { ReceiptDetailsDialog, ReceiptDetailsDialogData } from '../receipt-details-dialog/receipt-details-dialog';
import { Receipt, ReceiptFilters } from '../receipt.models';
import { ReceiptService } from '../receipt.service';

@Component({
  selector: 'app-receipts-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './receipts-list.html',
})
export class ReceiptsList {
  private readonly receiptService = inject(ReceiptService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rows = signal<Receipt[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly suppliers = signal<CatalogItem[]>([]);
  protected readonly receiptTypes = signal<CatalogItem[]>([]);

  private currentFilters: ReceiptFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'warehouseId',
      label: this.languageService.t('receipts.filters.warehouse'),
      type: 'select',
      options: this.warehouses().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'supplierId',
      label: this.languageService.t('receipts.filters.supplier'),
      type: 'select',
      options: this.suppliers().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'receiptTypeId',
      label: this.languageService.t('receipts.filters.receiptType'),
      type: 'select',
      options: this.receiptTypes().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'invoiceNumber',
      label: this.languageService.t('receipts.filters.invoiceNumber'),
      type: 'text',
    },
  ]);

  protected readonly columns = computed<TableColumn<Receipt>[]>(() => {
    const supplierNames = this.nameMap(this.suppliers());

    return [
      {
        key: 'receiptId',
        header: this.languageService.t('receipts.columns.rowNumber'),
        align: 'center',
        format: (_value, _row, index) => String((this.pageNumber() - 1) * this.pageSize() + index + 1),
      },
      {
        key: 'receiptId',
        header: this.languageService.t('receipts.columns.voucherNumber'),
        format: (value) => String(value).padStart(5, '0'),
      },
      {
        key: 'supplierId',
        header: this.languageService.t('receipts.columns.supplier'),
        format: (value) => (value ? (supplierNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'isVoided',
        header: this.languageService.t('receipts.columns.status'),
        align: 'center',
        format: (value, row) => {
          if (value) {
            return this.languageService.t('receipts.columns.statusVoided');
          }
          if ((row as Receipt).hasPendingVoidRequest) {
            return this.languageService.t('receipts.columns.statusVoidPending');
          }
          if ((row as Receipt).hasPendingChangeRequest) {
            return this.languageService.t('receipts.columns.statusPending');
          }
          return this.languageService.t('receipts.columns.statusNormal');
        },
        tooltip: (_value, row) => {
          const receipt = row as Receipt;
          if (!receipt.isVoided && !receipt.hasPendingVoidRequest) {
            return null;
          }
          const reason = receipt.voidReasonName ?? '—';
          const key = receipt.isVoided ? 'receipts.columns.statusVoidedTooltip' : 'receipts.columns.statusVoidPendingTooltip';
          const base = this.languageService.t(key, { reason });
          return receipt.voidDetail ? `${base} (${receipt.voidDetail})` : base;
        },
      },
      { key: 'invoiceNumber', header: this.languageService.t('receipts.columns.invoiceNumber'), format: (value) => (value as string) || '—' },
      {
        key: 'issueDate',
        header: this.languageService.t('receipts.columns.issueDate'),
        format: (value) => new Date(value as string).toLocaleDateString(),
      },
      {
        key: 'createdAt',
        header: this.languageService.t('receipts.columns.createdAt'),
        format: (value) => new Date(value as string).toLocaleString(),
      },
      {
        key: 'invoiceTotal',
        header: this.languageService.t('receipts.columns.invoiceTotal'),
        align: 'right',
        format: (value) => (value != null ? Number(value).toFixed(2) : '—'),
      },
      {
        key: 'createdByFullName',
        header: this.languageService.t('receipts.columns.createdBy'),
        format: (value) => (value as string) || '—',
      },
    ];
  });

  protected readonly actions = computed<TableAction<Receipt>[]>(() => [
    {
      label: this.languageService.t('receipts.actions.viewDetails'),
      icon: 'view',
      onClick: (row) => this.openDetails(row),
    },
    {
      label: this.languageService.t('receipts.actions.print'),
      icon: 'print',
      onClick: (row) => void this.printVoucher(row),
    },
    {
      label: this.languageService.t('receipts.actions.requestVoid'),
      icon: 'void',
      variant: 'danger',
      disabled: (row) => row.isVoided || row.hasPendingVoidRequest,
      disabledReason: (row) => {
        if (row.isVoided) {
          return this.languageService.t('receipts.actions.requestVoidDisabledVoided');
        }
        if (row.hasPendingVoidRequest) {
          return this.languageService.t('receipts.actions.requestVoidDisabledPending');
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
    const [warehouses, suppliers, receiptTypes] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getSuppliers(),
      this.catalogService.getReceiptTypes(),
    ]);
    this.warehouses.set(warehouses);
    this.suppliers.set(suppliers);
    this.receiptTypes.set(receiptTypes);
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.receiptService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      supplierId: values['supplierId'] ? Number(values['supplierId']) : undefined,
      receiptTypeId: values['receiptTypeId'] ? Number(values['receiptTypeId']) : undefined,
      invoiceNumber: values['invoiceNumber'] ?? undefined,
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
    void this.router.navigate(['/receipts/new']);
  }

  protected openDetails(row: Receipt): void {
    this.dialogService.open<void, ReceiptDetailsDialogData, ReceiptDetailsDialog>(ReceiptDetailsDialog, {
      data: { receiptId: row.receiptId },
    });
  }

  // Se abre la pestaña en blanco de forma síncrona al hacer clic, antes del fetch async del
  // PDF — así el navegador no la trata como un popup no solicitado y la bloquea.
  protected async printVoucher(row: Receipt): Promise<void> {
    const newTab = window.open('', '_blank');
    try {
      const blob = await this.reportService.getReceiptVoucherPdfBlob(row.receiptId);
      const url = URL.createObjectURL(blob);
      if (newTab) {
        newTab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch {
      newTab?.close();
      this.toastService.show(this.languageService.t('receipts.printError'));
    }
  }

  protected openVoidRequest(row: Receipt): void {
    const ref = this.dialogService.open<boolean, ReceiptVoidRequestDialogData, ReceiptVoidRequestDialog>(
      ReceiptVoidRequestDialog,
      { data: { receiptId: row.receiptId } }
    );
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.load();
      }
    });
  }
}
