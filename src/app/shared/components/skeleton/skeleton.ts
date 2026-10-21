import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly rounded = input<'sm' | 'md' | 'lg' | 'full'>('md');
  /** "surface" sobre el fondo de la página; "muted" dentro de tarjetas y ventanas (bg-surface), donde el otro no se vería. */
  readonly tone = input<'surface' | 'muted'>('surface');
}
