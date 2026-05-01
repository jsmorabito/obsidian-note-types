import { App, setIcon } from 'obsidian';

/**
 * Custom lightweight autocomplete dropdown for frontmatter fields.
 * Built from scratch instead of AbstractInputSuggest so we have full control
 * over keyboard/mouse handling inside Obsidian modals.
 */
export class FrontmatterValueSuggest {
  private app: App;
  private inputEl: HTMLInputElement;
  private key: string;
  private fieldType: string;
  private dropdown: HTMLElement | null = null;
  private suggestions: string[] = [];
  private selectedIndex = -1;

  private readonly _onInput:   () => void;
  private readonly _onFocus:   () => void;
  private readonly _onBlur:    () => void;
  private readonly _onKeydown: (e: KeyboardEvent) => void;

  constructor(app: App, inputEl: HTMLInputElement, key: string, fieldType: string) {
    this.app       = app;
    this.inputEl   = inputEl;
    this.key       = key;
    this.fieldType = fieldType;

    this._onInput   = () => this.refresh();
    this._onFocus   = () => this.refresh();
    this._onBlur    = () => setTimeout(() => this.close(), 150);
    this._onKeydown = (e) => this.handleKeydown(e);

    inputEl.addEventListener('input',   this._onInput);
    inputEl.addEventListener('focus',   this._onFocus);
    inputEl.addEventListener('blur',    this._onBlur);
    inputEl.addEventListener('keydown', this._onKeydown);
  }

  // ── Data ──────────────────────────────────────────────────────────────────────

  private getVaultValues(): string[] {
    const values = new Set<string>();
    if (this.key === 'tags' || this.key === 'tag') {
      const tags = (this.app.metadataCache as any).getTags() ?? {};
      for (const tag of Object.keys(tags)) {
        values.add(tag.startsWith('#') ? tag.slice(1) : tag);
      }
    }
    for (const file of this.app.vault.getMarkdownFiles()) {
      const raw = this.app.metadataCache.getFileCache(file)?.frontmatter?.[this.key];
      if (raw == null) continue;
      if (Array.isArray(raw)) {
        (raw as unknown[]).forEach((v) => { if (v != null) values.add(String(v).trim()); });
      } else {
        const s = String(raw).trim();
        if (s) values.add(s);
      }
    }
    return [...values].filter(Boolean)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  private activeTerm(): string {
    return this.fieldType === 'list'
      ? (this.inputEl.value.split(',').pop() ?? '').trim()
      : this.inputEl.value.trim();
  }

  private alreadyEntered(): string[] {
    if (this.fieldType !== 'list') return [];
    return this.inputEl.value.split(',').slice(0, -1).map((s) => s.trim().toLowerCase());
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  private select(value: string): void {
    if (this.fieldType === 'list') {
      const parts = this.inputEl.value.split(',');
      parts[parts.length - 1] = value;
      this.inputEl.value = parts.map((s) => s.trim()).join(', ');
    } else {
      this.inputEl.value = value;
    }
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
    this.inputEl.focus();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────────

  private handleKeydown(e: KeyboardEvent): void {
    if (!this.dropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
      this.updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateHighlight();
    } else if (e.key === 'Enter') {
      if (this.selectedIndex >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.select(this.suggestions[this.selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  // ── Dropdown UI ───────────────────────────────────────────────────────────────

  private refresh(): void {
    const term    = this.activeTerm().toLowerCase();
    const entered = this.alreadyEntered();
    const matches = this.getVaultValues().filter((v) =>
      v.toLowerCase().includes(term) && !entered.includes(v.toLowerCase())
    );

    if (matches.length === 0 || document.activeElement !== this.inputEl) {
      this.close();
      return;
    }

    this.suggestions   = matches;
    this.selectedIndex = -1;

    if (!this.dropdown) {
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'suggestion-container ffc-suggest-dropdown';
      document.body.appendChild(this.dropdown);
    }
    this.dropdown.empty();

    const rect = this.inputEl.getBoundingClientRect();
    Object.assign(this.dropdown.style, {
      position:  'fixed',
      top:       `${rect.bottom + 4}px`,
      left:      `${rect.left}px`,
      width:     `${rect.width}px`,
      zIndex:    '9999',
      maxHeight: '200px',
      overflowY: 'auto',
    });

    matches.forEach((value, i) => {
      const isLink = /^\[\[.*\]\]$/.test(value);
      const displayText = isLink ? value.slice(2, -2) : value;

      const item = this.dropdown!.createDiv({ cls: 'suggestion-item ffc-suggest-item' });
      item.createSpan({ cls: 'ffc-suggest-label', text: displayText });
      if (isLink) {
        const icon = item.createSpan({ cls: 'ffc-suggest-link-icon' });
        setIcon(icon, 'link');
      }
      item.addEventListener('mousedown', (e) => { e.preventDefault(); });
      item.addEventListener('click',     ()  => { this.select(value); });
      item.addEventListener('mouseover', ()  => {
        this.selectedIndex = i;
        this.updateHighlight();
      });
    });
  }

  private updateHighlight(): void {
    if (!this.dropdown) return;
    this.dropdown.querySelectorAll('.suggestion-item').forEach((el, i) => {
      (el as HTMLElement).classList.toggle('is-selected', i === this.selectedIndex);
    });
  }

  close(): void {
    if (this.dropdown) { this.dropdown.remove(); this.dropdown = null; }
    this.suggestions   = [];
    this.selectedIndex = -1;
  }

  destroy(): void {
    this.close();
    this.inputEl.removeEventListener('input',   this._onInput);
    this.inputEl.removeEventListener('focus',   this._onFocus);
    this.inputEl.removeEventListener('blur',    this._onBlur);
    this.inputEl.removeEventListener('keydown', this._onKeydown);
  }
}
