import { AbstractInputSuggest, App, getIconIds, setIcon } from 'obsidian';

/**
 * Autocomplete dropdown for picking a Lucide icon id, backed by Obsidian's
 * own registered icon list (`getIconIds()`), so whatever the user selects is
 * guaranteed to resolve via `getIcon()`/`setIcon()`.
 */
export class IconInputSuggest extends AbstractInputSuggest<string> {
  private readonly allIcons: string[];

  constructor(app: App, inputEl: HTMLInputElement, onPick: (iconId: string) => void) {
    super(app, inputEl);
    this.allIcons = getIconIds();
    this.onSelect((iconId) => {
      this.setValue(iconId);
      this.close();
      onPick(iconId);
    });
  }

  protected getSuggestions(query: string): string[] {
    const q = query.trim().toLowerCase();
    const matches = q ? this.allIcons.filter((id) => id.toLowerCase().includes(q)) : this.allIcons;
    return matches.slice(0, 100);
  }

  renderSuggestion(iconId: string, el: HTMLElement): void {
    el.addClass('ffc-icon-suggestion-item');
    const iconEl = el.createSpan({ cls: 'ffc-icon-suggestion-icon' });
    setIcon(iconEl, iconId);
    el.createSpan({ cls: 'ffc-icon-suggestion-label', text: iconId.replace(/^lucide-/, '') });
  }
}
