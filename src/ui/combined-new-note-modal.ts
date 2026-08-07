import { App, Modal, Notice, Setting } from 'obsidian';
import { NoteType } from '../types.ts';
import { renderFieldInputs } from '../utils/helpers.ts';

export class CombinedNewNoteModal extends Modal {
  private noteTypes: NoteType[];
  private selectedType: NoteType;
  private onSubmit: (noteType: NoteType, title: string, fieldValues: Record<string, string>, description: string) => void | Promise<void>;
  private titleValue = '';
  private initialTitle: string;
  private fieldValues: Record<string, string> = {};
  private descriptionValue = '';

  constructor(
    app: App,
    noteTypes: NoteType[],
    onSubmit: (noteType: NoteType, title: string, fieldValues: Record<string, string>, description: string) => void | Promise<void>,
    initialTitle = '',
  ) {
    super(app);
    this.noteTypes    = noteTypes;
    this.selectedType = noteTypes[0];
    this.onSubmit     = onSubmit;
    this.initialTitle = initialTitle;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('ffc-new-note-modal');
    contentEl.createEl('h2', { text: 'New note' });

    let descSettingEl: HTMLElement | null = null;

    new Setting(contentEl)
      .setName('Type')
      .addDropdown((dd) => {
        for (const obj of this.noteTypes) dd.addOption(obj.id, obj.name);
        dd.setValue(this.selectedType.id);
        dd.onChange((id) => {
          this.selectedType = this.noteTypes.find((o) => o.id === id) ?? this.noteTypes[0];
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
    void this.onSubmit(this.selectedType, title, this.fieldValues, this.descriptionValue);
  }

  onClose(): void { this.contentEl.empty(); }
}
