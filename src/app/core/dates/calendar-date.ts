// Dos tipos de fecha conviven en la API y no se muestran igual:
// - Momentos exactos (createdAt, paymentDate, requestedAt...): llegan en UTC con "Z" y
//   `new Date(value).toLocaleString()` los pasa bien a la hora del navegador.
// - Fechas de calendario (issueDate de Entradas/Salidas, dueDate): son un día, no un instante.
//   Llegan como "2026-09-23" o "2026-09-23T00:00:00Z"; pasarlas por `new Date(...)` las toma
//   como medianoche UTC y en Bolivia (UTC-4) se ven un día antes. Por eso se lee solo el día.

/** Muestra una fecha de calendario con el formato local, sin correrla por zona horaria. */
export function formatCalendarDate(value: unknown): string {
  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!match) {
    return '—';
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString();
}

/** Día de `date` en la zona del navegador, como "YYYY-MM-DD" (`toISOString` daría el día en UTC). */
export function localDateIso(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
