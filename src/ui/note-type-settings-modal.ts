import { App, Modal, Setting } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { nameToCommandSlug } from '../utils/helpers.ts';

export class NoteTypeSettingsModal extends Modal {
  private plugin: FilteredFileCommandsPlugin;
  private index: number;
  private onDismiss: (() => void) | undefined;

  constructor(app: App, plugin: FilteredFileCommandsPlugin, index: number, onDismiss?: () => void) {
    super(app);
    this.plugin    = plugin;
    this.index     = index;
    this.onDismiss = onDismiss;
  }

  onOpen(): void { this._render(); }

  private _render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ffc-item-modal');

    const obj = this.plugin.settings.noteTypes[this.index];
    if (!obj) { contentEl.createEl('p', { text: 'Note type not found.' }); return; }

    contentEl.createEl('h2', { text: obj.name || 'Note Type Settings', cls: 'ffc-modal-title' });

    // ── Name ──────────────────────────────────────────────────────────────────
    new Setting(contentEl).setName('Note type name').setDesc('Creates a "Create new {name}" command in the palette.')
      .addText((text) => text.setPlaceholder('e.g. Task').setValue(obj.name)
        .onChange(async (value) => {
          obj.name = value;
          await this.plugin.saveSettings();
          const cmdId = `ffc-notetype-${obj.commandSlug}`;
          const refs = this.plugin.commandRefs;
          if (refs[cmdId]) refs[cmdId].name = `Create new ${value}`;
          const findCmdId = `${cmdId}-find`;
          if (refs[findCmdId]) refs[findCmdId].name = `Find ${value}`;
          const titleEl = contentEl.querySelector('.ffc-modal-title');
          if (titleEl) titleEl.textContent = value || 'Note Type Settings';
        })
      );

    // ── Description ───────────────────────────────────────────────────────────
    new Setting(contentEl).setName('Description').setDesc('Short description shown beneath the note type name in the settings list.')
      .addText((text) => text.setPlaceholder('e.g. Tracks actionable to-dos').setValue(obj.description || '')
        .onChange(async (value) => {
          obj.description = value;
          await this.plugin.saveSettings();
        })
      );

    if (obj.commandSlug !== nameToCommandSlug(obj.name)) {
      contentEl.createEl('p', {
        text: `⚠ Command ID ("${obj.commandSlug}") was set when this type was first created and no longer matches the current name. Renaming only updates the display — to fix it, change "commandSlug" in data.json to "${nameToCommandSlug(obj.name)}" and rebind any shortcuts.`,
        cls: 'ffc-hint ffc-slug-warning',
      });
    }

    // ── Note Detection ────────────────────────────────────────────────────────
    const detectionSection = contentEl.createDiv({ cls: 'ffc-filters-section' });
    detectionSection.createEl('p', { text: 'Note Detection', cls: 'ffc-filters-title' });
    detectionSection.createEl('p', {
      text: 'Filters that identify existing files of this type. Used by the trigger menu and the "Find" command. If no filters are set, files in the Save Folder are used as a fallback.',
      cls: 'ffc-hint',
    });

    new Setting(detectionSection)
      .setName('Filter match mode')
      .setDesc('Should a file match ALL filters (AND) or at least ONE filter (OR)?')
      .addDropdown((dd) =>
        dd.addOption('all', 'Match ALL (AND)').addOption('any', 'Match ANY (OR)')
          .setValue(obj.matchMode ?? 'all')
          .onChange(async (value) => { obj.matchMode = value as 'all' | 'any'; await this.plugin.saveSettings(); })
      );

    if (!obj.matchFilters || obj.matchFilters.length === 0) {
      detectionSection.createEl('p', { text: 'No filters — save folder will be used as a fallback.', cls: 'ffc-hint' });
    }
    for (let fi = 0; fi < (obj.matchFilters ?? []).length; fi++) {
      this._renderNoteMatchFilter(detectionSection, fi);
    }
    new Setting(detectionSection).addButton((btn) =>
      btn.setButtonText('＋ Add Detection Filter').onClick(async () => {
        if (!obj.matchFilters) obj.matchFilters = [];
        obj.matchFilters.push({ key: '', operator: 'equals', value: '' });
        await this.plugin.saveSettings();
        this._render();
      })
    );

    new Setting(detectionSection)
      .setName('Show in trigger menu')
      .setDesc(`When enabled, matching files appear in the "${this.plugin.settings.triggerKey || '@'}" inline trigger menu.`)
      .addToggle((toggle) =>
        toggle.setValue(obj.showInTriggerMenu ?? false)
          .onChange(async (value) => { obj.showInTriggerMenu = value; await this.plugin.saveSettings(); })
      );

