import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientFormDialog, ClientFormDialogData } from '../client-form-dialog/client-form-dialog';
import { Client, ClientFilters } from '../client.models';
import { ClientService } from '../client.service';

@Component({
  selector: 'app-clients-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './clients-list.html',
})
export class ClientsList {
  private readonly clientService = inject(ClientService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<Client[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly districts = signal<CatalogItem[]>([]);

  private currentFilters: ClientFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('clients.filters.search'),
      type: 'text',
    },
    {
      key: 'districtId',
      label: this.languageService.t('clients.filters.district'),
      type: 'select',
      options: this.districts().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'isActive',
      label: this.languageService.t('clients.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('clients.filters.active') },
        { value: 'false', label: this.languageService.t('clients.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Client>[]>(() => [
    { key: 'taxId', header: this.languageService.t('clients.columns.taxId'), format: (value) => (value as string) || '—' },
    { key: 'name', header: this.languageService.t('clients.columns.name') },
    { key: 'email', header: this.languageService.t('clients.columns.email'), format: (value) => (value as string) || '—' },
    { key: 'mobilePhone', header: this.languageService.t('clients.columns.mobilePhone'), format: (value) => (value as string) || '—' },
    {
      key: 'isActive',
      header: this.languageService.t('clients.columns.status'),
      align: 'center',
      format: (value) =>
        value ? this.languageService.t('clients.filters.active') : this.languageService.t('clients.filters.inactive'),
    },
  ]);

  protected readonly actions = computed<TableAction<Client>[]>(() => [
    {
      label: this.languageService.t('clients.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('clients.actions.delete'),
      icon: 'delete',
      variant: 'danger',
      onClick: (row) => this.confirmDelete(row),
    },
  ]);

  constructor() {
    void this.loadCatalogs();
    void this.load();
  }

  private async loadCatalogs(): Promise<void> {
    this.districts.set(await this.catalogService.getDistricts());
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.clientService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      searchCriteria: values['searchCriteria'] ?? undefined,
      districtId: values['districtId'] ? Number(values['districtId']) : undefined,
      isActive: values['isActive'] ? values['isActive'] === 'true' : undefined,
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
    this.openForm(null);
  }

  protected openEdit(row: Client): void {
    this.openForm(row);
  }

  private openForm(client: Client | null): void {
    const ref = this.dialogService.open<number | null, ClientFormDialogData, ClientFormDialog>(ClientFormDialog, {
      data: { client },
    });
    ref.closed.subscribe((savedClientId) => {
      if (savedClientId) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: Client): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('clients.delete.title'),
        message: this.languageService.t('clients.delete.message', { name: row.name }),
        confirmLabel: this.languageService.t('clients.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteClient(row);
      }
    });
  }

  private async deleteClient(row: Client): Promise<void> {
    try {
      await this.clientService.delete(row.clientId);
      this.toastService.show(this.languageService.t('clients.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('clients.delete.error'));
    }
  }
}
