import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

const KNOWN_CODES = [400, 401, 403, 404, 500, 503];

@Component({
  selector: 'app-error-state',
  imports: [TranslatePipe],
  templateUrl: './error-state.html',
})
export class ErrorState {
  readonly code = input<number>(500);
  readonly title = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);

  readonly action = output<void>();

  private readonly i18nCode = computed(() => (KNOWN_CODES.includes(this.code()) ? this.code() : 'default'));
  protected readonly defaultTitleKey = computed(() => `errorState.${this.i18nCode()}.title`);
  protected readonly defaultDescriptionKey = computed(() => `errorState.${this.i18nCode()}.description`);
}
