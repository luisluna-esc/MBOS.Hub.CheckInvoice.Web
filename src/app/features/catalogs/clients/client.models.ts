export interface Client extends Record<string, unknown> {
  clientId: number;
  partyId: number | null;
  appUserId: number | null;
  documentTypeId: number | null;
  taxId: string | null;
  name: string;
  email: string | null;
  mobilePhone: string | null;
  districtId: number | null;
  churchId: number | null;
  isActive: boolean;
  complement: string | null;
  specialCaseId: number | null;
  isPastor: boolean;
  linkedSupplierId: number | null;
  linkedSupplierName: string | null;
}

export interface ClientRequest {
  clientId: number;
  /** Al crear: comparte identidad (Nombre/NIT/Correo/Teléfono) con un Proveedor ya existente. */
  partyId?: number | null;
  documentTypeId?: number | null;
  taxId?: string | null;
  name: string;
  email?: string | null;
  mobilePhone?: string | null;
  districtId?: number | null;
  churchId?: number | null;
  isActive: boolean;
  complement?: string | null;
  specialCaseId?: number | null;
  isPastor: boolean;
}

export interface ClientFilters {
  clientId?: number;
  taxId?: string;
  districtId?: number;
  churchId?: number;
  isActive?: boolean;
  isPastor?: boolean;
  pendingPortalAccess?: boolean;
  searchCriteria?: string;
}

export interface GrantPortalAccessResult {
  appUserId: number;
  temporaryPassword: string | null;
}
