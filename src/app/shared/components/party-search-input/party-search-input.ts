import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { Component, inject, input, output, signal } from '@angular/core';
import { Client } from '../../../features/catalogs/clients/client.models';
import { ClientService } from '../../../features/catalogs/clients/client.service';
import { Supplier } from '../../../features/catalogs/suppliers/supplier.models';
import { SupplierService } from '../../../features/catalogs/suppliers/supplier.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface PartySearchResult {
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

  private readonly clientService = inject(ClientService);
  private readonly supplierService = inject(SupplierService);

  protected readonly inputId = `party-search-${nextId++}`;
  protected readonly query = signal('');
  protected readonly results = signal<(Client | Supplier)[]>([]);
  protected readonly loading = signal(false);
  protected readonly open = signal(false);

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
      const result =
        this.mode() === 'supplier'
          ? await this.supplierService.list(1, 8, { searchCriteria: term })
          : await this.clientService.list(1, 8, { searchCriteria: term });
      if (token === this.requestToken) {
        this.results.set(result.items);
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
}
