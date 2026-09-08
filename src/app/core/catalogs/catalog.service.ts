import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogItem } from './catalog.models';

/** Catálogos pequeños (< 200 filas) usados como opciones de combos; se piden completos de una vez. */
const LOOKUP_PAGE_SIZE = 200;

interface RawPagedResponse<T> {
  data: { items: T[] };
}

export interface SpecialCaseItem {
  id: number;
  code: string;
  name: string;
}

export interface VoidReasonItem {
  id: number;
  code: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  getWarehouses(): Promise<CatalogItem[]> {
    return this.fetch<{ warehouseId: number; name: string }>('Warehouses', (item) => ({
      id: item.warehouseId,
      name: item.name,
    }));
  }

  getSuppliers(): Promise<CatalogItem[]> {
    return this.fetch<{ supplierId: number; name: string }>('Suppliers', (item) => ({
      id: item.supplierId,
      name: item.name,
    }));
  }

  getReceiptTypes(): Promise<CatalogItem[]> {
    return this.fetch<{ receiptTypeId: number; name: string }>('ReceiptTypes', (item) => ({
      id: item.receiptTypeId,
      name: item.name,
    }));
  }

  getIssueTypes(): Promise<CatalogItem[]> {
    return this.fetch<{ issueTypeId: number; name: string }>('IssueTypes', (item) => ({
      id: item.issueTypeId,
      name: item.name,
    }));
  }

  getProducts(): Promise<CatalogItem[]> {
    return this.fetch<{ productId: number; name: string }>('Products', (item) => ({
      id: item.productId,
      name: item.name,
    }));
  }

  getClients(): Promise<CatalogItem[]> {
    return this.fetch<{ clientId: number; name: string }>('Clients', (item) => ({
      id: item.clientId,
      name: item.name,
    }));
  }

  getPrintTypes(): Promise<CatalogItem[]> {
    return this.fetch<{ printTypeId: number; name: string }>('PrintTypes', (item) => ({
      id: item.printTypeId,
      name: item.name,
    }));
  }

  getCountries(): Promise<CatalogItem[]> {
    return this.fetch<{ countryId: number; name: string }>('Countries', (item) => ({
      id: item.countryId,
      name: item.name,
    }));
  }

  getDepartments(): Promise<CatalogItem[]> {
    return this.fetch<{ departmentId: number; name: string }>('Departments', (item) => ({
      id: item.departmentId,
      name: item.name,
    }));
  }

  getSubDepartments(): Promise<CatalogItem[]> {
    return this.fetch<{ subDepartmentId: number; name: string }>('SubDepartments', (item) => ({
      id: item.subDepartmentId,
      name: item.name,
    }));
  }

  getMediaTypes(): Promise<CatalogItem[]> {
    return this.fetch<{ mediaTypeId: number; name: string }>('MediaTypes', (item) => ({
      id: item.mediaTypeId,
      name: item.name,
    }));
  }

  getDocumentTypes(): Promise<CatalogItem[]> {
    return this.fetch<{ documentTypeId: number; name: string }>('DocumentTypes', (item) => ({
      id: item.documentTypeId,
      name: item.name,
    }));
  }

  getWarehousePeriods(): Promise<CatalogItem[]> {
    return this.fetch<{ warehousePeriodId: number; name: string }>('WarehousePeriods', (item) => ({
      id: item.warehousePeriodId,
      name: item.name,
    }));
  }

  getSpecialCases(): Promise<SpecialCaseItem[]> {
    return this.fetch<{ specialCaseId: number; code: string; name: string }, SpecialCaseItem>(
      'SpecialCases',
      (item) => ({ id: item.specialCaseId, code: item.code, name: item.name })
    );
  }

  getVoidReasons(): Promise<VoidReasonItem[]> {
    return this.fetch<{ voidReasonId: number; code: string; name: string }, VoidReasonItem>(
      'VoidReasons',
      (item) => ({ id: item.voidReasonId, code: item.code, name: item.name })
    );
  }

  getDistricts(): Promise<CatalogItem[]> {
    return this.fetch<{ districtId: number; districtName: string }>('Districts', (item) => ({
      id: item.districtId,
      name: item.districtName,
    }));
  }

  /** La Iglesia se maneja por Distrito: sin districtId trae todas, con districtId filtra las de ese distrito. */
  getChurches(districtId?: number | null): Promise<CatalogItem[]> {
    return this.fetch<{ churchId: number; churchName: string }>(
      'Churches',
      (item) => ({ id: item.churchId, name: item.churchName }),
      districtId ? { DistrictId: districtId } : undefined
    );
  }

  getMissions(): Promise<CatalogItem[]> {
    return this.fetch<{ missionId: number; name: string }>('Missions', (item) => ({
      id: item.missionId,
      name: item.name,
    }));
  }

  getProvinces(): Promise<CatalogItem[]> {
    return this.fetch<{ provinceId: number; name: string }>('Provinces', (item) => ({
      id: item.provinceId,
      name: item.name,
    }));
  }

  getChurchTypes(): Promise<CatalogItem[]> {
    return this.fetch<{ churchTypeId: number; name: string }>('ChurchTypes', (item) => ({
      id: item.churchTypeId,
      name: item.name,
    }));
  }

  getUsers(): Promise<CatalogItem[]> {
    return this.fetch<{ appUserId: number; firstName: string; lastName: string }>('AppUsers', (item) => ({
      id: item.appUserId,
      name: `${item.firstName} ${item.lastName}`,
    }));
  }

  private async fetch<T, R = CatalogItem>(
    resource: string,
    map: (item: T) => R,
    extraParams?: Record<string, string | number>
  ): Promise<R[]> {
    const response = await firstValueFrom(
      this.http.get<RawPagedResponse<T>>(`${environment.apiUrl}/${resource}`, {
        params: { pageSize: LOOKUP_PAGE_SIZE, pageNumber: 1, ...extraParams },
      })
    );
    return response.data.items.map(map);
  }
}
