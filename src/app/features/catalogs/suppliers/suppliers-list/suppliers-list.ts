import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupplierFormDialog, SupplierFormDialogData } from '../supplier-form-dialog/supplier-form-dialog';
import { Supplier, SupplierFilters } from '../supplier.models';
import { SupplierService } from '../supplier.service';

@Component({
  selector: 'app-suppliers-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './suppliers-list.html',
})
export class SuppliersList {
  private readonly supplierService = inject(SupplierService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<Supplier[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly countries = signal<CatalogItem[]>([]);

  private currentFilters: SupplierFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('suppliers.filters.search'),
      type: 'text',
    },
    {
      key: 'countryId',
      label: this.languageService.t('suppliers.filters.country'),
      type: 'select',
      options: this.countries().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'isActive',
      label: this.languageService.t('suppliers.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('suppliers.filters.active') },
        { value: 'false', label: this.languageService.t('suppliers.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Supplier>[]>(() => {
    const countryNames = this.nameMap(this.countries());

    return [
      { key: 'code', header: this.languageService.t('suppliers.columns.code'), format: (value) => (value as string) || '—' },
      { key: 'legalName', header: this.languageService.t('suppliers.columns.legalName'), format: (value) => (value as string) || '—' },
      { key: 'taxId', header: this.languageService.t('suppliers.columns.taxId'), format: (value) => (value as string) || '—' },
      {
        key: 'countryId',
        header: this.languageService.t('suppliers.columns.country'),
        format: (value) => (value ? (countryNames[value as number] ?? String(value)) : '—'),
      },
      { key: 'phone', header: this.languageService.t('suppliers.columns.phone'), format: (value) => (value as string) || '—' },
      { key: 'email', header: this.languageService.t('suppliers.columns.email'), format: (value) => (value as string) || '—' },
      {
        key: 'isActive',
        header: this.languageService.t('suppliers.columns.status'),
        align: 'center',
        format: (value) =>
          value
            ? this.languageService.t('suppliers.filters.active')
            : this.languageService.t('suppliers.filters.inactive'),
      },
    ];
  });

  private nameMap(items: CatalogItem[]): Record<number, string> {
    return Object.fromEntries(items.map((item) => [item.id, item.name]));
  }

  protected readonly actions = computed<TableAction<Supplier>[]>(() => [
    {
      label: this.languageService.t('suppliers.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('suppliers.actions.delete'),
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
    this.countries.set(await this.catalogService.getCountries());
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.supplierService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      countryId: values['countryId'] ? Number(values['countryId']) : undefined,
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

  protected openEdit(row: Supplier): void {
    this.openForm(row);
  }

  private openForm(supplier: Supplier | null): void {
    const ref = this.dialogService.open<number | null, SupplierFormDialogData, SupplierFormDialog>(SupplierFormDialog, {
      data: { supplier },
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: Supplier): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('suppliers.delete.title'),
        message: this.languageService.t('suppliers.delete.message', { name: row.name }),
        confirmLabel: this.languageService.t('suppliers.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteSupplier(row);
      }
    });
  }

  private async deleteSupplier(row: Supplier): Promise<void> {
    try {
      await this.supplierService.delete(row.supplierId);
      this.toastService.show(this.languageService.t('suppliers.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('suppliers.delete.error'));
    }
  }
}
