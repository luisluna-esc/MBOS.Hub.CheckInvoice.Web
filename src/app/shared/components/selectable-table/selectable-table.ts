import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TableColumn } from '../table/table';
import { Select, SelectOption } from '../select/select';
import { Skeleton } from '../skeleton/skeleton';
import { FormsModule } from '@angular/forms';

/**
 * Como app-table, pero para listas donde toda la fila es la acción — pickers de
 * Proveedor/Cliente (ej. receipt-supplier-picker, issue-client-picker): en vez de una
 * columna de Opciones con un botón "Seleccionar" por fila, se hace clic en la fila
 * misma. Misma paginación/filtros que app-table, así que el padre sigue funcionando
 * igual (mismo Filters + pageNumber/pageSize/load()).
 */
@Component({
  selector: 'app-selectable-table',
  imports: [FormsModule, Select, TranslatePipe, Skeleton],
  templateUrl: './selectable-table.html',
})
export class SelectableTable<T extends Record<string, unknown>> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly emptyMessage = input<string | null>(null);
  readonly loading = input(false);
  readonly rowDisabled = input<((row: T) => boolean) | null>(null);
  readonly rowDisabledReason = input<((row: T) => string | null) | null>(null);

  readonly totalRecords = input(0);
  readonly pageNumber = input(1);
  readonly pageSize = input(5);
  readonly pageSizeOptions = input<number[]>([5, 10, 20, 50]);

  readonly rowSelected = output<T>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  protected readonly pageSizeSelectOptions = computed<SelectOption[]>(() =>
    this.pageSizeOptions().map((size) => ({ value: String(size), label: String(size) }))
  );
  protected readonly pageSizeValue = computed(() => String(this.pageSize()));

  protected readonly skeletonRows = computed(() => Array.from({ length: Math.min(this.pageSize(), 10) }));

  protected getCellValue(row: T, column: TableColumn<T>, index: number): unknown {
    const raw = row[column.key];
    return column.format ? column.format(raw, row, index) : raw;
  }

  protected isRowDisabled(row: T): boolean {
    return this.rowDisabled()?.(row) ?? false;
  }

  protected getRowTitle(row: T): string | null {
    return this.isRowDisabled(row) ? (this.rowDisabledReason()?.(row) ?? null) : null;
  }

  protected onRowClick(row: T): void {
    if (this.isRowDisabled(row)) {
      return;
    }
    this.rowSelected.emit(row);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) {
      return;
    }
    this.pageChange.emit(page);
  }

  protected onPageSizeChange(value: string | null): void {
    const size = Number(value);
    if (size > 0 && size !== this.pageSize()) {
      this.pageSizeChange.emit(size);
    }
  }
}
