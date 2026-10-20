/**
 * Campos que cuentan para "pasar al siguiente con Enter": entradas de texto/número, áreas de
 * texto, los botones que abren una lista o un calendario (app-select, app-date-picker), los
 * interruptores y las casillas. No incluye botones de acción (Guardar, Cancelar...).
 */
const FIELD_SELECTOR = [
  'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=file]):not([disabled]):not([readonly])',
  'textarea:not([disabled])',
  'button[aria-haspopup]:not([disabled])',
  '[role=switch]:not([disabled])',
].join(', ');

/** Grupo de campos dentro del que se avanza: el formulario, la barra de filtros o el diálogo. */
const CONTAINER_SELECTOR = 'form, app-filters, .cdk-dialog-container, main';

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

/**
 * Pone el foco en el campo siguiente (o anterior) al elemento dado, dentro de su mismo grupo.
 * Devuelve false si no hay a dónde ir (último campo).
 */
export function focusAdjacentField(from: HTMLElement, direction: 1 | -1 = 1): boolean {
  const container = from.closest<HTMLElement>(CONTAINER_SELECTOR) ?? from.ownerDocument.body;
  const fields = Array.from(container.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(
    (field) => isVisible(field) && field.tabIndex >= 0
  );
  const index = fields.findIndex((field) => field === from || field.contains(from));
  const next = index === -1 ? undefined : fields[index + direction];
  if (!next) {
    return false;
  }
  next.focus();
  if (next instanceof HTMLInputElement && ['text', 'number', 'search', 'email', 'tel'].includes(next.type)) {
    next.select();
  }
  return true;
}
