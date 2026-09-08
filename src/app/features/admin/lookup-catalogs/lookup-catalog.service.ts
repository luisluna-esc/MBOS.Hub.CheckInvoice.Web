import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { LookupCatalogItem, LookupCatalogRequest } from './lookup-catalog.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

/** Un solo servicio, parametrizado por `resource` en cada llamada, en vez de 14
 * servicios casi idénticos — cada `resource` es el segmento de ruta REST real
 * (ej. 'DocumentTypes') que ya expone el backend con GET/POST/PUT/DELETE completos. */
@Injectable({ providedIn: 'root' })
export class LookupCatalogService {
  private readonly http = inject(HttpClient);

  async list(resource: string, pageNumber: number, pageSize: number): Promise<PagedResult<LookupCatalogItem>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<LookupCatalogItem> }>(`${environment.apiUrl}/${resource}`, {
        params: { pageNumber, pageSize },
      })
    );
    return response.data;
  }

  create(resource: string, request: LookupCatalogRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/${resource}`, request));
  }

  update(resource: string, id: number, request: LookupCatalogRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/${resource}/${id}`, request));
  }

  delete(resource: string, id: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/${resource}/${id}`));
  }
}
