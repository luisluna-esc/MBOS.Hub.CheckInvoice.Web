import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import { Receipt, ReceiptDetail, ReceiptFilters, ReceiptRequest } from './receipt.models';

interface CreateResponse {
  id: number;
  messages: ApiMessage[];
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly http = inject(HttpClient);

  async list(pageNumber: number, pageSize: number, filters: ReceiptFilters): Promise<PagedResult<Receipt>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<Receipt> }>(`${environment.apiUrl}/Receipts`, {
        params: { pageNumber, pageSize, ...this.cleanFilters(filters) },
      })
    );
    return response.data;
  }

  async getDetails(receiptId: number): Promise<ReceiptDetail[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: ReceiptDetail[] }>(`${environment.apiUrl}/Receipts/${receiptId}/details`)
    );
    return response.data;
  }

  create(request: ReceiptRequest): Promise<CreateResponse> {
    return firstValueFrom(this.http.post<CreateResponse>(`${environment.apiUrl}/Receipts`, request));
  }

  private cleanFilters(filters: ReceiptFilters): Record<string, string | number> {
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        clean[key] = value;
      }
    }
    return clean;
  }
}
