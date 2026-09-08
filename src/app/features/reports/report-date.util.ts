/** Primer día del mes actual, en formato ISO 'yyyy-MM-dd', para usar como valor
 * inicial del filtro "Fecha inicio" — así el primer reporte generado al entrar a
 * la pantalla ya viene acotado al mes en curso en vez de traer todo el historial. */
export function firstDayOfCurrentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
