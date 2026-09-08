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
import { Input as AppInput } from '../../../../shared/components/input/input';
import { ProductPickerDialog, ProductPickerResult } from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TransferRequest } from '../transfer.models';
import { TransferService } from '../transfer.service';

type DetailLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
  unitPrice: FormControl<string>;
}>;

@Component({
  selector: 'app-transfer-receive-create',
  imports: [ReactiveFormsModule, AppInput, Select, TranslatePipe, DecimalPipe],
  templateUrl: './transfer-receive-create.html',
})
export class TransferReceiveCreate {
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly transferService = inject(TransferService);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly headerConfirmed = signal(false);
  protected readonly lineProducts = signal<(ProductPickerResult | null)[]>([]);

  protected readonly warehouses = signal<CatalogItem[]>([]);

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    this.warehouses().map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly headerForm = new FormGroup({
    destinationWarehouseId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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

  protected readonly continueDisabled = computed(() => this.headerInvalid() || this.headerConfirmed());

  protected readonly detailsValues = toSignal(
    this.detailsArray.valueChanges.pipe(startWith(this.detailsArray.value), takeUntilDestroyed())
  );

  protected readonly saveDisabled = computed(
    () =>
      !this.headerConfirmed() ||
      this.detailsInvalid() ||
      this.detailsArray.length === 0 ||
      this.saving()
  );

  constructor() {
    void this.loadCatalogs();
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses] = await settleCatalogs([this.catalogService.getWarehouses()]);
    this.warehouses.set(warehouses);
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

  protected onEditHeader(): void {
    this.headerForm.enable();
    this.headerConfirmed.set(false);
  }

  protected addLine(): void {
    this.detailsArray.push(
      new FormGroup({
        productId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        quantity: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        unitPrice: new FormControl('', { nonNullable: true }),
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
    return (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
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
    if (this.saveDisabled()) {
      return;
    }

    this.saving.set(true);
    const raw = this.headerForm.getRawValue();
    const details = this.detailsArray.getRawValue();

    const request: TransferRequest = {
      destinationWarehouseId: Number(raw.destinationWarehouseId),
      receiverUserId: this.authService.session()?.appUserId ?? null,
      notes: raw.notes || null,
      details: details.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice ? Number(line.unitPrice) : null,
      })),
    };

    try {
      await this.transferService.create(request);
      this.toastService.show(this.languageService.t('transfers.receiveForm.success'));
      void this.router.navigate(['/transfers/received']);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('transfers.receiveForm.error'), message);
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    void this.router.navigate(['/transfers/received']);
  }
}
