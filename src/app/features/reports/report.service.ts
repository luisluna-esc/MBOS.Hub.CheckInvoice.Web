import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccountReceivablesReportFilters,
  FinancialDashboardData,
  InventoryCountReportFilters,
  IssuesReportFilters,
  KardexByProductReportFilters,
  KardexReportFilters,
  PastorFieldReportFilters,
  ReceiptsReportFilters,
  StockByDepartmentReportFilters,
  StockReportFilters
} from './report.models';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  async getFinancialDashboardData(): Promise<FinancialDashboardData> {
    return firstValueFrom(
      this.http.get<FinancialDashboardData>(`${environment.apiUrl}/Reports/financial-dashboard/data`)
    );
  }

  async downloadFinancialDashboard(): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/financial-dashboard`, { responseType: 'blob' })
    );
    this.triggerDownload(blob, 'reporte-financiero.pdf');
  }

  async getStockReportPdfBlob(filters: StockReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getInventoryCountTemplatePdfBlob(filters: StockReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/inventory-count-template/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getStockByDepartmentReportPdfBlob(filters: StockByDepartmentReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock-by-department/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getKardexReportPdfBlob(filters: KardexReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/kardex/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getInventoryCountReportPdfBlob(filters: InventoryCountReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/inventory-count/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getIssuesReportPdfBlob(filters: IssuesReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/issues/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getReceiptsReportPdfBlob(filters: ReceiptsReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/receipts/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getReceiptVoucherPdfBlob(receiptId: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/receipt-voucher/${receiptId}/pdf`, { responseType: 'blob' })
    );
  }

  async getIssueVoucherPdfBlob(issueId: number, printTypeId?: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/issue-voucher/${issueId}/pdf`, {
        params: printTypeId ? { printTypeId } : {},
        responseType: 'blob'
      })
    );
  }

  async getTransferVoucherPdfBlob(transferId: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/transfer-voucher/${transferId}/pdf`, { responseType: 'blob' })
    );
  }

  async getKardexByProductReportPdfBlob(filters: KardexByProductReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/kardex-by-product/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getPastorFieldReportPdfBlob(filters: PastorFieldReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/pastor-field/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getAccountReceivablesReportPdfBlob(filters: AccountReceivablesReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/account-receivables/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  private cleanFilters(
    filters:
      | StockReportFilters
      | StockByDepartmentReportFilters
      | KardexReportFilters
      | InventoryCountReportFilters
      | IssuesReportFilters
      | ReceiptsReportFilters
      | KardexByProductReportFilters
      | PastorFieldReportFilters
      | AccountReceivablesReportFilters
  ): Record<string, string> {
    const clean: Record<string, string> = {};
    if ('warehouseId' in filters && filters.warehouseId) {
      clean['WarehouseId'] = String(filters.warehouseId);
    }
    if ('departmentId' in filters && filters.departmentId) {
      clean['DepartmentId'] = String(filters.departmentId);
    }
    if ('productId' in filters && filters.productId) {
      clean['ProductId'] = String(filters.productId);
    }
    if ('clientId' in filters && filters.clientId) {
      clean['ClientId'] = String(filters.clientId);
    }
    if ('status' in filters && filters.status) {
      clean['Status'] = filters.status;
    }
    if (filters.dateFrom) {
      clean['DateFrom'] = filters.dateFrom;
    }
    if (filters.dateTo) {
      clean['DateTo'] = filters.dateTo;
    }
    return clean;
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
