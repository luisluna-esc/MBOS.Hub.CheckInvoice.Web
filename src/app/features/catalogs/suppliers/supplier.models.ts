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
  /** Proveedor adventista: distrito e iglesia (null si no lo es). */
  districtId: number | null;
  churchId: number | null;
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
  districtId?: number | null;
  churchId?: number | null;
}

/** Proveedor en el buscador de la compra. */
export interface PurchaseSupplier {
  supplierId: number;
  partyId: number;
  name: string;
  taxId: string | null;
  purchases: number;
  /** Al escribirlo en la compra: true si se creó, false si ya existía y se usó ese. */
  created?: boolean;
}

/** "  Juan  PÉREZ " -> "juan perez": para comparar nombres sin mayúsculas, acentos ni espacios de más. */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export interface SupplierFilters {
  supplierId?: number;
  code?: string;
  taxId?: string;
  countryId?: number;
  isActive?: boolean;
  searchCriteria?: string;
}
