import { ReceiptEdit, ReceiptSummaryLine } from '../receipts/receipt.models';

export interface Issue extends Record<string, unknown> {
  issueId: number;
  issueTypeId: number | null;
  warehouseId: number | null;
  warehousePeriodId: number | null;
  clientId: number | null;
  complement: string | null;
  issueDate: string;
  printTypeId: number | null;
  description: string | null;
  createdAt: string;
  createdById: number | null;
  createdByFullName: string | null;
  hasPendingChangeRequest: boolean;
  total: number;
  isVoided: boolean;
  hasPendingVoidRequest: boolean;
  voidReasonName: string | null;
  voidDetail: string | null;
  /** N° de salida por mes, como se imprime: "S 15-10-26" (las viejas, su N° interno). */
  noteNumber: string | null;
  /** Revisión del Contador: digitado, verificado o aprobado. */
  reviewStatus: string | null;
}

/** Salida completa con fotos (página del QR y carga de la corrección). */
export interface IssueSummary {
  issueId: number;
  noteNumber: string;
  issueTypeId: number | null;
  issueTypeName: string | null;
  clientId: number | null;
  clientName: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  issueDate: string;
  description: string | null;
  isVoided: boolean;
  createdByName: string | null;
  createdAt: string;
  lines: ReceiptSummaryLine[];
}

/** Corrección de una salida: la salida completa como debería quedar, con el motivo. */
export interface IssueEditRequest {
  issueId: number;
  reason: string;
  issueTypeId?: number | null;
  clientId?: number | null;
  description?: string | null;
  issueDate?: string | null;
  details: IssueDetailRequest[];
}

export interface IssueEdit extends Omit<ReceiptEdit, 'receiptId'> {
  issueId: number;
}

export interface IssueDetail {
  issueDetailId: number;
  issueId: number;
  productId: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface IssueDetailRequest {
  productId: number;
  quantity: number;
}

export interface IssueRequest {
  issueTypeId?: number | null;
  warehouseId: number;
  warehousePeriodId?: number | null;
  clientId?: number | null;
  issueDate?: string | null;
  printTypeId?: number | null;
  description?: string | null;
  sendToAccountsReceivable: boolean;
  paymentType?: string | null;
  paymentDetail?: string | null;
  dueDate?: string | null;
  details: IssueDetailRequest[];
}

export interface IssueFilters {
  issueId?: number;
  clientId?: number;
  warehouseId?: number;
  issueTypeId?: number;
  clientName?: string;
  /** N° de salida tal como sale impreso: "S 15-10-26". */
  noteNumber?: string;
}
