import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { minIssueDateIso } from '../../../../core/catalogs/current-warehouse-periods';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { openPdfTab, showPdf } from '../../../../core/files/pdf';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { PartySearchInput, PartySearchResult } from '../../../../shared/components/party-search-input/party-search-input';
import {
  ProductPickerData,
  ProductPickerDialog,
  ProductPickerResult,
} from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PendingReceiptService, apiError } from '../pending-receipt.service';

interface NoteLine {
  product: ProductPickerResult;
  quantity: number | null;
}

/**
 * Nota de ingreso sin factura: solo almacén, fecha de recepción y cantidades. No toca el stock ni
 * los reportes; los precios y el proveedor definitivo llegan con la factura.
 */
@Component({
  selector: 'app-pending-receipt-create',
  imports: [FormsModule, Select, DatePicker, PartySearchInput, ProductPhoto, TranslatePipe],
  templateUrl: './pending-receipt-create.html',
})
export class PendingReceiptCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly service = inject(PendingReceiptService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly todayIso = localDateIso();
  protected readonly minDateIso = minIssueDateIso();

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    this.warehouses().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly warehouseId = signal<string | null>(null);
  protected readonly receivedDate = signal<string | null>(this.todayIso);
  protected readonly supplier = signal<PartySearchResult | null>(null);
  protected readonly description = signal('');
  protected readonly lines = signal<NoteLine[]>([]);
  protected readonly saving = signal(false);

  protected readonly canSave = computed(
    () =>
      !!this.warehouseId() &&
      !!this.receivedDate() &&
      this.lines().length > 0 &&
      this.lines().every((line) => (line.quantity ?? 0) > 0) &&
      !this.saving()
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [warehouses] = await settleCatalogs([this.catalogService.getActiveWarehouses()]);
    this.warehouses.set(warehouses);
    if (warehouses.length === 1) {
      this.warehouseId.set(String(warehouses[0].id));
    }
  }

  protected addProduct(): void {
    const ref = this.dialogService.open<ProductPickerResult | null, ProductPickerData, ProductPickerDialog>(ProductPickerDialog, {
      data: { excludedProductIds: this.lines().map((line) => line.product.productId) },
    });
    ref.closed.subscribe((product) => {
      if (product) {
        this.lines.update((lines) => [...lines, { product, quantity: null }]);
        // El cursor pasa a la cantidad de la línea nueva.
        setTimeout(() => document.querySelector<HTMLInputElement>(`[data-quantity="${product.productId}"]`)?.focus());
      }
    });
  }

  protected onQuantity(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, quantity: value === '' ? null : Number(value) } : line)));
  }

  /** Enter en la cantidad de la última línea abre la ventana para agregar otro material. */
  protected onQuantityEnter(index: number, event: Event): void {
    event.preventDefault();
    if (index === this.lines().length - 1 && (this.lines()[index].quantity ?? 0) > 0) {
      this.addProduct();
    }
  }

  protected removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected async save(print = false): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    // La pestaña se abre antes de cualquier await para que el navegador no la bloquee.
    const tab = print ? openPdfTab() : null;
    try {
      const response = await this.service.create({
        warehouseId: Number(this.warehouseId()),
        supplierId: this.supplier()?.id ?? null,
        receivedDate: this.receivedDate(),
        description: this.description().trim() || null,
        details: this.lines().map((line) => ({ productId: line.product.productId, quantity: line.quantity ?? 0 })),
      });
      this.toastService.success(response.messages[0]?.description ?? this.languageService.t('pendingReceipts.form.success'));
      if (tab) {
        try {
          showPdf(await this.service.notePdf(response.id), `formulario-recepcion-${response.id}.pdf`, tab);
        } catch {
          tab.close();
        }
      }
      void this.router.navigate(['/receipts/pending']);
    } catch (error) {
      tab?.close();
      this.toastService.error(this.languageService.t('pendingReceipts.form.error'), apiError(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/receipts']);
  }
}
