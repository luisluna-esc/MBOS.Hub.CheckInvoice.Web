import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { SupplierFormDialog, SupplierFormDialogData } from '../../../catalogs/suppliers/supplier-form-dialog/supplier-form-dialog';
import { Supplier, SupplierFilters } from '../../../catalogs/suppliers/supplier.models';
import { SupplierService } from '../../../catalogs/suppliers/supplier.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { SelectableTable } from '../../../../shared/components/selectable-table/selectable-table';
import { TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-receipt-supplier-picker',
  imports: [Filters, SelectableTable, ErrorState, TranslatePipe],
  templateUrl: './receipt-supplier-picker.html',
})
export class ReceiptSupplierPicker {
  private readonly supplierService = inject(SupplierService);
  private readonly languageService = inject(LanguageService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly rows = signal<Supplier[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);

  private currentFilters: SupplierFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('receipts.supplierPicker.search'),
      type: 'text',
    },
  ]);

  protected readonly columns = computed<TableColumn<Supplier>[]>(() => [
    { key: 'taxId', header: this.languageService.t('receipts.supplierPicker.taxId'), format: (value) => (value as string) || '—' },
    {
      key: 'legalName',
      header: this.languageService.t('receipts.supplierPicker.fullName'),
      format: (value, row) => (value as string) || row.name,
    },
  ]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    try {
      const result = await this.supplierService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    }
  }

  protected onSearch(values: FilterValues): void {
    this.currentFilters = {
      searchCriteria: values['searchCriteria'] ?? undefined,
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

  protected onCancel(): void {
    void this.router.navigate(['/receipts']);
  }

  protected createSupplier(): void {
    const ref = this.dialogService.open<number | null, SupplierFormDialogData, SupplierFormDialog>(
      SupplierFormDialog,
      { data: { supplier: null } }
    );
    ref.closed.subscribe((supplierId) => {
      if (supplierId) {
        void this.router.navigate(['/receipts/new/details'], { state: { supplierId } });
      }
    });
  }

  protected selectSupplier(row: Supplier): void {
    void this.router.navigate(['/receipts/new/details'], { state: { supplierId: row.supplierId } });
  }
}
