import { CatalogItem } from './catalog.models';

const OPERATIONAL_WAREHOUSE_NAME = 'ALMACEN CENTRAL MBOS';

// El catálogo de almacenes tiene una sede por cada Misión, pero esas solo existen como
// origen/destino de Transferencias — la operación normal (Entradas, Salidas, Ajustes,
// Devoluciones) se maneja contra un único almacén central. Las pantallas de Transferencias
// no usan este filtro; siguen mostrando el catálogo completo.
export function operationalWarehouseOnly(warehouses: CatalogItem[]): CatalogItem[] {
  return warehouses.filter((warehouse) => warehouse.name === OPERATIONAL_WAREHOUSE_NAME);
}
