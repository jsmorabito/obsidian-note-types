import { App, Modal, Setting } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';

export class FilteredCommandSettingsModal extends Modal {
  private plugin: FilteredFileCommandsPlugin;
  private index: number;
  private onDismiss: (() => void) | undefined;

  constructor(app: App, plugin: FilteredFileCommandsPlugin, index: number, onDismiss?: () => void) {
    super(app);
    this.plugin    = plugin;
    this.index     = index;
    this.onDismiss = onDismiss;
  }

  onOpen(): void { this._render(); }

  private _render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ffc-item-modal');

    const cmd = this.plugin.settings.commands[this.index];
    if (!cmd) { contentEl.createEl('p', { text: 'Command not found.' }); return; }

    contentEl.createEl('h2', { text: cmd.name || 'Command Settings', cls: 'ffc-modal-title' });

    new Setting(contentEl).setName('Command name').setDesc('Shown in the command palette and hotkey settings.')
      .addText((text) => text.setPlaceholder('e.g. Show Active Projects').setValue(cmd.name)
        .onChange(async (value) => {
          cmd.name = value;
          await this.plugin.saveSettings();
          const ref = this.plugin.commandRefs[cmd.id];
          if (ref) ref.name = value;
          const titleEl = contentEl.querySelector('.ffc-modal-title');
          if (titleEl) titleEl.textContent = value || 'Command Settings';
        })
      );

    new Setting(contentEl).setName('Filter match mode').setDesc('Should a file match ALL filters (AND) or at least ONE filter (OR)?')
      .addDropdown((dd) => dd.addOption('all', 'Match ALL filters (AND)').addOption('any', 'Match ANY filter (OR)')
        .setValue(cmd.matchMode)
        .onChange(async (value) => { cmd.matchMode = value as 'all' | 'any'; await this.plugin.saveSettings(); })
      );

    new Setting(contentEl).setName('File types').setDesc('Comma-separated extensions (e.g. md, canvas). Leave blank for markdown only.')
      .addText((text) => text.setPlaceholder('md, canvas').setValue(cmd.fileTypes || '')
        .onChange(async (value) => { cmd.fileTypes = value; await this.plugin.saveSettings(); })
      );

    const filtersSection = contentEl.createDiv({ cls: 'ffc-filters-section' });
    filtersSection.createEl('p', { text: 'Frontmatter Filters', cls: 'ffc-filters-title' });
    if (cmd.filters.length === 0) {
      filtersSection.createEl('p', { text: 'No filters — all files of the specified type(s) will be shown.', cls: 'ffc-hint' });
    }
    for (let fi = 0; fi < cmd.filters.length; fi++) this._renderFilter(filtersSection, fi);
    new Setting(filtersSection).addButton((btn) =>
      btn.setButtonText('＋ Add Filter').onClick(async () => {
        cmd.filters.push({ key: '', operator: 'equals', value: '' });
        await this.plugin.saveSettings();
        this._render();
      })
    );
  }

  private _renderFilter(container: HTMLElement, filterIndex: number): void {
    const cmd    = this.plugin.settings.commands[this.index];
    const filter = cmd.filters[filterIndex];
    const row    = container.createDiv({ cls: 'ffc-filter-row' });

    const keyInput = row.createEl('input', { cls: 'ffc-input ffc-input-key' });
    keyInput.type = 'text'; keyInput.placeholder = 'Property key'; keyInput.value = filter.key;
    keyInput.addEventListener('change', async () => { filter.key = keyInput.value.trim(); await this.plugin.saveSettings(); });

    const opSelect = row.createEl('select', { cls: 'ffc-select' });
    for (const op of [{ value: 'equals', label: '=' }, { value: 'not_equals', label: '≠' }, { value: 'contains', label: 'contains' }, { value: 'exists', label: 'exists' }]) {
      const opt = opSelect.createEl('option', { text: op.label, value: op.value });
      if (filter.operator === op.value) opt.selected = true;
    }
    opSelect.addEventListener('change', async () => {
      filter.operator = opSelect.value as typeof filter.operator;
      await this.plugin.saveSettings();
      this._render();
    });

    if (filter.operator !== 'exists') {
      const valInput = row.createEl('input', { cls: 'ffc-input ffc-input-val' });
      valInput.type = 'text'; valInput.placeholder = 'Value'; valInput.value = filter.value;
      valInput.addEventListener('change', async () => { filter.value = valInput.value; await this.plugin.saveSettings(); });
    }

    row.createEl('button', { text: '✕', cls: 'ffc-btn-remove' }).onclick = async () => {
      cmd.filters.splice(filterIndex, 1);
      await this.plugin.saveSettings();
      this._render();
    };
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.onDismiss) this.onDismiss();
  }
}
