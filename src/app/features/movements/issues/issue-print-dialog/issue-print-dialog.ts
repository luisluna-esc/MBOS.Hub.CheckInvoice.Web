import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

const NO_PRINT_TYPE_NAME = 'sin impresión';

export interface IssuePrintDialogResult {
  printTypeId: number;
  newTab: Window | null;
}

@Component({
  selector: 'app-issue-print-dialog',
  imports: [ReactiveFormsModule, Dialog, Select, TranslatePipe],
  templateUrl: './issue-print-dialog.html',
})
export class IssuePrintDialog {
  private readonly dialogRef = inject(DialogRef<IssuePrintDialogResult | null, IssuePrintDialog>);
  private readonly catalogService = inject(CatalogService);

  protected readonly printTypeOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    printTypeId: new FormControl('', { nonNullable: true }),
  });

  // computed() no reacciona a form.controls.printTypeId.value directamente (no es una señal) —
  // sin este puente por toSignal(valueChanges), el botón queda deshabilitado para siempre
  // aunque el usuario sí elija un tipo en el select.
  private readonly printTypeIdValue = toSignal(
    this.form.controls.printTypeId.valueChanges.pipe(
      startWith(this.form.controls.printTypeId.value),
      takeUntilDestroyed()
    ),
    { initialValue: '' }
  );

  protected readonly saveDisabled = computed(() => !this.printTypeIdValue());

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
      this.form.markAllAsTouched();
      return;
    }
    // La pestaña se abre aquí, de forma síncrona dentro del clic real en "Confirmar" — si se
    // abriera después (ej. al recibir el cierre del diálogo desde afuera) el navegador ya no
    // lo reconoce como gesto del usuario y bloquea el popup en silencio.
    const newTab = window.open('', '_blank');
    this.dialogRef.close({ printTypeId: Number(this.form.controls.printTypeId.value), newTab });
  }

  protected onCancel(): void {
    this.dialogRef.close(null);
  }
}
