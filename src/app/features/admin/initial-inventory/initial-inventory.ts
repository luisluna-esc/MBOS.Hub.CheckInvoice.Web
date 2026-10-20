import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogItem } from '../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../core/catalogs/catalog.service';
import { downloadBlob } from '../../../core/files/pdf';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface InitialInventoryLine {
  productId: number;
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
}

interface InitialInventoryResult {
  lines: InitialInventoryLine[];
  errors: string[];
  totalQuantity: number;
  totalCost: number;
  receiptId: number | null;
  noteNumber: string | null;
}

/**
 * Inventario inicial: se carga una sola vez por almacén desde un Excel. Se descarga la plantilla
 * (con todos los productos activos), se llenan cantidad y costo, se revisa y recién se carga.
 */
@Component({
  selector: 'app-initial-inventory',
  imports: [FormsModule, Select, TranslatePipe, DecimalPipe],
  templateUrl: './initial-inventory.html',
})
export class InitialInventory {
  private readonly http = inject(HttpClient);
  private readonly catalogService = inject(CatalogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  private readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    this.warehouses().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly warehouseId = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly result = signal<InitialInventoryResult | null>(null);
  protected readonly working = signal(false);

  /** Revisado sin errores: ya se puede cargar. */
  protected readonly canConfirm = computed(() => {
    const result = this.result();
    return !!result && result.errors.length === 0 && result.lines.length > 0 && !result.receiptId;
  });

  constructor() {
    void this.catalogService.getActiveWarehouses().then((items) => {
      this.warehouses.set(items);
      if (items.length === 1) {
        this.warehouseId.set(String(items[0].id));
      }
    });
  }

  protected async onDownloadTemplate(): Promise<void> {
    try {
      const blob = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/Receipts/initial-inventory/template`, { responseType: 'blob' })
      );
      downloadBlob(blob, 'plantilla-inventario-inicial.xlsx');
    } catch {
      this.toastService.error(this.languageService.t('initialInventory.templateError'));
    }
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.result.set(null);
  }

  protected onWarehouseChange(value: string | null): void {
    this.warehouseId.set(value);
    this.result.set(null);
  }

  protected async onReview(): Promise<void> {
    await this.send(false);
  }

  protected async onConfirm(): Promise<void> {
    await this.send(true);
  }

  private async send(confirm: boolean): Promise<void> {
    const file = this.file();
    const warehouseId = this.warehouseId();
    if (!file || !warehouseId) {
      this.toastService.warning(this.languageService.t('initialInventory.missing'));
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('warehouseId', warehouseId);
    form.append('confirm', String(confirm));

    this.working.set(true);
    try {
      const response = await firstValueFrom(
        this.http.post<{ data: InitialInventoryResult }>(`${environment.apiUrl}/Receipts/initial-inventory`, form)
      );
      this.result.set(response.data);
      if (confirm && response.data.noteNumber) {
        this.toastService.success(this.languageService.t('initialInventory.done', { note: response.data.noteNumber }));
      }
    } catch (error) {
      // Con errores el servidor responde 400 y manda igual el detalle de cada fila.
      const data = (error as { error?: { data?: InitialInventoryResult } })?.error?.data;
      if (data?.errors) {
        this.result.set(data);
      } else {
        this.toastService.error(this.languageService.t('initialInventory.error'));
      }
    } finally {
      this.working.set(false);
    }
  }
}
