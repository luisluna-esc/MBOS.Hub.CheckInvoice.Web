import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, input } from '@angular/core';
import { DialogService } from '../../../core/dialog/dialog.service';
import { productImageUrl } from '../../../core/files/image';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface PhotoPreviewData {
  url: string;
  name: string;
}

/** Foto ampliada. Se cierra con el botón, con Escape o tocando fuera de la foto. */
@Component({
  selector: 'app-photo-preview-dialog',
  imports: [TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="flex max-h-[92vh] w-[min(94vw,56rem)] flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-xl">
      <div class="flex items-center justify-between gap-2">
        <span class="min-w-0 truncate text-sm font-medium text-foreground">{{ data.name }}</span>
        <button
          type="button"
          class="shrink-0 rounded-md border border-border px-3 py-1 text-sm text-foreground transition-colors hover:bg-background"
          (click)="close()"
        >
          {{ 'dialog.close' | translate }}
        </button>
      </div>
      <img [src]="data.url" [alt]="data.name" class="max-h-[80vh] w-full rounded-md object-contain" />
    </div>
  `,
})
export class PhotoPreviewDialog {
  protected readonly data = inject<PhotoPreviewData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void, PhotoPreviewDialog>);

  protected close(): void {
    this.dialogRef.close();
  }
}

/**
 * Miniatura de la foto de un producto; con un clic se amplía. Sin foto muestra un recuadro vacío
 * del mismo tamaño, para que las filas de una tabla queden alineadas.
 */
@Component({
  selector: 'app-product-photo',
  imports: [TranslatePipe],
  template: `
    @if (url(); as src) {
      <button
        type="button"
        class="block shrink-0 overflow-hidden rounded-md border border-border bg-background transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-accent"
        [class]="sizeClass()"
        [attr.aria-label]="'productPhoto.enlarge' | translate"
        [title]="'productPhoto.enlarge' | translate"
        (click)="open(src)"
      >
        <img [src]="src" [alt]="name()" loading="lazy" class="size-full object-cover" />
      </button>
    } @else {
      <span
        class="flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground"
        [class]="sizeClass()"
        [title]="'productPhoto.none' | translate"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
          <circle cx="9" cy="10" r="1.5" stroke="currentColor" stroke-width="1.5" />
          <path d="M5 17L10 13L13 15.5L16 12.5L19 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    }
  `,
})
export class ProductPhoto {
  readonly productId = input<number | null>(null);
  /** Versión de la foto (null = el producto no tiene foto). */
  readonly version = input<number | null | undefined>(null);
  readonly name = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('sm');

  private readonly dialogService = inject(DialogService);

  protected readonly url = computed(() => {
    const productId = this.productId();
    const version = this.version();
    return productId && version ? productImageUrl(productId, version) : null;
  });

  protected readonly sizeClass = computed(() => {
    switch (this.size()) {
      case 'lg':
        return 'size-24';
      case 'md':
        return 'size-14';
      default:
        return 'size-9';
    }
  });

  protected open(url: string): void {
    this.dialogService.open<void, PhotoPreviewData, PhotoPreviewDialog>(PhotoPreviewDialog, {
      data: { url, name: this.name() },
      disableClose: false,
    });
  }
}
