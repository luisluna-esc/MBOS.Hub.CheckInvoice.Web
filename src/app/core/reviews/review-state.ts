import { SelectOption } from '../../shared/components/select/select';

/**
 * Filtro "Firma" de los documentos con firma digital: actualizado es el que ya tiene la firma de
 * aprobación del Contador; desactualizado, el que todavía no. El backend recibe "updated" o
 * "outdated" (sin valor: todos).
 */
export type ReviewState = 'updated' | 'outdated';

export function reviewStateOptions(t: (key: string) => string): SelectOption[] {
  return [
    { value: 'updated', label: t('review.state.updated') },
    { value: 'outdated', label: t('review.state.outdated') },
  ];
}

export function toReviewState(value: string | null | undefined): ReviewState | undefined {
  return value === 'updated' || value === 'outdated' ? value : undefined;
}

/**
 * Select "Estado" de los reportes: "Actualizado" cuenta solo lo firmado (o anterior a la firma
 * digital); "Desactualizado" cuenta todo, también lo que todavía no tiene firma.
 */
export function reportReviewStateOptions(t: (key: string) => string): SelectOption[] {
  return [
    { value: 'updated', label: t('review.state.updated') },
    { value: 'all', label: t('review.state.outdated') },
  ];
}

/** Lo que va al backend: "updated", o nada para contar todo. */
export function toReportReviewState(value: string | null | undefined): ReviewState | undefined {
  return value === 'updated' ? 'updated' : undefined;
}
