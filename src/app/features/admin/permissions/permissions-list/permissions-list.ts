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
import { PermissionFormDialog, PermissionFormDialogData } from '../permission-form-dialog/permission-form-dialog';
import { Permission, PermissionFilters } from '../permission.models';
import { PermissionService } from '../permission.service';

@Component({
  selector: 'app-permissions-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './permissions-list.html',
})
export class PermissionsList {
  private readonly permissionService = inject(PermissionService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<Permission[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: PermissionFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('permissions.filters.search'),
      type: 'text',
    },
    {
      key: 'module',
      label: this.languageService.t('permissions.filters.module'),
      type: 'text',
    },
    {
      key: 'isActive',
      label: this.languageService.t('permissions.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('permissions.filters.active') },
        { value: 'false', label: this.languageService.t('permissions.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Permission>[]>(() => [
    { key: 'code', header: this.languageService.t('permissions.columns.code') },
    { key: 'name', header: this.languageService.t('permissions.columns.name') },
    { key: 'module', header: this.languageService.t('permissions.columns.module') },
    {
      key: 'description',
      header: this.languageService.t('permissions.columns.description'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'isActive',
      header: this.languageService.t('permissions.columns.status'),
      align: 'center',
      format: (value) =>
        value
          ? this.languageService.t('permissions.filters.active')
          : this.languageService.t('permissions.filters.inactive'),
    },
  ]);

  protected readonly actions = computed<TableAction<Permission>[]>(() => [
    {
      label: this.languageService.t('permissions.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('permissions.actions.delete'),
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
      const result = await this.permissionService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      module: values['module'] ?? undefined,
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

  protected openEdit(row: Permission): void {
    this.openForm(row);
  }

  private openForm(permission: Permission | null): void {
    const ref = this.dialogService.open<boolean, PermissionFormDialogData, PermissionFormDialog>(
      PermissionFormDialog,
      { data: { permission } }
    );
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected confirmDelete(row: Permission): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('permissions.delete.title'),
        message: this.languageService.t('permissions.delete.message', { name: row.name }),
        confirmLabel: this.languageService.t('permissions.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deletePermission(row);
      }
    });
  }

  private async deletePermission(row: Permission): Promise<void> {
    try {
      await this.permissionService.delete(row.permissionId);
      this.toastService.show(this.languageService.t('permissions.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('permissions.delete.error'));
    }
  }
}
