import { App, ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import { addSaveLocationSettings } from './save-location-setting.ts';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { FilterSpec, NoteType } from '../types.ts';

export type NewNoteTypeValues = Pick<NoteType, 'name' | 'description' | 'templatePath' | 'saveFolder' | 'saveLocation' | 'matchFilters' | 'matchMode'>;

/**
 * Compact "create note type" dialog, laid out like Obsidian's core Add bookmark
 * modal: a title, stacked setting rows, and a Cancel / Save button row.
 */
export class CreateNoteTypeModal extends Modal {
  private values: NewNoteTypeValues = { name: '', description: '', templatePath: '', saveFolder: '', saveLocation: 'vault', matchFilters: [], matchMode: 'all' };
  private filtersEl!: HTMLElement;

  constructor(app: App, private plugin: FilteredFileCommandsPlugin, private onSubmit: (values: NewNoteTypeValues) => Promise<void> | void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle('Create note type');

    new Setting(contentEl)
      .setName('Name')
      .addText((text) => {
        text.setPlaceholder('E.g. Meeting').onChange((v) => { this.values.name = v; });
        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); void this.submit(); }
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName('Description')
      .addText((text) => text.setPlaceholder('Optional').onChange((v) => { this.values.description = v; }));

    const templateFiles = this.plugin.getTemplateFiles();
    if (templateFiles.length > 0) {
      new Setting(contentEl)
        .setName('Template')
        .addDropdown((dd) => {
          dd.addOption('', 'None');
          for (const f of templateFiles) dd.addOption(f.path, f.basename);
          dd.setValue('').onChange((v) => { this.values.templatePath = v; });
        });
    } else {
      new Setting(contentEl)
        .setName('Template')
        .setDesc('No templates found. Set the templates folder in the main settings.')
        .addText((text) => text.setPlaceholder('Templates/Meeting.md').onChange((v) => { this.values.templatePath = v.trim(); }));
    }

    addSaveLocationSettings(this.app, contentEl, this.values);

    new Setting(contentEl)
      .setName('Detection filters')
      .setDesc('Notes matching these filters are treated as this type. Without filters, only a specific folder location lets notes be detected.')
      .addButton((btn) => btn.setButtonText('Add filter').onClick(() => {
        this.values.matchFilters.push({ key: '', operator: 'equals', value: '' });
        this.renderFilters();
      }));
    this.filtersEl = contentEl.createDiv();
    this.renderFilters();

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => this.close());
    new ButtonComponent(buttons).setButtonText('Save').setCta().onClick(() => { void this.submit(); });
  }

  private renderFilters(): void {
    const el = this.filtersEl;
    el.empty();
    const filters = this.values.matchFilters;

    if (filters.length > 1) {
      new Setting(el).setName('Match').addDropdown((dd) => dd
        .addOption('all', 'All filters')
        .addOption('any', 'Any filter')
        .setValue(this.values.matchMode)
        .onChange((v) => { this.values.matchMode = v as 'all' | 'any'; }));
    }

    filters.forEach((filter, i) => {
      const row = new Setting(el).setClass('ffc-create-filter-row');
      const isPathOp = () => filter.operator === 'in_folder' || filter.operator === 'not_in_folder';
      row.addText((t) => {
        t.setPlaceholder('Property').setValue(filter.key).onChange((v) => { filter.key = v.trim(); });
        if (isPathOp()) t.inputEl.hide();
      });
      row.addDropdown((dd) => dd
        .addOption('equals', 'Equals')
        .addOption('not_equals', 'Does not equal')
        .addOption('contains', 'Contains')
        .addOption('exists', 'Exists')
        .addOption('in_folder', 'In folder')
        .addOption('not_in_folder', 'Not in folder')
        .setValue(filter.operator)
        .onChange((v) => { filter.operator = v as FilterSpec['operator']; this.renderFilters(); }));
      if (filter.operator !== 'exists') {
        row.addText((t) => t.setPlaceholder(isPathOp() ? 'Folder path' : 'Value').setValue(filter.value)
          .onChange((v) => { filter.value = v; }));
      }
      row.addExtraButton((b) => b.setIcon('trash').setTooltip('Remove filter').onClick(() => {
        filters.splice(i, 1);
        this.renderFilters();
      }));
    });
  }

  private async submit(): Promise<void> {
    if (!this.values.name.trim()) {
      new Notice('Enter a name for the note type.');
      return;
    }
    this.values.name = this.values.name.trim();
    // Drop filters the user added but never filled in.
    this.values.matchFilters = this.values.matchFilters.filter((f) =>
      f.operator === 'in_folder' || f.operator === 'not_in_folder' ? !!f.value.trim()
        : f.operator === 'exists' ? !!f.key : !!f.key && !!f.value);
    // A folder typed before switching to another location shouldn't linger.
    if (this.values.saveLocation !== 'folder') this.values.saveFolder = '';
    try {
      await this.onSubmit(this.values);
      this.close();
    } catch (err) {
      console.error('Create note type failed:', err);
      new Notice('Could not create the note type. See the console for details.');
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
