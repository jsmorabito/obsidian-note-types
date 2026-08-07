import { App, Modal, Notice, Setting } from 'obsidian';
import { NoteType } from '../types.ts';
import { renderFieldInputs } from '../utils/helpers.ts';

export class NewNoteModal extends Modal {
  private noteType: NoteType;
  private onSubmit: (title: string, fieldValues: Record<string, string>, description: string) => void | Promise<void>;
  private titleValue: string;
  private fieldValues: Record<string, string> = {};
  private descriptionValue = '';

  constructor(
    app: App,
    noteType: NoteType,
    onSubmit: (title: string, fieldValues: Record<string, string>, description: string) => void | Promise<void>,
    initialTitle = '',
  ) {
    super(app);
    this.noteType = noteType;
    this.onSubmit = onSubmit;
    this.titleValue = initialTitle;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('ffc-new-note-modal');
    contentEl.createEl('h2', { text: `New ${this.noteType.name}` });

    new Setting(contentEl)
      .setName('Title')
      .addText((text) => {
        text.setPlaceholder(`Enter ${this.noteType.name} title…`)
          .setValue(this.titleValue)
          .onChange((v) => { this.titleValue = v; });
        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submit();
          if (e.key === 'Escape') this.close();
        });
        window.setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, 50);
      });

    const descSetting = new Setting(contentEl)
      .setName('Description')
      .setDesc('Added to the body of the created page')
      .addTextArea((ta) => {
        ta.setPlaceholder('Optional description…')
          .onChange((v) => { this.descriptionValue = v; });
        ta.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') this.close();
        });
      });

    renderFieldInputs(contentEl, this.app, this.noteType, this.fieldValues, () => this.submit(), descSetting.settingEl);

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText('Create').setCta().onClick(() => this.submit()))
      .addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  private submit(): void {
    const title = this.titleValue.trim();
    if (!title) { new Notice('Please enter a title.'); return; }
    this.close();
    void this.onSubmit(title, this.fieldValues, this.descriptionValue);
  }

  onClose(): void { this.contentEl.empty(); }
}
