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

export interface PortalStatementLine {
  issueDetailId: number;
  productId: number;
  code: string | null;
  name: string;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface PortalStatementPayment {
  paymentId: number;
  paymentDate: string;
  paymentMethod: string | null;
  amount: number;
  notes: string | null;
}

/** Una cuenta por cobrar del pastor con sus productos y depósitos (Mi Cuenta). */
export interface PortalStatementAccount {
  accountReceivableId: number;
  issueId: number | null;
  issueDate: string | null;
  dueDate: string | null;
  status: 'pending' | 'late' | 'paid';
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  lines: PortalStatementLine[];
  payments: PortalStatementPayment[];
}

export interface PortalDateRangeFilters {
  dateFrom?: string;
  dateTo?: string;
}