    new Setting(detectionSection)
      .setName('Enable "Find" command')
      .setDesc(`When enabled, adds a "Find ${obj.name}" command to the palette for fuzzy-searching files of this type.`)
      .addToggle((toggle) =>
        toggle.setValue(obj.enableFindCommand ?? false)
          .onChange(async (value) => {
            obj.enableFindCommand = value;
            await this.plugin.saveSettings();
            if (value) this.plugin.registerFindCommand(obj);
          })
      );

    new Setting(detectionSection)
      .setName('Style note links')
      .setDesc('When enabled, inline links to files of this type will have their underline removed and a background fill applied.')
      .addToggle((toggle) =>
        toggle.setValue(obj.styledLinks ?? false)
          .onChange(async (value) => {
            obj.styledLinks = value;
            await this.plugin.saveSettings();
            this.plugin.buildStyledNoteSet();
            this.plugin.refreshNoteLinkStyles();
          })
      );

    new Setting(detectionSection)
      .setName('Show status in links')
      .setDesc('When enabled, a status icon is shown on inline links to files of this type that have a "status" frontmatter field.')
      .addToggle((toggle) =>
        toggle.setValue(obj.showStatusInLinks ?? false)
          .onChange(async (value) => {
            obj.showStatusInLinks = value;
            await this.plugin.saveSettings();
            this.plugin.buildStyledNoteSet();
            this.plugin.refreshNoteLinkStyles();
          })
      );

    // ── Template & Save Folder ────────────────────────────────────────────────
    const templateFiles = this.plugin.getTemplateFiles();
    if (templateFiles.length > 0) {
      new Setting(contentEl).setName('Template').setDesc('Template file applied when creating a new note of this type.')
        .addDropdown((dd) => {
          dd.addOption('', '— None —');
          for (const f of templateFiles) dd.addOption(f.path, f.basename);
          dd.setValue(obj.templatePath || '');
          dd.onChange(async (value) => { obj.templatePath = value; await this.plugin.saveSettings(); });
        });
    } else {
      new Setting(contentEl).setName('Template').setDesc('No templates found. Set the templates folder in General settings, or check it contains .md files.')
        .addText((text) => text.setPlaceholder('path/to/template.md').setValue(obj.templatePath || '')
          .onChange(async (value) => { obj.templatePath = value.trim(); await this.plugin.saveSettings(); })
        );
    }

    new Setting(contentEl).setName('Save folder').setDesc('Where new files are created (e.g. "Projects/Tasks"). Leave blank for vault root.')
      .addText((text) => text.setPlaceholder('e.g. Projects/Tasks').setValue(obj.saveFolder || '')
        .onChange(async (value) => { obj.saveFolder = value.trim(); await this.plugin.saveSettings(); })
      );

    // ── Creation Fields ───────────────────────────────────────────────────────
    const fieldsSection = contentEl.createDiv({ cls: 'ffc-filters-section' });
    fieldsSection.createEl('p', { text: 'Creation Fields', cls: 'ffc-filters-title' });
    fieldsSection.createEl('p', {
      text: "Fields shown in the creation dialog. Values are written into the new file's frontmatter.",
      cls: 'ffc-hint',
    });

    for (let fi = 0; fi < (obj.fields ?? []).length; fi++) {
      this._renderNoteField(fieldsSection, fi);
    }
    new Setting(fieldsSection).addButton((btn) =>
      btn.setButtonText('＋ Add Field').onClick(async () => {
        if (!obj.fields) obj.fields = [];
        obj.fields.push({ key: '', label: '', type: 'text' });
        await this.plugin.saveSettings();
        this._render();
      })
    );

    // ── Preview Fields ────────────────────────────────────────────────────────
    const previewSection = contentEl.createDiv({ cls: 'ffc-filters-section' });
    previewSection.createEl('p', { text: 'Preview Fields', cls: 'ffc-filters-title' });
    previewSection.createEl('p', {
      text: 'Frontmatter keys shown when hovering over a link to a note of this type.',
      cls: 'ffc-hint',
    });

    for (let fi = 0; fi < (obj.previewFields ?? []).length; fi++) {
      this._renderPreviewField(previewSection, fi);
    }
    new Setting(previewSection).addButton((btn) =>
      btn.setButtonText('＋ Add Preview Field').onClick(async () => {
        if (!obj.previewFields) obj.previewFields = [];
        obj.previewFields.push({ key: '', label: '' });
        await this.plugin.saveSettings();
        this._render();
      })
    );

