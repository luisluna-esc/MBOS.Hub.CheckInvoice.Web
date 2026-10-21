import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Skeleton } from '../skeleton/skeleton';

/**
 * Lo que se ve mientras algo carga, en vez del texto "Cargando...": la forma del contenido que
 * va a aparecer. "list" para listas y ventanas, "cards" para tarjetas (ej. motivos de Salidas) y
 * "detail" para pantallas de ver un documento. Para lectores de pantalla sigue diciendo "Cargando".
 */
@Component({
  selector: 'app-loading-skeleton',
  imports: [Skeleton, TranslatePipe],
  templateUrl: './loading-skeleton.html',
})
export class LoadingSkeleton {
  readonly variant = input<'list' | 'cards' | 'detail'>('list');
  /** Cantidad de filas (list) o tarjetas (cards). */
  readonly count = input(4);
  /** true cuando va dentro de una tarjeta o ventana (fondo bg-surface). */
  readonly onSurface = input(false);

  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
  protected readonly tone = computed(() => (this.onSurface() ? 'muted' : 'surface'));
}
