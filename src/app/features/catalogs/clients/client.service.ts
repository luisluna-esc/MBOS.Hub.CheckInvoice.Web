import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Client, ClientFilters, ClientRequest, GrantPortalAccessResult } from './client.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

interface GrantPortalAccessResponse {
  data: GrantPortalAccessResult;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly http = inject(HttpClient);

  /** NIT/C.I. ya registrado: nombre de quien lo tiene (null si está libre). */
  async taxIdOwner(taxId: string, excludePartyId?: number | null): Promise<string | null> {
    const response = await firstValueFrom(
      this.http.get<{ data: { ownerName: string | null } }>(`${environment.apiUrl}/Clients/tax-id-check`, {
        params: excludePartyId ? { taxId, excludePartyId } : { taxId },
      })
    );
    return response.data.ownerName;
  }

  /** Pastor que ya tiene ese distrito y esa iglesia (null si están libres). */
  async pastorSlots(
    districtId: number | null,
    churchId: number | null,
    excludeClientId: number | null
  ): Promise<{ districtPastor: string | null; churchPastor: string | null }> {
    const params: Record<string, number> = {};
    if (districtId) {
      params['districtId'] = districtId;
    }
    if (churchId) {
      params['churchId'] = churchId;
    }
    if (excludeClientId) {
      params['excludeClientId'] = excludeClientId;
    }
    const response = await firstValueFrom(
      this.http.get<{ data: { districtPastor: string | null; churchPastor: string | null } }>(
        `${environment.apiUrl}/Clients/pastor-check`,
        { params }
      )
    );
    return response.data;
  }

  async list(pageNumber: number, pageSize: number, filters: ClientFilters): Promise<PagedResult<Client>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Client> }>(`${environment.apiUrl}/Clients`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: ClientRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/Clients`, request));
  }

  update(clientId: number, request: ClientRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/Clients/${clientId}`, request));
  }

  delete(clientId: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/Clients/${clientId}`));
  }

  async grantPortalAccess(clientId: number): Promise<GrantPortalAccessResult> {
    const response = await firstValueFrom(
      this.http.post<GrantPortalAccessResponse>(`${environment.apiUrl}/Clients/${clientId}/grant-portal-access`, {})
    );
    return response.data;
  }

  async resetPortalPassword(clientId: number): Promise<GrantPortalAccessResult> {
    const response = await firstValueFrom(
      this.http.post<GrantPortalAccessResponse>(`${environment.apiUrl}/Clients/${clientId}/reset-portal-password`, {})
    );
    return response.data;
  }

  private cleanFilters(filters: ClientFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
