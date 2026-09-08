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
import { ProductFormDialog, ProductFormDialogData } from '../product-form-dialog/product-form-dialog';
import { Product, ProductFilters } from '../product.models';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-products-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './products-list.html',
})
export class ProductsList {
  private readonly productService = inject(ProductService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<Product[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly departments = signal<CatalogItem[]>([]);

  private currentFilters: ProductFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('products.filters.search'),
      type: 'text',
    },
    {
      key: 'departmentId',
      label: this.languageService.t('products.filters.department'),
      type: 'select',
      options: this.departments().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'isActive',
      label: this.languageService.t('products.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('products.filters.active') },
        { value: 'false', label: this.languageService.t('products.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Product>[]>(() => {
    const departmentNames = this.nameMap(this.departments());

    return [
      { key: 'code', header: this.languageService.t('products.columns.code'), format: (value) => (value as string) || '—' },
      { key: 'name', header: this.languageService.t('products.columns.name') },
      {
        key: 'departmentId',
        header: this.languageService.t('products.columns.department'),
        format: (value) => (value ? (departmentNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'price',
        header: this.languageService.t('products.columns.price'),
        align: 'right',
        format: (value) => (value != null ? Number(value).toFixed(2) : '—'),
      },
      {
        key: 'isActive',
        header: this.languageService.t('products.columns.status'),
        align: 'center',
        format: (value) =>
          value
            ? this.languageService.t('products.filters.active')
            : this.languageService.t('products.filters.inactive'),
      },
    ];
  });

  protected readonly actions = computed<TableAction<Product>[]>(() => [
    {
      label: this.languageService.t('products.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('products.actions.delete'),
      icon: 'delete',
      variant: 'danger',
      onClick: (row) => this.confirmDelete(row),
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
    this.departments.set(await this.catalogService.getDepartments());
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.productService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      departmentId: values['departmentId'] ? Number(values['departmentId']) : undefined,
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

  protected openEdit(row: Product): void {
    this.openForm(row);
  }

  private openForm(product: Product | null): void {
    const ref = this.dialogService.open<boolean, ProductFormDialogData, ProductFormDialog>(ProductFormDialog, {
      data: { product },
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: Product): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('products.delete.title'),
        message: this.languageService.t('products.delete.message', { name: row.name }),
        confirmLabel: this.languageService.t('products.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteProduct(row);
      }
    });
  }

  private async deleteProduct(row: Product): Promise<void> {
    try {
      await this.productService.delete(row.productId);
      this.toastService.show(this.languageService.t('products.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('products.delete.error'));
    }
  }
}
