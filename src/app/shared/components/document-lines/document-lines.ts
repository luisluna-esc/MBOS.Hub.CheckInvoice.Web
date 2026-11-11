import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ReviewDocumentType } from '../../../core/review/document-review';
import { ToastService } from '../../../core/toast/toast.service';
import { IssueService } from '../../../features/movements/issues/issue.service';
import { ReceiptService } from '../../../features/movements/receipts/receipt.service';
import { TransferService } from '../../../features/movements/transfers/transfer.service';
import { ReportService } from '../../../features/reports/report.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LoadingSkeleton } from '../loading-skeleton/loading-skeleton';

interface Line {
  key: number;
  productId: number;
  quantity: number;
  unitCost: number;
  total: number;
}

/**
 * Productos de un documento (entrada, salida o transferencia) para revisarlo antes de firmar,
 * con un botón que abre su PDF en otra ventana.
 */
@Component({
  selector: 'app-document-lines',
  imports: [DecimalPipe, TranslatePipe, LoadingSkeleton],
  template: `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-foreground">{{ 'review.lines.title' | translate }}</h3>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-background disabled:opacity-50"
          [disabled]="openingPdf()"
          (click)="openPdf()"
        >
          <svg viewBox="0 0 24 24" fill="none" class="size-4" aria-hidden="true">
            <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ 'review.lines.viewPdf' | translate }}
        </button>
      </div>

      @if (loading()) {
        <app-loading-skeleton [count]="3" />
      } @else if (lines().length === 0) {
        <p class="text-sm text-muted-foreground">{{ 'review.lines.empty' | translate }}</p>
      } @else {
        <div class="w-full overflow-x-auto rounded-md border border-border">
          <table class="w-full divide-y divide-border text-sm">
            <thead class="bg-background">
              <tr>
                <th class="px-3 py-2 text-left font-semibold text-foreground">{{ 'review.lines.product' | translate }}</th>
                <th class="px-3 py-2 text-right font-semibold text-foreground">{{ 'review.lines.quantity' | translate }}</th>
                <th class="px-3 py-2 text-right font-semibold text-foreground">{{ 'review.lines.unitCost' | translate }}</th>
                <th class="px-3 py-2 text-right font-semibold text-foreground">{{ 'review.lines.total' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (line of lines(); track line.key) {
                <tr>
                  <td class="px-3 py-2 text-foreground">{{ productName(line.productId) }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">{{ line.quantity | number: '1.0-2' }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">{{ line.unitCost | number: '1.2-2' }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">{{ line.total | number: '1.2-2' }}</td>
                </tr>
              }
              <tr class="bg-background font-semibold">
                <td class="px-3 py-2 text-right text-foreground">{{ 'review.lines.sum' | translate }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">{{ totalQuantity() | number: '1.0-2' }}</td>
                <td></td>
                <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">{{ grandTotal() | number: '1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DocumentLines {
  readonly type = input.required<ReviewDocumentType>();
  readonly documentId = input.required<number>();

  private readonly receiptService = inject(ReceiptService);
  private readonly issueService = inject(IssueService);
  private readonly transferService = inject(TransferService);
  private readonly reportService = inject(ReportService);
  private readonly catalogService = inject(CatalogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly lines = signal<Line[]>([]);
  protected readonly loading = signal(true);
  protected readonly openingPdf = signal(false);
  private readonly productNames = signal<Record<number, string>>({});
  protected readonly totalQuantity = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  protected readonly grandTotal = computed(() => this.lines().reduce((sum, line) => sum + line.total, 0));

  constructor() {
    void this.catalogService.getProducts().then((products) =>
      this.productNames.set(Object.fromEntries(products.map((item) => [item.id, item.name])))
    );
    effect(() => void this.load(this.type(), this.documentId()));
  }

  private async load(type: ReviewDocumentType, id: number): Promise<void> {
    this.loading.set(true);
    try {
      if (type === 'receipt') {
        const items = await this.receiptService.getDetails(id);
        this.lines.set(items.map((l) => ({ key: l.receiptDetailId, productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, total: l.totalCost })));
      } else if (type === 'issue') {
        const items = await this.issueService.getDetails(id);
        this.lines.set(items.map((l) => ({ key: l.issueDetailId, productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, total: l.totalCost })));
      } else {
        const items = await this.transferService.getDetails(id);
        this.lines.set(
          items.map((l) => ({
            key: l.transferDetailId,
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitPrice ?? 0,
            total: l.totalSalePrice ?? 0,
          }))
        );
      }
    } catch {
      this.lines.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected productName(productId: number): string {
    return this.productNames()[productId] ?? `#${productId}`;
  }

  /** Abre el PDF en otra ventana. La ventana se abre antes de pedir el PDF para que el navegador no la bloquee. */
  protected async openPdf(): Promise<void> {
    const win = window.open('', '_blank');
    this.openingPdf.set(true);
    try {
      const id = this.documentId();
      const blob =
        this.type() === 'receipt'
          ? await this.reportService.getReceiptVoucherPdfBlob(id)
          : this.type() === 'issue'
            ? await this.reportService.getIssueVoucherPdfBlob(id)
            : await this.reportService.getTransferVoucherPdfBlob(id);
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win?.close();
      this.toastService.error(this.languageService.t('review.lines.pdfError'));
    } finally {
      this.openingPdf.set(false);
    }
  }
}
