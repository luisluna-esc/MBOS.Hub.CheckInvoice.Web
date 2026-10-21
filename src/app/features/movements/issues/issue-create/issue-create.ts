import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, viewChildren } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { minIssueDateIso } from '../../../../core/catalogs/current-warehouse-periods';
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
import { BATCH_ISSUE_TYPE } from '../issue-motives/issue-motives';
import { InfoHint } from '../../../../shared/components/info-hint/info-hint';
import { ProductPhoto } from '../../../../shared/components/product-photo/product-photo';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { openPdfTab, showPdf } from '../../../../core/files/pdf';
import { ShortcutDirective } from '../../../../shared/directives/shortcut.directive';

type DetailLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
}>;

const PAYMENT_TYPE_CODES = ['cash', 'credit', 'installments'] as const;

@Component({
  selector: 'app-issue-create',
  imports: [ShortcutDirective, ReactiveFormsModule, AppInput, Select, PartySearchInput, Checkbox, DatePicker, ProductPhoto, TranslatePipe, DecimalPipe, InfoHint],
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

  private readonly route = inject(ActivatedRoute);
  private readonly productButtons = viewChildren<ElementRef<HTMLButtonElement>>('productButton');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly todayIso = localDateIso();
  /** La fecha de la salida solo puede ser del mes anterior o del actual, hasta hoy (al corregir, dentro del mes de la salida). */
  protected readonly minIssueDate = signal(minIssueDateIso());
  protected readonly maxIssueDate = signal(this.todayIso);

  /**
   * Corrección de una salida ya registrada: el mismo formulario con la salida cargada. No se
   * guarda directo: se envía como solicitud con motivo y la aprueba el Contador.
   */
  protected readonly isCorrection = this.route.snapshot.data['motive'] === 'correct';
  private readonly correctionId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly correctionNote = signal<string | null>(null);
  /** Cantidades que ya salieron por producto: al corregir vuelven a estar disponibles. */
  private readonly originalQuantities = signal<Record<number, number>>({});
  protected readonly reasonControl = new FormControl('', { nonNullable: true });
  private readonly reasonValue = toSignal(
    this.reasonControl.valueChanges.pipe(startWith(this.reasonControl.value), takeUntilDestroyed()),
    { initialValue: '' }
  );

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
  protected readonly documentTypes = signal<CatalogItem[]>([]);

  private readonly departmentNames = computed(() =>
    Object.fromEntries(this.departments().map((item) => [item.id, item.name]))
  );
  private readonly documentTypeNames = computed(() =>
    Object.fromEntries(this.documentTypes().map((item) => [item.id, item.name]))
  );

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    this.warehouses().map((item) => ({ value: String(item.id), label: item.name }))
  );
  /** Tipo elegido en la tarjeta de Salidas: ya no se vuelve a preguntar en el formulario. */
  protected readonly presetIssueTypeId = signal<number | null>(null);
  protected readonly presetIssueTypeName = computed(() => {
    const id = this.presetIssueTypeId();
    return id ? (this.issueTypes().find((item) => item.id === id)?.name ?? null) : null;
  });
  protected readonly issueTypeOptions = computed<SelectOption[]>(() =>
    this.issueTypes()
      // La salida por lote tiene su propio formulario; al corregir una, su tipo se mantiene.
      .filter((item) => this.isCorrection || item.name !== BATCH_ISSUE_TYPE)
      .map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly printTypeOptions = computed<SelectOption[]>(() =>
    this.printTypes().map((item) => ({ value: String(item.id), label: item.name }))
  );
  protected readonly paymentTypeOptions = computed<SelectOption[]>(() =>
    PAYMENT_TYPE_CODES.map((code) => ({ value: code, label: this.languageService.t(`issues.form.paymentTypes.${code}`) }))
  );

  protected readonly headerForm = new FormGroup({
    warehouseId: new FormControl('', { nonNullable: true }),
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

  /** Productos de las líneas con unidades apartadas por una anulación de entrada pendiente (sin repetir). */
  protected readonly reservedProducts = computed(() => {
    const products = this.lineProducts();
    const reserved = new Map<number, { name: string; quantity: number }>();
    this.lineStock().forEach((stock, index) => {
      const product = products[index];
      if (product && stock?.reservedQuantity) {
        reserved.set(product.productId, { name: product.name, quantity: stock.reservedQuantity });
      }
    });
    return [...reserved.values()];
  });

  /** Productos cuya cantidad pedida supera el stock disponible (sin repetir), para el aviso arriba de la tabla. */
  protected readonly exceedingProducts = computed(() => {
    const values = this.detailsValues() ?? [];
    const products = this.lineProducts();
    const exceeding = new Map<number, { name: string; requested: number; available: number }>();
    this.lineStock().forEach((stock, index) => {
      const product = products[index];
      const requested = Number(values[index]?.quantity) || 0;
      const available = this.lineAvailable(index) ?? 0;
      if (product && stock && requested > available) {
        exceeding.set(product.productId, { name: product.name, requested, available });
      }
    });
    return [...exceeding.values()];
  });

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
      (this.isCorrection && (this.headerInvalid() || !this.reasonValue().trim())) ||
      this.saving()
  );

  constructor() {
    if (this.isCorrection && this.correctionId) {
      void this.loadForCorrection(this.correctionId);
    } else {
      void this.loadCatalogs();
      const state = history.state as { clientId?: number; issueTypeId?: number | null };
      if (state.clientId) {
        void this.lockClient(state.clientId);
      }
      // El tipo viene de la tarjeta elegida en Salidas.
      if (state.issueTypeId) {
        this.headerForm.controls.issueTypeId.setValue(String(state.issueTypeId));
        this.presetIssueTypeId.set(state.issueTypeId);
      }
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
    const [warehouses, issueTypes, printTypes, departments, documentTypes] = await settleCatalogs([
      this.catalogService.getActiveWarehouses(),
      this.catalogService.getIssueTypes(),
      this.catalogService.getPrintTypes(),
      this.catalogService.getDepartments(),
      this.catalogService.getDocumentTypes(),
    ]);
    this.warehouses.set(warehouses);
    this.issueTypes.set(issueTypes);
    this.printTypes.set(printTypes);
    this.departments.set(departments);
    this.documentTypes.set(documentTypes);

    // Con un solo almacén activo se marca solo; con varios, se elige.
    if (warehouses.length === 1) {
      this.headerForm.controls.warehouseId.setValue(String(warehouses[0].id));
      this.headerForm.controls.warehouseId.disable();
    }
  }

  /** Carga la salida a corregir: datos y productos, listos para cambiar. */
  private async loadForCorrection(issueId: number): Promise<void> {
    let summary: Awaited<ReturnType<IssueService['getSummary']>>;
    let catalogs: CatalogItem[][];
    try {
      [summary, catalogs] = await Promise.all([
        this.issueService.getSummary(issueId),
        settleCatalogs([
          this.catalogService.getWarehouses(),
          this.catalogService.getIssueTypes(),
          this.catalogService.getDepartments(),
        ]),
      ]);
    } catch {
      // La salida no existe o no se pudo leer: se avisa y se vuelve al historial.
      this.toastService.error(this.languageService.t('issues.correction.notFound'));
      void this.router.navigate(['/reports/issue-history']);
      return;
    }
    const [warehouses, issueTypes, departments] = catalogs;
    this.warehouses.set(warehouses);
    this.issueTypes.set(issueTypes);
    this.departments.set(departments);
    this.correctionNote.set(summary.noteNumber);

    const controls = this.headerForm.controls;
    controls.warehouseId.setValue(summary.warehouseId ? String(summary.warehouseId) : '');
    controls.warehouseId.disable();
    controls.issueTypeId.setValue(summary.issueTypeId ? String(summary.issueTypeId) : '');
    controls.issueDate.setValue(summary.issueDate.slice(0, 10));
    controls.description.setValue(summary.description ?? '');
    if (summary.clientId) {
      controls.clientId.setValue(String(summary.clientId));
      controls.clientId.disable();
      this.lockedClient.set({ name: summary.clientName ?? '—' } as Client);
      this.clientLocked.set(true);
    }

    // La fecha solo se mueve dentro del mes de la salida (su número es de ese mes).
    const [year, month] = summary.issueDate.slice(0, 7).split('-').map(Number);
    const monthEnd = localDateIso(new Date(year, month, 0));
    this.minIssueDate.set(`${summary.issueDate.slice(0, 7)}-01`);
    this.maxIssueDate.set(monthEnd < this.todayIso ? monthEnd : this.todayIso);

    this.originalQuantities.set(Object.fromEntries(summary.lines.map((line) => [line.productId, line.quantity])));
    for (const line of summary.lines) {
      this.detailsArray.push(
        new FormGroup({
          productId: new FormControl(String(line.productId), { nonNullable: true, validators: [Validators.required] }),
          quantity: new FormControl(String(line.quantity), { nonNullable: true }),
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
    this.lineStock.set(summary.lines.map(() => null));
    this.headerConfirmed.set(true);
    summary.lines.forEach((line, index) => void this.loadStock(index, line.productId));
  }

  protected readonly continueAttempted = signal(false);

  protected onContinue(): void {
    if (this.continueDisabled()) {
      this.continueAttempted.set(true);
      this.headerForm.markAllAsTouched();
      return;
    }
    this.headerForm.disable();
    this.headerConfirmed.set(true);
    if (this.detailsArray.length === 0) {
      this.addProduct();
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
      })
    );
    this.lineProducts.update((current) => [...current, null]);
    this.lineStock.update((current) => [...current, null]);
    // El cursor va al botón de producto de la línea nueva (Enter abre la ventana), para seguir
    // solo con el teclado.
    setTimeout(() => this.productButtons().at(-1)?.nativeElement.focus());
  }

  /** Enter en la cantidad de la última línea agrega otra línea. */
  protected onQuantityEnter(index: number, event: Event): void {
    event.preventDefault();
    if (index === this.detailsArray.length - 1 && this.detailsArray.at(index).valid && !this.lineExceedsStock(index)) {
      this.addProduct();
    }
  }

  /** Stock que se puede usar en la línea: al corregir, suma lo que ya salió de ese producto. */
  protected lineAvailable(index: number): number | null {
    const stock = this.lineStock()[index];
    if (!stock) {
      return null;
    }
    const productId = this.lineProducts()[index]?.productId;
    return stock.availableQuantity + (productId ? (this.originalQuantities()[productId] ?? 0) : 0);
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
    return quantity > (this.lineAvailable(index) ?? stock.availableQuantity);
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

  protected async pickProduct(index: number, isNew = false): Promise<void> {
    const warehouseId = Number(this.headerForm.getRawValue().warehouseId) || null;
    const ref = this.dialogService.open<ProductPickerResult | null, ProductPickerData, ProductPickerDialog>(
      ProductPickerDialog,
      { data: { warehouseId, inStockOnly: true, excludedProductIds: this.lineProducts().flatMap((product, i) => (product && i !== index ? [product.productId] : [])) } }
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

    if (this.isCorrection && this.correctionId) {
      await this.sendCorrection(this.correctionId, raw, details);
      return;
    }

    const request: IssueRequest = {
      warehouseId: Number(raw.warehouseId),
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
    const newTab = print ? openPdfTab() : null;

    try {
      const response = await this.issueService.create(request);
      this.toastService.success(this.languageService.t('issues.form.success'));
      if (print) {
        try {
          const blob = await this.reportService.getIssueVoucherPdfBlob(response.id);
          showPdf(blob, `salida-${response.id}.pdf`, newTab);
        } catch {
          newTab?.close();
        }
      }
      void this.router.navigate(['/issues']);
    } catch (error) {
      newTab?.close();
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('issues.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  private async sendCorrection(
    issueId: number,
    raw: ReturnType<typeof this.headerForm.getRawValue>,
    details: ReturnType<typeof this.detailsArray.getRawValue>
  ): Promise<void> {
    try {
      await this.issueService.requestEdit({
        issueId,
        reason: this.reasonControl.value.trim(),
        issueTypeId: raw.issueTypeId ? Number(raw.issueTypeId) : null,
        clientId: raw.clientId ? Number(raw.clientId) : null,
        description: raw.description || null,
        issueDate: raw.issueDate || null,
        details: details.map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity) })),
      });
      this.toastService.success(this.languageService.t('issues.correction.sent'));
      void this.router.navigate(['/reports/issue-history']);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.error(this.languageService.t('issues.correction.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate([this.isCorrection ? '/reports/issue-history' : '/issues']);
  }
}
