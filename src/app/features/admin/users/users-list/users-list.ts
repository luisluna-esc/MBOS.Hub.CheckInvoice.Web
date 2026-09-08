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
import { AppUser, AppUserFilters } from '../app-user.models';
import { AppUserService } from '../app-user.service';
import { UserFormDialog, UserFormDialogData } from '../user-form-dialog/user-form-dialog';
import { UserRolesDialog, UserRolesDialogData } from '../user-roles-dialog/user-roles-dialog';

@Component({
  selector: 'app-users-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './users-list.html',
})
export class UsersList {
  private readonly appUserService = inject(AppUserService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  protected readonly rows = signal<AppUser[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: AppUserFilters = {};

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('users.filters.search'),
      type: 'text',
    },
    {
      key: 'isActive',
      label: this.languageService.t('users.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.languageService.t('users.filters.active') },
        { value: 'false', label: this.languageService.t('users.filters.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<AppUser>[]>(() => [
    {
      key: 'firstName',
      header: this.languageService.t('users.columns.name'),
      format: (_value, row) => `${row.firstName} ${row.lastName}`,
    },
    { key: 'username', header: this.languageService.t('users.columns.username') },
    { key: 'email', header: this.languageService.t('users.columns.email') },
    {
      key: 'isActive',
      header: this.languageService.t('users.columns.status'),
      align: 'center',
      format: (value) =>
        value ? this.languageService.t('users.filters.active') : this.languageService.t('users.filters.inactive'),
    },
  ]);

  protected readonly actions = computed<TableAction<AppUser>[]>(() => [
    {
      label: this.languageService.t('users.actions.roles'),
      icon: 'verified',
      onClick: (row) => this.openRoles(row),
    },
    {
      label: this.languageService.t('users.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('users.actions.delete'),
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
      const result = await this.appUserService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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

  protected openEdit(row: AppUser): void {
    this.openForm(row);
  }

  private openForm(user: AppUser | null): void {
    const ref = this.dialogService.open<boolean, UserFormDialogData, UserFormDialog>(UserFormDialog, {
      data: { user },
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        void this.load();
      }
    });
  }

  protected openRoles(row: AppUser): void {
    this.dialogService.open<void, UserRolesDialogData, UserRolesDialog>(UserRolesDialog, {
      data: { user: row },
    });
  }

  protected confirmDelete(row: AppUser): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('users.delete.title'),
        message: this.languageService.t('users.delete.message', { name: `${row.firstName} ${row.lastName}` }),
        confirmLabel: this.languageService.t('users.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteUser(row);
      }
    });
  }

  private async deleteUser(row: AppUser): Promise<void> {
    try {
      await this.appUserService.delete(row.appUserId);
      this.toastService.show(this.languageService.t('users.delete.success'));
      void this.load();
    } catch {
      this.toastService.show(this.languageService.t('users.delete.error'));
    }
  }
}
