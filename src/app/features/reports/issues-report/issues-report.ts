import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { Tooltip } from '../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { firstDayOfCurrentMonthIso } from '../report-date.util';
import { ALL_WAREHOUSES_VALUE, warehouseIdFilter, warehouseOptionsWithGeneral } from '../report-warehouse.util';
import { ExcelDownloadButton, PdfDownloadButton, downloadBlob } from '../excel-download-button/excel-download-button';
import { IssuesReportFilters } from '../report.models';
import { ReportService } from '../report.service';
import { canPreviewPdf } from '../../../core/files/pdf';

@Component({
  selector: 'app-issues-report',
  imports: [FormsModule, Select, DatePicker, Skeleton, Tooltip, TranslatePipe, ExcelDownloadButton, PdfDownloadButton],
  templateUrl: './issues-report.html',
})
export class IssuesReport {
  private readonly catalogService = inject(CatalogService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly warehouses = signal<SelectOption[]>([]);
  protected readonly warehouseId = signal<string | null>(ALL_WAREHOUSES_VALUE);
  protected readonly dateFrom = signal<string | null>(firstDayOfCurrentMonthIso());
  protected readonly dateTo = signal<string | null>(null);

  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);

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

    // No genera nada al entrar a la pantalla, solo cuando el usuario cambia un filtro.
    // El efecto igual debe leer las señales en esta primera ejecución para registrar las
    // dependencias, si no nunca reaccionaría a cambios posteriores.
    let isFirstRun = true;
    effect(() => {
      this.warehouseId();
      this.dateFrom();
      this.dateTo();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      this.scheduleGenerate();
    });
  }

  private async loadWarehouses(): Promise<void> {
    const items = await this.catalogService.getWarehouses();
    this.warehouses.set(warehouseOptionsWithGeneral(items, this.languageService.t('reports.filters.allWarehouses')));
  }

  private scheduleGenerate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => void this.onGenerate(), 400);
  }

  private async onGenerate(): Promise<void> {
    if (!this.warehouseId()) {
      this.previewUrl.set(null);
      return;
    }

    this.loading.set(true);
    try {
      const blob = await this.reportService.getIssuesReportPdfBlob(this.currentFilters());
      this.revokeObjectUrl();
      this.pdfBlob = blob;
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.show(this.languageService.t('reports.issues.error'));
    } finally {
      this.loading.set(false);
    }
  }

  private currentFilters(): IssuesReportFilters {
    return {
      warehouseId: warehouseIdFilter(this.warehouseId()),
      dateFrom: this.dateFrom() ?? undefined,
      dateTo: this.dateTo() ?? undefined
    };
  }

  protected async onExportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      downloadBlob(await this.reportService.getIssuesReportExcelBlob(this.currentFilters()), 'salidas-de-almacen.xlsx');
    } catch {
      this.toastService.show(this.languageService.t('reports.excel.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected onDownloadPdf(): void {
    if (this.pdfBlob) {
      downloadBlob(this.pdfBlob, 'salidas-de-almacen.pdf');
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
