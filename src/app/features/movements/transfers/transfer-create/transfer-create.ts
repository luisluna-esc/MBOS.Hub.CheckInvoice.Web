import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { StockInfo, StockService } from '../../../../core/warehouses/stock.service';
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
import { ReportService } from '../../../reports/report.service';
import { TransferRequest } from '../transfer.models';
import { TransferService } from '../transfer.service';

type DetailLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
  unitPrice: FormControl<string>;
}>;

@Component({
  selector: 'app-transfer-create',
  imports: [ReactiveFormsModule, AppInput, Select, PartySearchInput, TranslatePipe, DecimalPipe],
  templateUrl: './transfer-create.html',
})
export class TransferCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly transferService = inject(TransferService);
  private readonly stockService = inject(StockService);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly reportService = inject(ReportService);

  protected readonly saving = signal(false);
  protected readonly headerConfirmed = signal(false);
  protected readonly lineProducts = signal<(ProductPickerResult | null)[]>([]);
  protected readonly lineStock = signal<(StockInfo | null)[]>([]);

  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly users = signal<CatalogItem[]>([]);
  protected readonly receiverParty = signal<PartySearchResult | null>(null);

  protected readonly senderName = computed(() => {
    const appUserId = this.authService.session()?.appUserId;
    return this.users().find((item) => item.id === appUserId)?.name ?? this.authService.session()?.username ?? '—';
  });

  protected readonly headerForm = new FormGroup({
    sourceWarehouseId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    destinationWarehouseId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    receiverClientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true }),
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

  protected readonly headerValues = toSignal(
    this.headerForm.valueChanges.pipe(startWith(this.headerForm.value), takeUntilDestroyed())
  );

  // Un almacén nunca se transfiere a sí mismo: en vez de dejar elegir el mismo en ambos y
  // mostrar un error, se excluye directamente del otro select — así nunca se puede llegar a
  // ese estado.
  protected readonly sourceWarehouseOptions = computed<SelectOption[]>(() => {
    const destId = this.headerValues()?.destinationWarehouseId;
    return this.warehouses()
      .filter((item) => String(item.id) !== destId)
      .map((item) => ({ value: String(item.id), label: item.name }));
  });

  protected readonly destinationWarehouseOptions = computed<SelectOption[]>(() => {
    const sourceId = this.headerValues()?.sourceWarehouseId;
    return this.warehouses()
      .filter((item) => String(item.id) !== sourceId)
      .map((item) => ({ value: String(item.id), label: item.name }));
  });

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
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, users] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getUsers(),
    ]);
    this.warehouses.set(warehouses);
    this.users.set(users);
  }

  protected onReceiverPicked(result: PartySearchResult): void {
    this.receiverParty.set(result);
    this.headerForm.controls.receiverClientId.setValue(String(result.id));
  }

  protected clearReceiver(): void {
    this.receiverParty.set(null);
    this.headerForm.controls.receiverClientId.setValue('');
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
      this.lineProducts().forEach((product, index) => {
        if (product) {
          void this.loadStock(index, product.productId);
        }
      });
    }
  }

  protected onEditHeader(): void {
    this.headerForm.enable();
    this.headerConfirmed.set(false);
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

  protected lineTotal(index: number): number {
    const line = (this.detailsValues() ?? [])[index];
    if (!line) {
      return 0;
    }
    return (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
  }

  protected async pickProduct(index: number): Promise<void> {
    const warehouseId = Number(this.headerForm.getRawValue().sourceWarehouseId) || null;
    const ref = this.dialogService.open<ProductPickerResult | null, ProductPickerData, ProductPickerDialog>(
      ProductPickerDialog,
      { data: { warehouseId } }
    );
    ref.closed.subscribe((result) => {
      if (result) {
        const line = this.detailsArray.at(index).controls;
        line.productId.setValue(String(result.productId));
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
    const warehouseId = Number(this.headerForm.getRawValue().sourceWarehouseId);
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

    const request: TransferRequest = {
      sourceWarehouseId: Number(raw.sourceWarehouseId),
      destinationWarehouseId: Number(raw.destinationWarehouseId),
      senderUserId: this.authService.session()?.appUserId ?? null,
      receiverClientId: raw.receiverClientId ? Number(raw.receiverClientId) : null,
      notes: raw.notes || null,
      details: details.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice ? Number(line.unitPrice) : null,
      })),
    };

    // Se abre la pestaña en blanco de forma síncrona, antes de cualquier await, para que el
    // navegador no la trate como un popup no solicitado y la bloquee.
    const newTab = print ? window.open('', '_blank') : null;

    try {
      const response = await this.transferService.create(request);
      this.toastService.show(this.languageService.t('transfers.form.success'));
      if (print) {
        try {
          const blob = await this.reportService.getTransferVoucherPdfBlob(response.id);
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
      void this.router.navigate(['/transfers/sent']);
    } catch (error) {
      newTab?.close();
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('transfers.form.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate(['/transfers/sent']);
  }
}
