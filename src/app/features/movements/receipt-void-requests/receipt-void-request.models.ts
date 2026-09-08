export interface ReceiptVoidRequest extends Record<string, unknown> {
  receiptVoidRequestId: number;
  receiptId: number;
  receiptDate: string;
  supplierName: string | null;
  warehouseName: string | null;
  receiptTotal: number;
  voidReasonId: number;
  voidReasonName: string;
  detail: string | null;
  status: string;
  requestedBy: number;
  requestedByFullName: string | null;
  requestedAt: string;
  reviewedBy: number | null;
  reviewedByFullName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface ReceiptVoidRequestCreate {
  receiptId: number;
  voidReasonId: number;
  detail?: string | null;
}

export interface ReceiptVoidRequestReview {
  reviewNotes?: string | null;
}

export interface ReceiptVoidRequestFilters {
  status?: string;
}
