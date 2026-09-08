import { Component, inject } from '@angular/core';
import { Language, LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcher {
  protected readonly languageService = inject(LanguageService);
  protected readonly languages: Language[] = ['es', 'en', 'pt'];
}
