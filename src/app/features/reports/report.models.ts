export interface FinancialDashboardSummary {
  totalIssuesThisMonth: number;
  totalReceiptsThisMonth: number;
  totalPendingReceivable: number;
  totalPaymentsThisMonth: number;
}

export interface MonthlyTotal {
  monthLabel: string;
  total: number;
}

export interface ReceivableStatusSummary {
  pendingTotal: number;
  paidTotal: number;
}

export interface FinancialDashboardData {
  summary: FinancialDashboardSummary;
  issuesByMonth: MonthlyTotal[];
  receivableStatus: ReceivableStatusSummary;
}

export interface StockReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockByDepartmentReportFilters {
  warehouseId?: number;
  departmentId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface KardexReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface InventoryCountReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface IssuesReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReceiptsReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface KardexByProductReportFilters {
  productId?: number;
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface PastorFieldReportFilters {
  clientId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface AccountReceivablesReportFilters {
  clientId?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}
