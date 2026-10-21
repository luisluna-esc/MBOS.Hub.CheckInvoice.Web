import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../../../core/catalogs/catalog.service';
import { CatalogItem } from '../../../../core/catalogs/catalog.models';
import { settleCatalogs } from '../../../../core/catalogs/settle-catalogs';
import { MenuTreeItem } from '../../../../core/menu/menu.models';
import { MenuService } from '../../../../core/menu/menu.service';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface ReceiptMotive {
  key: string;
  /** Nombre del tipo de entrada, tal como está en la tabla (el mismo que en los filtros). */
  title: string;
  /** Clave de la descripción en receipts.motives.byType; null usa la descripción general. */
  descriptionKey: string | null;
  icon: string;
  /** Sin ruta: el tipo todavía no tiene formulario (se muestra como "Próximamente"). */
  route: string | null;
  queryParams: Record<string, string> | null;
}

/** Formulario de cada tipo de entrada (por nombre de la tabla receipt_type, como en el backend). */
const FORMS: Record<string, { key: string; icon: string; route: string; withType: boolean }> = {
  'compras con factura': { key: 'invoice', icon: 'receipt', route: '/receipts/new', withType: true },
  'compras con retencion': { key: 'retention', icon: 'receipt', route: '/receipts/new', withType: true },
  devolucion: { key: 'return', icon: 'return', route: '/issue-returns', withType: false },
  ajuste: { key: 'adjustment', icon: 'adjustment', route: '/stock-adjustments', withType: false },
  donacion: { key: 'donation', icon: 'product', route: '/receipts/donation', withType: false },
  'inventario inicial': { key: 'initial', icon: 'catalog', route: '/admin/initial-inventory', withType: false },
};

function normalize(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function menuRoutes(items: MenuTreeItem[]): string[] {
  return items.flatMap((item) => [...(item.route ? [item.route] : []), ...menuRoutes(item.children)]);
}

/**
 * Entradas: antes de registrar se elige el tipo de entrada. Las tarjetas son exactamente los
 * tipos de la tabla receipt_type (la misma que usan los filtros del historial y los reportes);
 * cada una abre su formulario, las compras con el tipo ya elegido. Inventario Inicial solo se
 * muestra a quien tiene esa pantalla en su menú.
 */
@Component({
  selector: 'app-receipt-motives',
  imports: [LoadingSkeleton, RouterLink, Icon, TranslatePipe],
  templateUrl: './receipt-motives.html',
})
export class ReceiptMotives {
  private readonly catalogService = inject(CatalogService);
  private readonly menuService = inject(MenuService);

  private readonly receiptTypes = signal<CatalogItem[]>([]);
  protected readonly loading = signal(true);

  // Se recalcula cuando llega el menú del usuario (Inventario Inicial depende de él).
  protected readonly motives = computed<ReceiptMotive[]>(() => {
    const allowedRoutes = new Set(menuRoutes(this.menuService.items()));
    return this.receiptTypes().flatMap((type) => {
      const form = FORMS[normalize(type.name)];
      if (form?.key === 'initial' && !allowedRoutes.has(form.route)) {
        return [];
      }
      return [
        {
          key: `type-${type.id}`,
          title: type.name,
          descriptionKey: form ? form.key : null,
          icon: form?.icon ?? 'receipt',
          route: form?.route ?? null,
          queryParams: form?.withType ? { type: String(type.id) } : null,
        },
      ];
    });
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [receiptTypes] = await settleCatalogs([this.catalogService.getReceiptTypes()]);
    this.receiptTypes.set(receiptTypes);
    this.loading.set(false);
  }
}
