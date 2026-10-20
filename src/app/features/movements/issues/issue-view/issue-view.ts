import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { formatCalendarDate } from '../../../../core/dates/calendar-date';
import { DocumentReview, DocumentReviewEntry, DocumentReviewService } from '../../../../core/review/document-review';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { IssueSummary } from '../issue.models';
import { IssueService } from '../issue.service';

/**
 * Página que abre el QR impreso en el comprobante de salida: todo el detalle de la salida, con
 * la foto de cada producto y sus firmas. Igual que la de la nota de ingreso.
 */
@Component({
  selector: 'app-issue-view',
  imports: [ErrorState, ProductPhoto, TranslatePipe, DecimalPipe],
  templateUrl: './issue-view.html',
})
export class IssueView {
  /** Viene de la ruta /issues/view/:id. */
  readonly id = input.required<string>();

  private readonly issueService = inject(IssueService);
  private readonly reviewService = inject(DocumentReviewService);

  protected readonly summary = signal<IssueSummary | null>(null);
  protected readonly review = signal<DocumentReview | null>(null);

  /** Firmas de la versión vigente: la última verificación y la última aprobación. */
  protected readonly signatures = computed(() => {
    const review = this.review();
    const current = (review?.entries ?? []).filter((entry) => entry.version === review?.version);
    const last = (action: DocumentReviewEntry['action']) => current.filter((entry) => entry.action === action).at(-1) ?? null;
    return { verified: last('verificado'), approved: last('aprobado') };
  });
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly total = computed(() => (this.summary()?.lines ?? []).reduce((sum, line) => sum + line.totalCost, 0));

  protected readonly formatDate = formatCalendarDate;

  protected formatInstant(value: string): string {
    return new Date(value).toLocaleString();
  }

  constructor() {
    effect(() => {
      void this.load(Number(this.id()));
    });
  }

  private async load(issueId: number): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const [summary, review] = await Promise.all([
        this.issueService.getSummary(issueId),
        this.reviewService.get('issue', issueId),
      ]);
      this.summary.set(summary);
      this.review.set(review);
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }
}
