export interface District extends Record<string, unknown> {
  districtId: number;
  code: string | null;
  districtName: string;
  missionId: number | null;
  provinceId: number | null;
  isActive: boolean;
}

export interface DistrictRequest {
  districtId: number;
  districtName: string;
  missionId?: number | null;
  provinceId?: number | null;
  isActive: boolean;
}

export interface DistrictFilters {
  districtId?: number;
  isActive?: boolean;
  searchCriteria?: string;
}
