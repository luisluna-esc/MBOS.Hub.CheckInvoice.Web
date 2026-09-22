import { CatalogItem } from './catalog.models';

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Nombre del período (formato "YYYY-MM") correspondiente al mes actual — usado para
 * preseleccionar el período por defecto cuando el usuario no elige uno explícitamente. */
export function currentMonthKey(): string {
  return monthKey(new Date());
}

/** Nombre del período (formato "YYYY-MM") del mes siguiente — se usa para sugerir el valor al
 * crear un nuevo Período de Almacén, ya que hay que crearlo con anticipación (el catálogo no
 * genera los períodos solo; si nadie crea el de octubre, en octubre solo aparecerá septiembre). */
export function nextMonthKey(): string {
  const now = new Date();
  return monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
}

/** Formato exigido para el nombre de un Período de Almacén: "YYYY-MM". El resto del sistema
 * (selección de períodos vigentes, rango de Fecha de Emisión) interpreta el Name como una fecha
 * parseándolo con esta misma forma — un nombre libre rompería esa lógica en silencio. */
export const WAREHOUSE_PERIOD_NAME_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Primer día del mes anterior, en formato ISO (YYYY-MM-DD) — límite mínimo de la Fecha de
 * Emisión: junto con el `max` de hoy, mantiene la fecha dentro de la misma ventana que el
 * Periodo de Almacén (mes actual o el anterior), nunca más atrás. */
export function minIssueDateIso(): string {
  const now = new Date();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return previousMonthStart.toISOString().slice(0, 10);
}

/** Rango válido de Fecha de Emisión según el Periodo de Almacén elegido: debe caer dentro del
 * mes de ese período — si es el mes actual, tope en hoy (no fechas futuras); si es el mes
 * anterior, el mes completo (ya cerrado). Sin período reconocible (nombre no "YYYY-MM"), se usa
 * la ventana amplia por defecto (mes actual o el anterior) como respaldo. */
export function issueDateRangeForPeriod(periodName: string | null | undefined): { min: string; max: string } {
  const todayIso = new Date().toISOString().slice(0, 10);

  const match = periodName?.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return { min: minIssueDateIso(), max: todayIso };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const min = `${match[1]}-${match[2]}-01`;
  const lastDayOfMonth = new Date(year, month, 0).toISOString().slice(0, 10);
  const max = lastDayOfMonth < todayIso ? lastDayOfMonth : todayIso;

  return { min, max };
}

// El período de almacén ("gestión") solo debe permitir registrar contra el mes actual o el
// anterior (ej. si estamos en 2026-09, solo 2026-08 y 2026-09) — nunca meses más viejos ni
// futuros, aunque existan más períodos creados en el catálogo.
export function currentAndPreviousWarehousePeriods(periods: CatalogItem[]): CatalogItem[] {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentKey = monthKey(now);
  const previousKey = monthKey(previousMonth);

  return periods
    .filter((period) => period.name === currentKey || period.name === previousKey)
    .sort((a, b) => a.name.localeCompare(b.name));
}
