import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ClientFormDialog, ClientFormDialogData } from '../../clients/client-form-dialog/client-form-dialog';
import { Client, ClientFilters } from '../../clients/client.models';
import { ClientService } from '../../clients/client.service';
import {
  PortalAccessGrantedDialog,
  PortalAccessGrantedDialogData,
} from '../../clients/portal-access-granted-dialog/portal-access-granted-dialog';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-pastors-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './pastors-list.html',
})
export class PastorsList {
  private readonly clientService = inject(ClientService);
  private readonly catalogService = inject(CatalogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);

  protected readonly rows = signal<Client[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly busyId = signal<number | null>(null);

  protected readonly districts = signal<CatalogItem[]>([]);

  private currentFilters: ClientFilters = { isPastor: true };

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'searchCriteria',
      label: this.languageService.t('clients.filters.search'),
      type: 'text',
    },
    {
      key: 'districtId',
      label: this.languageService.t('clients.filters.district'),
      type: 'select',
      options: this.districts().map((item) => ({ value: String(item.id), label: item.name })),
    },
    {
      key: 'pendingPortalAccess',
      label: this.languageService.t('pastors.filters.access'),
      type: 'select',
      options: [{ value: 'true', label: this.languageService.t('pastors.columns.accessPending') }],
    },
  ]);

  protected readonly columns = computed<TableColumn<Client>[]>(() => [
    { key: 'name', header: this.languageService.t('clients.columns.name') },
    { key: 'email', header: this.languageService.t('clients.columns.email'), format: (value) => (value as string) || '—' },
    { key: 'mobilePhone', header: this.languageService.t('clients.columns.mobilePhone'), format: (value) => (value as string) || '—' },
    {
      key: 'appUserId',
      header: this.languageService.t('pastors.columns.access'),
      align: 'center',
      format: (value) =>
        value ? this.languageService.t('pastors.columns.accessGranted') : this.languageService.t('pastors.columns.accessPending'),
    },
  ]);

  protected readonly actions = computed<TableAction<Client>[]>(() => [
    {
      label: this.languageService.t('clients.actions.edit'),
      icon: 'edit',
      onClick: (row) => this.openEdit(row),
    },
    {
      label: this.languageService.t('clients.portalAccess.grant'),
      icon: 'create',
      disabled: (row) => this.busyId() === row.clientId || row.appUserId !== null,
      disabledReason: (row) => (row.appUserId !== null ? this.languageService.t('pastors.columns.accessGranted') : null),
      onClick: (row) => this.grantAccess(row),
    },
    {
      label: this.languageService.t('pastors.actions.resetPassword'),
      icon: 'verified',
      disabled: (row) => this.busyId() === row.clientId || row.appUserId === null,
      disabledReason: (row) => (row.appUserId === null ? this.languageService.t('pastors.columns.accessPending') : null),
      onClick: (row) => this.confirmResetPassword(row),
    },
  ]);

  constructor() {
    void this.loadCatalogs();
    void this.load();
  }

  private async loadCatalogs(): Promise<void> {
    this.districts.set(await this.catalogService.getDistricts());
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.clientService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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
      isPastor: true,
      searchCriteria: values['searchCriteria'] ?? undefined,
      districtId: values['districtId'] ? Number(values['districtId']) : undefined,
      pendingPortalAccess: values['pendingPortalAccess'] ? values['pendingPortalAccess'] === 'true' : undefined,
    };
    this.pageNumber.set(1);
    void this.load();
  }

  protected onClear(): void {
    this.currentFilters = { isPastor: true };
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

  private openEdit(row: Client): void {
    const ref = this.dialogService.open<number | null, ClientFormDialogData, ClientFormDialog>(ClientFormDialog, {
      data: { client: row },
    });
    ref.closed.subscribe((savedClientId) => {
      if (savedClientId) {
        void this.load();
      }
    });
  }

  protected async grantAccess(row: Client): Promise<void> {
    this.busyId.set(row.clientId);
    try {
      const result = await this.clientService.grantPortalAccess(row.clientId);
      this.dialogService.open<void, PortalAccessGrantedDialogData, PortalAccessGrantedDialog>(PortalAccessGrantedDialog, {
        data: {
          title: this.languageService.t('clients.portalAccess.grantedTitle'),
          message: this.languageService.t('clients.portalAccess.grantedMessage', { name: row.name }),
          username: row.email ?? '',
          result,
        },
      });
      void this.load();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]?.description;
      this.toastService.show(this.languageService.t('clients.portalAccess.error'), message);
    } finally {
      this.busyId.set(null);
    }
  }

  protected confirmResetPassword(row: Client): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t('pastors.resetConfirm.title'),
        message: this.languageService.t('pastors.resetConfirm.message', { name: row.name }),
        confirmLabel: this.languageService.t('pastors.actions.resetPassword'),
      },
    });
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.resetPassword(row);
      }
    });
  }

  private async resetPassword(row: Client): Promise<void> {
    this.busyId.set(row.clientId);
    try {
      const result = await this.clientService.resetPortalPassword(row.clientId);
      this.dialogService.open<void, PortalAccessGrantedDialogData, PortalAccessGrantedDialog>(PortalAccessGrantedDialog, {
        data: {
          title: this.languageService.t('pastors.resetSuccess.title'),
          message: this.languageService.t('pastors.resetSuccess.message', { name: row.name }),
          username: row.email ?? '',
          result,
        },
      });
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]?.description;
      this.toastService.show(this.languageService.t('pastors.resetError'), message);
    } finally {
      this.busyId.set(null);
    }
  }
}
