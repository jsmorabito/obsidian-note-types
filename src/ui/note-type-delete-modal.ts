import { App, Modal } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';

export class NoteTypeDeleteModal extends Modal {
  private plugin: FilteredFileCommandsPlugin;
  private index: number;
  private onDismiss: (() => void) | undefined;

  constructor(app: App, plugin: FilteredFileCommandsPlugin, index: number, onDismiss?: () => void) {
    super(app);
    this.plugin    = plugin;
    this.index     = index;
    this.onDismiss = onDismiss;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('ffc-confirm-modal');
    const obj = this.plugin.settings.noteTypes[this.index];

    contentEl.createEl('h2', { text: 'Delete note type?' });
    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${obj?.name || 'this note type'}"? This will remove it from your settings. Existing files will not be affected.`,
      cls: 'ffc-confirm-desc',
    });

    const btnRow = contentEl.createDiv({ cls: 'ffc-confirm-buttons' });

    btnRow.createEl('button', { text: 'Cancel', cls: 'ffc-btn-cancel' }).onclick = () => {
      this.close();
    };

    const deleteBtn = btnRow.createEl('button', { text: 'Delete', cls: 'mod-warning' });
    deleteBtn.onclick = async () => {
      this.plugin.settings.noteTypes.splice(this.index, 1);
      await this.plugin.saveSettings();
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.onDismiss) this.onDismiss();
  }
}
