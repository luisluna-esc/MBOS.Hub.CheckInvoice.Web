export interface Product extends Record<string, unknown> {
  productId: number;
  code: string | null;
  name: string;
  departmentId: number | null;
  subDepartmentId: number | null;
  mediaTypeId: number | null;
  price: number | null;
  isActive: boolean;
}

export interface ProductRequest {
  productId: number;
  name: string;
  departmentId?: number | null;
  subDepartmentId?: number | null;
  mediaTypeId?: number | null;
  price?: number | null;
  isActive: boolean;
}

export interface ProductFilters {
  code?: string;
  departmentId?: number;
  subDepartmentId?: number;
  isActive?: boolean;
  searchCriteria?: string;
  warehouseId?: number;
}
