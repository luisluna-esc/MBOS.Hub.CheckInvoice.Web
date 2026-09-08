export interface PortalAccountReceivable extends Record<string, unknown> {
  accountReceivableId: number;
  issueId: number | null;
  issueDate: string | null;
  totalAmount: number;
  outstandingBalance: number;
  paymentType: string;
  dueDate: string | null;
  status: string;
}

export interface PortalPayment extends Record<string, unknown> {
  paymentId: number;
  accountReceivableId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  notes: string | null;
}

export interface PortalIssue extends Record<string, unknown> {
  issueId: number;
  issueDate: string;
  total: number;
}

export interface PortalDateRangeFilters {
  dateFrom?: string;
  dateTo?: string;
}
