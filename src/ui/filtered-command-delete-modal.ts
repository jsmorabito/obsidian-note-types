import { App, Modal } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';

export class FilteredCommandDeleteModal extends Modal {
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
    const cmd = this.plugin.settings.commands[this.index];

    contentEl.createEl('h2', { text: 'Delete Command?' });
    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${cmd?.name || 'this command'}"? This will remove it from your settings.`,
      cls: 'ffc-confirm-desc',
    });

    const btnRow = contentEl.createDiv({ cls: 'ffc-confirm-buttons' });

    btnRow.createEl('button', { text: 'Cancel', cls: 'ffc-btn-cancel' }).onclick = () => {
      this.close();
    };

    const deleteBtn = btnRow.createEl('button', { text: 'Delete', cls: 'mod-warning' });
    deleteBtn.onclick = async () => {
      this.plugin.settings.commands.splice(this.index, 1);
      await this.plugin.saveSettings();
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.onDismiss) this.onDismiss();
  }
}
