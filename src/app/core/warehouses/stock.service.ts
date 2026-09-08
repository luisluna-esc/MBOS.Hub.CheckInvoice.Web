import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StockInfo {
  quantity: number;
  averageCost: number;
}

interface StockItem {
  quantity: number;
  averageCost: number;
}

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly http = inject(HttpClient);

  async get(warehouseId: number, productId: number): Promise<StockInfo> {
    const response = await firstValueFrom(
      this.http.get<{ data: { items: StockItem[] } }>(`${environment.apiUrl}/Stocks`, {
        params: { warehouseId, productId, pageSize: 1, pageNumber: 1 },
      })
    );
    const item = response.data.items[0];
    return { quantity: item?.quantity ?? 0, averageCost: item?.averageCost ?? 0 };
  }
}
