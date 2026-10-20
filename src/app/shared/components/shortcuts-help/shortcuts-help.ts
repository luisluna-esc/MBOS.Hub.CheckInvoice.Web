import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { ShortcutService } from '../../../core/shortcuts/shortcut.service';
import { ShortcutDirective } from '../../directives/shortcut.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface ShortcutsHelpData {
  /** Atajos "G + letra" disponibles para el rol activo (solo los que tiene en su menú). */
  goTo: { key: string; labelKey: string }[];
}

interface ShortcutRow {
  keys: string[];
  /** Otra combinación que hace lo mismo (se muestra con "o"). */
  altKeys?: string[];
  labelKey: string;
}

@Component({
  selector: 'app-shortcuts-help',
  imports: [TranslatePipe, ShortcutDirective],
  templateUrl: './shortcuts-help.html',
})
export class ShortcutsHelp {
  private readonly dialogRef = inject(DialogRef<void, ShortcutsHelp>);
  private readonly data = inject<ShortcutsHelpData>(DIALOG_DATA);
  protected readonly shortcuts = inject(ShortcutService);

  private readonly mod = this.shortcuts.isMac ? '⌘' : 'Ctrl';
  private readonly alt = this.shortcuts.isMac ? '⌥' : 'Alt';
  private readonly shift = this.shortcuts.isMac ? '⇧' : 'Shift';
  /** Mac no tiene teclas RePág/AvPág: se usan con fn + flechas. */
  private readonly pageUp = this.shortcuts.isMac ? 'fn ↑' : 'RePág';
  private readonly pageDown = this.shortcuts.isMac ? 'fn ↓' : 'AvPág';

  protected readonly groups: { titleKey: string; rows: ShortcutRow[] }[] = [
    {
      titleKey: 'shortcuts.groupGeneral',
      rows: [
        { keys: this.shortcuts.keysFor('palette'), labelKey: 'shortcuts.palette' },
        { keys: this.shortcuts.keysFor('help'), altKeys: ['?'], labelKey: 'shortcuts.help' },
        { keys: this.shortcuts.keysFor('sidebar'), labelKey: 'shortcuts.sidebar' },
        { keys: ['Esc'], labelKey: 'shortcuts.cancel' },
      ],
    },
    {
      titleKey: 'shortcuts.groupForms',
      rows: [
        { keys: this.shortcuts.keysFor('save'), altKeys: [this.mod, 'Enter'], labelKey: 'shortcuts.save' },
        { keys: ['Enter'], labelKey: 'shortcuts.enterPrice' },
        { keys: ['↑', '↓'], labelKey: 'shortcuts.productArrows' },
        { keys: ['Tab'], labelKey: 'shortcuts.productTab' },
      ],
    },
    {
      titleKey: 'shortcuts.groupFields',
      rows: [
        { keys: ['Tab'], labelKey: 'shortcuts.nextField' },
        { keys: [this.shift, 'Tab'], labelKey: 'shortcuts.prevField' },
        { keys: ['↓'], altKeys: ['Enter'], labelKey: 'shortcuts.selectOpen' },
        { keys: ['A…Z'], labelKey: 'shortcuts.selectType' },
        { keys: ['↑', '↓'], labelKey: 'shortcuts.selectMove' },
        { keys: ['Enter'], altKeys: ['Tab'], labelKey: 'shortcuts.selectPick' },
        { keys: ['0…9'], labelKey: 'shortcuts.dateType' },
        { keys: ['↑', '↓'], labelKey: 'shortcuts.dateDay' },
        { keys: [this.alt, '↓'], altKeys: ['␣'], labelKey: 'shortcuts.dateOpen' },
        { keys: [this.pageUp], altKeys: [this.pageDown], labelKey: 'shortcuts.dateMonth' },
        { keys: ['␣'], labelKey: 'shortcuts.switchToggle' },
        { keys: ['Enter'], labelKey: 'shortcuts.filterEnter' },
      ],
    },
    {
      titleKey: 'shortcuts.groupLists',
      rows: [
        { keys: this.shortcuts.keysFor('search'), labelKey: 'shortcuts.search' },
      ],
    },
    {
      titleKey: 'shortcuts.groupGoTo',
      rows: this.data.goTo.map((item) => ({ keys: ['G', item.key.toUpperCase()], labelKey: item.labelKey })),
    },
  ];

  protected close(): void {
    this.dialogRef.close();
  }
}
