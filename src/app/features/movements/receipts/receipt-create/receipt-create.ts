import { DecimalPipe, formatNumber } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, LOCALE_ID, viewChildren } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { minIssueDateIso } from '../../../../core/catalogs/current-warehouse-periods';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { DialogService } from '../../../../core/dialog/dialog.service';
import {
  ProductPickerData,
  ProductPickerDialog,
  ProductPickerResult,
} from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReportService } from '../../../reports/report.service';
import { SupplierService } from '../../../catalogs/suppliers/supplier.service';
import { ReceiptRequest } from '../receipt.models';
import { ReceiptService } from '../receipt.service';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { openPdfTab, showPdf } from '../../../../core/files/pdf';
import { ShortcutDirective } from '../../../../shared/directives/shortcut.directive';

type DetailLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
  unitPrice: FormControl<string>;
}>;

// Nombres de la tabla receipt_type. Este formulario es solo de Compras: devoluciones, ajustes
// e inventario inicial tienen su propio camino desde Entradas.
const PURCHASE_WITH_INVOICE = 'Compras con Factura';
const PURCHASE_WITH_RETENTION = 'Compras con Retencion';
const DONATION = 'Donacion';

/** Con retención (sin factura) el costo unitario es el precio dividido entre este factor. Igual que ReceiptCosting en el backend. */
const RETENTION_COST_FACTOR = 0.92;

