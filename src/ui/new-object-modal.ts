import { App, Modal, Notice, Setting } from 'obsidian';
import { ObjectType } from '../types.ts';
import { renderFieldInputs } from '../utils/helpers.ts';

export class NewObjectModal extends Modal {
  private objType: ObjectType;
  private onSubmit: (title: string, fieldValues: Record<string, string>, description: string) => void;
  private titleValue: string;
  private fieldValues: Record<string, string> = {};
  private descriptionValue = '';

  constructor(
    app: App,
    objType: ObjectType,
    onSubmit: (title: string, fieldValues: Record<string, string>, description: string) => void,
    initialTitle = '',
  ) {
    super(app);
    this.objType  = objType;
    this.onSubmit = onSubmit;
    this.titleValue = initialTitle;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('ffc-new-object-modal');
    contentEl.createEl('h2', { text: `New ${this.objType.name}` });

    new Setting(contentEl)
      .setName('Title')
      .addText((text) => {
        text.setPlaceholder(`Enter ${this.objType.name} title…`)
          .setValue(this.titleValue)
          .onChange((v) => { this.titleValue = v; });
        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submit();
          if (e.key === 'Escape') this.close();
        });
        setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, 50);
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

    renderFieldInputs(contentEl, this.app, this.objType, this.fieldValues, () => this.submit(), descSetting.settingEl);

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText('Create').setCta().onClick(() => this.submit()))
      .addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  private submit(): void {
    const title = this.titleValue.trim();
    if (!title) { new Notice('Please enter a title.'); return; }
    this.close();
    this.onSubmit(title, this.fieldValues, this.descriptionValue);
  }

  onClose(): void { this.contentEl.empty(); }
}
