import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import {
  currentAndPreviousWarehousePeriods,
  currentMonthKey,
  issueDateRangeForPeriod,
} from '../../../../core/catalogs/current-warehouse-periods';
import { operationalWarehouseOnly } from '../../../../core/catalogs/operational-warehouse';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { ProductPickerDialog, ProductPickerResult } from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReportService } from '../../../reports/report.service';
import { SupplierService } from '../../../catalogs/suppliers/supplier.service';
import { ReceiptRequest } from '../receipt.models';
import { ReceiptService } from '../receipt.service';

type DetailLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
  unitCost: FormControl<string>;
  workOrder: FormControl<string>;
  detail: FormControl<string>;
}>;

// 'Devolucion' y 'Ajuste' no se eligen a mano aquí: los crea automáticamente el apartado
// de Devoluciones (referenciando la Salida original) y el de Ajuste de Inventario — permitir
// elegirlos en este formulario genérico rompería esa referencia.
const HIDDEN_RECEIPT_TYPE_NAMES = ['Devolucion', 'Ajuste'];

@Component({
  selector: 'app-receipt-create',
  imports: [ReactiveFormsModule, AppInput, Select, DatePicker, TranslatePipe, DecimalPipe],
  templateUrl: './receipt-create.html',
})
export class ReceiptCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly receiptService = inject(ReceiptService);
  private readonly reportService = inject(ReportService);
  private readonly supplierService = inject(SupplierService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly supplierLocked = signal(false);
  protected readonly headerConfirmed = signal(false);
  protected readonly lineProducts = signal<(ProductPickerResult | null)[]>([]);
  protected readonly todayIso = new Date().toISOString().slice(0, 10);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly suppliers = signal<CatalogItem[]>([]);
  protected readonly receiptTypes = signal<CatalogItem[]>([]);
  protected readonly warehousePeriods = signal<CatalogItem[]>([]);

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    operationalWarehouseOnly(this.warehouses()).map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly supplierOptions = computed<SelectOption[]>(() =>
    this.suppliers().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly receiptTypeOptions = computed<SelectOption[]>(() =>
    this.receiptTypes()
      .filter((item) => !HIDDEN_RECEIPT_TYPE_NAMES.includes(item.name))
      .map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly warehousePeriodOptions = computed<SelectOption[]>(() =>
    currentAndPreviousWarehousePeriods(this.warehousePeriods()).map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly headerForm = new FormGroup({
    warehouseId: new FormControl('', { nonNullable: true }),
    warehousePeriodId: new FormControl('', { nonNullable: true }),
    supplierId: new FormControl('', { nonNullable: true }),
    receiptTypeId: new FormControl('', { nonNullable: true }),
    invoiceNumber: new FormControl('', { nonNullable: true }),
    taxId: new FormControl('', { nonNullable: true }),
    invoiceTotal: new FormControl('', { nonNullable: true }),
    issueDate: new FormControl(this.todayIso, { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
  });

  protected readonly detailsArray = new FormArray<DetailLineGroup>([]);

  private readonly warehousePeriodIdValue = toSignal(
    this.headerForm.controls.warehousePeriodId.valueChanges.pipe(
      startWith(this.headerForm.controls.warehousePeriodId.value),
      takeUntilDestroyed()
    ),
    { initialValue: '' }
  );

  // La Fecha de Emisión debe caer dentro del mes del Periodo de Almacén elegido (ej. si eliges
  // 2026-09, no puedes poner una fecha de agosto) — se recalcula cada vez que cambia el período.
  protected readonly issueDateRange = computed(() => {
    const periodId = Number(this.warehousePeriodIdValue());
    const periodName = this.warehousePeriods().find((period) => period.id === periodId)?.name ?? null;
    return issueDateRangeForPeriod(periodName);
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

  protected readonly linesTotalSum = computed(() =>
    (this.detailsValues() ?? []).reduce(
      (sum, line) => sum + (Number(line?.quantity) || 0) * (Number(line?.unitCost) || 0),
      0
    )
  );

  // La suma de las líneas debe coincidir exactamente con el Total de factura (ni más ni
  // menos) — 0.01 de tolerancia por redondeo de centavos, no por permitir diferencias reales.
  protected readonly totalMismatch = computed(() => {
    const total = Number(this.invoiceTotalValue());
    if (!total) {
      return false;
    }
    return Math.abs(this.linesTotalSum() - total) > 0.01;
  });

  protected readonly saveDisabled = computed(
    () =>
      !this.headerConfirmed() ||
      this.detailsInvalid() ||
      this.detailsArray.length === 0 ||
      this.totalMismatch() ||
      this.saving()
  );

  constructor() {
    void this.loadCatalogs();

    const state = history.state as { supplierId?: number };
    if (state.supplierId) {
      void this.lockSupplier(state.supplierId);
    }
  }

  private async lockSupplier(supplierId: number): Promise<void> {
    const result = await this.supplierService.list(1, 1, { supplierId });
    const supplier = result.items[0];
    if (!supplier) {
      return;
    }

    this.headerForm.controls.supplierId.setValue(String(supplierId));
    this.headerForm.controls.supplierId.disable();
    this.headerForm.controls.taxId.setValue(supplier.taxId ?? '');
    this.headerForm.controls.taxId.disable();
    this.supplierLocked.set(true);
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, suppliers, receiptTypes, warehousePeriods] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getSuppliers(),
      this.catalogService.getReceiptTypes(),
      this.catalogService.getWarehousePeriods(),
    ]);
    this.warehouses.set(warehouses);
    this.suppliers.set(suppliers);
    this.receiptTypes.set(receiptTypes);
    this.warehousePeriods.set(warehousePeriods);

    // Solo hay un almacén operativo: se marca solo, no hay nada que elegir.
    const [operationalWarehouse] = operationalWarehouseOnly(warehouses);
    if (operationalWarehouse) {
      this.headerForm.controls.warehouseId.setValue(String(operationalWarehouse.id));
      this.headerForm.controls.warehouseId.disable();
    }

    // Si no elige un período explícitamente, se asume el del mes actual.
    const currentPeriod = warehousePeriods.find((period) => period.name === currentMonthKey());
    if (currentPeriod) {
      this.headerForm.controls.warehousePeriodId.setValue(String(currentPeriod.id));
    }
  }

  protected onContinue(): void {
    if (this.continueDisabled()) {
      return;
    }
    this.headerForm.disable();
    this.headerConfirmed.set(true);
    if (this.detailsArray.length === 0) {
      this.addLine();
    }
  }

  protected addLine(): void {
    this.detailsArray.push(
      new FormGroup({
        productId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl('', { nonNullable: true }),
        unitCost: new FormControl('', { nonNullable: true }),
        workOrder: new FormControl('', { nonNullable: true }),
        detail: new FormControl('', { nonNullable: true }),
      })
    );
    this.lineProducts.update((current) => [...current, null]);
  }

  protected removeLine(index: number): void {
    this.detailsArray.removeAt(index);
    this.lineProducts.update((current) => current.filter((_, i) => i !== index));
  }

  protected lineTotal(index: number): number {
    const line = (this.detailsValues() ?? [])[index];
    if (!line) {
      return 0;
    }
    return (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
  }

  protected linePercentage(index: number): number | null {
    const total = Number(this.invoiceTotalValue());
    if (!total) {
      return null;
    }
    return (this.lineTotal(index) / total) * 100;
  }

  protected async pickProduct(index: number): Promise<void> {
    const ref = this.dialogService.open<ProductPickerResult | null, unknown, ProductPickerDialog>(ProductPickerDialog);
    ref.closed.subscribe((result) => {
      if (result) {
        this.detailsArray.at(index).controls.productId.setValue(String(result.productId));
        this.lineProducts.update((current) => {
          const next = [...current];
          next[index] = result;
          return next;
        });
      }
    });
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

    const request: ReceiptRequest = {
      warehouseId: Number(raw.warehouseId),
      warehousePeriodId: raw.warehousePeriodId ? Number(raw.warehousePeriodId) : null,
      supplierId: raw.supplierId ? Number(raw.supplierId) : null,
      receiptTypeId: raw.receiptTypeId ? Number(raw.receiptTypeId) : null,
      invoiceNumber: raw.invoiceNumber || null,
      taxId: raw.taxId || null,
      invoiceTotal: raw.invoiceTotal ? Number(raw.invoiceTotal) : null,
      issueDate: raw.issueDate || null,
      description: raw.description || null,
      details: details.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
        workOrder: line.workOrder || null,
        detail: line.detail || null,
      })),
    };

    // Se abre la pestaña en blanco de forma síncrona, antes de cualquier await, para que el
    // navegador no la trate como un popup no solicitado y la bloquee — el comprobante se
    // genera con datos ya guardados en el servidor, así que solo se completa si corresponde.
    const newTab = print ? window.open('', '_blank') : null;

    try {
      const response = await this.receiptService.create(request);
      this.toastService.show(this.languageService.t('receipts.form.success'));
      if (print) {
        try {
          const blob = await this.reportService.getReceiptVoucherPdfBlob(response.id);
          const url = URL.createObjectURL(blob);
          if (newTab) {
            newTab.location.href = url;
          } else {
            window.open(url, '_blank');
          }
        } catch {
          newTab?.close();
        }
      }
      void this.router.navigate(['/receipts']);
    } catch (error) {
      newTab?.close();
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('receipts.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate(['/receipts']);
  }
}
