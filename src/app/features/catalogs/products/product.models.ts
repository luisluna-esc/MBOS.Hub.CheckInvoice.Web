export interface Product extends Record<string, unknown> {
  productId: number;
  code: string | null;
  name: string;
  departmentId: number | null;
  subDepartmentId: number | null;
  mediaTypeId: number | null;
  isActive: boolean;
  hasImage?: boolean;
  /** Versión de la foto, para la URL de la imagen (sin foto: null). */
  imageVersion?: number | null;
}

export interface ProductRequest {
  productId: number;
  name: string;
  departmentId?: number | null;
  subDepartmentId?: number | null;
  mediaTypeId?: number | null;
  isActive: boolean;
}

export interface ProductFilters {
  code?: string;
  departmentId?: number;
  subDepartmentId?: number;
  isActive?: boolean;
  searchCriteria?: string;
  warehouseId?: number;
  /** Solo productos con stock (en warehouseId o, sin almacén, en alguno). */
  inStock?: boolean;
}
