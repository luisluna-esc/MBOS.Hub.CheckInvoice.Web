import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiMessage } from '../../../core/auth/auth.models';
import { PagedResult } from '../../../core/http/paged-result';
import {
  PendingDeliveryRequest,
  PendingReceipt,
  PendingReceiptFilters,
  PendingReceiptRequest,
  PendingReceiptValidateRequest,
} from './pending-receipt.models';

interface PostResponse {
  id: number;
  messages: ApiMessage[];
}

/** Notas de ingreso sin factura: no tocan el stock ni los reportes hasta unir la factura. */
@Injectable({ providedIn: 'root' })
export class PendingReceiptService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/PendingReceipts`;

  async list(pageNumber: number, pageSize: number, filters: PendingReceiptFilters): Promise<PagedResult<PendingReceipt>> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<PendingReceipt> }>(this.baseUrl, {
        params: { pageNumber, pageSize, ...clean(filters) },
      })
    );
    return response.data;
  }

  async get(pendingReceiptId: number): Promise<PendingReceipt> {
    const response = await firstValueFrom(this.http.get<{ data: PendingReceipt }>(`${this.baseUrl}/${pendingReceiptId}`));
    return response.data;
  }

  create(request: PendingReceiptRequest): Promise<PostResponse> {
    return firstValueFrom(this.http.post<PostResponse>(this.baseUrl, request));
  }

  void(pendingReceiptId: number): Promise<PostResponse> {
    return firstValueFrom(this.http.put<PostResponse>(`${this.baseUrl}/${pendingReceiptId}/void`, {}));
  }

  deliver(pendingReceiptId: number, request: PendingDeliveryRequest): Promise<PostResponse> {
    return firstValueFrom(this.http.post<PostResponse>(`${this.baseUrl}/${pendingReceiptId}/deliveries`, request));
  }

  voidDelivery(pendingDeliveryId: number): Promise<PostResponse> {
    return firstValueFrom(this.http.put<PostResponse>(`${this.baseUrl}/deliveries/${pendingDeliveryId}/void`, {}));
  }

  validate(request: PendingReceiptValidateRequest): Promise<PostResponse> {
    return firstValueFrom(this.http.post<PostResponse>(`${this.baseUrl}/validate`, request));
  }

  pdf(filters: PendingReceiptFilters): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/pdf`, { params: clean(filters), responseType: 'blob' }));
  }
}

function clean(filters: PendingReceiptFilters): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

/** Primer mensaje de error de la API, para el toast. */
export function apiError(error: unknown): string | undefined {
  return (error as { error?: { messages?: { description: string }[] } })?.error?.messages?.[0]?.description;
}
