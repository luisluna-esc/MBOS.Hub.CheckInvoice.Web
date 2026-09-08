import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Church, ChurchFilters, ChurchRequest } from './church.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChurchService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: ChurchFilters): Promise<PagedResult<Church>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Church> }>(`${environment.apiUrl}/Churches`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: ChurchRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/Churches`, request));
  }

  update(churchId: number, request: ChurchRequest): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/Churches/${churchId}`, request));
  }

  delete(churchId: number): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(`${environment.apiUrl}/Churches/${churchId}`));
  }

  private cleanFilters(filters: ChurchFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
