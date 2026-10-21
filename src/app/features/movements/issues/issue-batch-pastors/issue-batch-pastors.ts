import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientService } from '../../../catalogs/clients/client.service';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';

/** Pastor elegido para el lote; pasa al formulario por el estado de la navegación. */
export interface BatchPastor {
  clientId: number;
  name: string;
  districtName: string | null;
}

/** Hasta cuántos pastores se traen de una vez (son todos los de la misión). */
const PASTORS_PAGE_SIZE = 1000;

/**
 * Salida por lote, paso 1: en vez de un cliente se eligen los pastores. Se pueden marcar todos,
 * algunos o uno solo; el buscador y el distrito solo filtran la lista, lo marcado se mantiene.
 */
@Component({
  selector: 'app-issue-batch-pastors',
  imports: [LoadingSkeleton, ErrorState, TranslatePipe],
  templateUrl: './issue-batch-pastors.html',
})
export class IssueBatchPastors {
  private readonly clientService = inject(ClientService);
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly pastors = signal<BatchPastor[]>([]);
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  protected readonly search = signal('');
  protected readonly district = signal('');

  protected readonly districts = computed(() =>
    [...new Set(this.pastors().map((p) => p.districtName).filter((name): name is string => !!name))].sort((a, b) =>
      a.localeCompare(b)
    )
  );

  protected readonly visible = computed(() => {
    const text = normalize(this.search());
    const district = this.district();
    return this.pastors().filter(
      (p) => (!text || normalize(p.name).includes(text)) && (!district || p.districtName === district)
    );
  });

  protected readonly allVisibleSelected = computed(() => {
    const selected = this.selectedIds();
    const visible = this.visible();
    return visible.length > 0 && visible.every((p) => selected.has(p.clientId));
  });

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const [result, [districts]] = await Promise.all([
        this.clientService.list(1, PASTORS_PAGE_SIZE, { isPastor: true, isActive: true }),
        settleCatalogs([this.catalogService.getDistricts()]),
      ]);
      const districtNames = new Map(districts.map((d) => [d.id, d.name]));
      this.pastors.set(
        result.items
          .map((client) => ({
            clientId: client.clientId,
            name: client.name,
            districtName: client.districtId ? (districtNames.get(client.districtId) ?? null) : null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      this.errorCode.set(error instanceof HttpErrorResponse ? error.status : 500);
    } finally {
      this.loading.set(false);
    }
  }

  protected isSelected(clientId: number): boolean {
    return this.selectedIds().has(clientId);
  }

  protected toggle(clientId: number): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }

  /** Marca (o desmarca) todos los de la lista filtrada; sin filtro, todos los pastores. */
  protected toggleAllVisible(): void {
    const visibleIds = this.visible().map((p) => p.clientId);
    const select = !this.allVisibleSelected();
    this.selectedIds.update((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (select) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onDistrict(event: Event): void {
    this.district.set((event.target as HTMLSelectElement).value);
  }

  protected onCancel(): void {
    void this.router.navigate(['/issues']);
  }

  protected onContinue(): void {
    const selected = this.selectedIds();
    const pastors = this.pastors().filter((p) => selected.has(p.clientId));
    if (pastors.length === 0) {
      return;
    }
    void this.router.navigate(['/issues/batch/details'], { state: { pastors } });
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
