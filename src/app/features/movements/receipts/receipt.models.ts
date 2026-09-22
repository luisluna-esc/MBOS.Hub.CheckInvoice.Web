export interface Receipt extends Record<string, unknown> {
  receiptId: number;
  supplierId: number | null;
  taxId: string | null;
  warehouseId: number | null;
  warehousePeriodId: number | null;
  receiptTypeId: number | null;
  invoiceNumber: string | null;
  description: string | null;
  issueDate: string;
  invoiceTotal: number | null;
  createdAt: string;
  createdById: number | null;
  createdByFullName: string | null;
  hasPendingChangeRequest: boolean;
  isVoided: boolean;
  hasPendingVoidRequest: boolean;
  voidReasonName: string | null;
  voidDetail: string | null;
  relatedIssueId: number | null;
}

export interface ReceiptDetail {
  receiptDetailId: number;
  receiptId: number;
  productId: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  workOrder: string | null;
  detail: string | null;
}

export interface ReceiptDetailRequest {
  productId: number;
  quantity: number;
  unitCost: number;
  workOrder?: string | null;
  detail?: string | null;
}

export interface ReceiptRequest {
  supplierId?: number | null;
  taxId?: string | null;
  warehouseId: number;
  warehousePeriodId?: number | null;
  receiptTypeId?: number | null;
  invoiceNumber?: string | null;
  description?: string | null;
  invoiceTotal?: number | null;
  issueDate?: string | null;
  details: ReceiptDetailRequest[];
}

export interface ReceiptFilters {
  receiptId?: number;
  supplierId?: number;
  warehouseId?: number;
  receiptTypeId?: number;
  invoiceNumber?: string;
  supplierName?: string;
}

export interface ReturnableIssueLine {
  productId: number;
  quantityIssued: number;
  quantityAlreadyReturned: number;
  quantityReturnable: number;
  unitCost: number;
}

export interface ReceiptReturnLineRequest {
  productId: number;
  quantity: number;
}

export interface ReceiptReturnRequest {
  issueId: number;
  receiptTypeId: number;
  description?: string | null;
  lines: ReceiptReturnLineRequest[];
}
