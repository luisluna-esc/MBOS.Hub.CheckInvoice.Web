export interface Supplier extends Record<string, unknown> {
  supplierId: number;
  partyId: number | null;
  code: string | null;
  legalName: string | null;
  name: string;
  taxId: string | null;
  countryId: number | null;
  address: string | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  linkedClientId: number | null;
  linkedClientName: string | null;
}

export interface SupplierRequest {
  supplierId: number;
  /** Al crear: comparte identidad (Nombre/NIT/Correo/Teléfono) con un Cliente ya existente. */
  partyId?: number | null;
  code?: string | null;
  legalName?: string | null;
  name: string;
  taxId?: string | null;
  countryId?: number | null;
  address?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface SupplierFilters {
  supplierId?: number;
  code?: string;
  taxId?: string;
  countryId?: number;
  isActive?: boolean;
  searchCriteria?: string;
}
