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
import { ChurchFormDialog, ChurchFormDialogData } from '../church-form-dialog/church-form-dialog';
import { Church, ChurchFilters } from '../church.models';
import { ChurchService } from '../church.service';

@Component({
  selector: 'app-churches-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './churches-list.html',
})
export class ChurchesList {
  private readonly churchService = inject(ChurchService);
  private readonly catalogService = inject(CatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<Church[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly districts = signal<CatalogItem[]>([]);
  protected readonly churchTypes = signal<CatalogItem[]>([]);

  private currentFilters: ChurchFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('churches.filters.search'),
      type: 'text',
    },
    {
      key: 'districtId',
      label: this.languageService.t('churches.filters.district'),
      type: 'select',
      options: this.districts().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'churchTypeId',
      label: this.languageService.t('churches.filters.type'),
      type: 'select',
      options: this.churchTypes().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'isActive',
      label: this.languageService.t('churches.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('churches.filters.active') },
        { value: 'false', label: this.languageService.t('churches.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Church>[]>(() => {
    const districtNames = this.nameMap(this.districts());
    const churchTypeNames = this.nameMap(this.churchTypes());

    return [
      { key: 'code', header: this.languageService.t('churches.columns.code'), format: (value) => (value as string) || '—' },
      { key: 'churchName', header: this.languageService.t('churches.columns.name') },
      {
        key: 'districtId',
        header: this.languageService.t('churches.columns.district'),
        format: (value) => (value ? (districtNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'churchTypeId',
        header: this.languageService.t('churches.columns.type'),
        format: (value) => (value ? (churchTypeNames[value as number] ?? String(value)) : '—'),
      },
      {
        key: 'isActive',
        header: this.languageService.t('churches.columns.status'),
        align: 'center',
        format: (value) =>
          value
            ? this.languageService.t('churches.filters.active')
            : this.languageService.t('churches.filters.inactive'),
      },
    ];
  });

  private nameMap(items: CatalogItem[]): Record<number, string> {
    return Object.fromEntries(items.map((item) => [item.id, item.name]));
  }

  protected readonly actions = computed<TableAction<Church>[]>(() => [
    {
      label: this.languageService.t('churches.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('churches.actions.delete'),
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
    const [districts, churchTypes] = await settleCatalogs([
      this.catalogService.getDistricts(),
      this.catalogService.getChurchTypes(),
    ]);
    this.districts.set(districts);
    this.churchTypes.set(churchTypes);
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.churchService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      churchTypeId: values['churchTypeId'] ? Number(values['churchTypeId']) : undefined,
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

  protected openEdit(row: Church): void {
    this.openForm(row);
  }

  private openForm(church: Church | null): void {
    const ref = this.dialogService.open<boolean, ChurchFormDialogData, ChurchFormDialog>(ChurchFormDialog, {
      data: { church },
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: Church): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('churches.delete.title'),
        message: this.languageService.t('churches.delete.message', { name: row.churchName }),
        confirmLabel: this.languageService.t('churches.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteChurch(row);
      }
    });
  }

  private async deleteChurch(row: Church): Promise<void> {
    try {
      await this.churchService.delete(row.churchId);
      this.toastService.show(this.languageService.t('churches.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('churches.delete.error'));
    }
  }
}
