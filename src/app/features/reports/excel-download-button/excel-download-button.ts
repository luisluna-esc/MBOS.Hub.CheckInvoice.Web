import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** Botón "Descargar Excel" que va sobre la vista previa de cada reporte (mismos filtros que el PDF). */
@Component({
  selector: 'app-excel-download-button',
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
      [disabled]="loading()"
      (click)="download.emit()"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="size-4 text-primary" aria-hidden="true">
        <path d="M4 4.5C4 3.67 4.67 3 5.5 3H14L20 9V19.5C20 20.33 19.33 21 18.5 21H5.5C4.67 21 4 20.33 4 19.5V4.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M14 3V9H20" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M8.5 12.5L12 17M12 12.5L8.5 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      {{ (loading() ? 'reports.excel.downloading' : 'reports.excel.download') | translate }}
    </button>
  `,
})
export class ExcelDownloadButton {
  readonly loading = input(false);
  readonly download = output<void>();
}

/** Descarga un archivo generado en memoria con el nombre indicado. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
