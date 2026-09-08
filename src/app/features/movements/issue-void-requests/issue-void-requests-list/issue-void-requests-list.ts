import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { IssueDetailsDialog, IssueDetailsDialogData } from '../../issues/issue-details-dialog/issue-details-dialog';
import { IssueVoidRequest, IssueVoidRequestFilters } from '../issue-void-request.models';
import { IssueVoidRequestService } from '../issue-void-request.service';
import {
  IssueVoidRequestReviewDialog,
  IssueVoidRequestReviewDialogData,
} from '../issue-void-request-review-dialog/issue-void-request-review-dialog';

const APPROVER_ROLES = ['Contador', 'M-BOS'];

@Component({
  selector: 'app-issue-void-requests-list',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './issue-void-requests-list.html',
})
export class IssueVoidRequestsList {
  private readonly issueVoidRequestService = inject(IssueVoidRequestService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);

  protected readonly rows = signal<IssueVoidRequest[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly loading = signal(false);

  private currentFilters: IssueVoidRequestFilters = { status: 'pending' };

  protected readonly canReview = computed(() => APPROVER_ROLES.includes(this.authService.activeRole() ?? ''));

  protected readonly filterFields = computed<FilterField[]>(() => [
    {
      key: 'status',
      label: this.languageService.t('issueVoidRequests.filters.status'),
      type: 'select',
      options: [
        { value: 'pending', label: this.languageService.t('issueVoidRequests.status.pending') },
        { value: 'approved', label: this.languageService.t('issueVoidRequests.status.approved') },
        { value: 'rejected', label: this.languageService.t('issueVoidRequests.status.rejected') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<IssueVoidRequest>[]>(() => [
    {
      key: 'issueId',
      header: this.languageService.t('issueVoidRequests.columns.issue'),
      format: (value) => String(value).padStart(5, '0'),
    },
    {
      key: 'issueDate',
      header: this.languageService.t('issueVoidRequests.columns.issueDate'),
      format: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: 'clientName',
      header: this.languageService.t('issueVoidRequests.columns.client'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'voidReasonName',
      header: this.languageService.t('issueVoidRequests.columns.reason'),
    },
    {
      key: 'detail',
      header: this.languageService.t('issueVoidRequests.columns.detail'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'requestedByFullName',
      header: this.languageService.t('issueVoidRequests.columns.requestedBy'),
      format: (value) => (value as string) || '—',
    },
    {
      key: 'requestedAt',
      header: this.languageService.t('issueVoidRequests.columns.requestedAt'),
      format: (value) => new Date(value as string).toLocaleString(),
    },
    {
      key: 'status',
      header: this.languageService.t('issueVoidRequests.columns.status'),
      align: 'center',
      format: (value) => this.languageService.t(`issueVoidRequests.status.${value}`),
    },
  ]);

  protected readonly actions = computed<TableAction<IssueVoidRequest>[]>(() => {
    const actions: TableAction<IssueVoidRequest>[] = [
      {
        label: this.languageService.t('issueVoidRequests.actions.viewIssue'),
        icon: 'view',
        onClick: (row) => this.openIssueDetails(row),
      },
    ];

    if (this.canReview()) {
      actions.push(
        {
          label: this.languageService.t('issueVoidRequests.actions.approve'),
          icon: 'verified',
          disabled: (row) => row.status !== 'pending',
          onClick: (row) => this.openReview(row, 'approve'),
        },
        {
          label: this.languageService.t('issueVoidRequests.actions.reject'),
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
      const result = await this.issueVoidRequestService.list(this.pageNumber(), this.pageSize(), this.currentFilters);
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

  protected openIssueDetails(row: IssueVoidRequest): void {
    this.dialogService.open<void, IssueDetailsDialogData, IssueDetailsDialog>(IssueDetailsDialog, {
      data: { issueId: row.issueId },
    });
  }

  protected openReview(row: IssueVoidRequest, mode: 'approve' | 'reject'): void {
    const ref = this.dialogService.open<boolean, IssueVoidRequestReviewDialogData, IssueVoidRequestReviewDialog>(
      IssueVoidRequestReviewDialog,
      { data: { issueVoidRequestId: row.issueVoidRequestId, mode } }
    );
    ref.closed.subscribe((confirmed) => {
      if (confirmed) {
        void this.load();
      }
    });
  }
}
