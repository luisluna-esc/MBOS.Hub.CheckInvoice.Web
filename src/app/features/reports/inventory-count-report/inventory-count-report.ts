import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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
import { ReportService } from '../report.service';

@Component({
  selector: 'app-inventory-count-report',
  imports: [FormsModule, Select, DatePicker, Skeleton, Tooltip, TranslatePipe],
  templateUrl: './inventory-count-report.html',
})
export class InventoryCountReport {
  private readonly catalogService = inject(CatalogService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modes = computed<SelectOption[]>(() => [
    { value: 'template', label: this.languageService.t('reports.inventoryCount.modeTemplate') },
    { value: 'result', label: this.languageService.t('reports.inventoryCount.modeResult') }
  ]);
  protected readonly mode = signal<string>('template');
  protected readonly hint = computed(() =>
    this.languageService.t(
      this.mode() === 'template' ? 'reports.inventoryCount.hintTemplate' : 'reports.inventoryCount.hintResult'
    )
  );

  protected readonly warehouses = signal<SelectOption[]>([]);
  protected readonly warehouseId = signal<string | null>(ALL_WAREHOUSES_VALUE);
  protected readonly dateFrom = signal<string | null>(firstDayOfCurrentMonthIso());
  protected readonly dateTo = signal<string | null>(null);

  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);

  private objectUrl: string | null = null;
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
      this.mode();
      this.warehouseId();
      this.dateFrom();
      this.dateTo();
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
      const filters = {
        warehouseId: warehouseIdFilter(this.warehouseId()),
        dateFrom: this.dateFrom() ?? undefined,
        dateTo: this.dateTo() ?? undefined
      };
      const blob =
        this.mode() === 'template'
          ? await this.reportService.getInventoryCountTemplatePdfBlob(filters)
          : await this.reportService.getInventoryCountReportPdfBlob(filters);
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.show(this.languageService.t('reports.inventoryCount.error'));
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
