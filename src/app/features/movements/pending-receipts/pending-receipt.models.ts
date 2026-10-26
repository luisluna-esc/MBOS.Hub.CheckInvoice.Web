/** Estado de una nota de ingreso sin factura. */
export type PendingReceiptStatus = 'pendiente' | 'validado' | 'anulado';

export interface PendingReceiptLine {
  productId: number;
  code: string | null;
  name: string;
  unitMeasure: string | null;
  imageVersion: number | null;
  received: number;
  /** Entregado en entregas pendientes (sin las anuladas). */
  delivered: number;
  remaining: number;
}

export interface PendingDeliveryLine {
  productId: number;
  name: string;
  quantity: number;
}

export interface PendingDelivery {
  pendingDeliveryId: number;
  deliveryDate: string;
  issueTypeId: number | null;
  issueTypeName: string | null;
  clientId: number | null;
  clientName: string | null;
  description: string | null;
  sendToAccountsReceivable: boolean;
  isVoided: boolean;
  /** Salida creada al unir la factura. */
  issueId: number | null;
  issueNumber: string | null;
  createdByName: string | null;
  lines: PendingDeliveryLine[];
}

export interface PendingReceipt {
  pendingReceiptId: number;
  noteNumber: string;
  warehouseId: number;
  warehouseName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  receivedDate: string;
  description: string | null;
  status: PendingReceiptStatus;
  /** Entrada creada al unir la factura. */
  receiptId: number | null;
  receiptNoteNumber: string | null;
  invoiceNumber: string | null;
  createdByName: string | null;
  createdAt: string;
  closedByName: string | null;
  closedAt: string | null;
  lines: PendingReceiptLine[];
  deliveries: PendingDelivery[];
}

export interface PendingReceiptFilters {
  warehouseId?: number | null;
  status?: PendingReceiptStatus | null;
  noteNumber?: string | null;
}

export interface PendingLineRequest {
  productId: number;
  quantity: number;
}

export interface PendingReceiptRequest {
  warehouseId: number;
  supplierId: number | null;
  receivedDate: string | null;
  description: string | null;
  details: PendingLineRequest[];
}

export interface PendingDeliveryRequest {
  deliveryDate: string | null;
  issueTypeId: number | null;
  clientId: number | null;
  description: string | null;
  sendToAccountsReceivable: boolean;
  paymentType: string | null;
  paymentDetail: string | null;
  dueDate: string | null;
  details: PendingLineRequest[];
}

export interface PendingInvoiceLine {
  pendingReceiptId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}

/** Unir la factura a una o varias notas del mismo almacén. */
export interface PendingReceiptValidateRequest {
  pendingReceiptIds: number[];
  receiptTypeId: number | null;
  supplierId: number | null;
  taxId: string | null;
  invoiceNumber: string | null;
  purchaseDate: string | null;
  invoiceTotal: number | null;
  lines: PendingInvoiceLine[];
}