@Component({
  selector: 'app-receipt-create',
  imports: [ShortcutDirective, ReactiveFormsModule, AppInput, Select, DatePicker, ProductPhoto, TranslatePipe, DecimalPipe],
  templateUrl: './receipt-create.html',
})
export class ReceiptCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly receiptService = inject(ReceiptService);
  private readonly reportService = inject(ReportService);
  private readonly supplierService = inject(SupplierService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly locale = inject(LOCALE_ID);

  private readonly productButtons = viewChildren<ElementRef<HTMLButtonElement>>('productButton');
  private readonly dialogService = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly route = inject(ActivatedRoute);
  private readonly motive = this.route.snapshot.data['motive'] as 'donation' | 'correct' | undefined;

  /**
   * Donación: mismo formulario sin factura, NIT, valor total ni fecha de compra; quien dona se
   * eligió antes y el valor de cada producto es estimado (con ese costo entra al inventario).
   */
  protected readonly isDonation = signal(this.motive === 'donation');

  /**
   * Corrección de una entrada ya registrada: el mismo formulario con la nota cargada. No se
   * guarda directo: se envía como solicitud con motivo y la aprueba el Contador.
   */
  protected readonly isCorrection = this.motive === 'correct';
  private readonly correctionId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly correctionNote = signal<string | null>(null);
  protected readonly reasonControl = new FormControl('', { nonNullable: true });
  private readonly reasonValue = toSignal(
    this.reasonControl.valueChanges.pipe(startWith(this.reasonControl.value), takeUntilDestroyed()),
    { initialValue: '' }
  );

  protected readonly saving = signal(false);
  protected readonly lockedSupplierName = signal<string | null>(null);
  /** NIT/CI que trae el proveedor: con factura no se cambia; con retención se puede corregir. */
  protected readonly supplierTaxId = signal<string | null>(null);
  protected readonly headerConfirmed = signal(false);
  protected readonly lineProducts = signal<(ProductPickerResult | null)[]>([]);
  protected readonly todayIso = localDateIso();
  /** La fecha de ingreso solo puede ser del mes anterior o del actual, hasta hoy (al corregir, dentro del mes de la nota). */
  protected readonly minEntryDateIso = signal(minIssueDateIso());
  protected readonly maxEntryDateIso = signal(this.todayIso);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly receiptTypes = signal<CatalogItem[]>([]);

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    this.warehouses().map((item) => ({ value: String(item.id), label: item.name }))
  );

  /** Tipo elegido en la tarjeta de Entradas (null si se entró sin tarjeta: se elige en el formulario). */
  protected readonly presetReceiptTypeId = signal<number | null>(null);
  protected readonly presetReceiptTypeName = computed(() => {
    const id = this.presetReceiptTypeId();
    return id ? (this.receiptTypes().find((item) => item.id === id)?.name ?? null) : null;
  });

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

  protected readonly headerForm = new FormGroup({
    warehouseId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    supplierId: new FormControl('', { nonNullable: true }),
    receiptTypeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    invoiceNumber: new FormControl('', { nonNullable: true }),
    taxId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    invoiceTotal: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    purchaseDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    issueDate: new FormControl(this.todayIso, { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
  });

  protected readonly detailsArray = new FormArray<DetailLineGroup>([]);

  private readonly receiptTypeIdValue = toSignal(
    this.headerForm.controls.receiptTypeId.valueChanges.pipe(
      startWith(this.headerForm.controls.receiptTypeId.value),
      takeUntilDestroyed()
    ),
    { initialValue: '' }
  );

  /** Con retención cambian los nombres de los campos (N° de documento, CI) y el costo es precio / 0,92. */
  protected readonly withRetention = computed(() => {
    const typeId = Number(this.receiptTypeIdValue());
    return this.receiptTypes().find((item) => item.id === typeId)?.name === PURCHASE_WITH_RETENTION;
  });

  protected readonly headerInvalid = toSignal(
    this.headerForm.statusChanges.pipe(
      startWith(this.headerForm.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: true }
  );

  protected readonly detailsInvalid = toSignal(
    this.detailsArray.statusChanges.pipe(
      startWith(this.detailsArray.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: true }
  );

  protected readonly continueDisabled = computed(() => this.headerInvalid() || this.headerConfirmed());

  protected readonly detailsValues = toSignal(
    this.detailsArray.valueChanges.pipe(startWith(this.detailsArray.value), takeUntilDestroyed())
  );

  protected readonly invoiceTotalValue = toSignal(
    this.headerForm.controls.invoiceTotal.valueChanges.pipe(
      startWith(this.headerForm.controls.invoiceTotal.value),
      takeUntilDestroyed()
    ),
    { initialValue: '' }
  );

  /**
   * El 100% de la compra. Con factura es el Valor total de la compra; con retención es ese valor
   * dividido entre 0,92, porque las líneas se comparan por costo (precio / 0,92).
   */
  protected readonly baseTotal = computed(() => {
    const total = Number(this.invoiceTotalValue()) || 0;
    return this.withRetention() ? total / RETENTION_COST_FACTOR : total;
  });

  /** Debajo del Valor total, con retención: cuánto es el 100% (valor total / 0,92). */
  protected readonly retentionBaseHint = computed(() =>
    this.withRetention() && this.baseTotal()
      ? this.languageService.t('receipts.form.retentionBase', { total: formatNumber(this.baseTotal(), this.locale, '1.2-2') })
      : ''
  );

  /** Suma de los totales de línea: es lo que debe coincidir con el 100% de la compra. */
  protected readonly linesTotalSum = computed(() =>
    (this.detailsValues() ?? []).reduce((sum, _line, index) => sum + this.lineTotal(index), 0)
  );

  // La suma de las líneas debe coincidir exactamente con el Valor total de la compra (ni más ni
  // menos) — 0.01 de tolerancia por redondeo de centavos, no por permitir diferencias reales.
  protected readonly totalMismatch = computed(() => {
    if (this.isDonation()) {
      return false;
    }
    const total = this.baseTotal();
    if (!total) {
      return false;
    }
    return Math.abs(this.linesTotalSum() - total) > 0.01;
  });

  /** Porcentaje que representa la suma de las líneas sobre el Valor total de la compra (100% = cuadra). */
  protected readonly linesTotalPercentage = computed(() => {
    const total = this.baseTotal();
    return total ? (this.linesTotalSum() / total) * 100 : null;
  });

  /** Lo que sobra (positivo) o falta (negativo) en las líneas respecto del Valor total de la compra. */
  protected readonly totalDifference = computed(() => this.linesTotalSum() - this.baseTotal());

  /** Dice cuánto suman las líneas, cuánto la compra y cuánto sobra o falta, en vez de solo "no cuadra". */
  protected readonly totalMismatchMessage = computed(() => {
    const difference = this.totalDifference();
    const format = (value: number) => formatNumber(value, this.locale, '1.2-2');
    return this.languageService.t(
      difference > 0 ? 'receipts.form.totalMismatchOver' : 'receipts.form.totalMismatchUnder',
      {
        lines: format(this.linesTotalSum()),
        invoice: format(this.baseTotal()),
        difference: format(Math.abs(difference)),
      }
    );
  });

  protected readonly saveDisabled = computed(
    () =>
      !this.headerConfirmed() ||
      this.detailsInvalid() ||
      this.detailsArray.length === 0 ||
      this.totalMismatch() ||
      (this.isCorrection && (this.headerInvalid() || !this.reasonValue().trim())) ||
      this.saving()
  );

  constructor() {
    if (this.isCorrection && this.correctionId) {
      void this.loadForCorrection(this.correctionId);
    } else {
      void this.loadCatalogs();
      const state = history.state as { supplierId?: number; receiptTypeId?: number | null };
      if (state.supplierId) {
        void this.lockSupplier(state.supplierId);
      }
      // El tipo viene de la tarjeta elegida en Entradas: ya no se vuelve a preguntar.
      if (state.receiptTypeId) {
        this.headerForm.controls.receiptTypeId.setValue(String(state.receiptTypeId));
        this.presetReceiptTypeId.set(state.receiptTypeId);
      }
    }

    // Con factura el N° de factura es obligatorio; con retención el N° de documento es opcional
    // (a veces no hay ningún papel). El NIT del proveedor no se cambia con factura.
    this.headerForm.controls.receiptTypeId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.applyPurchaseTypeRules();
    });

    if (this.isDonation()) {
      this.applyDonationRules();
    }
  }

  private applyDonationRules(): void {
    for (const name of ['invoiceNumber', 'taxId', 'invoiceTotal', 'purchaseDate'] as const) {
      this.headerForm.controls[name].clearValidators();
      this.headerForm.controls[name].updateValueAndValidity();
    }
  }

  /** Carga la nota a corregir: datos de la compra y productos, listos para cambiar. */
  private async loadForCorrection(receiptId: number): Promise<void> {
    let summary: Awaited<ReturnType<ReceiptService['getSummary']>>;
    let warehouses: CatalogItem[];
    let receiptTypes: CatalogItem[];
    try {
      [summary, [warehouses, receiptTypes]] = await Promise.all([
        this.receiptService.getSummary(receiptId),
        settleCatalogs([this.catalogService.getWarehouses(), this.catalogService.getReceiptTypes()]),
      ]);
    } catch {
      // La nota no existe o no se pudo leer: se avisa y se vuelve al historial.
      this.toastService.error(this.languageService.t('receipts.correction.notFound'));
      void this.router.navigate(['/reports/receipt-history']);
      return;
    }
    if (summary.relatedIssueId != null) {
      this.toastService.warning(this.languageService.t('receipts.actions.correctionReturn'));
      void this.router.navigate(['/reports/receipt-history']);
      return;
    }
    this.warehouses.set(warehouses);
    this.receiptTypes.set(receiptTypes);
    this.correctionNote.set(summary.noteNumber);
    this.lockedSupplierName.set(summary.supplierName);
    if (summary.receiptTypeName === DONATION) {
      this.isDonation.set(true);
      this.applyDonationRules();
    }

    const controls = this.headerForm.controls;
    controls.warehouseId.setValue(summary.warehouseId ? String(summary.warehouseId) : '');
    controls.warehouseId.disable();
    controls.receiptTypeId.setValue(summary.receiptTypeId ? String(summary.receiptTypeId) : '');
    controls.receiptTypeId.disable();
    controls.supplierId.setValue(summary.supplierId ? String(summary.supplierId) : '');
    controls.invoiceNumber.setValue(summary.invoiceNumber ?? '');
    controls.taxId.setValue(summary.taxId ?? '');
    controls.taxId.enable();
    controls.invoiceTotal.setValue(summary.invoiceTotal != null ? String(summary.invoiceTotal) : '');
    controls.purchaseDate.setValue(summary.purchaseDate?.slice(0, 10) ?? '');
    controls.issueDate.setValue(summary.issueDate.slice(0, 10));
    controls.description.setValue(summary.description ?? '');

    // La fecha de ingreso solo se mueve dentro del mes de la nota (su número es de ese mes).
    const monthStart = `${summary.issueDate.slice(0, 7)}-01`;
    const [year, month] = summary.issueDate.slice(0, 7).split('-').map(Number);
    const monthEnd = localDateIso(new Date(year, month, 0));
    this.minEntryDateIso.set(monthStart);
    this.maxEntryDateIso.set(monthEnd < this.todayIso ? monthEnd : this.todayIso);

    for (const line of summary.lines) {
      this.detailsArray.push(
        new FormGroup({
          productId: new FormControl(String(line.productId), { nonNullable: true, validators: [Validators.required] }),
          quantity: new FormControl(String(line.quantity), { nonNullable: true }),
          unitPrice: new FormControl(String(line.unitPrice), { nonNullable: true }),
        })
      );
    }
    this.lineProducts.set(
      summary.lines.map((line) => ({
        productId: line.productId,
        name: line.name,
        code: line.code,
        departmentId: null,
        mediaTypeId: null,
        imageVersion: line.imageVersion,
      }))
    );
    this.headerConfirmed.set(true);
  }

  private applyPurchaseTypeRules(): void {
    if (this.isDonation() || this.isCorrection) {
      return;
    }
    const invoiceNumber = this.headerForm.controls.invoiceNumber;
    invoiceNumber.setValidators(this.withRetention() ? [] : [Validators.required]);
    invoiceNumber.updateValueAndValidity();

    // NIT (con factura) o CI (con retención): sale siempre de la ficha del proveedor y no se
    // edita en la nota, para que coincidan. Solo se escribe si el proveedor no lo tiene registrado.
    const taxId = this.headerForm.controls.taxId;
    if (this.supplierTaxId()) {
      taxId.setValue(this.supplierTaxId()!);
      taxId.disable();
    } else {
      taxId.enable();
    }
  }

  private async lockSupplier(supplierId: number): Promise<void> {
    const result = await this.supplierService.list(1, 1, { supplierId });
    const supplier = result.items[0];
    if (!supplier) {
      return;
    }

    this.headerForm.controls.supplierId.setValue(String(supplierId));
    this.headerForm.controls.taxId.setValue(supplier.taxId ?? '');
    this.supplierTaxId.set(supplier.taxId || null);
    this.lockedSupplierName.set(supplier.legalName || supplier.name);
    this.applyPurchaseTypeRules();
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, receiptTypes] = await settleCatalogs([
      this.catalogService.getActiveWarehouses(),
      this.catalogService.getReceiptTypes(),
    ]);
    this.warehouses.set(warehouses);
    this.receiptTypes.set(receiptTypes);

    // Con un solo almacén activo se marca solo; con varios, se elige a cuál entra la compra.
    if (warehouses.length === 1) {
      this.headerForm.controls.warehouseId.setValue(String(warehouses[0].id));
    }

    const donationType = receiptTypes.find((item) => item.name === DONATION);
    if (this.isDonation() && donationType) {
      this.headerForm.controls.receiptTypeId.setValue(String(donationType.id));
    }
  }

  protected onContinue(): void {
    if (this.continueDisabled()) {
      this.headerForm.markAllAsTouched();
      return;
    }
    this.headerForm.disable();
    this.headerConfirmed.set(true);
    if (this.detailsArray.length === 0) {
      this.addProduct();
    }
  }

  /** "Agregar producto": abre la ventana de productos y lo elegido entra como una línea nueva. */
  protected addProduct(): void {
    this.addLine();
    void this.pickProduct(this.detailsArray.length - 1, true);
  }

  protected addLine(): void {
    this.detailsArray.push(
      new FormGroup({
        productId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl('', { nonNullable: true }),
        unitPrice: new FormControl('', { nonNullable: true }),
      })
    );
    this.lineProducts.update((current) => [...current, null]);
    // El cursor va al botón de producto de la línea nueva (Enter abre la ventana), para seguir
    // solo con el teclado.
    setTimeout(() => this.productButtons().at(-1)?.nativeElement.focus());
  }

  /** Enter en el precio de la última línea agrega otra línea. */
  protected onPriceEnter(index: number, event: Event): void {
    event.preventDefault();
    if (index === this.detailsArray.length - 1 && this.detailsArray.at(index).valid) {
      this.addProduct();
    }
  }

  protected removeLine(index: number): void {
    this.detailsArray.removeAt(index);
    this.lineProducts.update((current) => current.filter((_, i) => i !== index));
  }

  protected excludedFor(index: number): number[] {
    return this.lineProducts().flatMap((product, i) => (product && i !== index ? [product.productId] : []));
  }

  /** Ventana para elegir el producto: muestra los ya elegidos en otras líneas sin dejar repetirlos. */
  protected pickProduct(index: number, isNew = false): void {
    const ref = this.dialogService.open<ProductPickerResult | null, ProductPickerData, ProductPickerDialog>(ProductPickerDialog, {
      data: { excludedProductIds: this.excludedFor(index) },
    });
    ref.closed.subscribe((result) => {
      if (result) {
        this.onProductPicked(index, result);
        // Elegido el producto, el cursor pasa a la cantidad de esa línea.
        setTimeout(() => this.host.querySelectorAll('tbody tr')[index]?.querySelector<HTMLInputElement>('app-input input')?.focus());
      } else if (isNew) {
        // Se cerró la ventana sin elegir: la línea nueva no queda vacía.
        this.removeLine(index);
      } else {
        setTimeout(() => this.productButtons()[index]?.nativeElement.focus());
      }
    });
  }

  protected onProductPicked(index: number, result: ProductPickerResult): void {
    this.detailsArray.at(index).controls.productId.setValue(String(result.productId));
    this.lineProducts.update((current) => {
      const next = [...current];
      next[index] = result;
      return next;
    });
  }

  protected lineTotal(index: number): number {
    const line = (this.detailsValues() ?? [])[index];
    if (!line) {
      return 0;
    }
    // Con retención el total de la línea va a costo (precio / 0,92), como entra al inventario.
    const total = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
    return this.withRetention() ? total / RETENTION_COST_FACTOR : total;
  }

  /** Costo con el que entra al inventario: con retención, precio / 0,92. */
  protected lineUnitCost(index: number): number {
    const price = Number((this.detailsValues() ?? [])[index]?.unitPrice) || 0;
    return this.withRetention() ? Math.round((price / RETENTION_COST_FACTOR) * 100) / 100 : price;
  }

  protected linePercentage(index: number): number | null {
    const total = this.baseTotal();
    if (!total) {
      return null;
    }
    return (this.lineTotal(index) / total) * 100;
  }

  protected async onSave(): Promise<void> {
    await this.save(false);
  }

  protected async onSaveAndPrint(): Promise<void> {
    await this.save(true);
  }

  private async save(print: boolean): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }

    this.saving.set(true);
    const raw = this.headerForm.getRawValue();
    const details = this.detailsArray.getRawValue();

    if (this.isCorrection && this.correctionId) {
      await this.sendCorrection(this.correctionId, raw, details);
      return;
    }

    const request: ReceiptRequest = {
      warehouseId: Number(raw.warehouseId),
      supplierId: raw.supplierId ? Number(raw.supplierId) : null,
      receiptTypeId: raw.receiptTypeId ? Number(raw.receiptTypeId) : null,
      invoiceNumber: this.isDonation() ? null : raw.invoiceNumber || null,
      taxId: this.isDonation() ? null : raw.taxId || null,
      invoiceTotal: this.isDonation() ? null : raw.invoiceTotal ? Number(raw.invoiceTotal) : null,
      issueDate: raw.issueDate || null,
      purchaseDate: this.isDonation() ? null : raw.purchaseDate || null,
      description: raw.description || null,
      details: details.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    };

    // Se abre la pestaña en blanco de forma síncrona, antes de cualquier await, para que el
    // navegador no la trate como un popup no solicitado y la bloquee — el comprobante se
    // genera con datos ya guardados en el servidor, así que solo se completa si corresponde.
    const newTab = print ? openPdfTab() : null;

    try {
      const response = await this.receiptService.create(request);
      this.toastService.success(this.languageService.t('receipts.form.success'));
      if (print) {
        try {
          const blob = await this.reportService.getReceiptVoucherPdfBlob(response.id);
          showPdf(blob, `ingreso-${String(response.id).padStart(5, '0')}.pdf`, newTab);
        } catch {
          newTab?.close();
        }
      }
      void this.router.navigate(['/receipts']);
    } catch (error) {
      newTab?.close();
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('receipts.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  private async sendCorrection(
    receiptId: number,
    raw: ReturnType<typeof this.headerForm.getRawValue>,
    details: ReturnType<typeof this.detailsArray.getRawValue>
  ): Promise<void> {
    try {
      await this.receiptService.requestEdit({
        receiptId,
        reason: this.reasonControl.value.trim(),
        supplierId: raw.supplierId ? Number(raw.supplierId) : null,
        taxId: raw.taxId || null,
        invoiceNumber: raw.invoiceNumber || null,
        description: raw.description || null,
        invoiceTotal: this.isDonation() ? null : raw.invoiceTotal ? Number(raw.invoiceTotal) : null,
        issueDate: raw.issueDate || null,
        purchaseDate: this.isDonation() ? null : raw.purchaseDate || null,
        details: details.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      });
      this.toastService.success(this.languageService.t('receipts.correction.sent'));
      void this.router.navigate(['/reports/receipt-history']);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('receipts.correction.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate([this.isCorrection ? '/reports/receipt-history' : '/receipts']);
  }
}
