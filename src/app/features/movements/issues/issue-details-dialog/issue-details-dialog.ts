import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { IssueDetail } from '../issue.models';
import { IssueService } from '../issue.service';

export interface IssueDetailsDialogData {
  issueId: number;
}

@Component({
  selector: 'app-issue-details-dialog',
  imports: [Dialog, TranslatePipe],
  templateUrl: './issue-details-dialog.html',
})
export class IssueDetailsDialog {
  private readonly data = inject<IssueDetailsDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, IssueDetailsDialog>);
  private readonly issueService = inject(IssueService);
  private readonly catalogService = inject(CatalogService);

  protected readonly lines = signal<IssueDetail[]>([]);
  protected readonly productNames = signal<Record<number, string>>({});
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [lines, products] = await Promise.all([
      this.issueService.getDetails(this.data.issueId),
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
