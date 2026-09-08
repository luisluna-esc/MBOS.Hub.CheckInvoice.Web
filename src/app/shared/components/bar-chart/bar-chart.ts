import { Component, computed, input } from '@angular/core';

export interface BarChartItem {
  label: string;
  value: number;
  /** Clase Tailwind de color de fondo (ej. "bg-primary"). Por defecto usa "bg-primary". */
  colorClass?: string;
}

@Component({
  selector: 'app-bar-chart',
  templateUrl: './bar-chart.html',
})
export class BarChart {
  readonly items = input.required<BarChartItem[]>();
  readonly valueFormatter = input<(value: number) => string>((value) => value.toFixed(2));
  readonly height = input(200);

  protected readonly maxValue = computed(() => Math.max(1, ...this.items().map((item) => item.value)));

  protected barHeightPercent(value: number): number {
    return Math.max((value / this.maxValue()) * 100, value > 0 ? 2 : 0);
  }
}
