import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { formatCalendarDate } from '../../../../core/dates/calendar-date';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { openPdfTab, showPdf } from '../../../../core/files/pdf';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PendingDelivery, PendingReceipt, PendingReceiptFilters, PendingReceiptStatus } from '../pending-receipt.models';
import { PendingReceiptService, apiError } from '../pending-receipt.service';

const PAGE_SIZE = 20;
const STATUSES: PendingReceiptStatus[] = ['pendiente', 'validado', 'anulado'];

/**
 * Ingresos pendientes de factura: las notas sin factura con lo recibido, lo entregado y lo que
 * queda. Desde aquí se entrega material, se anula y se une la factura (marcando una o varias
 * notas del mismo almacén). Es aparte de los demás reportes: estas notas todavía no cuentan en ellos.
 */
@Component({
  selector: 'app-pending-receipts-list',
  imports: [FormsModule, RouterLink, Select, LoadingSkeleton, TranslatePipe, DecimalPipe],
  templateUrl: './pending-receipts-list.html',
})
export class PendingReceiptsList {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly service = inject(PendingReceiptService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly authService = inject(AuthService);
  protected readonly canManage = computed(() => this.authService.hasActiveRolePermission('trabajo'));

  /** Recepción y entrega son días, no instantes: se muestran sin correrlos por zona horaria. */
  protected readonly day = formatCalendarDate;

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly warehouseOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('pendingReceipts.filters.allWarehouses') },
    ...this.warehouses().map((item) => ({ value: String(item.id), label: item.name })),
  ]);
  protected readonly statusOptions = computed<SelectOption[]>(() => [
    ...STATUSES.map((status) => ({ value: status, label: this.languageService.t(`pendingReceipts.status.${status}`) })),
    { value: '', label: this.languageService.t('pendingReceipts.status.all') },
  ]);

  protected readonly warehouseId = signal<string | null>('');
  protected readonly status = signal<string | null>(
    (inject(ActivatedRoute).snapshot.queryParamMap.get('status') as PendingReceiptStatus | null) ?? 'pendiente'
  );
  protected readonly noteNumber = signal('');

  protected readonly loading = signal(true);
  protected readonly notes = signal<PendingReceipt[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / PAGE_SIZE)));

  /** Notas marcadas para unir una misma factura (solo pendientes y del mismo almacén). */
  protected readonly selected = signal<Set<number>>(new Set());
  protected readonly selectedNotes = computed(() => this.notes().filter((note) => this.selected().has(note.pendingReceiptId)));
  protected readonly selectedWarehouseId = computed(() => this.selectedNotes()[0]?.warehouseId ?? null);

  constructor() {
    void this.loadCatalogs();
    void this.load();
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses] = await settleCatalogs([this.catalogService.getWarehouses()]);
    this.warehouses.set(warehouses);
  }

  private filters(): PendingReceiptFilters {
    return {
      warehouseId: this.warehouseId() ? Number(this.warehouseId()) : null,
      status: (this.status() || null) as PendingReceiptStatus | null,
      noteNumber: this.noteNumber().trim() || null,
    };
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.service.list(this.pageNumber(), PAGE_SIZE, this.filters());
      this.notes.set(result.items);
      this.totalRecords.set(result.totalRecords);
      // Lo marcado que ya no está en la lista (o dejó de estar pendiente) se desmarca.
      const visible = new Set(result.items.filter((note) => note.status === 'pendiente').map((note) => note.pendingReceiptId));
      this.selected.update((current) => new Set([...current].filter((id) => visible.has(id))));
    } catch (error) {
      this.toastService.error(this.languageService.t('pendingReceipts.loadError'), apiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected search(): void {
    this.pageNumber.set(1);
    void this.load();
  }

  protected goToPage(page: number): void {
    this.pageNumber.set(page);
    void this.load();
  }

  protected canSelect(note: PendingReceipt): boolean {
    const warehouseId = this.selectedWarehouseId();
    return note.status === 'pendiente' && (warehouseId === null || warehouseId === note.warehouseId || this.selected().has(note.pendingReceiptId));
  }

  protected toggle(note: PendingReceipt): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(note.pendingReceiptId)) {
        next.delete(note.pendingReceiptId);
      } else {
        next.add(note.pendingReceiptId);
      }
      return next;
    });
  }

  protected joinInvoice(): void {
    const ids = [...this.selected()];
    if (ids.length > 0) {
      void this.router.navigate(['/receipts/pending/validate'], { queryParams: { ids: ids.join(',') } });
    }
  }

  protected activeDeliveries(note: PendingReceipt): PendingDelivery[] {
    return note.deliveries.filter((delivery) => !delivery.isVoided);
  }

  protected hasRemaining(note: PendingReceipt): boolean {
    return note.lines.some((line) => line.remaining > 0);
  }

  protected deliveryText(delivery: PendingDelivery): string {
    return delivery.lines.map((line) => `${line.quantity} ${line.name}`).join(', ');
  }

  protected voidNote(note: PendingReceipt): void {
    this.confirm('pendingReceipts.voidTitle', 'pendingReceipts.voidMessage', { note: note.noteNumber }, async () => {
      await this.service.void(note.pendingReceiptId);
      this.toastService.success(this.languageService.t('pendingReceipts.voided'));
    });
  }

  protected voidDelivery(note: PendingReceipt, delivery: PendingDelivery): void {
    this.confirm('pendingReceipts.voidDeliveryTitle', 'pendingReceipts.voidDeliveryMessage', { note: note.noteNumber }, async () => {
      await this.service.voidDelivery(delivery.pendingDeliveryId);
      this.toastService.success(this.languageService.t('pendingReceipts.deliveryVoided'));
    });
  }

  private confirm(titleKey: string, messageKey: string, params: Record<string, string>, action: () => Promise<void>): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data: {
        title: this.languageService.t(titleKey),
        message: this.languageService.t(messageKey, params),
        confirmLabel: this.languageService.t('pendingReceipts.void'),
      },
    });
    ref.closed.subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }
      try {
        await action();
        void this.load();
      } catch (error) {
        this.toastService.error(this.languageService.t('pendingReceipts.actionError'), apiError(error));
      }
    });
  }

  protected async printReport(): Promise<void> {
    const tab = openPdfTab();
    try {
      const blob = await this.service.pdf(this.filters());
      showPdf(blob, 'ingresos-pendientes-de-factura.pdf', tab);
    } catch (error) {
      tab?.close();
      this.toastService.error(this.languageService.t('pendingReceipts.loadError'), apiError(error));
    }
  }
}
