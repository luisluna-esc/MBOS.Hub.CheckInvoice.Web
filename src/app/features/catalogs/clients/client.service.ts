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
