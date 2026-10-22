import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { DialogService } from '../../../core/dialog/dialog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import {
  ProductPickerDialog,
  ProductPickerResult,
} from '../../../shared/components/product-picker-dialog/product-picker-dialog';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { Switch } from '../../../shared/components/switch/switch';
import { Tooltip } from '../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { firstDayOfCurrentMonthIso } from '../report-date.util';
import { ExcelDownloadButton, TxtDownloadButton, PdfDownloadButton, downloadBlob } from '../excel-download-button/excel-download-button';
import { KardexByProductReportFilters } from '../report.models';
import { ReportService } from '../report.service';
import { canPreviewPdf } from '../../../core/files/pdf';
import { reportReviewStateOptions, toReportReviewState } from '../../../core/reviews/review-state';

@Component({
  selector: 'app-kardex-by-product-report',
  imports: [FormsModule, Select, DatePicker, Skeleton, Switch, Tooltip, TranslatePipe, ExcelDownloadButton, TxtDownloadButton, PdfDownloadButton],
  templateUrl: './kardex-by-product-report.html',
})
export class KardexByProductReport {
  private readonly catalogService = inject(CatalogService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);

  /** "Todos los productos": el kardex de cada producto del almacén, sin elegir uno. */
  protected readonly allProducts = signal(false);
  protected readonly selectedProduct = signal<ProductPickerResult | null>(null);
  protected readonly productId = signal<string | null>(null);
  protected readonly warehouses = signal<SelectOption[]>([]);
  protected readonly warehouseId = signal<string | null>(null);
  protected readonly dateFrom = signal<string | null>(firstDayOfCurrentMonthIso());
  protected readonly dateTo = signal<string | null>(null);
  /** Estado: "Solo actualizado" (firmado) o "Actualizado y sin actualizar" (todo). */
  protected readonly reviewState = signal<string | null>('updated');
  protected readonly reviewStates = computed(() => reportReviewStateOptions((key) => this.languageService.t(key)));

  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportingTxt = signal(false);

  private objectUrl: string | null = null;
  private pdfBlob: Blob | null = null;

  /** En celulares el PDF no se puede mostrar dentro de la página: se ofrece descargarlo. */
  protected readonly canPreviewPdf = canPreviewPdf();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.loadWarehouses();
    this.destroyRef.onDestroy(() => {
      this.revokeObjectUrl();
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    });

    effect(() => {
      this.allProducts();
      this.productId();
      this.warehouseId();
      this.dateFrom();
      this.dateTo();
      this.reviewState();
      this.scheduleGenerate();
    });
  }

  protected pickProduct(): void {
    const ref = this.dialogService.open<ProductPickerResult | null, unknown, ProductPickerDialog>(ProductPickerDialog);
    ref.closed.subscribe((result) => {
      if (result) {
        this.selectedProduct.set(result);
        this.productId.set(String(result.productId));
      }
    });
  }

  protected clearProduct(): void {
    this.selectedProduct.set(null);
    this.productId.set(null);
  }

  private async loadWarehouses(): Promise<void> {
    const items = await this.catalogService.getWarehouses();
    this.warehouses.set(items.map((item) => ({ value: String(item.id), label: item.name })));
  }

  private scheduleGenerate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => void this.onGenerate(), 400);
  }

  private async onGenerate(): Promise<void> {
    if ((!this.allProducts() && !this.productId()) || !this.warehouseId()) {
      this.previewUrl.set(null);
      return;
    }

    this.loading.set(true);
    try {
      const blob = await this.reportService.getKardexByProductReportPdfBlob(this.currentFilters());
      this.revokeObjectUrl();
      this.pdfBlob = blob;
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.error(this.languageService.t('reports.kardexByProduct.error'));
    } finally {
      this.loading.set(false);
    }
  }

  private currentFilters(): KardexByProductReportFilters {
    return {
      productId: !this.allProducts() && this.productId() ? Number(this.productId()) : undefined,
      warehouseId: Number(this.warehouseId()),
      dateFrom: this.dateFrom() ?? undefined,
      dateTo: this.dateTo() ?? undefined,
      reviewState: toReportReviewState(this.reviewState()),
    };
  }

  protected async onExportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      downloadBlob(await this.reportService.getKardexByProductReportExcelBlob(this.currentFilters()), 'kardex-por-material.xlsx');
    } catch {
      this.toastService.error(this.languageService.t('reports.excel.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected async onExportTxt(): Promise<void> {
    this.exportingTxt.set(true);
    try {
      downloadBlob(await this.reportService.getKardexByProductReportTxtBlob(this.currentFilters()), 'kardex-por-material.txt');
    } catch {
      this.toastService.error(this.languageService.t('reports.txt.error'));
    } finally {
      this.exportingTxt.set(false);
    }
  }

  protected onDownloadPdf(): void {
    if (this.pdfBlob) {
      downloadBlob(this.pdfBlob, 'kardex-por-material.pdf');
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
