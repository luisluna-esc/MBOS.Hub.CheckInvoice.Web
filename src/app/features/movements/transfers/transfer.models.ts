export interface Transfer extends Record<string, unknown> {
  transferId: number;
  sourceWarehouseId: number | null;
  destinationWarehouseId: number | null;
  senderUserId: number | null;
  receiverUserId: number | null;
  receiverClientId: number | null;
  transferDate: string;
  notes: string | null;
  isApproved: boolean;
  approvedById: number | null;
  approvedAt: string | null;
  /** Revisión del Contador: digitado, verificado o aprobado. */
  reviewStatus: string | null;
  isVoided: boolean;
  hasPendingVoidRequest: boolean;
}

export interface TransferDetail {
  transferDetailId: number;
  transferId: number;
  productId: number;
  quantity: number;
  /** Costo unitario con el que salió del almacén de origen (antes se guardaba un precio de venta). */
  unitPrice: number | null;
  totalSalePrice: number | null;
}

export interface TransferDetailRequest {
  productId: number;
  quantity: number;
  unitPrice?: number | null;
}

export interface TransferRequest {
  sourceWarehouseId?: number | null;
  destinationWarehouseId: number;
  senderUserId?: number | null;
  receiverUserId?: number | null;
  receiverClientId?: number | null;
  notes?: string | null;
  details: TransferDetailRequest[];
}

export interface TransferFilters {
  transferId?: number;
  sourceWarehouseId?: number;
  destinationWarehouseId?: number;
  senderUserId?: number;
  receiverUserId?: number;
  receiverClientId?: number;
  dateFrom?: string;
  dateTo?: string;
  isApproved?: boolean;
}
