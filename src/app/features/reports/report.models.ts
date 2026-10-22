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
  dateTo?: string;
  /** Estado: solo elige productos (todos sus documentos firmados o no); no cambia cantidades. */
  reviewState?: 'updated' | 'outdated';
}

export interface StockByDepartmentReportFilters {
  warehouseId?: number;
  departmentId?: number;
  dateTo?: string;
  /** Estado: solo elige productos (todos sus documentos firmados o no); no cambia cantidades. */
  reviewState?: 'updated' | 'outdated';
}

export interface KardexReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Estado: solo elige productos (todos sus documentos firmados o no); no cambia cantidades. */
  reviewState?: 'updated' | 'outdated';
}

export interface InventoryCountReportFilters {
  warehouseId?: number;
  dateTo?: string;
  /** Estado: solo elige productos (todos sus documentos firmados o no); no cambia cantidades. */
  reviewState?: 'updated' | 'outdated';
}

export interface IssuesReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Firma: 'updated' (verificado) u 'outdated' (sin verificar). */
  reviewState?: 'updated' | 'outdated';
}

/** Informe para contabilidad: de salidas o de entradas (ingresos). */
export type AccountingKind = 'issues' | 'receipts';

export interface AccountingReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Solo en entradas. */
  receiptTypeId?: number;
  /** Firma: 'updated' (verificado) u 'outdated' (sin verificar). */
  reviewState?: 'updated' | 'outdated';
}

/** Una fila del archivo para contabilidad (formato "Transaction_Entry"). */
export type AccountingEntryRow = {
  accountCode: string;
  subAccountCode: string;
  fundCode: string;
  functionCode: string;
  restrictionCode: string;
  entityValue: number;
  sendMemo: string;
  description: string;
  documentId: number;
  documentDate: string;
  warehouseName: string | null;
  departmentName: string | null;
  productCode: string | null;
  /** Solo en entradas: N° de nota y tipo de entrada. */
  documentNumber?: string | null;
  documentType?: string | null;
};

export interface TransfersReportFilters {
  sourceWarehouseId?: number;
  destinationWarehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Firma: 'updated' (aprobado por el Contador) u 'outdated' (sin aprobar). */
  reviewState?: 'updated' | 'outdated';
}

export interface ReceiptsReportFilters {
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Firma: 'updated' (verificado) u 'outdated' (sin verificar). */
  reviewState?: 'updated' | 'outdated';
}

export interface KardexByProductReportFilters {
  productId?: number;
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Estado: solo elige productos (todos sus documentos firmados o no); no cambia cantidades. */
  reviewState?: 'updated' | 'outdated';
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
