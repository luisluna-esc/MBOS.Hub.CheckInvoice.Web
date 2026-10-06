export interface AccountReceivable extends Record<string, unknown> {
  accountReceivableId: number;
  issueId: number | null;
  issueDate: string | null;
  clientId: number | null;
  totalAmount: number;
  outstandingBalance: number;
  paidAmount: number;
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
  /** Reparto del depósito por producto (línea de la salida). Vacío si la cuenta no tiene salida. */
  details: { issueDetailId: number; amount: number }[];
}

export interface PaymentLine {
  issueDetailId: number;
  productId: number;
  code: string | null;
  name: string;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface PaymentLines {
  accountReceivableId: number;
  outstandingBalance: number;
  hasProducts: boolean;
  lines: PaymentLine[];
}
