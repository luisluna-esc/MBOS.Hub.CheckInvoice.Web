import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { PartySearchInput, PartySearchResult } from '../../../../shared/components/party-search-input/party-search-input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PendingReceipt } from '../pending-receipt.models';
import { PendingReceiptService, apiError } from '../pending-receipt.service';

// Nombres de la tabla receipt_type: la nota se vuelve una compra con factura o con retención.
const PURCHASE_WITH_INVOICE = 'Compras con Factura';
const PURCHASE_WITH_RETENTION = 'Compras con Retencion';

interface InvoiceLine {
  key: string;
  pendingReceiptId: number;
  noteNumber: string;
  productId: number;
  code: string | null;
  name: string;
  received: number;
  delivered: number;
  quantity: number | null;
  unitPrice: number | null;
}

/**
 * Unir la factura: una o varias notas del mismo almacén. Se escribe el precio de cada material y,
 * si la factura dice otra cantidad, se corrige. Al guardar, cada nota pasa a ser una entrada con su
 * fecha de recepción y sus entregas, salidas: recién ahí cuentan en los reportes.
 */
@Component({
  selector: 'app-pending-receipt-validate',
  imports: [FormsModule, Select, DatePicker, PartySearchInput, TranslatePipe, DecimalPipe],
  templateUrl: './pending-receipt-validate.html',
})
export class PendingReceiptValidate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly service = inject(PendingReceiptService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly noteIds = (inject(ActivatedRoute).snapshot.queryParamMap.get('ids') ?? '')
    .split(',')
    .map(Number)
    .filter((id) => id > 0);

  protected readonly todayIso = localDateIso();
  protected readonly notes = signal<PendingReceipt[]>([]);
  protected readonly receiptTypes = signal<CatalogItem[]>([]);
  protected readonly purchaseTypeOptions = computed<SelectOption[]>(() =>
    this.receiptTypes().flatMap((item) => {
      if (item.name === PURCHASE_WITH_INVOICE) {
        return [{ value: String(item.id), label: this.languageService.t('receipts.form.withInvoice') }];
      }
      if (item.name === PURCHASE_WITH_RETENTION) {
        return [{ value: String(item.id), label: this.languageService.t('receipts.form.withRetention') }];
      }
      return [];
    })
  );

  protected readonly receiptTypeId = signal<string | null>(null);
  protected readonly withRetention = computed(
    () => this.receiptTypes().find((item) => String(item.id) === this.receiptTypeId())?.name === PURCHASE_WITH_RETENTION
  );
  protected readonly supplier = signal<PartySearchResult | null>(null);
  protected readonly taxId = signal('');
  protected readonly invoiceNumber = signal('');
  protected readonly purchaseDate = signal<string | null>(null);
  protected readonly invoiceTotal = signal<number | null>(null);
  protected readonly lines = signal<InvoiceLine[]>([]);
  protected readonly saving = signal(false);

  protected readonly linesTotal = computed(() =>
    this.lines().reduce((sum, line) => sum + (line.quantity ?? 0) * (line.unitPrice ?? 0), 0)
  );
  protected readonly mismatch = computed(() => {
    const total = this.invoiceTotal();
    return total !== null && Math.abs(this.linesTotal() - total) > 0.01;
  });
  protected readonly invalidLines = computed(() =>
    this.lines().filter((line) => (line.quantity ?? 0) <= 0 || (line.quantity ?? 0) < line.delivered || line.unitPrice === null)
  );

  protected readonly canSave = computed(
    () =>
      this.notes().length > 0 &&
      !!this.receiptTypeId() &&
      !!this.supplier() &&
      !!this.taxId().trim() &&
      (this.withRetention() || !!this.invoiceNumber().trim()) &&
      !!this.purchaseDate() &&
      this.invoiceTotal() !== null &&
      !this.mismatch() &&
      this.invalidLines().length === 0 &&
      !this.saving()
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [notes, [receiptTypes]] = await Promise.all([
        Promise.all(this.noteIds.map((id) => this.service.get(id))),
        settleCatalogs([this.catalogService.getReceiptTypes()]),
      ]);
      const pending = notes.filter((note) => note.status === 'pendiente');
      if (pending.length === 0) {
        this.toastService.warning(this.languageService.t('pendingReceipts.validate.nothing'));
        void this.router.navigate(['/receipts/pending']);
        return;
      }
      this.notes.set(pending);
      this.receiptTypes.set(receiptTypes);
      this.lines.set(
        pending.flatMap((note) =>
          note.lines.map((line) => ({
            key: `${note.pendingReceiptId}-${line.productId}`,
            pendingReceiptId: note.pendingReceiptId,
            noteNumber: note.noteNumber,
            productId: line.productId,
            code: line.code,
            name: line.name,
            received: line.received,
            delivered: line.delivered,
            quantity: line.received,
            unitPrice: null,
          }))
        )
      );
      // Si la nota ya tenía proveedor, se propone el mismo.
      const noteSupplier = pending.find((note) => note.supplierId);
      if (noteSupplier?.supplierId) {
        this.supplier.set({
          id: noteSupplier.supplierId,
          partyId: 0,
          name: noteSupplier.supplierName ?? '',
          taxId: null,
          email: null,
          mobilePhone: null,
        });
      }
    } catch {
      this.toastService.error(this.languageService.t('pendingReceipts.notFound'));
      void this.router.navigate(['/receipts/pending']);
    }
  }

  protected onSupplierPicked(supplier: PartySearchResult): void {
    this.supplier.set(supplier);
    if (supplier.taxId) {
      this.taxId.set(supplier.taxId);
    }
  }

  protected onLine(key: string, field: 'quantity' | 'unitPrice', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.lines.update((lines) =>
      lines.map((line) => (line.key === key ? { ...line, [field]: value === '' ? null : Number(value) } : line))
    );
  }

  protected onTotal(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.invoiceTotal.set(value === '' ? null : Number(value));
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      const response = await this.service.validate({
        pendingReceiptIds: this.notes().map((note) => note.pendingReceiptId),
        receiptTypeId: Number(this.receiptTypeId()),
        supplierId: this.supplier()?.id ?? null,
        taxId: this.taxId().trim() || null,
        invoiceNumber: this.invoiceNumber().trim() || null,
        purchaseDate: this.purchaseDate(),
        invoiceTotal: this.invoiceTotal(),
        lines: this.lines().map((line) => ({
          pendingReceiptId: line.pendingReceiptId,
          productId: line.productId,
          quantity: line.quantity ?? 0,
          unitPrice: line.unitPrice ?? 0,
        })),
      });
      this.toastService.success(response.messages[0]?.description ?? this.languageService.t('pendingReceipts.validate.success'));
      void this.router.navigate(['/receipts/pending'], { queryParams: { status: 'validado' } });
    } catch (error) {
      this.toastService.error(this.languageService.t('pendingReceipts.validate.error'), apiError(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/receipts/pending']);
  }
}
