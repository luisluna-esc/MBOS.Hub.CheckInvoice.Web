import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Transfer, TransferDetail, TransferFilters, TransferRequest } from './transfer.models';

interface CreateResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: TransferFilters): Promise<PagedResult<Transfer>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Transfer> }>(`${environment.apiUrl}/Transfers`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  async getDetails(transferId: number): Promise<TransferDetail[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: TransferDetail[] }>(`${environment.apiUrl}/Transfers/${transferId}/details`)
    );
    return response.data;
  }

  create(request: TransferRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Transfers`, request));
  }

  approve(transferId: number): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Transfers/${transferId}/approve`, {}));
  }

  private cleanFilters(filters: TransferFilters): Record<string, string | number | boolean> {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
