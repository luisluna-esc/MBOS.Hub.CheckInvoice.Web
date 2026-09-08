import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Language = 'es' | 'en' | 'pt';

type TranslationDictionary = Record<string, unknown>;

const STORAGE_KEY = 'language';
const SUPPORTED_LANGUAGES: Language[] = ['es', 'en', 'pt'];
const FALLBACK_LANGUAGE: Language = 'es';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly http = inject(HttpClient);

  readonly language = signal<Language>(this.resolveInitialLanguage());
  private readonly translations = signal<TranslationDictionary>({});

  constructor() {
    effect(() => {
      const language = this.language();
      document.documentElement.lang = language;
      localStorage.setItem(STORAGE_KEY, language);
      this.loadTranslations(language);
    });
  }

  setLanguage(language: Language): void {
    this.language.set(language);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const value = key
      .split('.')
      .reduce<unknown>((current, segment) => {
        if (current && typeof current === 'object' && segment in current) {
          return (current as Record<string, unknown>)[segment];
        }
        return undefined;
      }, this.translations());

    if (typeof value !== 'string') {
      return key;
    }

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, paramValue]) => result.replaceAll(`{{${paramKey}}}`, String(paramValue)),
      value
    );
  }

  private async loadTranslations(language: Language): Promise<void> {
    try {
      const dictionary = await firstValueFrom(
        this.http.get<TranslationDictionary>(`i18n/${language}.json`)
      );
      this.translations.set(dictionary);
    } catch {
      this.translations.set({});
    }
  }

  private resolveInitialLanguage(): Language {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (this.isSupportedLanguage(stored)) {
      return stored;
    }

    const browserLanguage = navigator.language.slice(0, 2);
    if (this.isSupportedLanguage(browserLanguage)) {
      return browserLanguage;
    }

    return FALLBACK_LANGUAGE;
  }

  private isSupportedLanguage(value: string | null): value is Language {
    return !!value && SUPPORTED_LANGUAGES.includes(value as Language);
  }
}
