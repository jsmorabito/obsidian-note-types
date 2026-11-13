import { App, ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import type { TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';

/** Asks for a name, then creates an empty template file in the vault's templates folder. */
export class NewTemplateModal extends Modal {
  private name = '';
  private busy = false;

  constructor(
    app: App,
    private plugin: FilteredFileCommandsPlugin,
    private onCreated: (file: TFile) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'New template' });

    new Setting(contentEl)
      .setName('Name')
      .setDesc(`Created in ${this.plugin.getNewTemplateFolder() || 'the vault root'}.`)
      .addText((text) => {
        text.setPlaceholder('Meeting').onChange((v) => { this.name = v; });
        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); void this.submit(); }
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => this.close());
    new ButtonComponent(buttons).setButtonText('Create').setCta().onClick(() => { void this.submit(); });
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const file = await this.plugin.createTemplateFile(this.name);
      this.close();
      this.onCreated(file);
    } catch (err) {
      this.busy = false;
      new Notice(err instanceof Error ? err.message : 'Could not create the template.');
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** Adds a "+" button to the left of a Template setting's input that creates a new template file. */
export function addNewTemplateButton(
  app: App,
  plugin: FilteredFileCommandsPlugin,
  setting: Setting,
  onCreated: (file: TFile) => void,
): void {
  setting.addExtraButton((btn) => {
    btn.setIcon('plus').setTooltip('Add new template')
      .onClick(() => new NewTemplateModal(app, plugin, onCreated).open());
    setting.controlEl.prepend(btn.extraSettingsEl);
  });
}

/**
 * Adds an "open template" icon to the left of a Template setting's input. It is
 * in the DOM only while `getPath()` names an existing file (hiding it would
 * still leave a gap); call the returned function after the path changes.
 */
export function addOpenTemplateButton(
  app: App,
  setting: Setting,
  getPath: () => string,
): () => void {
  let el: HTMLElement | null = null;
  setting.addExtraButton((btn) => {
    btn.setIcon('file-pen').setTooltip('Open template to edit')
      .onClick(() => {
        const file = app.vault.getFileByPath(getPath());
        if (file) void app.workspace.getLeaf('tab').openFile(file);
      });
    el = btn.extraSettingsEl;
  });

  const sync = (): void => {
    if (!el) return;
    const show = !!app.vault.getFileByPath(getPath());
    if (!show) { el.detach(); return; }
    // Obsidian appends extra buttons after the input; (re)place it right before the input, after the plus.
    const input = Array.from(setting.controlEl.children).find((c) => !c.hasClass('extra-setting-button'));
    setting.controlEl.insertBefore(el, input ?? null);
  };
  sync();
  return sync;
}
