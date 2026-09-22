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
}
