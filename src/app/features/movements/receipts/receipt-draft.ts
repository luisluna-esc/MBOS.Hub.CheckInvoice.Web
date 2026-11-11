import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ProductPickerResult } from '../../../shared/components/product-picker-dialog/product-picker-dialog';

/**
 * Entrada a medio hacer: se guarda sola en este navegador mientras se llena. Si se apaga la
 * compu o se sale sin guardar, al volver se ofrece continuarla o descartarla.
 */
export interface ReceiptDraft {
  savedAt: string;
  /** Pantalla donde se estaba llenando (compra o donación). */
  route: string;
  supplierId: number | null;
  supplierName: string | null;
  receiptTypeId: number | null;
  header: Record<string, string>;
  headerConfirmed: boolean;
  lines: { productId: string; quantity: string; unitPrice: string; product: ProductPickerResult | null }[];
}

@Injectable({ providedIn: 'root' })
export class ReceiptDraftStore {
  private readonly authService = inject(AuthService);

  private get key(): string {
    return `mbos.receiptDraft.${this.authService.session()?.appUserId ?? 'anon'}`;
  }

  get(): ReceiptDraft | null {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as ReceiptDraft) : null;
    } catch {
      return null;
    }
  }

  save(draft: ReceiptDraft): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(draft));
    } catch {
      // Sin espacio o sin acceso al almacenamiento: no se guarda el borrador, nada más.
    }
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}
