import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
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
import { TransferDetailsDialog, TransferDetailsDialogData } from '../transfer-details-dialog/transfer-details-dialog';
import { Transfer, TransferFilters } from '../transfer.models';
import { TransferService } from '../transfer.service';

@Component({
  selector: 'app-transfers-sent-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './transfers-sent-list.html',
})
export class TransfersSentList {
  private readonly transferService = inject(TransferService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rows = signal<Transfer[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly clients = signal<CatalogItem[]>([]);

  private currentFilters: TransferFilters = {};
  private readonly todayIso = new Date().toISOString().slice(0, 10);

  // Ninguna transferencia tiene el mismo almacén de origen y destino: en vez de dejar elegir
  // el mismo y luego avisar, se excluye directamente del otro select — así nunca se puede
  // llegar a ese estado y no hace falta ningún mensaje de validación.
  private readonly selectedSourceId = signal<number | null>(null);
  private readonly selectedDestId = signal<number | null>(null);

  protected readonly filterFields = computed<FilterField[]>(() => {
    const allOptions = this.warehouses().map((item) => ({ value: String(item.id), label: item.name }));
    const destId = this.selectedDestId();
    const sourceId = this.selectedSourceId();

    return [
      {
        key: 'sourceWarehouseId',
        label: this.languageService.t('transfers.filters.sourceWarehouse'),
        type: 'select',
        placeholder: this.languageService.t('transfers.filters.allWarehouses'),
        options: destId === null ? allOptions : allOptions.filter((o) => Number(o.value) !== destId),
      },
      {
        key: 'destinationWarehouseId',
        label: this.languageService.t('transfers.filters.destinationWarehouse'),
        type: 'select',
        placeholder: this.languageService.t('transfers.filters.allWarehouses'),
        options: sourceId === null ? allOptions : allOptions.filter((o) => Number(o.value) !== sourceId),
      },
      {
        key: 'dateFrom',
        label: this.languageService.t('transfers.filters.dateFrom'),
        type: 'date',
        max: this.todayIso,
      },
      {
        key: 'dateTo',
        label: this.languageService.t('transfers.filters.dateTo'),
        type: 'date',
        max: this.todayIso,
      },
    ];
  });

  protected readonly columns = computed<TableColumn<Transfer>[]>(() => {
    const warehouseNames = this.nameMap(this.warehouses());
    const clientNames = this.nameMap(this.clients());

    return [
      {
        key: 'transferId',
        header: this.languageService.t('transfers.columns.rowNumber'),
        align: 'center',
        format: (_value, _row, index) => String((this.pageNumber() - 1) * this.pageSize() + index + 1),
      },
      {
        key: 'transferId',
        header: this.languageService.t('transfers.columns.voucherNumber'),
        format: (value) => String(value).padStart(5, '0'),
      },
      {
        key: 'destinationWarehouseId',
        header: this.languageService.t('transfers.columns.destinationWarehouse'),
        format: (value) => (value ? (warehouseNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'receiverClientId',
        header: this.languageService.t('transfers.columns.receiver'),
        format: (value) => (value ? (clientNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'transferDate',
        header: this.languageService.t('transfers.columns.transferDate'),
        format: (value) => new Date(value as string).toLocaleString(),
      },
      {
        key: 'notes',
        header: this.languageService.t('transfers.columns.notes'),
        format: (value) => (value as string) || '—',
      },
    ];
  });

  protected readonly actions = computed<TableAction<Transfer>[]>(() => [
    {
      label: this.languageService.t('transfers.actions.viewDetails'),
      icon: 'view',
      onClick: (row) => this.openDetails(row),
    },
    {
      label: this.languageService.t('transfers.actions.print'),
      icon: 'print',
      onClick: (row) => void this.printVoucher(row),
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
    const [warehouses, clients] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getClients(),
    ]);
    this.warehouses.set(warehouses);
    this.clients.set(clients);
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const senderUserId = this.authService.session()?.appUserId;
      const result = await this.transferService.list(this.pageNumber(), this.pageSize(), {
        ...this.currentFilters,
        senderUserId,
      });
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
      sourceWarehouseId: values['sourceWarehouseId'] ? Number(values['sourceWarehouseId']) : undefined,
      destinationWarehouseId: values['destinationWarehouseId'] ? Number(values['destinationWarehouseId']) : undefined,
      dateFrom: values['dateFrom'] ?? undefined,
      dateTo: values['dateTo'] ?? undefined,
    };
    this.selectedSourceId.set(this.currentFilters.sourceWarehouseId ?? null);
    this.selectedDestId.set(this.currentFilters.destinationWarehouseId ?? null);
    this.pageNumber.set(1);
    void this.load();
  }

  protected onClear(): void {
    this.currentFilters = {};
    this.selectedSourceId.set(null);
    this.selectedDestId.set(null);
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
    void this.router.navigate(['/transfers/new']);
  }

  protected openDetails(row: Transfer): void {
    this.dialogService.open<void, TransferDetailsDialogData, TransferDetailsDialog>(TransferDetailsDialog, {
      data: { transferId: row.transferId },
    });
  }

  // Se abre la pestaña en blanco de forma síncrona al hacer clic, antes del fetch async del
  // PDF — así el navegador no la trata como un popup no solicitado y la bloquea.
  protected async printVoucher(row: Transfer): Promise<void> {
    const newTab = window.open('', '_blank');
    try {
      const blob = await this.reportService.getTransferVoucherPdfBlob(row.transferId);
      const url = URL.createObjectURL(blob);
      if (newTab) {
        newTab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch {
      newTab?.close();
      this.toastService.show(this.languageService.t('transfers.printError'));
    }
  }
}
