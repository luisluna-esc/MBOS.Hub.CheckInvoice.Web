import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import {
  ReceiptVoidRequest,
  ReceiptVoidRequestCreate,
  ReceiptVoidRequestFilters,
  ReceiptVoidRequestReview,
} from './receipt-void-request.models';

interface WriteResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class ReceiptVoidRequestService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: ReceiptVoidRequestFilters): Promise<PagedResult<ReceiptVoidRequest>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<ReceiptVoidRequest> }>(`${environment.apiUrl}/ReceiptVoidRequests`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  create(request: ReceiptVoidRequestCreate): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(`${environment.apiUrl}/ReceiptVoidRequests`, request));
  }

  approve(id: number, review: ReceiptVoidRequestReview): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/ReceiptVoidRequests/${id}/approve`, review));
  }

  reject(id: number, review: ReceiptVoidRequestReview): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(`${environment.apiUrl}/ReceiptVoidRequests/${id}/reject`, review));
  }

  private cleanFilters(filters: ReceiptVoidRequestFilters): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value as string;
      }
    }
    return clean;
  }
}
