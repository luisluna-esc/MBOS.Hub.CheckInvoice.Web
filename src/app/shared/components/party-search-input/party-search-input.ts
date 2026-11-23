import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, inject, input, output, signal } from '@angular/core';
import { Client } from '../../../features/catalogs/clients/client.models';
import { ClientService } from '../../../features/catalogs/clients/client.service';
import { Supplier, normalizeName } from '../../../features/catalogs/suppliers/supplier.models';
import { SupplierService } from '../../../features/catalogs/suppliers/supplier.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface PartySearchResult {
  /** Id propio del registro (clientId o supplierId según `mode`), no el partyId compartido. */
  id: number;
  partyId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  mobilePhone: string | null;
}

let nextId = 0;

const MIN_QUERY_LENGTH = 3;

/**
 * Buscador en vivo (con debounce) de Clientes o Proveedores existentes, para vincular
 * su identidad compartida. No carga la lista completa: consulta al backend a medida
 * que se escribe, como cualquier buscador. Usa CDK Overlay para no quedar recortado
 * por el scroll del diálogo que lo contiene.
 */
@Component({
  selector: 'app-party-search-input',
  imports: [OverlayModule, TranslatePipe],
  templateUrl: './party-search-input.html',
})
export class PartySearchInput {
  readonly mode = input.required<'supplier' | 'client'>();
  readonly label = input<string>('');
  readonly picked = output<PartySearchResult>();
  /**
   * Texto de la opción "Crear «…»" al final de la lista (ej. 'receipts.supplierInput.create').
   * Sin él no se ofrece crear (como en las demás pantallas). Con él, si lo escrito no es
   * exactamente uno de la lista, se puede crear ahí mismo y se avisa por `createRequested`.
   */
  readonly createLabelKey = input<string | null>(null);
  /**
   * Búsqueda de las pantallas de trabajo (Proveedor en Compras; Cliente o pastor en Salidas y
   * Entregas): solo activos, sin importar mayúsculas, acentos ni el orden de las palabras, y
   * primero los más usados. Sin esto busca en la lista completa (formularios de Clientes y
   * Proveedores, reportes).
   */
  readonly ranked = input(false);
  readonly createRequested = output<string>();

  private readonly clientService = inject(ClientService);
  private readonly supplierService = inject(SupplierService);

  protected readonly inputId = `party-search-${nextId++}`;
  protected readonly query = signal('');
  protected readonly results = signal<(Client | Supplier)[]>([]);
  protected readonly loading = signal(false);
  protected readonly open = signal(false);
  /** Resultado resaltado con el teclado. */
  protected readonly activeIndex = signal(0);

  protected readonly overlayPositions: ConnectionPositionPair[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private requestToken = 0;

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.open.set(true);
    clearTimeout(this.searchTimeout);

    if (value.trim().length < MIN_QUERY_LENGTH) {
      this.results.set([]);
      this.loading.set(false);
      return;
    }

    this.searchTimeout = setTimeout(() => void this.search(value), 300);
  }

  protected readonly minQueryLength = MIN_QUERY_LENGTH;

  private async search(term: string): Promise<void> {
    const token = ++this.requestToken;
    this.loading.set(true);
    try {
      let items: (Client | Supplier)[];
      if (this.ranked() && this.mode() === 'supplier') {
        // Compra: de paso pasa a inactivo el proveedor que lleva un año sin compras.
        const rows = await this.supplierService.forPurchase(term, 8);
        items = rows.map((row) => ({ supplierId: row.supplierId, partyId: row.partyId, name: row.name, taxId: row.taxId, email: null, mobilePhone: null, uses: row.purchases }) as unknown as Supplier);
      } else if (this.ranked()) {
        const rows = await this.clientService.forIssue(term, 8);
        items = rows.map((row) => ({ clientId: row.clientId, partyId: row.partyId, name: row.name, taxId: row.taxId, email: null, mobilePhone: null, uses: row.issues }) as unknown as Client);
      } else {
        const result =
          this.mode() === 'supplier'
            ? await this.supplierService.list(1, 8, { searchCriteria: term })
            : await this.clientService.list(1, 8, { searchCriteria: term });
        items = result.items;
      }
      if (token === this.requestToken) {
        this.results.set(items);
        this.activeIndex.set(0);
      }
    } finally {
      if (token === this.requestToken) {
        this.loading.set(false);
      }
    }
  }

  protected select(row: Client | Supplier): void {
    if (row.partyId === null) {
      return;
    }
    this.picked.emit({
      id: this.mode() === 'client' ? (row as Client).clientId : (row as Supplier).supplierId,
      partyId: row.partyId,
      name: row.name,
      taxId: row.taxId,
      email: row.email,
      mobilePhone: row.mobilePhone,
    });
    this.query.set('');
    this.results.set([]);
    this.open.set(false);
  }

  protected close(): void {
    this.open.set(false);
  }

  /** Compras (proveedor) o salidas (cliente) que tiene; 0 o sin dato no se muestra. */
  protected usesOf(row: Client | Supplier): number {
    return Number((row as { uses?: number }).uses ?? 0);
  }

  /**
   * Se ofrece "Crear «…»" cuando está permitido, ya se buscó (3 letras o más) y lo escrito no es
   * exactamente uno de la lista (sin importar mayúsculas, acentos ni espacios de más).
   */
  protected canCreate(): boolean {
    if (!this.createLabelKey() || this.loading()) {
      return false;
    }
    const text = normalizeName(this.query());
    return text.length >= MIN_QUERY_LENGTH && !this.results().some((row) => normalizeName(row.name) === text);
  }

  protected requestCreate(): void {
    const name = this.query().trim().replace(/\s+/g, ' ');
    if (!name) {
      return;
    }
    this.createRequested.emit(name);
    this.query.set('');
    this.results.set([]);
    this.open.set(false);
  }

  /** ↑ ↓ para moverse entre los resultados, Enter o Tab para elegir, Esc para cerrar la lista. */
  protected onKeydown(event: KeyboardEvent): void {
    const items = this.results();
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    // La opción "Crear" va después de los resultados y también se elige con el teclado.
    const count = items.length + (this.canCreate() ? 1 : 0);
    if (!this.open() || count === 0) {
      return;
    }
    const choose = () => {
      const row = items[this.activeIndex()];
      if (row) {
        this.select(row);
      } else {
        this.requestCreate();
      }
    };
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set((this.activeIndex() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        break;
      case 'Enter':
        event.preventDefault();
        choose();
        break;
      case 'Tab':
        // Sin preventDefault: toma el resultado y el foco sigue al próximo campo.
        if (!event.shiftKey) {
          choose();
        }
        break;
    }
  }
}