    new Setting(previewSection)
      .setName('Show cover image in preview')
      .setDesc('When enabled, the image from the Image Key is shown at the top of the hover card.')
      .addToggle((toggle) =>
        toggle.setValue(obj.showImageInPreview ?? false)
          .onChange(async (value) => { obj.showImageInPreview = value; await this.plugin.saveSettings(); })
      );

    // ── Canvas Card Fields ────────────────────────────────────────────────────
    const canvasSection = contentEl.createDiv({ cls: 'ffc-filters-section' });
    canvasSection.createEl('p', { text: 'Canvas Card Fields', cls: 'ffc-filters-title' });
    canvasSection.createEl('p', {
      text: 'Frontmatter keys shown on canvas cards for notes of this type.',
      cls: 'ffc-hint',
    });

    for (let fi = 0; fi < (obj.canvasFields ?? []).length; fi++) {
      this._renderCanvasField(canvasSection, fi);
    }
    new Setting(canvasSection).addButton((btn) =>
      btn.setButtonText('＋ Add Canvas Field').onClick(async () => {
        if (!obj.canvasFields) obj.canvasFields = [];
        obj.canvasFields.push({ key: '', label: '' });
        await this.plugin.saveSettings();
        this._render();
      })
    );

    new Setting(canvasSection)
      .setName('Show cover image on canvas cards')
      .setDesc('When enabled, the image from the Image Key is embedded at the top of the canvas card.')
      .addToggle((toggle) =>
        toggle.setValue(obj.showImageInCanvas ?? false)
          .onChange(async (value) => { obj.showImageInCanvas = value; await this.plugin.saveSettings(); })
      );

    // ── Cover Image ───────────────────────────────────────────────────────────
    const imageSection = contentEl.createDiv({ cls: 'ffc-filters-section' });
    imageSection.createEl('p', { text: 'Cover Image', cls: 'ffc-filters-title' });
    imageSection.createEl('p', {
      text: 'The frontmatter key whose value is an image path or wikilink (e.g. "cover" or "image").',
      cls: 'ffc-hint',
    });

