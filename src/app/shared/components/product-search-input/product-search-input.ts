import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Product } from '../../../features/catalogs/products/product.models';
import { ProductService } from '../../../features/catalogs/products/product.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ProductPickerResult } from '../product-picker-dialog/product-picker-dialog';

let nextId = 0;

const MAX_RESULTS = 8;

/**
 * Buscador de productos para cargar líneas sin mouse: se escribe una letra o parte del código,
 * las flechas eligen, y Enter o Tab toman el producto marcado (Tab además pasa a Cantidad).
 * Busca por nombre o código sin distinguir mayúsculas. Solo productos activos.
 */
@Component({
  selector: 'app-product-search-input',
  imports: [OverlayModule, TranslatePipe],
  templateUrl: './product-search-input.html',
  host: { class: 'block w-full min-w-0' },
})
export class ProductSearchInput {
  /** Producto ya elegido en la línea: se muestra en el campo hasta que se escriba otra cosa. */
  readonly selected = input<ProductPickerResult | null>(null);
  /** Productos que ya están en otra línea: aparecen pero no se pueden elegir. */
  readonly excludedProductIds = input<number[]>([]);
  readonly invalid = input(false);
  readonly picked = output<ProductPickerResult>();

  private readonly productService = inject(ProductService);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly inputId = `product-search-${nextId++}`;
  protected readonly query = signal('');
  protected readonly results = signal<Product[]>([]);
  protected readonly loading = signal(false);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);

  protected readonly overlayPositions: ConnectionPositionPair[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private requestToken = 0;

  constructor() {
    // Al elegir (o al cargar una línea ya elegida) el campo muestra "código — nombre".
    effect(() => {
      const product = this.selected();
      this.query.set(product ? this.label(product) : '');
    });
  }

  /** Lo usa el formulario para dejar el cursor aquí al agregar una línea nueva. */
  focus(): void {
    this.inputRef().nativeElement.focus();
  }

  protected label(product: { code: string | null; name: string }): string {
    return product.code ? `${product.code} — ${product.name}` : product.name;
  }

  protected isExcluded(product: Product): boolean {
    return this.excludedProductIds().includes(product.productId);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.open.set(true);
    clearTimeout(this.searchTimeout);

    if (value.trim().length === 0) {
      this.results.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.searchTimeout = setTimeout(() => void this.search(value), 200);
  }

  private async search(term: string): Promise<void> {
    const token = ++this.requestToken;
    try {
      const result = await this.productService.list(1, MAX_RESULTS, { searchCriteria: term.trim(), isActive: true });
      if (token === this.requestToken) {
        this.results.set(result.items);
        const firstChoosable = result.items.findIndex((item) => !this.isExcluded(item));
        this.activeIndex.set(Math.max(firstChoosable, 0));
      }
    } finally {
      if (token === this.requestToken) {
        this.loading.set(false);
      }
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.results();
    // Esc con la lista abierta solo la cierra (no el diálogo ni el formulario).
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (!this.open() || items.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set((this.activeIndex() + 1) % items.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set((this.activeIndex() - 1 + items.length) % items.length);
        break;
      case 'Enter':
        event.preventDefault();
        this.select(items[this.activeIndex()]);
        break;
      case 'Tab':
        // Sin preventDefault: toma el producto y el foco sigue a Cantidad.
        if (!event.shiftKey) {
          this.select(items[this.activeIndex()]);
        }
        break;
      case 'Escape':
        this.close();
        break;
    }
  }

  protected select(product: Product | undefined): void {
    if (!product || this.isExcluded(product)) {
      return;
    }
    const result: ProductPickerResult = {
      productId: product.productId,
      name: product.name,
      code: product.code,
      departmentId: product.departmentId,
      mediaTypeId: product.mediaTypeId,
      imageVersion: product.imageVersion ?? null,
    };
    this.picked.emit(result);
    this.query.set(this.label(result));
    this.results.set([]);
    this.open.set(false);
  }

  protected onBlur(): void {
    // Si se sale sin elegir, el campo vuelve a mostrar el producto que ya tenía la línea.
    this.close();
    const product = this.selected();
    this.query.set(product ? this.label(product) : '');
  }

  protected close(): void {
    clearTimeout(this.searchTimeout);
    this.open.set(false);
  }
}
