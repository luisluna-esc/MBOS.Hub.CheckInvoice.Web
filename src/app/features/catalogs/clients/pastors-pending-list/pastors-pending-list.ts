import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Client, ClientFilters } from '../client.models';
import { ClientService } from '../client.service';
import {
  PortalAccessGrantedDialog,
  PortalAccessGrantedDialogData,
} from '../portal-access-granted-dialog/portal-access-granted-dialog';

@Component({
  selector: 'app-pastors-pending-list',
  imports: [Table, ErrorState, TranslatePipe],
  templateUrl: './pastors-pending-list.html',
})
export class PastorsPendingList {
  private readonly clientService = inject(ClientService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly rows = signal<Client[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly grantingId = signal<number | null>(null);

  private readonly filters: ClientFilters = { pendingPortalAccess: true };

  protected readonly columns = computed<TableColumn<Client>[]>(() => [
    { key: 'name', header: this.languageService.t('clients.columns.name') },
    { key: 'email', header: this.languageService.t('clients.columns.email'), format: (value) => (value as string) || '—' },
    { key: 'mobilePhone', header: this.languageService.t('clients.columns.mobilePhone'), format: (value) => (value as string) || '—' },
  ]);

  protected readonly actions = computed<TableAction<Client>[]>(() => [
    {
      label: this.languageService.t('clients.portalAccess.grant'),
      icon: 'create',
      disabled: (row) => this.grantingId() === row.clientId,
      onClick: (row) => this.grantAccess(row),
    },
  ]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.clientService.list(this.pageNumber(), this.pageSize(), this.filters);
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

  protected onBack(): void {
    void this.router.navigate(['/catalogs/clients']);
  }

  protected async grantAccess(row: Client): Promise<void> {
    this.grantingId.set(row.clientId);
    try {
      const result = await this.clientService.grantPortalAccess(row.clientId);
      this.dialogService.open<void, PortalAccessGrantedDialogData, PortalAccessGrantedDialog>(
        PortalAccessGrantedDialog,
        { data: { clientName: row.name, username: row.email ?? '', result } }
      );
      void this.load();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('clients.portalAccess.error'), message);
    } finally {
      this.grantingId.set(null);
    }
  }
}