    new Setting(imageSection)
      .setName('Image frontmatter key')
      .setDesc('e.g. cover, image, thumbnail')
      .addText((text) =>
        text.setPlaceholder('cover')
          .setValue(obj.imageKey ?? '')
          .onChange(async (value) => { obj.imageKey = value.trim(); await this.plugin.saveSettings(); })
      );
  }

  private _renderNoteMatchFilter(container: HTMLElement, filterIndex: number): void {
    const obj    = this.plugin.settings.noteTypes[this.index];
    const filter = obj.matchFilters[filterIndex];
    const row    = container.createDiv({ cls: 'ffc-filter-row' });

    const isPathOp = filter.operator === 'in_folder' || filter.operator === 'not_in_folder';

    if (!isPathOp) {
      const keyInput = row.createEl('input', { cls: 'ffc-input ffc-input-key' });
      keyInput.type = 'text'; keyInput.placeholder = 'Property key'; keyInput.value = filter.key ?? '';
      keyInput.addEventListener('change', async () => { filter.key = keyInput.value.trim(); await this.plugin.saveSettings(); });
    }

    const opSelect = row.createEl('select', { cls: 'ffc-select' });
    for (const op of [
      { value: 'equals',        label: '=' },
      { value: 'not_equals',    label: '≠' },
      { value: 'contains',      label: 'contains' },
      { value: 'exists',        label: 'exists' },
      { value: 'in_folder',     label: 'in folder' },
      { value: 'not_in_folder', label: 'not in folder' },
    ]) {
      const opt = opSelect.createEl('option', { text: op.label, value: op.value });
      if (filter.operator === op.value) opt.selected = true;
    }
    opSelect.addEventListener('change', async () => {
      filter.operator = opSelect.value as typeof filter.operator;
      await this.plugin.saveSettings();
      this._render();
    });

    if (filter.operator !== 'exists') {
      const valInput = row.createEl('input', { cls: 'ffc-input ffc-input-val' });
      valInput.type = 'text';
      valInput.placeholder = isPathOp ? 'Folder path (e.g. Templates)' : 'Value';
      valInput.value = filter.value ?? '';
      valInput.addEventListener('change', async () => { filter.value = valInput.value; await this.plugin.saveSettings(); });
    }

    row.createEl('button', { text: '✕', cls: 'ffc-btn-remove' }).onclick = async () => {
      obj.matchFilters.splice(filterIndex, 1);
      await this.plugin.saveSettings();
      this._render();
    };
  }

  private _renderNoteField(container: HTMLElement, fieldIndex: number): void {
    const obj   = this.plugin.settings.noteTypes[this.index];
    const field = obj.fields[fieldIndex];
    const row   = container.createDiv({ cls: 'ffc-filter-row' });

    const labelInput = row.createEl('input', { cls: 'ffc-input ffc-input-label' });
    labelInput.type = 'text'; labelInput.placeholder = 'Label'; labelInput.value = field.label ?? '';
    labelInput.title = 'Display label shown in the creation dialog';
    labelInput.addEventListener('change', async () => { field.label = labelInput.value; await this.plugin.saveSettings(); });

    const keyInput = row.createEl('input', { cls: 'ffc-input ffc-input-key' });
    keyInput.type = 'text'; keyInput.placeholder = 'Frontmatter key'; keyInput.value = field.key ?? '';
    keyInput.title = 'The frontmatter property key written into the new file';
    keyInput.addEventListener('change', async () => { field.key = keyInput.value.trim(); await this.plugin.saveSettings(); });

    const typeSelect = row.createEl('select', { cls: 'ffc-select' });
    for (const t of [{ value: 'text', label: 'Text' }, { value: 'list', label: 'List' }]) {
      const opt = typeSelect.createEl('option', { text: t.label, value: t.value });
      if (field.type === t.value) opt.selected = true;
    }
    typeSelect.title = 'List splits comma-separated input into a YAML array';
    typeSelect.addEventListener('change', async () => { field.type = typeSelect.value as 'text' | 'list'; await this.plugin.saveSettings(); });

    row.createEl('button', { text: '✕', cls: 'ffc-btn-remove' }).onclick = async () => {
      obj.fields.splice(fieldIndex, 1);
      await this.plugin.saveSettings();
      this._render();
    };
  }

  private _renderPreviewField(container: HTMLElement, fieldIndex: number): void {
    const obj   = this.plugin.settings.noteTypes[this.index];
    const field = obj.previewFields[fieldIndex];
    const row   = container.createDiv({ cls: 'ffc-filter-row' });

    const labelInput = row.createEl('input', { cls: 'ffc-input ffc-input-label' });
    labelInput.type = 'text'; labelInput.placeholder = 'Display label'; labelInput.value = field.label ?? '';
    labelInput.title = 'Label shown in the preview card (leave blank to use the key name)';
    labelInput.addEventListener('change', async () => { field.label = labelInput.value; await this.plugin.saveSettings(); });

    const keyInput = row.createEl('input', { cls: 'ffc-input ffc-input-key' });
    keyInput.type = 'text'; keyInput.placeholder = 'Frontmatter key'; keyInput.value = field.key ?? '';
    keyInput.title = 'The frontmatter property key whose value will appear in the preview';
    keyInput.addEventListener('change', async () => {
      field.key = keyInput.value.trim();
      await this.plugin.saveSettings();
      this.plugin.buildStyledNoteSet();
      this.plugin.refreshNoteLinkStyles();
    });

    row.createEl('button', { text: '✕', cls: 'ffc-btn-remove' }).onclick = async () => {
      obj.previewFields.splice(fieldIndex, 1);
      await this.plugin.saveSettings();
      this.plugin.buildStyledNoteSet();
      this.plugin.refreshNoteLinkStyles();
      this._render();
    };
  }

  private _renderCanvasField(container: HTMLElement, fieldIndex: number): void {
    const obj   = this.plugin.settings.noteTypes[this.index];
    const field = obj.canvasFields[fieldIndex];
    const row   = container.createDiv({ cls: 'ffc-filter-row' });

    const labelInput = row.createEl('input', { cls: 'ffc-input ffc-input-label' });
    labelInput.type        = 'text';
    labelInput.placeholder = 'Display label';
    labelInput.value       = field.label ?? '';
    labelInput.title       = 'Label shown on the canvas card (leave blank to use the key name)';
    labelInput.addEventListener('change', async () => {
      field.label = labelInput.value;
      await this.plugin.saveSettings();
    });

    const keyInput = row.createEl('input', { cls: 'ffc-input ffc-input-key' });
    keyInput.type        = 'text';
    keyInput.placeholder = 'Frontmatter key';
    keyInput.value       = field.key ?? '';
    keyInput.title       = 'The frontmatter property key whose value will appear on the card';
    keyInput.addEventListener('change', async () => {
      field.key = keyInput.value.trim();
      await this.plugin.saveSettings();
    });

    row.createEl('button', { text: '✕', cls: 'ffc-btn-remove' }).onclick = async () => {
      obj.canvasFields.splice(fieldIndex, 1);
      await this.plugin.saveSettings();
      this._render();
    };
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.onDismiss) this.onDismiss();
  }
}
