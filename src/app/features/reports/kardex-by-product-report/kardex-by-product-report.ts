import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
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
import { Tooltip } from '../../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { firstDayOfCurrentMonthIso } from '../report-date.util';
import { ReportService } from '../report.service';

@Component({
  selector: 'app-kardex-by-product-report',
  imports: [FormsModule, Select, DatePicker, Skeleton, Tooltip, TranslatePipe],
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

  protected readonly selectedProduct = signal<ProductPickerResult | null>(null);
  protected readonly productId = signal<string | null>(null);
  protected readonly warehouses = signal<SelectOption[]>([]);
  protected readonly warehouseId = signal<string | null>(null);
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
      this.productId();
      this.warehouseId();
      this.dateFrom();
      this.dateTo();
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
    if (!this.productId() || !this.warehouseId()) {
      this.previewUrl.set(null);
      return;
    }

    this.loading.set(true);
    try {
      const blob = await this.reportService.getKardexByProductReportPdfBlob({
        productId: Number(this.productId()),
        warehouseId: Number(this.warehouseId()),
        dateFrom: this.dateFrom() ?? undefined,
        dateTo: this.dateTo() ?? undefined
      });
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toastService.show(this.languageService.t('reports.kardexByProduct.error'));
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
