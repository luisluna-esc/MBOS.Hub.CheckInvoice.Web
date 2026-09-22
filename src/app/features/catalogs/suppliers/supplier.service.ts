import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Supplier, SupplierFilters, SupplierRequest } from './supplier.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: SupplierFilters): Promise<PagedResult<Supplier>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Supplier> }>(`${environment.apiUrl}/Suppliers`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: SupplierRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/Suppliers`, request));
  }

  update(supplierId: number, request: SupplierRequest): Promise<WriteResponse> {
    return firstValueFrom(
      this.http.put<WriteResponse>(`${environment.apiUrl}/Suppliers/${supplierId}`, request)
    );
  }

  delete(supplierId: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/Suppliers/${supplierId}`));
  }

  async checkTaxIdAvailable(taxId: string, excludePartyId?: number | null): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.get<{ available: boolean }>(`${environment.apiUrl}/Suppliers/check-taxid`, {
        params: excludePartyId ? { taxId, excludePartyId } : { taxId },
      })
    );
    return response.available;
  }

  private cleanFilters(filters: SupplierFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
