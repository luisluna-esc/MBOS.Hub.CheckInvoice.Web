import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../../core/http/paged-result';
import { PortalAccountReceivable, PortalDateRangeFilters, PortalIssue, PortalPayment } from './portal.models';

const LOOKUP_PAGE_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);

  async getMyAccountReceivables(): Promise<PortalAccountReceivable[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<PortalAccountReceivable> }>(`${environment.apiUrl}/portal/account-receivables`, {
        params: { pageNumber: 1, pageSize: LOOKUP_PAGE_SIZE },
      })
    );
    return response.data.items;
  }

  async getMyPayments(): Promise<PortalPayment[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<PortalPayment> }>(`${environment.apiUrl}/portal/payments`, {
        params: { pageNumber: 1, pageSize: LOOKUP_PAGE_SIZE },
      })
    );
    return response.data.items;
  }

  async getMyIssues(filters: PortalDateRangeFilters): Promise<PortalIssue[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: PagedResult<PortalIssue> }>(`${environment.apiUrl}/portal/issues`, {
        params: { pageNumber: 1, pageSize: LOOKUP_PAGE_SIZE, ...this.cleanFilters(filters) },
      })
    );
    return response.data.items;
  }

  private cleanFilters(filters: PortalDateRangeFilters): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        clean[key] = value as string;
      }
    }
    return clean;
  }
}
