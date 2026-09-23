import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { operationalWarehouseOnly } from '../../../../core/catalogs/operational-warehouse';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { StockService } from '../../../../core/warehouses/stock.service';
import { InfoHint } from '../../../../shared/components/info-hint/info-hint';
import { Input as AppInput } from '../../../../shared/components/input/input';
import {
  ProductPickerDialog,
  ProductPickerResult,
} from '../../../../shared/components/product-picker-dialog/product-picker-dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { IssueService } from '../../issues/issue.service';
import { ReceiptService } from '../../receipts/receipt.service';

type AdjustmentLineGroup = FormGroup<{
  productId: FormControl<string>;
  countedQuantity: FormControl<string>;
}>;

interface LineInfo {
  product: ProductPickerResult | null;
  currentQuantity: number;
  averageCost: number;
}

@Component({
  selector: 'app-stock-adjustment-create',
  imports: [ReactiveFormsModule, AppInput, Select, TranslatePipe, InfoHint],
  templateUrl: './stock-adjustment-create.html',
})
export class StockAdjustmentCreate {
  private readonly catalogService = inject(CatalogService);
  private readonly stockService = inject(StockService);
  private readonly receiptService = inject(ReceiptService);
  private readonly issueService = inject(IssueService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);
  protected readonly warehouses = signal<CatalogItem[]>([]);
  protected readonly lineInfos = signal<LineInfo[]>([]);

  protected readonly warehouseOptions = computed<SelectOption[]>(() =>
    operationalWarehouseOnly(this.warehouses()).map((item) => ({ value: String(item.id), label: item.name }))
  );

  protected readonly warehouseControl = new FormControl('', { nonNullable: true });
  protected readonly descriptionControl = new FormControl('', { nonNullable: true });
  protected readonly linesArray = new FormArray<AdjustmentLineGroup>([]);

  protected readonly warehouseId = toSignal(
    this.warehouseControl.valueChanges.pipe(startWith(this.warehouseControl.value), takeUntilDestroyed())
  );

  protected readonly linesValues = toSignal(
    this.linesArray.valueChanges.pipe(startWith(this.linesArray.value), takeUntilDestroyed())
  );

  protected readonly hasWarehouse = computed(() => !!this.warehouseId());

  protected readonly hasChanges = computed(() =>
    this.lineInfos().some((info, index) => this.difference(index) !== 0)
  );

  protected readonly saveDisabled = computed(() => !this.hasWarehouse() || !this.hasChanges() || this.saving());

  private receiptTypeId: number | null = null;
  private issueTypeId: number | null = null;

  constructor() {
    void this.loadCatalogs();
  }

  private async loadCatalogs(): Promise<void> {
    const [warehouses, receiptTypes, issueTypes] = await settleCatalogs([
      this.catalogService.getWarehouses(),
      this.catalogService.getReceiptTypes(),
      this.catalogService.getIssueTypes(),
    ]);
    this.warehouses.set(warehouses);
    this.receiptTypeId = receiptTypes.find((item) => item.name === 'Ajuste')?.id ?? null;
    this.issueTypeId = issueTypes.find((item) => item.name === 'Salida por Merma')?.id ?? null;
  }

  protected difference(index: number): number {
    const line = (this.linesValues() ?? [])[index];
    const info = this.lineInfos()[index];
    if (!line || !info) {
      return 0;
    }
    return (Number(line.countedQuantity) || 0) - info.currentQuantity;
  }

  protected async pickProduct(index: number): Promise<void> {
    const warehouseId = Number(this.warehouseControl.value);
    if (!warehouseId) {
      return;
    }

    const ref = this.dialogService.open<ProductPickerResult | null, unknown, ProductPickerDialog>(
      ProductPickerDialog,
      { data: { warehouseId } }
    );
    ref.closed.subscribe((result) => {
      if (result) {
        void this.applyPickedProduct(index, warehouseId, result);
      }
    });
  }

  private async applyPickedProduct(index: number, warehouseId: number, product: ProductPickerResult): Promise<void> {
    const stock = await this.stockService.get(warehouseId, product.productId);
    this.linesArray.at(index).controls.productId.setValue(String(product.productId));
    this.linesArray.at(index).controls.countedQuantity.setValue(String(stock.quantity));
    this.lineInfos.update((current) => {
      const next = [...current];
      next[index] = { product, currentQuantity: stock.quantity, averageCost: stock.averageCost };
      return next;
    });
  }

  protected addLine(): void {
    this.linesArray.push(
      new FormGroup({
        productId: new FormControl('', { nonNullable: true }),
        countedQuantity: new FormControl('0', { nonNullable: true }),
      })
    );
    this.lineInfos.update((current) => [...current, { product: null, currentQuantity: 0, averageCost: 0 }]);
  }

  protected removeLine(index: number): void {
    this.linesArray.removeAt(index);
    this.lineInfos.update((current) => current.filter((_, i) => i !== index));
  }

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }

    if (this.receiptTypeId === null || this.issueTypeId === null) {
      this.toastService.show(this.languageService.t('stockAdjustment.error'));
      return;
    }

    const warehouseId = Number(this.warehouseControl.value);
    const description = this.descriptionControl.value || null;

    const increaseLines: { productId: number; quantity: number; unitCost: number }[] = [];
    const decreaseLines: { productId: number; quantity: number }[] = [];

    this.lineInfos().forEach((info, index) => {
      if (!info.product) {
        return;
      }
      const diff = this.difference(index);
      if (diff > 0) {
        increaseLines.push({ productId: info.product.productId, quantity: diff, unitCost: info.averageCost });
      } else if (diff < 0) {
        decreaseLines.push({ productId: info.product.productId, quantity: -diff });
      }
    });

    this.saving.set(true);
    try {
      if (increaseLines.length > 0) {
        await this.receiptService.create({
          warehouseId,
          receiptTypeId: this.receiptTypeId,
          description,
          details: increaseLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        });
      }

      if (decreaseLines.length > 0) {
        await this.issueService.create({
          warehouseId,
          issueTypeId: this.issueTypeId,
          clientId: null,
          description,
          sendToAccountsReceivable: false,
          details: decreaseLines,
        });
      }

      this.toastService.show(this.languageService.t('stockAdjustment.success'));
      this.linesArray.clear();
      this.lineInfos.set([]);
    } catch (error) {
      const message = (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]
        ?.description;
      this.toastService.show(this.languageService.t('stockAdjustment.error'), message);
    } finally {
      this.saving.set(false);
    }
  }
}
