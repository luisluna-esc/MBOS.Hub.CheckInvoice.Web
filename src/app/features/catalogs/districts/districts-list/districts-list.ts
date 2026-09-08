import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DistrictFormDialog, DistrictFormDialogData } from '../district-form-dialog/district-form-dialog';
import { District, DistrictFilters } from '../district.models';
import { DistrictService } from '../district.service';

@Component({
  selector: 'app-districts-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './districts-list.html',
})
export class DistrictsList {
  private readonly districtService = inject(DistrictService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<District[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: DistrictFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('districts.filters.search'),
      type: 'text',
    },
    {
      key: 'isActive',
      label: this.languageService.t('districts.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('districts.filters.active') },
        { value: 'false', label: this.languageService.t('districts.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<District>[]>(() => [
    { key: 'code', header: this.languageService.t('districts.columns.code'), format: (value) => (value as string) || '—' },
    { key: 'districtName', header: this.languageService.t('districts.columns.name') },
    {
      key: 'isActive',
      header: this.languageService.t('districts.columns.status'),
      align: 'center',
      format: (value) =>
        value
          ? this.languageService.t('districts.filters.active')
          : this.languageService.t('districts.filters.inactive'),
    },
  ]);

  protected readonly actions = computed<TableAction<District>[]>(() => [
    {
      label: this.languageService.t('districts.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('districts.actions.delete'),
      icon: 'delete',
      variant: 'danger',
      onClick: (row) => this.confirmDelete(row),
    },
  ]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.districtService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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

  protected openEdit(row: District): void {
    this.openForm(row);
  }

  private openForm(district: District | null): void {
    const ref = this.dialogService.open<boolean, DistrictFormDialogData, DistrictFormDialog>(DistrictFormDialog, {
      data: { district },
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: District): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('districts.delete.title'),
        message: this.languageService.t('districts.delete.message', { name: row.districtName }),
        confirmLabel: this.languageService.t('districts.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteDistrict(row);
      }
    });
  }

  private async deleteDistrict(row: District): Promise<void> {
    try {
      await this.districtService.delete(row.districtId);
      this.toastService.show(this.languageService.t('districts.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('districts.delete.error'));
    }
  }
}
