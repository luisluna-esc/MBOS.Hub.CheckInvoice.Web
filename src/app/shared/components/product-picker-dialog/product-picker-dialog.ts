import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { Product, ProductFilters } from '../../../features/catalogs/products/product.models';
import { ProductService } from '../../../features/catalogs/products/product.service';
import { Dialog } from '../dialog/dialog';
import { ErrorState } from '../error-state/error-state';
import { FilterField, Filters, FilterValues } from '../filters/filters';
import { SelectableTable } from '../selectable-table/selectable-table';
import { TableColumn } from '../table/table';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface ProductPickerResult {
  productId: number;
  name: string;
  code: string | null;
  departmentId: number | null;
  mediaTypeId: number | null;
}

export interface ProductPickerData {
  warehouseId?: number | null;
  /** Productos que ya están en otra línea del documento: se muestran pero no se pueden elegir. */
  excludedProductIds?: number[];
}

@Component({
  selector: 'app-product-picker-dialog',
  imports: [Dialog, Filters, SelectableTable, ErrorState, TranslatePipe],
  templateUrl: './product-picker-dialog.html',
})
export class ProductPickerDialog {
  private readonly dialogRef = inject(DialogRef<ProductPickerResult | null, ProductPickerDialog>);
  private readonly data = inject<ProductPickerData | null>(DIALOG_DATA, { optional: true });
  private readonly productService = inject(ProductService);
  private readonly languageService = inject(LanguageService);

  private readonly warehouseId = this.data?.warehouseId ?? undefined;
  private readonly excludedProductIds = new Set(this.data?.excludedProductIds ?? []);
  private readonly alreadyAddedLabel = this.languageService.t('productPicker.alreadyAdded');

  protected readonly isExcluded = (row: Product): boolean => this.excludedProductIds.has(row.productId);
  protected readonly excludedReason = (row: Product): string | null => (this.isExcluded(row) ? this.alreadyAddedLabel : null);

  protected readonly rows = signal<Product[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: ProductFilters = { warehouseId: this.warehouseId };

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('productPicker.filters.name'),
      type: 'text',
    },
    {
      key: 'code',
      label: this.languageService.t('productPicker.filters.code'),
      type: 'text',
    },
  ]);

  protected readonly columns = computed<TableColumn<Product>[]>(() => [
    { key: 'code', header: this.languageService.t('productPicker.columns.code'), format: (value) => (value as string) || '—' },
    {
      key: 'name',
      header: this.languageService.t('productPicker.columns.name'),
      // El motivo va también en el texto (no solo en el title): en el celular no hay hover.
      format: (value, row) => (this.isExcluded(row) ? `${value} (${this.alreadyAddedLabel})` : String(value)),
    },
  ]);

  constructor() {
    void this.load();
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
      code: values['code'] ?? undefined,
      warehouseId: this.warehouseId,
    };
    this.pageNumber.set(1);
    void this.load();
  }

  protected onClear(): void {
    this.currentFilters = { warehouseId: this.warehouseId };
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

  protected onRowSelected(row: Product): void {
    if (this.isExcluded(row)) {
      return;
    }
    this.dialogRef.close({
      productId: row.productId,
      name: row.name,
      code: row.code,
      departmentId: row.departmentId,
      mediaTypeId: row.mediaTypeId,
    });
  }

  protected close(): void {
    this.dialogRef.close(null);
  }
}
