import { App, Modal, Setting } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { RelationType } from '../types.ts';

/**
 * Edits a {@link RelationType} in place. `saveSettings()` runs after every
 * change; `onDismiss` fires on close so the settings list can redraw its row.
 * The built-in "Related to" relation is editable here but cannot be deleted.
 */
export class RelationTypeModal extends Modal {
  private plugin: FilteredFileCommandsPlugin;
  private rt: RelationType;
  private onDismiss: (() => void) | undefined;

  constructor(app: App, plugin: FilteredFileCommandsPlugin, rt: RelationType, onDismiss?: () => void) {
    super(app);
    this.plugin    = plugin;
    this.rt        = rt;
    this.onDismiss = onDismiss;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ffc-item-modal');

    const rt = this.rt;

    contentEl.createEl('h2', { text: 'Relation type', cls: 'ffc-modal-title' });

    if (rt.builtin) {
      contentEl.createEl('p', {
        text: 'The built-in generic relation. Every note type can use it. You can change its labels and keys, but it can’t be removed.',
        cls: 'ffc-hint',
      });
    }

    new Setting(contentEl)
      .setName('Name')
      .setDesc('Label shown in the "Mark as…" menu, e.g. "Related to" or "Blocks".')
      .addText((text) => text
        .setPlaceholder('E.g. Blocks')
        .setValue(rt.name ?? '')
        .onChange(async (value) => {
          rt.name = value;
          await this.plugin.saveSettings();
        }));

    new Setting(contentEl)
      .setName('Frontmatter key')
      .setDesc('Property key written on the note you mark, e.g. "blocks".')
      .addText((text) => text
        .setPlaceholder('E.g. blocks')
        .setValue(rt.frontmatterKey ?? '')
        .onChange(async (value) => {
          rt.frontmatterKey = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(contentEl)
      .setName('Reverse label')
      .setDesc('Label from the target’s side, e.g. "Blocked by". Leave blank if the relation reads the same both ways.')
      .addText((text) => text
        .setPlaceholder('E.g. Blocked by')
        .setValue(rt.reverseName ?? '')
        .onChange(async (value) => {
          rt.reverseName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(contentEl)
      .setName('Reverse frontmatter key')
      .setDesc('Property key written back on the target note. Leave blank to reuse the key above, or to derive one from the reverse label when that label differs.')
      .addText((text) => text
        .setPlaceholder('E.g. blocked_by')
        .setValue(rt.reverseKey ?? '')
        .onChange(async (value) => {
          rt.reverseKey = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(contentEl).addButton((btn) => btn.setButtonText('Done').setCta().onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
    this.onDismiss?.();
  }
}
