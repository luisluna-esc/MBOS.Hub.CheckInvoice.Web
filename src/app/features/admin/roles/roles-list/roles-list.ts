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
import { RoleFormDialog, RoleFormDialogData } from '../role-form-dialog/role-form-dialog';
import { RoleMenusDialog, RoleMenusDialogData } from '../role-menus-dialog/role-menus-dialog';
import { RolePermissionsDialog, RolePermissionsDialogData } from '../role-permissions-dialog/role-permissions-dialog';
import { Role, RoleFilters } from '../role.models';
import { RoleService } from '../role.service';

@Component({
  selector: 'app-roles-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './roles-list.html',
})
export class RolesList {
  private readonly roleService = inject(RoleService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<Role[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: RoleFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('roles.filters.search'),
      type: 'text',
    },
    {
      key: 'isActive',
      label: this.languageService.t('roles.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('roles.filters.active') },
        { value: 'false', label: this.languageService.t('roles.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Role>[]>(() => [
    { key: 'name', header: this.languageService.t('roles.columns.name') },
    { key: 'description', header: this.languageService.t('roles.columns.description'), format: (value) => (value as string) || '—' },
    {
      key: 'isActive',
      header: this.languageService.t('roles.columns.status'),
      align: 'center',
      format: (value) =>
        value ? this.languageService.t('roles.filters.active') : this.languageService.t('roles.filters.inactive'),
    },
  ]);

  protected readonly actions = computed<TableAction<Role>[]>(() => [
    {
      label: this.languageService.t('roles.actions.permissions'),
      icon: 'verified',
      onClick: (row) => this.openPermissions(row),
    },
    {
      label: this.languageService.t('roles.actions.menus'),
      icon: 'menu',
      onClick: (row) => this.openMenus(row),
    },
    {
      label: this.languageService.t('roles.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('roles.actions.delete'),
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
      const result = await this.roleService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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

  protected openEdit(row: Role): void {
    this.openForm(row);
  }

  private openForm(role: Role | null): void {
    const ref = this.dialogService.open<boolean, RoleFormDialogData, RoleFormDialog>(RoleFormDialog, {
      data: { role },
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected openPermissions(row: Role): void {
    this.dialogService.open<void, RolePermissionsDialogData, RolePermissionsDialog>(RolePermissionsDialog, {
      data: { role: row },
    });
  }

  protected openMenus(row: Role): void {
    this.dialogService.open<void, RoleMenusDialogData, RoleMenusDialog>(RoleMenusDialog, {
      data: { role: row },
    });
  }

  protected confirmDelete(row: Role): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('roles.delete.title'),
        message: this.languageService.t('roles.delete.message', { name: row.name }),
        confirmLabel: this.languageService.t('roles.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteRole(row);
      }
    });
  }

  private async deleteRole(row: Role): Promise<void> {
    try {
      await this.roleService.delete(row.roleId);
      this.toastService.show(this.languageService.t('roles.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('roles.delete.error'));
    }
  }
}
