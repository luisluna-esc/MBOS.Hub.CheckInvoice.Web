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
  TransfersReportFilters,
  AccountingEntryRow,
  AccountingKind,
  AccountingReportFilters,
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

  async getStockReportPdfBlob(filters: StockReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock/pdf`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getStockReportExcelBlob(filters: StockReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getStockReportTxtBlob(filters: StockReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock/txt`, {
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

  async getStockByDepartmentReportExcelBlob(filters: StockByDepartmentReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock-by-department/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getStockByDepartmentReportTxtBlob(filters: StockByDepartmentReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/stock-by-department/txt`, {
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

  async getKardexReportExcelBlob(filters: KardexReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/kardex/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getKardexReportTxtBlob(filters: KardexReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/kardex/txt`, {
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

  async getInventoryCountReportExcelBlob(filters: InventoryCountReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/inventory-count/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getInventoryCountReportTxtBlob(filters: InventoryCountReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/inventory-count/txt`, {
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

  async getIssuesReportExcelBlob(filters: IssuesReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/issues/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getIssuesReportTxtBlob(filters: IssuesReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/issues/txt`, {
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

  async getReceiptsReportExcelBlob(filters: ReceiptsReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/receipts/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getReceiptsReportTxtBlob(filters: ReceiptsReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/receipts/txt`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getTransfersReportPdfBlob(filters: TransfersReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/transfers/pdf`, { params: this.transferParams(filters), responseType: 'blob' })
    );
  }

  async getTransfersReportExcelBlob(filters: TransfersReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/transfers/excel`, { params: this.transferParams(filters), responseType: 'blob' })
    );
  }

  async getTransfersReportTxtBlob(filters: TransfersReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/transfers/txt`, { params: this.transferParams(filters), responseType: 'blob' })
    );
  }

  /** Salidas o Ingresos para contabilidad (formato de importación del sistema contable). */
  async getAccounting(kind: AccountingKind, filters: AccountingReportFilters): Promise<AccountingEntryRow[]> {
    return firstValueFrom(
      this.http.get<AccountingEntryRow[]>(`${environment.apiUrl}/Reports/${kind}-accounting`, { params: this.accountingParams(filters) })
    );
  }

  async getAccountingExcelBlob(kind: AccountingKind, filters: AccountingReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/${kind}-accounting/excel`, { params: this.accountingParams(filters), responseType: 'blob' })
    );
  }

  async getAccountingTxtBlob(kind: AccountingKind, filters: AccountingReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/${kind}-accounting/txt`, { params: this.accountingParams(filters), responseType: 'blob' })
    );
  }

  private accountingParams(filters: AccountingReportFilters): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.warehouseId) {
      params['WarehouseId'] = String(filters.warehouseId);
    }
    if (filters.dateFrom) {
      params['DateFrom'] = filters.dateFrom;
    }
    if (filters.dateTo) {
      params['DateTo'] = filters.dateTo;
    }
    if (filters.receiptTypeId) {
      params['ReceiptTypeId'] = String(filters.receiptTypeId);
    }
    return params;
  }

  private transferParams(filters: TransfersReportFilters): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.sourceWarehouseId) {
      params['SourceWarehouseId'] = String(filters.sourceWarehouseId);
    }
    if (filters.destinationWarehouseId) {
      params['DestinationWarehouseId'] = String(filters.destinationWarehouseId);
    }
    if (filters.dateFrom) {
      params['DateFrom'] = filters.dateFrom;
    }
    if (filters.dateTo) {
      params['DateTo'] = filters.dateTo;
    }
    return params;
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

  async getKardexByProductReportExcelBlob(filters: KardexByProductReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/kardex-by-product/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getKardexByProductReportTxtBlob(filters: KardexByProductReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/kardex-by-product/txt`, {
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

  async getPastorFieldReportExcelBlob(filters: PastorFieldReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/pastor-field/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getPastorFieldReportTxtBlob(filters: PastorFieldReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/pastor-field/txt`, {
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

  async getAccountReceivablesReportExcelBlob(filters: AccountReceivablesReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/account-receivables/excel`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getAccountReceivablesReportTxtBlob(filters: AccountReceivablesReportFilters): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/account-receivables/txt`, {
        params: this.cleanFilters(filters),
        responseType: 'blob'
      })
    );
  }

  async getAccountReceivableVoucherPdfBlob(accountReceivableId: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/Reports/account-receivable-voucher/${accountReceivableId}/pdf`, {
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
}
