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
  /** N° de nota por mes, como se imprime: "15-01". */
  noteNumber: string | null;
  /** Revisión del Contador: digitado, verificado o aprobado. */
  reviewStatus: string | null;
}

/** Nota de ingreso completa (página del QR). */
export interface ReceiptSummary {
  receiptId: number;
  noteNumber: string;
  receiptTypeId: number | null;
  supplierId: number | null;
  warehouseId: number | null;
  relatedIssueId: number | null;
  issueDate: string;
  purchaseDate: string | null;
  receiptTypeName: string | null;
  warehouseName: string | null;
  supplierName: string | null;
  taxId: string | null;
  invoiceNumber: string | null;
  description: string | null;
  invoiceTotal: number | null;
  isVoided: boolean;
  createdByName: string | null;
  createdAt: string;
  lines: ReceiptSummaryLine[];
}

export interface ReceiptSummaryLine {
  productId: number;
  code: string | null;
  name: string;
  unitMeasure: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalCost: number;
  imageVersion: number | null;
}

export interface ReceiptDetail {
  receiptDetailId: number;
  receiptId: number;
  productId: number;
  quantity: number;
  /** Precio de compra. Con retención el costo unitario es menor (precio x 0,92). */
  unitPrice: number | null;
  unitCost: number;
  totalCost: number;
  workOrder: string | null;
  detail: string | null;
}

export interface ReceiptDetailRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptRequest {
  supplierId?: number | null;
  taxId?: string | null;
  warehouseId: number;
  receiptTypeId?: number | null;
  invoiceNumber?: string | null;
  description?: string | null;
  invoiceTotal?: number | null;
  /** Fecha de ingreso al almacén (mes anterior o actual, hasta hoy). */
  issueDate?: string | null;
  /** Fecha de compra (factura o recibo). */
  purchaseDate?: string | null;
  details: ReceiptDetailRequest[];
}

/** Corrección de una entrada: la nota completa como debería quedar, con el motivo. */
export interface ReceiptEditRequest {
  receiptId: number;
  reason: string;
  supplierId?: number | null;
  taxId?: string | null;
  invoiceNumber?: string | null;
  description?: string | null;
  invoiceTotal?: number | null;
  issueDate?: string | null;
  purchaseDate?: string | null;
  details: ReceiptDetailRequest[];
}

export interface ReceiptEditFieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface ReceiptEditLineChange {
  productId: number;
  code: string | null;
  name: string;
  quantityBefore: number;
  quantityAfter: number;
  priceBefore: number;
  priceAfter: number;
}

export interface ReceiptEdit {
  changeRequestId: number;
  receiptId: number;
  noteNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  requestedByName: string | null;
  requestedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  headerChanges: ReceiptEditFieldChange[];
  lines: ReceiptEditLineChange[];
}

export interface ReceiptFilters {
  receiptId?: number;
  supplierId?: number;
  warehouseId?: number;
  receiptTypeId?: number;
  invoiceNumber?: string;
  supplierName?: string;
  /** N° de nota tal como sale impreso: "15-01" o "15-01-2026". */
  noteNumber?: string;
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
  /** Fecha de la devolución (mes anterior o actual, hasta hoy). */
  returnDate?: string | null;
  lines: ReceiptReturnLineRequest[];
}
