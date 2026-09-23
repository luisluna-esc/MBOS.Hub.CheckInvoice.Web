import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { InfoHint } from '../../../../shared/components/info-hint/info-hint';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReceiptDetailsDialog, ReceiptDetailsDialogData } from '../../receipts/receipt-details-dialog/receipt-details-dialog';
import { ReceiptVoidRequest, ReceiptVoidRequestFilters } from '../receipt-void-request.models';
import { ReceiptVoidRequestService } from '../receipt-void-request.service';
import {
  ReceiptVoidRequestReviewDialog,
  ReceiptVoidRequestReviewDialogData,
} from '../receipt-void-request-review-dialog/receipt-void-request-review-dialog';

const APPROVER_ROLES = ['Contador', 'M-BOS'];

@Component({
  selector: 'app-receipt-void-requests-list',
  imports: [Filters, Table, ErrorState, TranslatePipe, InfoHint],
  templateUrl: './receipt-void-requests-list.html',
})
export class ReceiptVoidRequestsList {
  private readonly receiptVoidRequestService = inject(ReceiptVoidRequestService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);

  protected readonly rows = signal<ReceiptVoidRequest[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: ReceiptVoidRequestFilters = { status: 'pending' };

  protected readonly canReview = computed(() => APPROVER_ROLES.includes(this.authService.activeRole() ?? ''));

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'status',
      label: this.languageService.t('receiptVoidRequests.filters.status'),
      type: 'select',
      options: [
        { value: 'pending', label: this.languageService.t('receiptVoidRequests.status.pending') },
        { value: 'approved', label: this.languageService.t('receiptVoidRequests.status.approved') },
        { value: 'rejected', label: this.languageService.t('receiptVoidRequests.status.rejected') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<ReceiptVoidRequest>[]>(() => [
    {
      key: 'receiptId',
      header: this.languageService.t('receiptVoidRequests.columns.receipt'),
      format: (value) => String(value).padStart(5, '0'),
    },
    {
      key: 'receiptDate',
      header: this.languageService.t('receiptVoidRequests.columns.receiptDate'),
      format: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: 'supplierName',
      header: this.languageService.t('receiptVoidRequests.columns.supplier'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'voidReasonName',
      header: this.languageService.t('receiptVoidRequests.columns.reason'),
    },
    {
      key: 'detail',
      header: this.languageService.t('receiptVoidRequests.columns.detail'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'requestedByFullName',
      header: this.languageService.t('receiptVoidRequests.columns.requestedBy'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'requestedAt',
      header: this.languageService.t('receiptVoidRequests.columns.requestedAt'),
      format: (value) => new Date(value as string).toLocaleString(),
    },
    {
      key: 'status',
      header: this.languageService.t('receiptVoidRequests.columns.status'),
      align: 'center',
      format: (value) => this.languageService.t(`receiptVoidRequests.status.${value}`),
    },
  ]);

  protected readonly actions = computed<TableAction<ReceiptVoidRequest>[]>(() => {
    const actions: TableAction<ReceiptVoidRequest>[] = [
      {
        label: this.languageService.t('receiptVoidRequests.actions.viewReceipt'),
        icon: 'view',
        onClick: (row) => this.openReceiptDetails(row),
      },
    ];

    if (this.canReview()) {
      actions.push(
        {
          label: this.languageService.t('receiptVoidRequests.actions.approve'),
          icon: 'verified',
          disabled: (row) => row.status !== 'pending',
          onClick: (row) => this.openReview(row, 'approve'),
        },
        {
          label: this.languageService.t('receiptVoidRequests.actions.reject'),
          variant: 'danger',
          disabled: (row) => row.status !== 'pending',
          onClick: (row) => this.openReview(row, 'reject'),
        }
      );
    }

    return actions;
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.receiptVoidRequestService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(values: FilterValues): void {
    this.currentFilters = { status: values['status'] ?? undefined };
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

  protected openReceiptDetails(row: ReceiptVoidRequest): void {
    this.dialogService.open<void, ReceiptDetailsDialogData, ReceiptDetailsDialog>(ReceiptDetailsDialog, {
      data: { receiptId: row.receiptId },
    });
  }

  protected openReview(row: ReceiptVoidRequest, mode: 'approve' | 'reject'): void {
    const ref = this.dialogService.open<boolean, ReceiptVoidRequestReviewDialogData, ReceiptVoidRequestReviewDialog>(
      ReceiptVoidRequestReviewDialog,
      { data: { receiptVoidRequestId: row.receiptVoidRequestId, mode } }
    );
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.load();
      }
    });
  }
}
