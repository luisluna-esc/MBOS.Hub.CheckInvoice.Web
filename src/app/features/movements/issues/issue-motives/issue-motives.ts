import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { Icon } from '../../../../shared/components/icon/icon';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface IssueMotive {
  key: string;
  title: string;
  icon: string;
  route: string;
  queryParams: Record<string, string> | null;
}

/** Ícono por tipo de salida (por nombre del catálogo); los demás usan el de salidas. */
function iconFor(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('regalo')) {
    return 'product';
  }
  if (normalized.includes('prestamo')) {
    return 'return';
  }
  if (normalized.includes('merma')) {
    return 'adjustment';
  }
  return 'issue';
}

/**
 * Salidas: igual que Entradas, antes de registrar se elige por qué sale el material. Cada tipo
 * de salida del catálogo es una tarjeta (el formulario abre con ese tipo ya elegido), más la
 * transferencia a otro almacén. El historial de salidas está en Reportes.
 */
@Component({
  selector: 'app-issue-motives',
  imports: [RouterLink, Icon, TranslatePipe],
  templateUrl: './issue-motives.html',
})
export class IssueMotives {
  private readonly catalogService = inject(CatalogService);

  protected readonly motives = signal<IssueMotive[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [issueTypes] = await settleCatalogs([this.catalogService.getIssueTypes()]);
    this.motives.set([
      ...issueTypes.map((type) => ({
        key: `type-${type.id}`,
        title: type.name,
        icon: iconFor(type.name),
        route: '/issues/new',
        queryParams: { type: String(type.id) },
      })),
      { key: 'transfers', title: '', icon: 'transfer', route: '/transfers/new', queryParams: null },
    ]);
    this.loading.set(false);
  }
}
