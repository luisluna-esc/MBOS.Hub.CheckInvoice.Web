import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { minIssueDateIso } from '../../../../core/catalogs/current-warehouse-periods';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { PartySearchInput, PartySearchResult } from '../../../../shared/components/party-search-input/party-search-input';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { BATCH_ISSUE_TYPE } from '../../issues/issue-motives/issue-motives';
import { PendingReceipt } from '../pending-receipt.models';
import { PendingReceiptService, apiError } from '../pending-receipt.service';

const PAYMENT_TYPE_CODES = ['cash', 'credit', 'installments'] as const;

/**
 * Entregar material de una nota sin factura. Tampoco descuenta del stock: al unir la factura de
 * la nota se vuelve una salida con esta fecha, tipo, cliente y cuenta por cobrar.
 */
@Component({
  selector: 'app-pending-delivery-create',
  imports: [FormsModule, Select, DatePicker, Checkbox, PartySearchInput, ProductPhoto, TranslatePipe, DecimalPipe],
  templateUrl: './pending-delivery-create.html',
})
export class PendingDeliveryCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly service = inject(PendingReceiptService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly noteId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly todayIso = localDateIso();
  protected readonly note = signal<PendingReceipt | null>(null);
  /** Desde la recepción de la nota (y dentro del mes anterior o el actual) hasta hoy. */
  protected readonly minDateIso = computed(() => {
    const received = this.note()?.receivedDate.slice(0, 10) ?? '';
    const min = minIssueDateIso();
    return received > min ? received : min;
  });

  protected readonly issueTypes = signal<CatalogItem[]>([]);
  protected readonly issueTypeOptions = computed<SelectOption[]>(() =>
    this.issueTypes()
      .filter((item) => item.name !== BATCH_ISSUE_TYPE)
      .map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly paymentTypeOptions = computed<SelectOption[]>(() =>
    PAYMENT_TYPE_CODES.map((code) => ({ value: code, label: this.languageService.t(`issues.form.paymentTypes.${code}`) }))
  );

  protected readonly deliveryDate = signal<string | null>(this.todayIso);
  protected readonly issueTypeId = signal<string | null>(null);
  protected readonly client = signal<PartySearchResult | null>(null);
  protected readonly description = signal('');
  protected readonly sendToAccountsReceivable = signal(false);
  protected readonly paymentType = signal<string | null>(null);
  protected readonly dueDate = signal<string | null>(null);
  protected readonly paymentDetail = signal('');
  /** Cantidad a entregar por material (productId). */
  protected readonly quantities = signal<Record<number, number | null>>({});
  protected readonly saving = signal(false);

  protected readonly exceeding = computed(() =>
    (this.note()?.lines ?? []).filter((line) => (this.quantities()[line.productId] ?? 0) > line.remaining)
  );

  protected readonly canSave = computed(() => {
    const entered = Object.values(this.quantities()).some((value) => (value ?? 0) > 0);
    const receivableOk = !this.sendToAccountsReceivable() || (!!this.client() && !!this.paymentType());
    return !!this.note() && !!this.deliveryDate() && entered && this.exceeding().length === 0 && receivableOk && !this.saving();
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [note, [issueTypes]] = await Promise.all([
        this.service.get(this.noteId),
        settleCatalogs([this.catalogService.getIssueTypes()]),
      ]);
      if (note.status !== 'pendiente') {
        this.toastService.warning(this.languageService.t('pendingReceipts.delivery.notPending'));
        void this.router.navigate(['/receipts/pending']);
        return;
      }
      this.note.set(note);
      this.issueTypes.set(issueTypes);
    } catch {
      this.toastService.error(this.languageService.t('pendingReceipts.notFound'));
      void this.router.navigate(['/receipts/pending']);
    }
  }

  protected onQuantity(productId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.quantities.update((current) => ({ ...current, [productId]: value === '' ? null : Number(value) }));
  }

  /** "Todo": lo que queda de ese material en la nota. */
  protected fill(productId: number, remaining: number): void {
    this.quantities.update((current) => ({ ...current, [productId]: remaining }));
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    const receivable = this.sendToAccountsReceivable();
    try {
      const response = await this.service.deliver(this.noteId, {
        deliveryDate: this.deliveryDate(),
        issueTypeId: this.issueTypeId() ? Number(this.issueTypeId()) : null,
        clientId: this.client()?.id ?? null,
        description: this.description().trim() || null,
        sendToAccountsReceivable: receivable,
        paymentType: receivable ? this.paymentType() : null,
        paymentDetail: receivable ? this.paymentDetail().trim() || null : null,
        dueDate: receivable ? this.dueDate() : null,
        details: Object.entries(this.quantities())
          .filter(([, quantity]) => (quantity ?? 0) > 0)
          .map(([productId, quantity]) => ({ productId: Number(productId), quantity: quantity ?? 0 })),
      });
      this.toastService.success(response.messages[0]?.description ?? this.languageService.t('pendingReceipts.delivery.success'));
      void this.router.navigate(['/receipts/pending']);
    } catch (error) {
      this.toastService.error(this.languageService.t('pendingReceipts.delivery.error'), apiError(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/receipts/pending']);
  }
}
