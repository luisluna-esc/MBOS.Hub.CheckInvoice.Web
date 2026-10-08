import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import {
  PartySearchInput,
  PartySearchResult,
} from '../../../shared/components/party-search-input/party-search-input';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { Switch } from '../../../shared/components/switch/switch';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ExcelDownloadButton, PdfDownloadButton, downloadBlob } from '../excel-download-button/excel-download-button';
import { AccountReceivablesReportFilters } from '../report.models';
import { ReportService } from '../report.service';
import { canPreviewPdf } from '../../../core/files/pdf';

/** Opción "Todos los estados": no es un estado real, significa no filtrar. */
const ALL_VALUE = 'all';

/** "Por cobrar": pendientes y con pago retrasado juntas (el backend lo entiende como "open"). */
const OPEN_STATUS_VALUE = 'open';

@Component({
  selector: 'app-account-receivables-report',
  imports: [FormsModule, PartySearchInput, Select, DatePicker, Skeleton, Switch, TranslatePipe, ExcelDownloadButton, PdfDownloadButton],
  templateUrl: './account-receivables-report.html',
})
export class AccountReceivablesReport {
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  /** Encendido: reporte de todos los clientes y el select de Cliente queda desactivado. */
  protected readonly general = signal(false);
  protected readonly selectedClient = signal<PartySearchResult | null>(null);
  protected readonly clientId = signal<string | null>(null);
  // Por defecto solo lo que falta cobrar (pendientes y retrasadas): con muchos pastores, el
  // historial completo de cuentas pagadas haría pesado el reporte.
  protected readonly status = signal<string>(OPEN_STATUS_VALUE);
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);

  /** Hay algo que mostrar: el reporte general o el de un cliente elegido. */
  protected readonly canGenerate = computed(() => this.general() || !!this.clientId());

  protected readonly statusOptions = computed<SelectOption[]>(() => [
    { value: OPEN_STATUS_VALUE, label: this.languageService.t('reports.accountReceivables.openStatuses') },
    { value: 'pending', label: this.languageService.t('accountReceivables.status.pending') },
    { value: 'late', label: this.languageService.t('accountReceivables.status.late') },
    { value: 'paid', label: this.languageService.t('accountReceivables.status.paid') },
    { value: ALL_VALUE, label: this.languageService.t('reports.accountReceivables.allStatuses') },
  ]);

  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);

  private objectUrl: string | null = null;
  private pdfBlob: Blob | null = null;

  /** En celulares el PDF no se puede mostrar dentro de la página: se ofrece descargarlo. */
  protected readonly canPreviewPdf = canPreviewPdf();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeObjectUrl();
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    });

    // Se genera cuando hay qué mostrar (general o un cliente) y se actualiza al cambiar filtros.
    effect(() => {
      this.general();
      this.clientId();
      this.status();
      this.dateFrom();
      this.dateTo();
      if (this.canGenerate()) {
        this.scheduleGenerate();
      } else {
        this.clearPreview();
      }
    });
  }

  protected onClientPicked(result: PartySearchResult): void {
    this.selectedClient.set(result);
    this.clientId.set(String(result.id));
  }

  protected clearClient(): void {
    this.selectedClient.set(null);
    this.clientId.set(null);
  }

  private scheduleGenerate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => void this.onGenerate(), 400);
  }

  private clearPreview(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.revokeObjectUrl();
    this.previewUrl.set(null);
  }

  private async onGenerate(): Promise<void> {
    this.loading.set(true);
    try {
      const blob = await this.reportService.getAccountReceivablesReportPdfBlob(this.currentFilters());
      // Si mientras se generaba ya no hay qué mostrar, no se muestra.
      if (!this.canGenerate()) {
        return;
      }
      this.revokeObjectUrl();
      this.pdfBlob = blob;
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.show(this.languageService.t('reports.accountReceivables.error'));
    } finally {
      this.loading.set(false);
    }
  }

  private currentFilters(): AccountReceivablesReportFilters {
    return {
      clientId: !this.general() && this.clientId() ? Number(this.clientId()) : undefined,
      status: this.status() !== ALL_VALUE ? this.status() : undefined,
      dateFrom: this.dateFrom() ?? undefined,
      dateTo: this.dateTo() ?? undefined
    };
  }

  protected async onExportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      downloadBlob(await this.reportService.getAccountReceivablesReportExcelBlob(this.currentFilters()), 'cuentas-por-cobrar.xlsx');
    } catch {
      this.toastService.show(this.languageService.t('reports.excel.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected onDownloadPdf(): void {
    if (this.pdfBlob) {
      downloadBlob(this.pdfBlob, 'cuentas-por-cobrar.pdf');
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
