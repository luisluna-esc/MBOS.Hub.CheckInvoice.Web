export interface Church extends Record<string, unknown> {
  churchId: number;
  code: string | null;
  churchName: string;
  districtId: number | null;
  churchTypeId: number | null;
  isActive: boolean;
}

export interface ChurchRequest {
  churchId: number;
  code?: string | null;
  churchName: string;
  districtId?: number | null;
  churchTypeId?: number | null;
  isActive: boolean;
}

export interface ChurchFilters {
  churchId?: number;
  districtId?: number;
  churchTypeId?: number;
  isActive?: boolean;
  searchCriteria?: string;
}
