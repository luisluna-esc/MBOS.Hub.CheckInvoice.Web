import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ReceiptDetail } from '../receipt.models';
import { ReceiptService } from '../receipt.service';

export interface ReceiptDetailsDialogData {
  receiptId: number;
}

@Component({
  selector: 'app-receipt-details-dialog',
  imports: [Dialog, TranslatePipe],
  templateUrl: './receipt-details-dialog.html',
})
export class ReceiptDetailsDialog {
  private readonly data = inject<ReceiptDetailsDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, ReceiptDetailsDialog>);
  private readonly receiptService = inject(ReceiptService);
  private readonly catalogService = inject(CatalogService);

  protected readonly lines = signal<ReceiptDetail[]>([]);
  protected readonly productNames = signal<Record<number, string>>({});
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [lines, products] = await Promise.all([
      this.receiptService.getDetails(this.data.receiptId),
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
