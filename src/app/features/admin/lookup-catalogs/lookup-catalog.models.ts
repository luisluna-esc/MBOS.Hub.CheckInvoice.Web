export interface LookupCatalogItem extends Record<string, unknown> {
  code?: string;
  name: string;
  address?: string | null;
  isActive?: boolean;
}

export interface LookupCatalogRequest {
  id: number;
  code?: string;
  name: string;
  address?: string | null;
  isActive?: boolean;
}

/** Config de una pantalla de catálogo pequeño: una sola pareja de componentes
 * (lista + diálogo) sirve a las 14 tablas, parametrizada por esto según la ruta
 * (`admin/lookup/:slug`) en vez de crear 14 componentes casi idénticos. */
export interface LookupCatalogConfig {
  slug: string;
  resource: string;
  idField: string;
  titleKey: string;
  hasCode: boolean;
  hasIsActive: boolean;
  hasAddress: boolean;
  nameMaxLength: number;
  codeMaxLength?: number;
}
