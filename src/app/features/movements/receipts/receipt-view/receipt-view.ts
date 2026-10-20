import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { formatCalendarDate } from '../../../../core/dates/calendar-date';
import { DocumentReview, DocumentReviewEntry, DocumentReviewService } from '../../../../core/review/document-review';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReceiptSummary } from '../receipt.models';
import { ReceiptService } from '../receipt.service';

/**
 * Página que abre el QR impreso en la nota de ingreso: todo el detalle de la entrada, con la
 * foto de cada producto. Pide iniciar sesión (después del login vuelve aquí).
 */
@Component({
  selector: 'app-receipt-view',
  imports: [ErrorState, ProductPhoto, TranslatePipe, DecimalPipe],
  templateUrl: './receipt-view.html',
})
export class ReceiptView {
  /** Viene de la ruta /receipts/view/:id. */
  readonly id = input.required<string>();

  private readonly receiptService = inject(ReceiptService);
  private readonly reviewService = inject(DocumentReviewService);

  protected readonly summary = signal<ReceiptSummary | null>(null);
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
  protected readonly hasPrices = computed(() =>
    (this.summary()?.lines ?? []).some((line) => line.unitPrice !== line.unitCost)
  );

  protected readonly formatDate = formatCalendarDate;

  protected formatInstant(value: string): string {
    return new Date(value).toLocaleString();
  }

  constructor() {
    effect(() => {
      void this.load(Number(this.id()));
    });
  }

  private async load(receiptId: number): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const [summary, review] = await Promise.all([
        this.receiptService.getSummary(receiptId),
        this.reviewService.get('receipt', receiptId),
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
