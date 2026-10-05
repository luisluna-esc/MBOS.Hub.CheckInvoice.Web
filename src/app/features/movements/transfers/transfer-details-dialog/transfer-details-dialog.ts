import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TransferDetail } from '../transfer.models';
import { TransferService } from '../transfer.service';

export interface TransferDetailsDialogData {
  transferId: number;
  isApproved?: boolean;
}

@Component({
  selector: 'app-transfer-details-dialog',
  imports: [Dialog, TranslatePipe, DecimalPipe],
  templateUrl: './transfer-details-dialog.html',
})
export class TransferDetailsDialog {
  private readonly data = inject<TransferDetailsDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, TransferDetailsDialog>);
  private readonly transferService = inject(TransferService);
  private readonly catalogService = inject(CatalogService);

  protected readonly lines = signal<TransferDetail[]>([]);
  protected readonly productNames = signal<Record<number, string>>({});
  protected readonly loading = signal(true);
  protected readonly totalQuantity = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  protected readonly grandTotal = computed(() => this.lines().reduce((sum, line) => sum + (line.totalSalePrice ?? 0), 0));
  protected readonly hasPrices = computed(() => this.lines().some((line) => line.unitPrice != null));
  protected readonly showPendingNotice = this.data.isApproved === false;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [lines, products] = await Promise.all([
      this.transferService.getDetails(this.data.transferId),
      this.catalogService.getProducts(),
    ]);
    this.lines.set(lines);
    this.productNames.set(Object.fromEntries(products.map((item) => [item.id, item.name])));
    this.loading.set(false);
  }

  protected productName(productId: number): string {
    return this.productNames()[productId] ?? `#${productId}`;
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
