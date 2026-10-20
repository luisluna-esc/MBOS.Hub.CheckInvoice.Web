import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { InboxKind, InboxRow, InboxService, InboxTab } from '../../core/inbox/inbox.service';
import { LanguageService } from '../../core/i18n/language.service';
import {
  DocumentReviewDialog,
  DocumentReviewDialogData,
} from '../../shared/components/document-review-dialog/document-review-dialog';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../shared/components/table/table';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { localDateIso } from '../../core/dates/calendar-date';

const PENDING_KINDS: InboxKind[] = ['toVerify', 'toApprove', 'voidRequest', 'receiptEdit', 'issueEdit'];
const ANSWER_KINDS: InboxKind[] = ['reviewApproved', 'reviewRejected', 'voidRequest', 'receiptEdit', 'issueEdit'];
const SIGNED_KINDS: InboxKind[] = ['reviewSigned', 'voidRequest', 'receiptEdit', 'issueEdit'];

/**
 * Buzón: Pendientes (lo que el rol tiene que firmar o autorizar), Respuestas (cómo terminó lo que
 * pedí o digité; las nuevas arriba y resaltadas) y Lo que firmé (mis firmas y autorizaciones).
 * Las firmas se resuelven aquí mismo; anulaciones y correcciones llevan a Autorizaciones.
 */
