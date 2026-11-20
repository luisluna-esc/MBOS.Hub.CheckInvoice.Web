import { formatNumber } from '@angular/common';

/** Formato de números de la app: separador de miles "." y decimales "," (como en Bolivia). */
export const APP_LOCALE = 'es-BO';

/** Monto con separador de miles y dos decimales: 4376 da "4.376,00". */
export function formatMoney(value: unknown): string {
  return formatNumber(Number(value) || 0, APP_LOCALE, '1.2-2');
}
