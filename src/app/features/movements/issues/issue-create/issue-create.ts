import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { StockInfo, StockService } from '../../../../core/warehouses/stock.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Input as AppInput } from '../../../../shared/components/input/input';
import {
  PartySearchInput,
  PartySearchResult,
} from '../../../../shared/components/party-search-input/party-search-input';
import {
  ProductPickerData,
  ProductPickerDialog,
  ProductPickerResult,
} from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Client } from '../../../catalogs/clients/client.models';
import { ClientService } from '../../../catalogs/clients/client.service';
import { ReportService } from '../../../reports/report.service';
import { IssueRequest } from '../issue.models';
import { IssueService } from '../issue.service';

type DetailLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
}>;

const PAYMENT_TYPE_CODES = ['cash', 'credit', 'installments'] as const;

@Component({
  selector: 'app-issue-create',
  imports: [ReactiveFormsModule, AppInput, Select, PartySearchInput, Checkbox, DatePicker, TranslatePipe, DecimalPipe],
  templateUrl: './issue-create.html',
})
export class IssueCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly issueService = inject(IssueService);
  private readonly clientService = inject(ClientService);
  private readonly stockService = inject(StockService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly reportService = inject(ReportService);

  protected readonly todayIso = new Date().toISOString().slice(0, 10);

  protected readonly saving = signal(false);
  protected readonly clientLocked = signal(false);
  protected readonly lockedClient = signal<Client | null>(null);
  protected readonly headerConfirmed = signal(false);
  protected readonly lineProducts = signal<(ProductPickerResult | null)[]>([]);
  protected readonly lineStock = signal<(StockInfo | null)[]>([]);

  protected readonly selectedClient = signal<PartySearchResult | null>(null);
  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly issueTypes = signal<CatalogItem[]>([]);
  protected readonly printTypes = signal<CatalogItem[]>([]);
  protected readonly departments = signal<CatalogItem[]>([]);
  protected readonly mediaTypes = signal<CatalogItem[]>([]);
  protected readonly documentTypes = signal<CatalogItem[]>([]);
  protected readonly warehousePeriods = signal<CatalogItem[]>([]);

  private readonly departmentNames = computed(() =>
    Object.fromEntries(this.departments().map((item) => [item.id, item.name]))
  );
  private readonly mediaTypeNames = computed(() =>
    Object.fromEntries(this.mediaTypes().map((item) => [item.id, item.name]))
  );
  private readonly documentTypeNames = computed(() =>
    Object.fromEntries(this.documentTypes().map((item) => [item.id, item.name]))
  );

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    operationalWarehouseOnly(this.warehouses()).map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly issueTypeOptions = computed<SelectOption[]>(() =>
    this.issueTypes().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly printTypeOptions = computed<SelectOption[]>(() =>
    this.printTypes().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly warehousePeriodOptions = computed<SelectOption[]>(() =>
    currentAndPreviousWarehousePeriods(this.warehousePeriods()).map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly paymentTypeOptions = computed<SelectOption[]>(() =>
    PAYMENT_TYPE_CODES.map((code) => ({ value: code, label: this.languageService.t(`issues.form.paymentTypes.${code}`) }))
  );

  protected readonly headerForm = new FormGroup({
    warehouseId: new FormControl('', { nonNullable: true }),
    warehousePeriodId: new FormControl('', { nonNullable: true }),
    clientId: new FormControl('', { nonNullable: true }),
    issueTypeId: new FormControl('', { nonNullable: true }),
    printTypeId: new FormControl('', { nonNullable: true }),
    issueDate: new FormControl(this.todayIso, { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    sendToAccountsReceivable: new FormControl(false, { nonNullable: true }),
    paymentType: new FormControl('', { nonNullable: true }),
    paymentDetail: new FormControl('', { nonNullable: true }),
    dueDate: new FormControl('', { nonNullable: true }),
  });

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

  protected readonly detailsArray = new FormArray<DetailLineGroup>([]);

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

  // getRawValue() en vez de .value: clientId queda disabled cuando el cliente viene
  // bloqueado desde el buscador previo, y .value excluye los controles disabled — eso
  // dejaba clientId como undefined aquí y el botón "Continuar" nunca se habilitaba.
  protected readonly headerValues = toSignal(
    this.headerForm.valueChanges.pipe(
      startWith(this.headerForm.value),
      map(() => this.headerForm.getRawValue()),
      takeUntilDestroyed()
    )
  );

  protected readonly sendToAccountsReceivable = toSignal(
    this.headerForm.controls.sendToAccountsReceivable.valueChanges.pipe(
      startWith(this.headerForm.controls.sendToAccountsReceivable.value),
      takeUntilDestroyed()
    ),
    { initialValue: false }
  );

  protected readonly arConditionsMet = computed(() => {
    if (!this.sendToAccountsReceivable()) {
      return true;
    }
    const values = this.headerValues();
    return !!values?.clientId && !!values?.paymentType;
  });

  protected readonly continueDisabled = computed(
    () => this.headerInvalid() || this.headerConfirmed() || !this.arConditionsMet()
  );

  protected readonly detailsValues = toSignal(
    this.detailsArray.valueChanges.pipe(startWith(this.detailsArray.value), takeUntilDestroyed())
  );

  protected readonly anyLineExceedsStock = computed(() => {
    const values = this.detailsValues() ?? [];
    return values.some((_, index) => this.lineExceedsStock(index));
  });

  protected readonly saveDisabled = computed(
    () =>
      !this.headerConfirmed() ||
      this.detailsInvalid() ||
      this.detailsArray.length === 0 ||
      this.anyLineExceedsStock() ||
      this.saving()
  );

  constructor() {
    void this.loadCatalogs();

    const state = history.state as { clientId?: number };
    if (state.clientId) {
      void this.lockClient(state.clientId);
    }

    // paymentType solo es obligatorio mientras "Enviar a cuentas por cobrar" esté marcado.
    // Se gestiona aquí (no solo con [required] en el input) porque el input se saca del DOM
    // con @if al desmarcar, y su validador quedaba pegado en el control aunque ya no se viera,
    // dejando el formulario inválido sin que el usuario supiera por qué.
    effect(() => {
      const required = this.sendToAccountsReceivable();
      const control = this.headerForm.controls.paymentType;
      control.setValidators(required ? [Validators.required] : []);
      if (!required) {
        control.setValue('', { emitEvent: false });
      }
      // Sin emitEvent:false aquí: headerForm.statusChanges tiene que disparar para que
      // headerInvalid() (basado en ese observable) se entere de que ya volvió a ser válido.
      control.updateValueAndValidity();
    });
  }

  private async lockClient(clientId: number): Promise<void> {
    const result = await this.clientService.list(1, 1, { clientId });
    const client = result.items[0];
    if (!client) {
      return;
    }

    this.headerForm.controls.clientId.setValue(String(clientId));
    this.headerForm.controls.clientId.disable();
    this.lockedClient.set(client);
    this.clientLocked.set(true);
  }

  protected onClientPicked(result: PartySearchResult): void {
    this.selectedClient.set(result);
    this.headerForm.controls.clientId.setValue(String(result.id));
  }

  protected clearClient(): void {
    this.selectedClient.set(null);
    this.headerForm.controls.clientId.setValue('');
  }

  protected documentTypeName(documentTypeId: number | null): string {
    return documentTypeId ? (this.documentTypeNames()[documentTypeId] ?? '—') : '—';
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, issueTypes, printTypes, departments, mediaTypes, documentTypes, warehousePeriods] =
      await settleCatalogs([
        this.catalogService.getWarehouses(),
        this.catalogService.getIssueTypes(),
        this.catalogService.getPrintTypes(),
        this.catalogService.getDepartments(),
        this.catalogService.getMediaTypes(),
        this.catalogService.getDocumentTypes(),
        this.catalogService.getWarehousePeriods(),
      ]);
    this.warehouses.set(warehouses);
    this.issueTypes.set(issueTypes);
    this.printTypes.set(printTypes);
    this.departments.set(departments);
    this.mediaTypes.set(mediaTypes);
    this.documentTypes.set(documentTypes);
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
    } else {
      // Si venían de "Editar" y cambiaron el almacén, el stock de las líneas ya cargadas
      // quedó calculado contra el almacén anterior: se refresca contra el actual.
      this.lineProducts().forEach((product, index) => {
        if (product) {
          void this.loadStock(index, product.productId);
        }
      });
    }
  }

  protected onEditHeader(): void {
    this.headerForm.enable();
    if (this.clientLocked()) {
      this.headerForm.controls.clientId.disable();
    }
    this.headerConfirmed.set(false);
  }

  protected addLine(): void {
    this.detailsArray.push(
      new FormGroup({
        productId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl('', { nonNullable: true }),
      })
    );
    this.lineProducts.update((current) => [...current, null]);
    this.lineStock.update((current) => [...current, null]);
  }

  protected removeLine(index: number): void {
    this.detailsArray.removeAt(index);
    this.lineProducts.update((current) => current.filter((_, i) => i !== index));
    this.lineStock.update((current) => current.filter((_, i) => i !== index));
  }

  protected lineExceedsStock(index: number): boolean {
    const line = (this.detailsValues() ?? [])[index];
    const stock = this.lineStock()[index];
    if (!line || !stock) {
      return false;
    }
    const quantity = Number(line.quantity) || 0;
    return quantity > stock.quantity;
  }

  protected lineTotalCost(index: number): number {
    const line = (this.detailsValues() ?? [])[index];
    const stock = this.lineStock()[index];
    if (!line || !stock) {
      return 0;
    }
    return (Number(line.quantity) || 0) * stock.averageCost;
  }

  protected lineDepartmentName(index: number): string {
    const departmentId = this.lineProducts()[index]?.departmentId;
    return departmentId ? (this.departmentNames()[departmentId] ?? '—') : '—';
  }

  protected lineMediaTypeName(index: number): string {
    const mediaTypeId = this.lineProducts()[index]?.mediaTypeId;
    return mediaTypeId ? (this.mediaTypeNames()[mediaTypeId] ?? '—') : '—';
  }

  protected async pickProduct(index: number): Promise<void> {
    const warehouseId = Number(this.headerForm.getRawValue().warehouseId) || null;
    const ref = this.dialogService.open<ProductPickerResult | null, ProductPickerData, ProductPickerDialog>(
      ProductPickerDialog,
      { data: { warehouseId } }
    );
    ref.closed.subscribe((result) => {
      if (result) {
        const line = this.detailsArray.at(index).controls;
        line.productId.setValue(String(result.productId));
        // Cambiar el producto de una línea no debe arrastrar la cantidad del producto anterior.
        line.quantity.setValue('');
        this.lineProducts.update((current) => {
          const next = [...current];
          next[index] = result;
          return next;
        });
        void this.loadStock(index, result.productId);
      }
    });
  }

  private async loadStock(index: number, productId: number): Promise<void> {
    const warehouseId = Number(this.headerForm.getRawValue().warehouseId);
    if (!warehouseId) {
      return;
    }
    const stock = await this.stockService.get(warehouseId, productId);
    this.lineStock.update((current) => {
      const next = [...current];
      next[index] = stock;
      return next;
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

    const request: IssueRequest = {
      warehouseId: Number(raw.warehouseId),
      warehousePeriodId: raw.warehousePeriodId ? Number(raw.warehousePeriodId) : null,
      clientId: raw.clientId ? Number(raw.clientId) : null,
      issueTypeId: raw.issueTypeId ? Number(raw.issueTypeId) : null,
      printTypeId: raw.printTypeId ? Number(raw.printTypeId) : null,
      issueDate: raw.issueDate || null,
      description: raw.description || null,
      sendToAccountsReceivable: raw.sendToAccountsReceivable,
      paymentType: raw.sendToAccountsReceivable ? raw.paymentType || null : null,
      paymentDetail: raw.sendToAccountsReceivable ? raw.paymentDetail || null : null,
      dueDate: raw.sendToAccountsReceivable ? raw.dueDate || null : null,
      details: details.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
      })),
    };

    // Se abre la pestaña en blanco de forma síncrona, antes de cualquier await, para que el
    // navegador no la trate como un popup no solicitado y la bloquee — el comprobante se
    // genera con datos ya guardados en el servidor, así que solo se completa si corresponde.
    const newTab = print ? window.open('', '_blank') : null;

    try {
      const response = await this.issueService.create(request);
      this.toastService.show(this.languageService.t('issues.form.success'));
      if (print) {
        try {
          const blob = await this.reportService.getIssueVoucherPdfBlob(response.id);
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
      void this.router.navigate(['/issues']);
    } catch (error) {
      newTab?.close();
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('issues.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate(['/issues']);
  }
}
