import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

const NO_PRINT_TYPE_NAME = 'sin impresión';

@Component({
  selector: 'app-issue-print-dialog',
  imports: [ReactiveFormsModule, Dialog, Select, TranslatePipe],
  templateUrl: './issue-print-dialog.html',
})
export class IssuePrintDialog {
  private readonly dialogRef = inject(DialogRef<number | null, IssuePrintDialog>);
  private readonly catalogService = inject(CatalogService);

  protected readonly printTypeOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    printTypeId: new FormControl('', { nonNullable: true }),
  });

  protected readonly saveDisabled = computed(() => !this.form.controls.printTypeId.value);

  constructor() {
    void this.loadPrintTypes();
  }

  // Excluye "Sin Impresión": no tendría sentido reimprimir eligiendo justamente no imprimir.
  private async loadPrintTypes(): Promise<void> {
    const items = await this.catalogService.getPrintTypes();
    this.printTypeOptions.set(
      items
        .filter((item) => item.name.trim().toLowerCase() !== NO_PRINT_TYPE_NAME)
        .map((item) => ({ value: String(item.id), label: item.name }))
    );
  }

  protected onSave(): void {
    if (this.saveDisabled()) {
      return;
    }
    this.dialogRef.close(Number(this.form.controls.printTypeId.value));
  }

  protected onCancel(): void {
    this.dialogRef.close(null);
  }
}
