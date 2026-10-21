import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { Icon } from '../../../../shared/components/icon/icon';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';

interface IssueMotive {
  key: string;
  title: string;
  icon: string;
  route: string;
  queryParams: Record<string, string> | null;
}

/** Tipo de salida de los lotes (tabla issue_type): su tarjeta abre la salida por lote. */
export const BATCH_ISSUE_TYPE = 'Salida por Lote';

function normalize(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ícono por tipo de salida (por nombre del catálogo); los demás usan el de salidas. */
function iconFor(name: string): string {
  const normalized = normalize(name);
  if (normalized.includes('lote')) {
    return 'client';
  }
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
 * Salidas: antes de registrar se elige el tipo de salida. Las tarjetas son exactamente los tipos
 * de la tabla issue_type (la misma que usan los filtros del historial y los reportes): cada una
 * abre el formulario con ese tipo ya elegido, y "Salida por Lote" abre la salida por lote.
 */
@Component({
  selector: 'app-issue-motives',
  imports: [LoadingSkeleton, RouterLink, Icon, TranslatePipe],
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
    this.motives.set(
      issueTypes.map((type) => {
        const isBatch = normalize(type.name) === normalize(BATCH_ISSUE_TYPE);
        return {
          key: isBatch ? 'batch' : `type-${type.id}`,
          title: type.name,
          icon: iconFor(type.name),
          route: isBatch ? '/issues/batch' : '/issues/new',
          queryParams: isBatch ? null : { type: String(type.id) },
        };
      })
    );
    this.loading.set(false);
  }
}
