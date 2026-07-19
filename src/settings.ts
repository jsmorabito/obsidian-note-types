import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type { FilteredFileCommandsPlugin } from './main.ts';
import { PluginSettings } from './types.ts';
import { NoteTypeSettingsModal } from './ui/note-type-settings-modal.ts';
import { NoteTypeDeleteModal } from './ui/note-type-delete-modal.ts';
import { nameToCommandSlug } from './utils/helpers.ts';

export const DEFAULT_SETTINGS: PluginSettings = {
  commands: [],
  filteredCommandsEnabled: true,
  filteredWidgetEnabled: true,
  noteTypes: [],
  templatesFolder: '',
  triggerKey: '',
  ffwSections: [],
  ffwDisplayNameKey: '',
};

export class MyPluginSettingTab extends PluginSettingTab {
  plugin: FilteredFileCommandsPlugin;

  constructor(app: App, plugin: FilteredFileCommandsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private filteredCmdsSectionEl?: HTMLElement;
  private filteredWidgetSectionEl?: HTMLElement;

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('ffc-settings');
    this.filteredCmdsSectionEl = undefined;
    this.filteredWidgetSectionEl = undefined;

    // ── General ───────────────────────────────────────────────────────────────
    containerEl.createEl('h2', { text: 'General' });

    new Setting(containerEl)
      .setName('Trigger key')
      .setDesc('Character that opens the inline note picker while editing (e.g. "@"). Leave blank to disable.')
      .addText((text) =>
        text
          .setPlaceholder('e.g. @')
          .setValue(this.plugin.settings.triggerKey || '')
          .onChange(async (value) => {
            this.plugin.settings.triggerKey = value.trim().slice(0, 1);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Templates folder')
      .setDesc('Path to your templates folder (e.g. "Templates"). Leave blank to auto-detect from the core Templates plugin.')
      .addText((text) =>
        text.setPlaceholder('Templates').setValue(this.plugin.settings.templatesFolder || '')
          .onChange(async (value) => {
            this.plugin.settings.templatesFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    const filteredCmdsSetting = new Setting(containerEl)
      .setName('Filtered file commands')
      .setDesc('Create palette commands that open a fuzzy file picker filtered by frontmatter.');
    if (this.plugin.settings.filteredCommandsEnabled) {
      filteredCmdsSetting.addExtraButton((btn) =>
        btn.setIcon('arrow-down').setTooltip('Jump to Filtered File Commands').onClick(() => {
          this.filteredCmdsSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
      );
    }
    filteredCmdsSetting.addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.filteredCommandsEnabled)
        .onChange(async (value) => {
          this.plugin.settings.filteredCommandsEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        })
    );

    const filteredWidgetSetting = new Setting(containerEl)
      .setName('Filtered files widget')
      .setDesc('A sidebar panel that shows lists of files matching configurable filter rules.');
    if (this.plugin.settings.filteredWidgetEnabled) {
      filteredWidgetSetting.addExtraButton((btn) =>
        btn.setIcon('arrow-down').setTooltip('Jump to Filtered Files Widget').onClick(() => {
          this.filteredWidgetSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
      );
    }
    filteredWidgetSetting.addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.filteredWidgetEnabled)
        .onChange(async (value) => {
          this.plugin.settings.filteredWidgetEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        })
    );

    containerEl.createEl('hr', { cls: 'ffc-divider' });

    // ── Note Types ────────────────────────────────────────────────────────────
    const objTypesHeader = containerEl.createDiv({ cls: 'ffc-section-header' });
    objTypesHeader.createEl('h2', { text: 'Note Types', cls: 'ffc-section-header-title' });
    const addObjTypeBtn = objTypesHeader.createEl('button', {
      cls: 'clickable-icon ffc-btn-add',
      attr: { title: 'Add note type', 'aria-label': 'Add note type' },
    });
    setIcon(addObjTypeBtn, 'plus');
    addObjTypeBtn.onclick = async () => {
      const id          = `ffc-notetype-${Date.now()}`;
      const takenSlugs  = new Set(this.plugin.settings.noteTypes.map((o) => o.commandSlug).filter(Boolean));
      const baseSlug    = nameToCommandSlug('New Note');
      let newSlug = baseSlug; let slugN = 2;
      while (takenSlugs.has(newSlug)) newSlug = `${baseSlug}-${slugN++}`;
      this.plugin.settings.noteTypes.push({
        id, commandSlug: newSlug, name: 'New Note', templatePath: '', saveFolder: '',
        fields: [], matchFilters: [], matchMode: 'all', enableFindCommand: false,
        showInTriggerMenu: false, previewFields: [], canvasFields: [],
      });
      await this.plugin.saveSettings();
      this.plugin.registerNoteTypeCommand(this.plugin.settings.noteTypes[this.plugin.settings.noteTypes.length - 1]);
      this.display();
    };

    const objTypesList = containerEl.createDiv({ cls: 'setting-group ffc-notetype-list' });
    if (this.plugin.settings.noteTypes.length === 0) {
      objTypesList.createEl('p', { text: 'No note types yet. Select + to add one.', cls: 'ffc-hint ffc-notetype-empty' });
    } else {
      for (let i = 0; i < this.plugin.settings.noteTypes.length; i++) {
        this.renderNoteTypeRow(objTypesList, i);
      }
    }

    containerEl.createEl('hr', { cls: 'ffc-divider' });

    // ── Filtered File Commands ────────────────────────────────────────────────
    if (this.plugin.settings.filteredCommandsEnabled) {
      this.filteredCmdsSectionEl = containerEl.createDiv();

      const filteredCmdsHeader = this.filteredCmdsSectionEl.createDiv({ cls: 'ffc-section-header' });
      filteredCmdsHeader.createEl('h2', { text: 'Filtered File Commands', cls: 'ffc-section-header-title' });
      const addCmdBtn = filteredCmdsHeader.createEl('button', {
        cls: 'clickable-icon ffc-btn-add',
        attr: { title: 'Add filtered command', 'aria-label': 'Add filtered command' },
      });
      setIcon(addCmdBtn, 'plus');
      addCmdBtn.onclick = async () => {
        const id = `ffc-command-${Date.now()}`;
        this.plugin.settings.commands.push({ id, name: 'New Filtered Command', matchMode: 'all', filters: [] });
        await this.plugin.saveSettings();
        this.plugin.registerFilterCommand(this.plugin.settings.commands[this.plugin.settings.commands.length - 1]);
        this.display();
      };

      for (let i = 0; i < this.plugin.settings.commands.length; i++) {
        this.renderCommand(this.filteredCmdsSectionEl, i);
      }

      containerEl.createEl('hr', { cls: 'ffc-divider' });
    }

    // ── Filtered Files Widget ─────────────────────────────────────────────────
    if (this.plugin.settings.filteredWidgetEnabled) {
      this.filteredWidgetSectionEl = containerEl.createDiv();
      this.filteredWidgetSectionEl.createEl('h2', { text: 'Filtered Files Widget' });

      new Setting(this.filteredWidgetSectionEl)
        .setName('Open the widget')
        .setDesc('Reveal the filtered files widget in the left sidebar.')
        .addButton((btn) => btn.setButtonText('Open widget').setCta().onClick(() => {
          this.plugin.activateWidgetView();
        }));

      new Setting(this.filteredWidgetSectionEl)
        .setName('Display name frontmatter key')
        .setDesc('Show a frontmatter value instead of the filename in the widget. Enter the key you use (e.g. "title"). Leave blank to use the filename.')
        .addText((text) => text
          .setPlaceholder('e.g. title')
          .setValue(this.plugin.settings.ffwDisplayNameKey)
          .onChange(async (v) => {
            this.plugin.settings.ffwDisplayNameKey = v.trim();
            await this.plugin.saveSettings();
            this.plugin.refreshWidgetViews();
          })
        );

      new Setting(this.filteredWidgetSectionEl)
        .setName('Reset all filter sections')
        .setDesc('Remove every filter section from the widget. This cannot be undone.')
        .addButton((btn) => btn.setButtonText('Reset').setWarning().onClick(async () => {
          this.plugin.settings.ffwSections = [];
          await this.plugin.saveSettings();
          this.plugin.refreshWidgetViews();
        }));
    }
  }

  // ── Filtered command block ────────────────────────────────────────────────────

  private renderCommand(containerEl: HTMLElement, index: number): void {
    const cmd   = this.plugin.settings.commands[index];
    const block = containerEl.createDiv({ cls: 'ffc-command-block' });

    const header = block.createDiv({ cls: 'ffc-command-header' });
    header.createEl('span', { text: `Command ${index + 1}`, cls: 'ffc-command-label' });
    header.createEl('button', { text: '✕ Remove', cls: 'mod-warning' }).onclick = async () => {
      this.plugin.settings.commands.splice(index, 1);
      await this.plugin.saveSettings();
      this.display();
    };

    new Setting(block).setName('Command name').setDesc('Shown in the command palette and hotkey settings.')
      .addText((text) => text.setPlaceholder('e.g. Show Active Projects').setValue(cmd.name)
        .onChange(async (value) => {
          cmd.name = value;
          await this.plugin.saveSettings();
          const ref = this.plugin.commandRefs[cmd.id];
          if (ref) ref.name = value;
        })
      );

    new Setting(block).setName('Filter match mode').setDesc('Should a file match ALL filters (AND) or at least ONE filter (OR)?')
      .addDropdown((dd) => dd.addOption('all', 'Match ALL filters (AND)').addOption('any', 'Match ANY filter (OR)')
        .setValue(cmd.matchMode)
        .onChange(async (value) => { cmd.matchMode = value as 'all' | 'any'; await this.plugin.saveSettings(); })
      );

    new Setting(block).setName('File types').setDesc('Comma-separated extensions (e.g. md, canvas). Leave blank for markdown only.')
      .addText((text) => text.setPlaceholder('md, canvas').setValue(cmd.fileTypes || '')
        .onChange(async (value) => { cmd.fileTypes = value; await this.plugin.saveSettings(); })
      );

    const filtersSection = block.createDiv({ cls: 'ffc-filters-section' });
    filtersSection.createEl('p', { text: 'Frontmatter Filters', cls: 'ffc-filters-title' });
    if (cmd.filters.length === 0) {
      filtersSection.createEl('p', { text: 'No filters — all files of the specified type(s) will be shown.', cls: 'ffc-hint' });
    }
    for (let fi = 0; fi < cmd.filters.length; fi++) this.renderFilter(filtersSection, index, fi);
    new Setting(filtersSection).addButton((btn) =>
      btn.setButtonText('＋ Add Filter').onClick(async () => {
        cmd.filters.push({ key: '', operator: 'equals', value: '' });
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }

  private renderFilter(container: HTMLElement, cmdIndex: number, filterIndex: number): void {
    const cmd    = this.plugin.settings.commands[cmdIndex];
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
      this.display();
    });

    if (filter.operator !== 'exists') {
      const valInput = row.createEl('input', { cls: 'ffc-input ffc-input-val' });
      valInput.type = 'text'; valInput.placeholder = 'Value'; valInput.value = filter.value;
      valInput.addEventListener('change', async () => { filter.value = valInput.value; await this.plugin.saveSettings(); });
    }

    row.createEl('button', { text: '✕', cls: 'ffc-btn-remove' }).onclick = async () => {
      cmd.filters.splice(filterIndex, 1);
      await this.plugin.saveSettings();
      this.display();
    };
  }

  // ── Note type compact row ─────────────────────────────────────────────────────

  private renderNoteTypeRow(containerEl: HTMLElement, index: number): void {
    const obj = this.plugin.settings.noteTypes[index];
    const row = containerEl.createDiv({ cls: 'ffc-notetype-row' });
    row.onclick = (e) => {
      if (!(e.target as Element).closest('.ffc-notetype-row-actions')) {
        new NoteTypeSettingsModal(this.app, this.plugin, index, () => this.display()).open();
      }
    };

    const info = row.createDiv({ cls: 'ffc-notetype-row-info' });
    info.createEl('div', { text: obj.name || 'Unnamed', cls: 'ffc-notetype-row-name' });
    if (obj.description) {
      info.createEl('div', { text: obj.description, cls: 'ffc-notetype-row-desc' });
    }

    const actions = row.createDiv({ cls: 'ffc-notetype-row-actions' });

    const gearBtn = actions.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Edit settings' } });
    setIcon(gearBtn, 'settings');
    gearBtn.onclick = () => {
      new NoteTypeSettingsModal(this.app, this.plugin, index, () => this.display()).open();
    };

    const trashBtn = actions.createEl('button', { cls: 'clickable-icon ffc-btn-icon-danger', attr: { 'aria-label': 'Delete note type' } });
    setIcon(trashBtn, 'trash-2');
    trashBtn.onclick = () => {
      new NoteTypeDeleteModal(this.app, this.plugin, index, () => this.display()).open();
    };
  }
}
