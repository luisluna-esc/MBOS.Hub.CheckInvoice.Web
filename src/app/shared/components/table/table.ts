import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Input as AppInput } from '../input/input';
import { ProductPhoto } from '../product-photo/product-photo';
import { Select, SelectOption } from '../select/select';
import { Skeleton } from '../skeleton/skeleton';
import { Tooltip } from '../tooltip/tooltip';

export type TableColumnType = 'text' | 'number' | 'select';
export type TableActionIcon =
  | 'view'
  | 'edit'
  | 'delete'
  | 'create'
  | 'verified'
  | 'menu'
  | 'print'
  | 'void'
  | 'return'
  | 'download'
  | 'photo';

export interface TableColumn<T> {
  key: keyof T & string;
  header: string;
  editable?: boolean;
  type?: TableColumnType;
  options?: SelectOption[];
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown, row: T, index: number) => string;
  tooltip?: (value: unknown, row: T, index: number) => string | null;
  /** Columna de foto de producto: miniatura chica que se amplía con un clic. */
  photo?: (row: T) => { productId: number; version: number | null | undefined; name: string };
  /** Con esto la foto es un botón: al elegir un archivo se llama con la fila y el archivo. */
  photoUpload?: (row: T, file: File) => void;
}

export interface TableAction<T> {
  label: string;
  onClick: (row: T) => void;
  icon?: TableActionIcon;
  variant?: 'default' | 'danger';
  disabled?: (row: T) => boolean;
  disabledReason?: (row: T) => string | null;
}

export interface TableCellChange<T> {
  row: T;
  column: TableColumn<T>;
  value: unknown;
}

@Component({
  selector: 'app-table',
  imports: [FormsModule, AppInput, Select, TranslatePipe, Tooltip, Skeleton, ProductPhoto, OverlayModule, NgTemplateOutlet],
  templateUrl: './table.html',
})
export class Table<T extends Record<string, unknown>> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly actions = input<TableAction<T>[]>([]);
  readonly emptyMessage = input<string | null>(null);
  readonly loading = input(false);

  readonly totalRecords = input(0);
  readonly pageNumber = input(1);
  readonly pageSize = input(5);
  readonly pageSizeOptions = input<number[]>([5, 10, 20, 50]);

  readonly cellChange = output<TableCellChange<T>>();
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

  protected getCellTooltip(row: T, column: TableColumn<T>, index: number): string {
    return column.tooltip ? (column.tooltip(row[column.key], row, index) ?? '') : '';
  }

  /** Hasta 2 opciones se ven como íconos; con más de 2, todas van al menú de opciones. */
  protected readonly visibleActions = computed(() => (this.actions().length > 2 ? [] : this.actions()));
  protected readonly menuActions = computed(() => (this.actions().length > 2 ? this.actions() : []));
  /** Fila con el menú de tres puntos abierto (-1 = ninguno). */
  protected readonly openMenuRow = signal(-1);

  protected readonly menuPositions: ConnectionPositionPair[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected toggleMenu(rowIndex: number): void {
    this.openMenuRow.set(this.openMenuRow() === rowIndex ? -1 : rowIndex);
  }

  protected closeMenu(): void {
    this.openMenuRow.set(-1);
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu();
    }
  }

  protected getActionTooltip(action: TableAction<T>, row: T): string {
    if (action.disabled?.(row) && action.disabledReason) {
      return action.disabledReason(row) ?? action.label;
    }
    return action.label;
  }

  protected onCellChange(row: T, column: TableColumn<T>, value: unknown): void {
    this.cellChange.emit({ row, column, value });
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

  protected onPhotoChosen(row: T, upload: (row: T, file: File) => void, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se limpia para poder volver a elegir el mismo archivo después.
    input.value = '';
    if (file) {
      upload(row, file);
    }
  }
}
