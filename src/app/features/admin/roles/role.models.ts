export interface Role extends Record<string, unknown> {
  roleId: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface RoleRequest {
  roleId: number;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface RoleFilters {
  roleId?: number;
  isActive?: boolean;
  searchCriteria?: string;
}

export interface Permission extends Record<string, unknown> {
  permissionId: number;
  code: string;
  name: string;
  description: string | null;
  module: string;
  isActive: boolean;
}

export interface Menu extends Record<string, unknown> {
  menuId: number;
  name: string;
  route: string | null;
  parentMenuId: number | null;
}
