import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { APPROVER_ROLES } from '../../../core/review/document-review';
import { ToastService } from '../../../core/toast/toast.service';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ReceiptEditLineChange as IssueEditLineChange } from '../receipts/receipt.models';
import { IssueEdit } from '../issues/issue.models';
import { IssueService } from '../issues/issue.service';
import { LoadingSkeleton } from '../../../shared/components/loading-skeleton/loading-skeleton';

/**
 * Correcciones de Salidas (Autorizaciones): como las anulaciones, las pide quien trabaja en
 * almacén y el Contador las aprueba o las rechaza viendo qué cambia, producto por producto.
 */
@Component({
  selector: 'app-issue-edit-requests',
  imports: [LoadingSkeleton, FormsModule, Select, TranslatePipe, DecimalPipe],
  templateUrl: './issue-edit-requests.html',
})
export class IssueEditRequests {
  private readonly issueService = inject(IssueService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly status = signal<string | null>('pending');
  protected readonly edits = signal<IssueEdit[]>([]);
  protected readonly loading = signal(false);
  protected readonly working = signal<number | null>(null);
  /** Observación del Contador por solicitud (obligatoria para rechazar). */
  protected readonly notes = signal<Record<number, string | undefined>>({});

  protected readonly canReview = computed(() => APPROVER_ROLES.includes(this.authService.activeRole() ?? ''));

  protected readonly statusOptions = computed<SelectOption[]>(() => [
    { value: 'pending', label: this.languageService.t('issueEdits.status.pending') },
    { value: 'approved', label: this.languageService.t('issueEdits.status.approved') },
    { value: 'rejected', label: this.languageService.t('issueEdits.status.rejected') },
  ]);

  constructor() {
    void this.load();
  }

  protected onStatusChange(value: string | null): void {
    this.status.set(value);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.edits.set(await this.issueService.listEdits(this.status() ?? undefined));
    } finally {
      this.loading.set(false);
    }
  }

  protected lineChanged(line: IssueEditLineChange): boolean {
    return line.quantityBefore !== line.quantityAfter || line.priceBefore !== line.priceAfter;
  }

  protected setNotes(id: number, value: string): void {
    this.notes.update((current) => ({ ...current, [id]: value }));
  }

  protected formatInstant(value: string | null): string {
    return value ? new Date(value).toLocaleString() : '—';
  }

  protected async review(edit: IssueEdit, decision: 'approve' | 'reject'): Promise<void> {
    const notes = (this.notes()[edit.changeRequestId] ?? '').trim();
    if (decision === 'reject' && !notes) {
      this.toastService.warning(this.languageService.t('issueEdits.notesRequired'));
      return;
    }
    this.working.set(edit.changeRequestId);
    try {
      await this.issueService.reviewEdit(edit.changeRequestId, decision, notes || null);
      this.toastService.success(this.languageService.t(decision === 'approve' ? 'issueEdits.approved' : 'issueEdits.rejected'));
      await this.load();
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('issueEdits.error'), message);
    } finally {
      this.working.set(null);
    }
  }
}
