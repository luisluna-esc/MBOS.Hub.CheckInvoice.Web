import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { firstDayOfCurrentMonthIso } from '../report-date.util';
import { ALL_WAREHOUSES_VALUE, warehouseIdFilter, warehouseOptionsWithGeneral } from '../report-warehouse.util';
import { ExcelDownloadButton, TxtDownloadButton, PdfDownloadButton, downloadBlob } from '../excel-download-button/excel-download-button';
import { TransfersReportFilters } from '../report.models';
import { ReportService } from '../report.service';
import { canPreviewPdf } from '../../../core/files/pdf';

/** Transferencias entre almacenes propios: por origen, destino y fechas. */
@Component({
  selector: 'app-transfers-report',
  imports: [FormsModule, Select, DatePicker, Skeleton, TranslatePipe, ExcelDownloadButton, TxtDownloadButton, PdfDownloadButton],
  templateUrl: './transfers-report.html',
})
export class TransfersReport {
  private readonly catalogService = inject(CatalogService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly warehouses = signal<SelectOption[]>([]);
  protected readonly sourceWarehouseId = signal<string | null>(ALL_WAREHOUSES_VALUE);
  protected readonly destinationWarehouseId = signal<string | null>(ALL_WAREHOUSES_VALUE);
  protected readonly dateFrom = signal<string | null>(firstDayOfCurrentMonthIso());
  protected readonly dateTo = signal<string | null>(null);

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

    // Igual que los demás reportes: no genera nada al entrar, solo al cambiar un filtro.
    let isFirstRun = true;
    effect(() => {
      this.sourceWarehouseId();
      this.destinationWarehouseId();
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
    this.loading.set(true);
    try {
      const blob = await this.reportService.getTransfersReportPdfBlob(this.currentFilters());
      this.revokeObjectUrl();
      this.pdfBlob = blob;
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.error(this.languageService.t('reports.transfers.error'));
    } finally {
      this.loading.set(false);
    }
  }

  private currentFilters(): TransfersReportFilters {
    return {
      sourceWarehouseId: warehouseIdFilter(this.sourceWarehouseId()),
      destinationWarehouseId: warehouseIdFilter(this.destinationWarehouseId()),
      dateFrom: this.dateFrom() ?? undefined,
      dateTo: this.dateTo() ?? undefined,
    };
  }

  protected async onExportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      downloadBlob(await this.reportService.getTransfersReportExcelBlob(this.currentFilters()), 'transferencias-de-almacen.xlsx');
    } catch {
      this.toastService.error(this.languageService.t('reports.excel.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected async onExportTxt(): Promise<void> {
    this.exportingTxt.set(true);
    try {
      downloadBlob(await this.reportService.getTransfersReportTxtBlob(this.currentFilters()), 'transferencias-de-almacen.txt');
    } catch {
      this.toastService.error(this.languageService.t('reports.txt.error'));
    } finally {
      this.exportingTxt.set(false);
    }
  }

  protected onDownloadPdf(): void {
    if (this.pdfBlob) {
      downloadBlob(this.pdfBlob, 'transferencias-de-almacen.pdf');
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
