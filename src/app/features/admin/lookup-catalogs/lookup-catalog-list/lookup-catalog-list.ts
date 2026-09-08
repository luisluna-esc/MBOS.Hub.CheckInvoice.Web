import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  LookupCatalogFormDialog,
  LookupCatalogFormDialogData,
} from '../lookup-catalog-form-dialog/lookup-catalog-form-dialog';
import { LOOKUP_CATALOG_CONFIGS } from '../lookup-catalog.config';
import { LookupCatalogItem } from '../lookup-catalog.models';
import { LookupCatalogService } from '../lookup-catalog.service';

@Component({
  selector: 'app-lookup-catalog-list',
  imports: [Table, ErrorState, TranslatePipe],
  templateUrl: './lookup-catalog-list.html',
})
export class LookupCatalogList {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogService = inject(LookupCatalogService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  // Una sola ruta parametrizada (admin/lookup/:slug) sirve las 14 tablas — por eso esto
  // reacciona al paramMap en vez de leer snapshot una sola vez: Angular reutiliza esta
  // misma instancia del componente al navegar de un catálogo a otro.
  protected readonly config = toSignal(
    this.route.paramMap.pipe(map((params) => LOOKUP_CATALOG_CONFIGS[params.get('slug') ?? ''])),
    { requireSync: true }
  );

  protected readonly rows = signal<LookupCatalogItem[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  protected readonly columns = computed<TableColumn<LookupCatalogItem>[]>(() => {
    const config = this.config();
    const columns: TableColumn<LookupCatalogItem>[] = [];
    if (config?.hasCode) {
      columns.push({ key: 'code', header: this.languageService.t('lookupCatalogs.columns.code') });
    }
    columns.push({ key: 'name', header: this.languageService.t('lookupCatalogs.columns.name') });
    if (config?.hasAddress) {
      columns.push({
        key: 'address',
        header: this.languageService.t('lookupCatalogs.columns.address'),
        format: (value) => (value as string) || '—',
      });
    }
    if (config?.hasIsActive) {
      columns.push({
        key: 'isActive',
        header: this.languageService.t('lookupCatalogs.columns.status'),
        align: 'center',
        format: (value) =>
          value ? this.languageService.t('lookupCatalogs.active') : this.languageService.t('lookupCatalogs.inactive'),
      });
    }
    return columns;
  });

  protected readonly actions = computed<TableAction<LookupCatalogItem>[]>(() => [
    {
      label: this.languageService.t('lookupCatalogs.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('lookupCatalogs.actions.delete'),
      icon: 'delete',
      variant: 'danger',
      onClick: (row) => this.confirmDelete(row),
    },
  ]);

  constructor() {
    effect(() => {
      this.config();
      this.pageNumber.set(1);
      void this.load();
    });
  }

  private async load(): Promise<void> {
    const config = this.config();
    if (!config) {
      this.errorCode.set(404);
      return;
    }

    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.catalogService.list(config.resource, this.pageNumber(), this.pageSize());
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
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

  protected openEdit(row: LookupCatalogItem): void {
    this.openForm(row);
  }

  private openForm(item: LookupCatalogItem | null): void {
    const config = this.config();
    if (!config) {
      return;
    }
    const ref = this.dialogService.open<boolean, LookupCatalogFormDialogData, LookupCatalogFormDialog>(
      LookupCatalogFormDialog,
      { data: { config, item } }
    );
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: LookupCatalogItem): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('lookupCatalogs.delete.title'),
        message: this.languageService.t('lookupCatalogs.delete.message', { name: row.name }),
        confirmLabel: this.languageService.t('lookupCatalogs.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteItem(row);
      }
    });
  }

  private async deleteItem(row: LookupCatalogItem): Promise<void> {
    const config = this.config();
    if (!config) {
      return;
    }
    try {
      await this.catalogService.delete(config.resource, row[config.idField] as number);
      this.toastService.show(this.languageService.t('lookupCatalogs.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('lookupCatalogs.delete.error'));
    }
  }
}
