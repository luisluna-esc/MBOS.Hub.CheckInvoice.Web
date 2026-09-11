import { CatalogItem } from '../../core/catalogs/catalog.models';
import { SelectOption } from '../../shared/components/select/select';

/** Valor centinela para la opción "General" del filtro de Almacén — no es un id real, indica
 * que no se debe filtrar por almacén. Los reportes que lo soportan ya devuelven el agregado
 * de todos los almacenes cuando WarehouseId llega nulo (ver StockReportQueryFilter y afines). */
export const ALL_WAREHOUSES_VALUE = 'all';

/** Antepone la opción "General" a la lista de almacenes de un filtro de reporte. */
export function warehouseOptionsWithGeneral(items: CatalogItem[], generalLabel: string): SelectOption[] {
  return [
    { value: ALL_WAREHOUSES_VALUE, label: generalLabel },
    ...items.map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

/** Convierte el valor del select de Almacén al filtro que espera el backend: undefined para
 * "General" (sin filtro, todos los almacenes) o el id numérico elegido. */
export function warehouseIdFilter(value: string | null): number | undefined {
  return value && value !== ALL_WAREHOUSES_VALUE ? Number(value) : undefined;
}
