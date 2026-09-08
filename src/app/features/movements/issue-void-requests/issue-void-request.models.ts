export interface IssueVoidRequest extends Record<string, unknown> {
  issueVoidRequestId: number;
  issueId: number;
  issueDate: string;
  clientName: string | null;
  warehouseName: string | null;
  issueTotal: number;
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

export interface IssueVoidRequestCreate {
  issueId: number;
  voidReasonId: number;
  detail?: string | null;
}

export interface IssueVoidRequestReview {
  reviewNotes?: string | null;
}

export interface IssueVoidRequestFilters {
  status?: string;
}
