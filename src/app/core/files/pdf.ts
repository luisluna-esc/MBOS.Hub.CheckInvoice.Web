// Los celulares (Chrome en Android) no muestran PDFs dentro de la página ni en una pestaña
// abierta desde un archivo temporal: se ve un recuadro con un código raro y "Abrir" falla.
// Ahí el PDF se descarga con un nombre legible. En computadoras se sigue mostrando.

/** true si el navegador puede mostrar un PDF dentro de la página (false en Chrome de Android). */
export function canPreviewPdf(): boolean {
  return (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;
}

/** Descarga un archivo generado en memoria con el nombre indicado. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Pestaña en blanco que se abre de forma síncrona en el clic (si se abre después de un await
 * el navegador la bloquea como popup). En celulares no se abre: el PDF se va a descargar.
 */
export function openPdfTab(): Window | null {
  return canPreviewPdf() ? window.open('', '_blank') : null;
}

/** Muestra el PDF en la pestaña abierta con openPdfTab(), o lo descarga si el navegador no puede mostrarlo. */
export function showPdf(blob: Blob, fileName: string, newTab: Window | null): void {
  if (!canPreviewPdf()) {
    newTab?.close();
    downloadBlob(blob, fileName);
    return;
  }
  const url = URL.createObjectURL(blob);
  if (newTab) {
    newTab.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}
