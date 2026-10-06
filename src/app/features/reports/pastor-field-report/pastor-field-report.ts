import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import {
  PartySearchInput,
  PartySearchResult,
} from '../../../shared/components/party-search-input/party-search-input';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { Tooltip } from '../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { firstDayOfCurrentMonthIso } from '../report-date.util';
import { ExcelDownloadButton, downloadBlob } from '../excel-download-button/excel-download-button';
import { PastorFieldReportFilters } from '../report.models';
import { ReportService } from '../report.service';

@Component({
  selector: 'app-pastor-field-report',
  imports: [FormsModule, PartySearchInput, DatePicker, Skeleton, Tooltip, TranslatePipe, ExcelDownloadButton],
  templateUrl: './pastor-field-report.html',
})
export class PastorFieldReport {
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly selectedClient = signal<PartySearchResult | null>(null);
  protected readonly clientId = signal<string | null>(null);
  protected readonly dateFrom = signal<string | null>(firstDayOfCurrentMonthIso());
  protected readonly dateTo = signal<string | null>(null);

  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);

  private objectUrl: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeObjectUrl();
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    });

    effect(() => {
      this.clientId();
      this.dateFrom();
      this.dateTo();
      this.scheduleGenerate();
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

  private async onGenerate(): Promise<void> {
    if (!this.clientId()) {
      this.previewUrl.set(null);
      return;
    }

    this.loading.set(true);
    try {
      const blob = await this.reportService.getPastorFieldReportPdfBlob(this.currentFilters());
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.show(this.languageService.t('reports.pastorField.error'));
    } finally {
      this.loading.set(false);
    }
  }

  private currentFilters(): PastorFieldReportFilters {
    return {
      clientId: Number(this.clientId()),
      dateFrom: this.dateFrom() ?? undefined,
      dateTo: this.dateTo() ?? undefined
    };
  }

  protected async onExportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      downloadBlob(await this.reportService.getPastorFieldReportExcelBlob(this.currentFilters()), 'campo-pastor.xlsx');
    } catch {
      this.toastService.show(this.languageService.t('reports.excel.error'));
    } finally {
      this.exporting.set(false);
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
