import { App, Modal, Notice, Setting } from 'obsidian';
import { ObjectType } from '../types.ts';
import { renderFieldInputs } from '../utils/helpers.ts';

export class CombinedNewObjectModal extends Modal {
  private objectTypes: ObjectType[];
  private selectedType: ObjectType;
  private onSubmit: (objType: ObjectType, title: string, fieldValues: Record<string, string>, description: string) => void;
  private titleValue = '';
  private initialTitle: string;
  private fieldValues: Record<string, string> = {};
  private descriptionValue = '';

  constructor(
    app: App,
    objectTypes: ObjectType[],
    onSubmit: (objType: ObjectType, title: string, fieldValues: Record<string, string>, description: string) => void,
    initialTitle = '',
  ) {
    super(app);
    this.objectTypes  = objectTypes;
    this.selectedType = objectTypes[0];
    this.onSubmit     = onSubmit;
    this.initialTitle = initialTitle;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('ffc-new-object-modal');
    contentEl.createEl('h2', { text: 'New Object' });

    let descSettingEl: HTMLElement | null = null;

    new Setting(contentEl)
      .setName('Type')
      .addDropdown((dd) => {
        for (const obj of this.objectTypes) dd.addOption(obj.id, obj.name);
        dd.setValue(this.selectedType.id);
        dd.onChange((id) => {
          this.selectedType = this.objectTypes.find((o) => o.id === id) ?? this.objectTypes[0];
          this.fieldValues  = {};
          renderFieldInputs(contentEl, this.app, this.selectedType, this.fieldValues, () => this.submit(), descSettingEl);
        });
      });

    new Setting(contentEl)
      .setName('Title')
      .addText((text) => {
        text.setPlaceholder('Enter title…').setValue(this.initialTitle).onChange((v) => { this.titleValue = v; });
        this.titleValue = this.initialTitle;
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
    descSettingEl = descSetting.settingEl;

    renderFieldInputs(contentEl, this.app, this.selectedType, this.fieldValues, () => this.submit(), descSettingEl);

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText('Create').setCta().onClick(() => this.submit()))
      .addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  private submit(): void {
    const title = this.titleValue.trim();
    if (!title) { new Notice('Please enter a title.'); return; }
    this.close();
    this.onSubmit(this.selectedType, title, this.fieldValues, this.descriptionValue);
  }

  onClose(): void { this.contentEl.empty(); }
}