@Component({
  selector: 'app-inbox',
  imports: [Filters, Table, ErrorState, TranslatePipe],
  templateUrl: './inbox.html',
})
export class Inbox {
  protected readonly inboxService = inject(InboxService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly tab = signal<InboxTab>('pending');
  protected readonly kind = signal<InboxKind | null>(null);
  protected readonly rows = signal<InboxRow[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);
  private filters: FilterValues = {};

  protected readonly counts = this.inboxService.counts;
  protected readonly todayIso = localDateIso();

  protected readonly tabs = computed(() => {
    const counts = this.counts();
    return [
      // En Respuestas el número resaltado son las nuevas; en Lo que firmé, el total (solo informativo).
      { key: 'pending' as InboxTab, count: counts?.pending ?? 0, alert: true },
      { key: 'answers' as InboxTab, count: counts?.unread ?? 0, alert: true },
      { key: 'signed' as InboxTab, count: counts?.signed ?? 0, alert: false },
    ];
  });

  /** Accesos rápidos por clase en Pendientes (solo las que el rol puede ver). */
  protected readonly kindChips = computed(() => {
    const counts = this.counts();
    if (!counts || this.tab() !== 'pending') {
      return [];
    }
    return PENDING_KINDS.filter((kind) => (kind === 'toVerify' ? counts.canVerify : counts.canApprove)).map((kind) => ({
      kind,
      count: counts.byKind[kind] ?? 0,
    }));
  });

  protected readonly filterFields = computed<FilterField[]>(() => {
    const kinds = this.tab() === 'pending' ? PENDING_KINDS : this.tab() === 'answers' ? ANSWER_KINDS : SIGNED_KINDS;
    return [
      {
        key: 'search',
        label: this.languageService.t('inbox.filters.search'),
        type: 'text',
      },
      {
        key: 'kind',
        label: this.languageService.t('inbox.filters.kind'),
        type: 'select',
        options: kinds.map((kind) => ({ value: kind, label: this.languageService.t(`inbox.kinds.${kind}`) })),
      },
      {
        key: 'documentType',
        label: this.languageService.t('inbox.filters.document'),
        type: 'select',
        options: (['receipt', 'issue', 'transfer'] as const).map((type) => ({
          value: type,
          label: this.languageService.t(`inbox.documentTypes.${type}`),
        })),
      },
      { key: 'dateFrom', label: this.languageService.t('inbox.filters.dateFrom'), type: 'date', max: this.todayIso },
      { key: 'dateTo', label: this.languageService.t('inbox.filters.dateTo'), type: 'date', max: this.todayIso },
    ];
  });

  protected readonly columns = computed<TableColumn<InboxRow>[]>(() => {
    const columns: TableColumn<InboxRow>[] = [
      {
        key: 'kind',
        header: this.languageService.t('inbox.columns.kind'),
        // En Respuestas, las que todavía no abriste llevan la marca "● Nueva".
        format: (value, row) =>
          (this.tab() === 'answers' && !row.seen ? `● ${this.languageService.t('inbox.newMark')} · ` : '') +
          this.languageService.t(`inbox.kinds.${value as string}`),
      },
      {
        key: 'number',
        header: this.languageService.t('inbox.columns.document'),
        format: (_value, row) => this.documentLabel(row),
      },
      {
        key: 'detail',
        header: this.languageService.t('inbox.columns.detail'),
        format: (value) => (value as string) || '—',
      },
      {
        key: 'at',
        header: this.languageService.t('inbox.columns.date'),
        format: (value) => new Date(value as string).toLocaleString(),
      },
    ];
    if (this.tab() !== 'pending') {
      columns.push({
        key: 'status',
        header: this.languageService.t('inbox.columns.result'),
        align: 'center',
        format: (value) => (value ? this.languageService.t(`inbox.results.${value as string}`) : '—'),
      });
    }
    return columns;
  });

  protected readonly actions = computed<TableAction<InboxRow>[]>(() => {
    const actions: TableAction<InboxRow>[] = [
      { label: this.languageService.t('inbox.actions.open'), icon: 'view', onClick: (row) => this.open(row) },
    ];
    if (this.tab() === 'answers') {
      actions.push({
        label: this.languageService.t('inbox.actions.markSeen'),
        icon: 'verified',
        disabled: (row) => row.seen,
        disabledReason: (row) => (row.seen ? this.languageService.t('inbox.alreadySeen') : null),
        onClick: (row) => void this.markSeen(row),
      });
    }
    return actions;
  });

  constructor() {
    void this.inboxService.refresh();
    void this.load();
  }

  protected selectTab(tab: InboxTab): void {
    if (this.tab() === tab) {
      return;
    }
    this.tab.set(tab);
    this.kind.set(null);
    this.filters = {};
    this.pageNumber.set(1);
    void this.load();
  }

  protected selectKind(kind: InboxKind): void {
    this.kind.set(this.kind() === kind ? null : kind);
    this.pageNumber.set(1);
    void this.load();
  }

  protected onSearch(values: FilterValues): void {
    this.filters = values;
    this.kind.set((values['kind'] as InboxKind | null) ?? null);
    this.pageNumber.set(1);
    void this.load();
  }

  protected onClear(): void {
    this.filters = {};
    this.kind.set(null);
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

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const result = await this.inboxService.list({
        tab: this.tab(),
        kind: this.kind(),
        documentType: this.filters['documentType'],
        search: this.filters['search'],
        dateFrom: this.filters['dateFrom'],
        dateTo: this.filters['dateTo'],
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
      });
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  /** "Nota MB 4-10-26", "Salida 00019" o "Transferencia 00009". */
  protected documentLabel(row: InboxRow): string {
    return this.languageService.t(`inbox.documents.${row.documentType}`, { number: row.number });
  }

  protected async markSeen(row: InboxRow): Promise<void> {
    if (row.notificationKey) {
      await this.inboxService.markSeen([row.notificationKey]);
      await this.load();
    }
  }

  protected async markAllSeen(): Promise<void> {
    await this.inboxService.markSeen();
    await this.load();
  }

  protected open(row: InboxRow): void {
    // Abrir una notificación la da por vista.
    if (row.notificationKey && !row.seen) {
      void this.inboxService.markSeen([row.notificationKey]).then(() => this.load());
    }

    if (row.kind === 'voidRequest') {
      const routes = { issue: '/issues/void-requests', receipt: '/receipts/void-requests', transfer: '/transfers/void-requests' };
      void this.router.navigate([routes[row.documentType]]);
      return;
    }
    if (row.kind === 'receiptEdit' || row.kind === 'issueEdit') {
      void this.router.navigate([row.kind === 'receiptEdit' ? '/receipts/edit-requests' : '/issues/edit-requests']);
      return;
    }

    const ref = this.dialogService.open<boolean, DocumentReviewDialogData, DocumentReviewDialog>(DocumentReviewDialog, {
      data: { type: row.documentType, id: row.documentId, title: this.documentLabel(row) },
    });
    ref.closed.subscribe((changed) => {
      if (changed) {
        void this.inboxService.refresh();
        void this.load();
      }
    });
  }
}
