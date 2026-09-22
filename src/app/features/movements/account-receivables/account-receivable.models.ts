export interface AccountReceivable extends Record<string, unknown> {
  accountReceivableId: number;
  issueId: number | null;
  issueDate: string | null;
  clientId: number | null;
  totalAmount: number;
  outstandingBalance: number;
  paymentType: string;
  paymentDetail: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
  createdById: number | null;
}

export interface AccountReceivableFilters {
  clientId?: number;
  status?: string;
  clientName?: string;
}

export interface Payment extends Record<string, unknown> {
  paymentId: number;
  accountReceivableId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  notes: string | null;
  createdById: number | null;
}

export interface PaymentCreate {
  accountReceivableId: number;
  amount: number;
  paymentMethod?: string | null;
  notes?: string | null;
}
