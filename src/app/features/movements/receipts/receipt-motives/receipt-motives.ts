import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface ReceiptMotive {
  key: string;
  icon: string;
  /** Sin ruta: todavía no está definido (se muestra como "Próximamente"). */
  route: string | null;
}

/**
 * Entradas: antes de registrar se elige por qué entra el material. Cada motivo abre su propio
 * formulario. El historial de entradas ya no está aquí: está en Reportes.
 */
@Component({
  selector: 'app-receipt-motives',
  imports: [RouterLink, Icon, TranslatePipe],
  templateUrl: './receipt-motives.html',
})
export class ReceiptMotives {
  protected readonly motives: ReceiptMotive[] = [
    { key: 'purchases', icon: 'receipt', route: '/receipts/new' },
    { key: 'transfers', icon: 'transfer', route: '/transfers/new' },
    { key: 'returns', icon: 'return', route: '/issue-returns' },
    { key: 'donations', icon: 'product', route: '/receipts/donation' },
    { key: 'adjustments', icon: 'adjustment', route: '/stock-adjustments' },
  ];
}
