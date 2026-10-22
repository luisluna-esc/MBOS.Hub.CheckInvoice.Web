import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { openPdfTab, showPdf } from '../../../../core/files/pdf';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { minIssueDateIso } from '../../../../core/catalogs/current-warehouse-periods';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { StockInfo, StockService } from '../../../../core/warehouses/stock.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Input as AppInput } from '../../../../shared/components/input/input';
import {
  ProductPickerData,
  ProductPickerDialog,
  ProductPickerResult,
} from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { ShortcutDirective } from '../../../../shared/directives/shortcut.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { BatchPastor } from '../issue-batch-pastors/issue-batch-pastors';
import { IssueBatchRequest } from '../issue.models';
import { IssueService } from '../issue.service';

const PAYMENT_TYPE_CODES = ['cash', 'credit', 'installments'] as const;

interface BatchMaterial {
  product: ProductPickerResult;
  stock: StockInfo | null;
}

/**
 * Salida por lote, paso 2: los datos de la salida y el cobro valen para todos los pastores;
 * después se eligen los materiales (también para todos) y en la planilla va la cantidad de
 * cada pastor. "Igual para todos" llena una columna entera; Enter baja al pastor siguiente.
 */
@Component({
  selector: 'app-issue-batch-create',
  imports: [ShortcutDirective, ReactiveFormsModule, AppInput, Select, Checkbox, DatePicker, ProductPhoto, TranslatePipe, DecimalPipe],
  templateUrl: './issue-batch-create.html',
})
export class IssueBatchCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly issueService = inject(IssueService);
  private readonly stockService = inject(StockService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly todayIso = localDateIso();
  protected readonly minIssueDate = minIssueDateIso();

  protected readonly pastors = signal<BatchPastor[]>((history.state as { pastors?: BatchPastor[] }).pastors ?? []);
  protected readonly materials = signal<BatchMaterial[]>([]);
  /** Cantidad de cada pastor por material: clave "clientId:productId". */
  protected readonly quantities = signal<Record<string, number>>({});
  protected readonly headerConfirmed = signal(false);
  /** Buscador de la tabla: filtra las filas por pastor o distrito (sin perder lo escrito). */
  protected readonly pastorSearch = signal('');
  protected readonly visiblePastors = computed(() => {
    const text = normalize(this.pastorSearch());
    return text
      ? this.pastors().filter((p) => normalize(p.name).includes(text) || normalize(p.districtName ?? '').includes(text))
      : this.pastors();
  });
  protected readonly saving = signal(false);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly printTypes = signal<CatalogItem[]>([]);

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    this.warehouses().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly printTypeOptions = computed<SelectOption[]>(() =>
    this.printTypes().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly paymentTypeOptions = computed<SelectOption[]>(() =>
    PAYMENT_TYPE_CODES.map((code) => ({ value: code, label: this.languageService.t(`issues.form.paymentTypes.${code}`) }))
  );

  protected readonly headerForm = new FormGroup({
    warehouseId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    printTypeId: new FormControl('', { nonNullable: true }),
    issueDate: new FormControl(this.todayIso, { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    sendToAccountsReceivable: new FormControl(false, { nonNullable: true }),
    paymentType: new FormControl('', { nonNullable: true }),
    paymentDetail: new FormControl('', { nonNullable: true }),
    dueDate: new FormControl('', { nonNullable: true }),
  });

  protected readonly headerInvalid = toSignal(
    this.headerForm.statusChanges.pipe(
      startWith(this.headerForm.status),
      map((status) => status !== 'VALID' && status !== 'DISABLED'),
      takeUntilDestroyed()
    ),
    { initialValue: true }
  );

  protected readonly sendToAccountsReceivable = toSignal(
    this.headerForm.controls.sendToAccountsReceivable.valueChanges.pipe(
      startWith(this.headerForm.controls.sendToAccountsReceivable.value),
      takeUntilDestroyed()
    ),
    { initialValue: false }
  );

  /** Total de cada material en el lote (suma de todos los pastores). */
  protected readonly materialTotals = computed(() => {
    const quantities = this.quantities();
    const totals: Record<number, number> = {};
    for (const material of this.materials()) {
      const productId = material.product.productId;
      totals[productId] = this.pastors().reduce((sum, p) => sum + (quantities[key(p.clientId, productId)] ?? 0), 0);
    }
    return totals;
  });

  /** Materiales cuyo total del lote pasa el stock disponible. */
  protected readonly exceedingMaterials = computed(() => {
    const totals = this.materialTotals();
    return this.materials().filter((m) => m.stock && (totals[m.product.productId] ?? 0) > m.stock.availableQuantity);
  });

  /** Pastores que no tienen ninguna cantidad: no generan salida. */
  protected readonly emptyPastors = computed(() => {
    const quantities = this.quantities();
    return this.pastors().filter((p) => !this.materials().some((m) => (quantities[key(p.clientId, m.product.productId)] ?? 0) > 0));
  });

  protected readonly pastorsWithMaterial = computed(() => this.pastors().length - this.emptyPastors().length);

  protected readonly batchTotalCost = computed(() =>
    this.pastors().reduce((sum, p) => sum + this.pastorTotal(p.clientId), 0)
  );

  protected readonly saveDisabled = computed(
    () =>
      !this.headerConfirmed() ||
      this.materials().length === 0 ||
      this.pastorsWithMaterial() === 0 ||
      this.exceedingMaterials().length > 0 ||
      this.saving()
  );

  constructor() {
    // Sin pastores (ej. se recargó la página) no hay lote: se vuelve a elegirlos.
    if (this.pastors().length === 0) {
      void this.router.navigate(['/issues/batch']);
      return;
    }
    void this.loadCatalogs();

    // El tipo de pago solo es obligatorio mientras se envíe a cuentas por cobrar.
    effect(() => {
      const required = this.sendToAccountsReceivable();
      const control = this.headerForm.controls.paymentType;
      control.setValidators(required ? [Validators.required] : []);
      if (!required) {
        control.setValue('', { emitEvent: false });
      }
      control.updateValueAndValidity();
    });
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, printTypes] = await settleCatalogs([
      this.catalogService.getActiveWarehouses(),
      this.catalogService.getPrintTypes(),
    ]);
    this.warehouses.set(warehouses);
    this.printTypes.set(printTypes);
    if (warehouses.length === 1) {
      this.headerForm.controls.warehouseId.setValue(String(warehouses[0].id));
    }
  }

  protected readonly continueAttempted = signal(false);

  protected onContinue(): void {
    if (this.headerInvalid()) {
      this.continueAttempted.set(true);
      this.headerForm.markAllAsTouched();
      return;
    }
    this.headerForm.disable();
    this.headerConfirmed.set(true);
    // El stock de los materiales ya elegidos se vuelve a leer por si cambió el almacén.
    this.materials().forEach((material) => void this.loadStock(material.product.productId));
    if (this.materials().length === 0) {
      setTimeout(() => this.addMaterial());
    }
  }

  protected onEditHeader(): void {
    this.headerForm.enable();
    this.headerConfirmed.set(false);
  }

  protected addMaterial(): void {
    const warehouseId = Number(this.headerForm.getRawValue().warehouseId) || null;
    const ref = this.dialogService.open<ProductPickerResult | null, ProductPickerData, ProductPickerDialog>(ProductPickerDialog, {
      data: { warehouseId, inStockOnly: true, excludedProductIds: this.materials().map((m) => m.product.productId) },
    });
    ref.closed.subscribe((result) => {
      if (!result) {
        return;
      }
      this.materials.update((current) => [...current, { product: result, stock: null }]);
      void this.loadStock(result.productId);
      // El cursor va a "Igual para todos" del material nuevo.
      setTimeout(() => this.host.querySelector<HTMLInputElement>(`input[data-all="${result.productId}"]`)?.focus());
    });
  }

  protected removeMaterial(productId: number): void {
    this.materials.update((current) => current.filter((m) => m.product.productId !== productId));
    this.quantities.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([k]) => !k.endsWith(`:${productId}`)))
    );
  }

  protected removePastor(clientId: number): void {
    this.pastors.update((current) => current.filter((p) => p.clientId !== clientId));
    this.quantities.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith(`${clientId}:`)))
    );
    if (this.pastors().length === 0) {
      void this.router.navigate(['/issues/batch']);
    }
  }

  private async loadStock(productId: number): Promise<void> {
    const warehouseId = Number(this.headerForm.getRawValue().warehouseId);
    if (!warehouseId) {
      return;
    }
    const stock = await this.stockService.get(warehouseId, productId);
    this.materials.update((current) => current.map((m) => (m.product.productId === productId ? { ...m, stock } : m)));
  }

  protected quantity(clientId: number, productId: number): number | null {
    return this.quantities()[key(clientId, productId)] ?? null;
  }

  protected onQuantity(clientId: number, productId: number, event: Event): void {
    const value = toQuantity((event.target as HTMLInputElement).value);
    this.quantities.update((current) => {
      const next = { ...current };
      if (value > 0) {
        next[key(clientId, productId)] = value;
      } else {
        delete next[key(clientId, productId)];
      }
      return next;
    });
  }

  /** "Igual para todos": la misma cantidad para todos los pastores de ese material. */
  protected applyToAll(productId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = toQuantity(input.value);
    this.quantities.update((current) => {
      const next = { ...current };
      for (const pastor of this.pastors()) {
        if (value > 0) {
          next[key(pastor.clientId, productId)] = value;
        } else {
          delete next[key(pastor.clientId, productId)];
        }
      }
      return next;
    });
    input.value = '';
  }

  protected onPastorSearch(event: Event): void {
    this.pastorSearch.set((event.target as HTMLInputElement).value);
  }

  /** Enter en "Igual para todos" lo aplica; en una cantidad, baja al pastor siguiente del mismo material. */
  protected onAllEnter(productId: number, event: Event): void {
    event.preventDefault();
    this.applyToAll(productId, event);
  }

  protected onQuantityEnter(row: number, productId: number, event: Event): void {
    event.preventDefault();
    this.host.querySelector<HTMLInputElement>(`input[data-cell="${row + 1}-${productId}"]`)?.focus();
  }

  protected pastorTotal(clientId: number): number {
    const quantities = this.quantities();
    return this.materials().reduce(
      (sum, m) => sum + (quantities[key(clientId, m.product.productId)] ?? 0) * (m.stock?.averageCost ?? 0),
      0
    );
  }

  protected exceeds(material: BatchMaterial): boolean {
    return !!material.stock && (this.materialTotals()[material.product.productId] ?? 0) > material.stock.availableQuantity;
  }

  protected async onSave(): Promise<void> {
    await this.save(false);
  }

  /** Guarda y abre la hoja de firmas para imprimirla (los pastores firman a mano). */
  protected async onSaveAndPrint(): Promise<void> {
    await this.save(true);
  }

  private async save(print: boolean): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }
    this.saving.set(true);
    const raw = this.headerForm.getRawValue();
    const quantities = this.quantities();
    const request: IssueBatchRequest = {
      warehouseId: Number(raw.warehouseId),
      // La tarjeta "Salida por lote" ya dice qué es: no se pide otro tipo de salida.
      issueTypeId: null,
      printTypeId: raw.printTypeId ? Number(raw.printTypeId) : null,
      issueDate: raw.issueDate || null,
      description: raw.description.trim() || null,
      sendToAccountsReceivable: raw.sendToAccountsReceivable,
      paymentType: raw.sendToAccountsReceivable ? raw.paymentType || null : null,
      paymentDetail: raw.sendToAccountsReceivable ? raw.paymentDetail || null : null,
      dueDate: raw.sendToAccountsReceivable ? raw.dueDate || null : null,
      pastors: this.pastors()
        .map((p) => ({
          clientId: p.clientId,
          details: this.materials()
            .map((m) => ({ productId: m.product.productId, quantity: quantities[key(p.clientId, m.product.productId)] ?? 0 }))
            .filter((d) => d.quantity > 0),
        }))
        .filter((p) => p.details.length > 0),
    };

    // La pestaña se abre antes de esperar al servidor para que el navegador no la bloquee.
    const newTab = print ? openPdfTab() : null;
    try {
      const response = await this.issueService.createBatch(request);
      this.toastService.success(response.messages?.[0]?.description ?? this.languageService.t('issues.batch.saved'));
      if (print) {
        try {
          const blob = await this.issueService.getBatchPdf(response.id);
          showPdf(blob, `salida-lote-${response.id}.pdf`, newTab);
        } catch {
          newTab?.close();
        }
      }
      void this.router.navigate(['/issues']);
    } catch (error) {
      newTab?.close();
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages
        ?.map((m) => m.description)
        .join(' ');
      this.toastService.error(this.languageService.t('issues.batch.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate(['/issues']);
  }
}

function key(clientId: number, productId: number): string {
  return `${clientId}:${productId}`;
}

/** Cantidades enteras y no negativas. */
function toQuantity(value: string): number {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
