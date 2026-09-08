import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ReportService } from '../report.service';

@Component({
  selector: 'app-account-receivables-report',
  imports: [FormsModule, Select, DatePicker, Skeleton, TranslatePipe],
  templateUrl: './account-receivables-report.html',
})
export class AccountReceivablesReport {
  private readonly catalogService = inject(CatalogService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly clients = signal<SelectOption[]>([]);
  protected readonly clientId = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);

  protected readonly statusOptions = computed<SelectOption[]>(() => [
    { value: 'pending', label: this.languageService.t('accountReceivables.status.pending') },
    { value: 'paid', label: this.languageService.t('accountReceivables.status.paid') },
  ]);

  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);

  private objectUrl: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.loadClients();
    this.destroyRef.onDestroy(() => {
      this.revokeObjectUrl();
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    });

    effect(() => {
      this.clientId();
      this.status();
      this.dateFrom();
      this.dateTo();
      this.scheduleGenerate();
    });
  }

  private async loadClients(): Promise<void> {
    const items = await this.catalogService.getClients();
    this.clients.set(items.map((item) => ({ value: String(item.id), label: item.name })));
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
      const blob = await this.reportService.getAccountReceivablesReportPdfBlob({
        clientId: this.clientId() ? Number(this.clientId()) : undefined,
        status: this.status() ?? undefined,
        dateFrom: this.dateFrom() ?? undefined,
        dateTo: this.dateTo() ?? undefined
      });
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.show(this.languageService.t('reports.accountReceivables.error'));
    } finally {
      this.loading.set(false);
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
