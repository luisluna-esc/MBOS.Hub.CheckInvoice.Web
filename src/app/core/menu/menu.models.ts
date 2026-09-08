export interface MenuTreeItem {
  menuId: number;
  name: string;
  /** Clave i18n opcional (ej. "nav.home"); si es null, usar `name` literal. */
  translationKey: string | null;
  route: string | null;
  icon: string | null;
  displayOrder: number;
  /** Código del permiso requerido para verlo (null = visible para cualquier usuario autenticado). */
  permissionCode: string | null;
  children: MenuTreeItem[];
}
