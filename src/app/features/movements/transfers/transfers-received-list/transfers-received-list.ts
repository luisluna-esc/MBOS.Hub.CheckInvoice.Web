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
import { AuthorizationDialog, AuthorizationDialogData } from '../../../../shared/components/authorization-dialog/authorization-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TransferDetailsDialog, TransferDetailsDialogData } from '../transfer-details-dialog/transfer-details-dialog';
import { Transfer, TransferFilters } from '../transfer.models';
import { TransferService } from '../transfer.service';

@Component({
  selector: 'app-transfers-received-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './transfers-received-list.html',
})
export class TransfersReceivedList {
  private readonly transferService = inject(TransferService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rows = signal<Transfer[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly warehouses = signal<CatalogItem[]>([]);

  private currentFilters: TransferFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'destinationWarehouseId',
      label: this.languageService.t('transfers.filters.destinationWarehouse'),
      type: 'select',
      options: this.warehouses().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'isApproved',
      label: this.languageService.t('transfers.filters.status'),
      type: 'select',
      options: [
        { value: 'false', label: this.languageService.t('transfers.columns.statusPending') },
        { value: 'true', label: this.languageService.t('transfers.columns.statusApproved') },
      ],
    },
    {
      key: 'dateFrom',
      label: this.languageService.t('transfers.filters.dateFrom'),
      type: 'date',
    },
    {
      key: 'dateTo',
      label: this.languageService.t('transfers.filters.dateTo'),
      type: 'date',
    },
  ]);

  protected readonly columns = computed<TableColumn<Transfer>[]>(() => {
    const warehouseNames = this.nameMap(this.warehouses());

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
        key: 'notes',
        header: this.languageService.t('transfers.receiveForm.sender'),
        format: (value) => (value as string) || '—',
      },
      {
        key: 'transferDate',
        header: this.languageService.t('transfers.columns.transferDate'),
        format: (value) => new Date(value as string).toLocaleString(),
      },
      {
        key: 'isApproved',
        header: this.languageService.t('transfers.columns.status'),
        align: 'center',
        format: (value) =>
          value
            ? this.languageService.t('transfers.columns.statusApproved')
            : this.languageService.t('transfers.columns.statusPending'),
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
      label: this.languageService.t('transfers.actions.approve'),
      icon: 'verified',
      disabled: (row) => row.isApproved,
      onClick: (row) => this.approve(row),
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
    const [warehouses] = await settleCatalogs([this.catalogService.getWarehouses()]);
    this.warehouses.set(warehouses);
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const receiverUserId = this.authService.session()?.appUserId;
      const result = await this.transferService.list(this.pageNumber(), this.pageSize(), {
        ...this.currentFilters,
        receiverUserId,
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
      destinationWarehouseId: values['destinationWarehouseId'] ? Number(values['destinationWarehouseId']) : undefined,
      isApproved: values['isApproved'] === 'true' ? true : values['isApproved'] === 'false' ? false : undefined,
      dateFrom: values['dateFrom'] ?? undefined,
      dateTo: values['dateTo'] ?? undefined,
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
    void this.router.navigate(['/transfers/received/new']);
  }

  protected openDetails(row: Transfer): void {
    this.dialogService.open<void, TransferDetailsDialogData, TransferDetailsDialog>(TransferDetailsDialog, {
      data: { transferId: row.transferId, isApproved: row.isApproved },
    });
  }

  protected approve(row: Transfer): void {
    if (row.isApproved) {
      return;
    }
    const ref = this.dialogService.open<boolean, AuthorizationDialogData, AuthorizationDialog>(AuthorizationDialog, {
      data: {
        title: this.languageService.t('transfers.actions.approveConfirmTitle'),
        message: this.languageService.t('transfers.actions.approveConfirmMessage'),
        confirmLabel: this.languageService.t('transfers.actions.approve'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.doApprove(row);
      }
    });
  }

  private async doApprove(row: Transfer): Promise<void> {
    try {
      await this.transferService.approve(row.transferId);
      this.toastService.show(this.languageService.t('transfers.actions.approveSuccess'));
      void this.load();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('transfers.actions.approveError'), message);
    }
  }
}
