export interface Permission extends Record<string, unknown> {
  permissionId: number;
  code: string;
  name: string;
  description: string | null;
  module: string;
  isActive: boolean;
}

export interface PermissionRequest {
  permissionId: number;
  code: string;
  name: string;
  description?: string | null;
  module: string;
  isActive: boolean;
}

export interface PermissionFilters {
  permissionId?: number;
  code?: string;
  module?: string;
  isActive?: boolean;
  searchCriteria?: string;
}
