import { App, Modal, Notice, Setting, ButtonComponent } from 'obsidian';
import {
  FfwSection, FfwFilter, FfwTagFilter, FfwFrontmatterFilter,
  FfwPathFilter, FfwNameFilter, FfwSort,
} from '../types.ts';
import {
  ffwNewSectionId, ffwDefaultFilter, ffwDefaultSort,
  FFW_FILTER_TYPE_LABELS, FFW_SORT_OPTIONS,
} from '../utils/ffw-utils.ts';

export class FfwSectionEditModal extends Modal {
  private filtersContainer: HTMLElement | null        = null;
  private frontmatterKeyContainer: HTMLElement | null = null;
  private isNew: boolean;
  private working: FfwSection;
  private onSave: (section: FfwSection) => void;

  constructor(app: App, section: FfwSection | null, onSave: (section: FfwSection) => void) {
    super(app);
    this.isNew   = section === null;
    this.working = section
      ? JSON.parse(JSON.stringify(section)) as FfwSection
      : { id: ffwNewSectionId(), title: '', filters: [ffwDefaultFilter('tag')], sort: ffwDefaultSort(), collapsed: false, maxResults: 0 };
    this.onSave  = onSave;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.addClass('ffw-modal');
    titleEl.setText(this.isNew ? 'Add filter section' : 'Edit filter section');

    new Setting(contentEl)
      .setName('Title')
      .setDesc('Shown as the section header in the widget.')
      .addText((text) => text
        .setPlaceholder('Active projects')
        .setValue(this.working.title)
        .onChange((v) => { this.working.title = v; })
      );

    contentEl.createEl('h3', { text: 'Filters' });
    contentEl.createEl('p', { cls: 'setting-item-description', text: 'All filters must match. Add as many rows as you need.' });

    this.filtersContainer = contentEl.createDiv({ cls: 'ffw-filter-rows' });
    this.renderFilterRows();

    const addRow = contentEl.createDiv({ cls: 'ffw-add-filter-row' });
    for (const type of ['tag', 'frontmatter', 'path', 'name'] as const) {
      new ButtonComponent(addRow)
        .setButtonText(`+ ${FFW_FILTER_TYPE_LABELS[type]}`)
        .onClick(() => {
          this.working.filters.push(ffwDefaultFilter(type));
          this.renderFilterRows();
        });
    }

    contentEl.createEl('h3', { text: 'Sort' });

    new Setting(contentEl)
      .setName('Sort by')
      .addDropdown((dd) => {
        for (const opt of FFW_SORT_OPTIONS) dd.addOption(opt.value, opt.label);
        dd.setValue(this.working.sort.field)
          .onChange((v) => {
            this.working.sort.field = v;
            this.updateFrontmatterKeyVisibility();
          });
      });

    this.frontmatterKeyContainer = contentEl.createDiv();
    new Setting(this.frontmatterKeyContainer)
      .setName('Frontmatter sort key')
      .setDesc('Required when sorting by a frontmatter field.')
      .addText((text) => text
        .setPlaceholder('Due')
        .setValue(this.working.sort.frontmatterKey ?? '')
        .onChange((v) => { this.working.sort.frontmatterKey = v.trim() || undefined; })
      );
    this.updateFrontmatterKeyVisibility();

    new Setting(contentEl)
      .setName('Result limit')
      .setDesc('Maximum number of files to show. 0 means unlimited.')
      .addText((text) => text
        .setPlaceholder('0')
        .setValue(String(this.working.maxResults))
        .onChange((v) => {
          const n = parseInt(v, 10);
          this.working.maxResults = Number.isFinite(n) && n > 0 ? n : 0;
        })
      );

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    new ButtonComponent(btnRow).setButtonText('Cancel').onClick(() => this.close());
    new ButtonComponent(btnRow)
      .setButtonText(this.isNew ? 'Add section' : 'Save')
      .setCta()
      .onClick(() => this.handleSave());
  }

  onClose(): void { this.contentEl.empty(); }

  private updateFrontmatterKeyVisibility(): void {
    if (!this.frontmatterKeyContainer) return;
    const show = this.working.sort.field === 'frontmatter-asc' || this.working.sort.field === 'frontmatter-desc';
    this.frontmatterKeyContainer.style.display = show ? '' : 'none';
  }

  private renderFilterRows(): void {
    if (!this.filtersContainer) return;
    this.filtersContainer.empty();
    if (this.working.filters.length === 0) {
      this.filtersContainer.createEl('p', { cls: 'setting-item-description ffw-empty', text: 'No filters yet — add one below.' });
      return;
    }
    this.working.filters.forEach((filter, idx) => {
      const row = this.filtersContainer!.createDiv({ cls: 'ffw-filter-row' });

      const typeSelect = row.createEl('select', { cls: 'dropdown ffw-type-select' });
      for (const [val, label] of Object.entries(FFW_FILTER_TYPE_LABELS)) {
        const opt = typeSelect.createEl('option', { value: val, text: label });
        if (val === filter.type) opt.selected = true;
      }
      typeSelect.addEventListener('change', () => {
        if (typeSelect.value !== filter.type) {
          this.working.filters[idx] = ffwDefaultFilter(typeSelect.value as FfwFilter['type']);
          this.renderFilterRows();
        }
      });

      const inputsEl = row.createDiv({ cls: 'ffw-filter-inputs' });
      this.renderFilterInputs(inputsEl, filter, idx);

      const removeBtn = row.createEl('button', { text: '✕', cls: 'ffw-filter-remove' });
      removeBtn.setAttribute('aria-label', 'Remove filter');
      removeBtn.addEventListener('click', () => {
        this.working.filters.splice(idx, 1);
        this.renderFilterRows();
      });
    });
  }

  private renderFilterInputs(el: HTMLElement, filter: FfwFilter, idx: number): void {
    switch (filter.type) {
      case 'tag':         this.renderTagInputs(el, filter, idx);         break;
      case 'frontmatter': this.renderFrontmatterInputs(el, filter, idx); break;
      case 'path':        this.renderPathInputs(el, filter, idx);        break;
      case 'name':        this.renderNameInputs(el, filter, idx);        break;
    }
  }

  private renderTagInputs(el: HTMLElement, filter: FfwTagFilter, idx: number): void {
    const modeSelect = el.createEl('select', { cls: 'dropdown' });
    const inclOpt = modeSelect.createEl('option', { value: 'include', text: 'Has tag' });
    const exclOpt = modeSelect.createEl('option', { value: 'exclude', text: 'Does not have tag' });
    (filter.include ? inclOpt : exclOpt).selected = true;
    modeSelect.addEventListener('change', () => {
      (this.working.filters[idx] as FfwTagFilter).include = modeSelect.value === 'include';
    });
    const tagInput = el.createEl('input', { type: 'text', placeholder: 'e.g. project', value: filter.tag, cls: 'ffw-text-input' });
    tagInput.addEventListener('input', () => { (this.working.filters[idx] as FfwTagFilter).tag = tagInput.value; });
  }

  private renderFrontmatterInputs(el: HTMLElement, filter: FfwFrontmatterFilter, idx: number): void {
    const keyInput = el.createEl('input', { type: 'text', placeholder: 'key', value: filter.key, cls: 'ffw-text-input' });
    keyInput.addEventListener('input', () => { (this.working.filters[idx] as FfwFrontmatterFilter).key = keyInput.value; });

    const compSelect = el.createEl('select', { cls: 'dropdown' });
    for (const { v, label } of [{ v: 'equals', label: '=' }, { v: 'not-equals', label: '≠' }, { v: 'contains', label: 'contains' }, { v: 'exists', label: 'exists' }]) {
      const opt = compSelect.createEl('option', { value: v, text: label });
      if (v === filter.comparison) opt.selected = true;
    }

    const valInput = el.createEl('input', { type: 'text', placeholder: 'value', value: filter.value, cls: 'ffw-text-input' });
    valInput.disabled = filter.comparison === 'exists';
    valInput.addEventListener('input', () => { (this.working.filters[idx] as FfwFrontmatterFilter).value = valInput.value; });
    compSelect.addEventListener('change', () => {
      const comp = compSelect.value as FfwFrontmatterFilter['comparison'];
      (this.working.filters[idx] as FfwFrontmatterFilter).comparison = comp;
      valInput.disabled = comp === 'exists';
    });
  }

  private renderPathInputs(el: HTMLElement, filter: FfwPathFilter, idx: number): void {
    const negateSelect = el.createEl('select', { cls: 'dropdown' });
    negateSelect.createEl('option', { value: 'is',     text: 'is'     }).selected = !filter.negate;
    negateSelect.createEl('option', { value: 'is-not', text: 'is not' }).selected =  filter.negate;
    negateSelect.addEventListener('change', () => {
      (this.working.filters[idx] as FfwPathFilter).negate = negateSelect.value === 'is-not';
    });

    const modeSelect = el.createEl('select', { cls: 'dropdown' });
    for (const { v, label } of [{ v: 'starts-with', label: 'starts with' }, { v: 'contains', label: 'contains' }, { v: 'equals', label: 'equals' }, { v: 'ends-with', label: 'ends with' }]) {
      const opt = modeSelect.createEl('option', { value: v, text: label });
      if (v === filter.matchMode) opt.selected = true;
    }
    modeSelect.addEventListener('change', () => {
      (this.working.filters[idx] as FfwPathFilter).matchMode = modeSelect.value as FfwPathFilter['matchMode'];
    });

    const patInput = el.createEl('input', { type: 'text', placeholder: 'e.g. Work/', value: filter.pattern, cls: 'ffw-text-input' });
    patInput.addEventListener('input', () => { (this.working.filters[idx] as FfwPathFilter).pattern = patInput.value; });
  }

  private renderNameInputs(el: HTMLElement, filter: FfwNameFilter, idx: number): void {
    const negateSelect = el.createEl('select', { cls: 'dropdown' });
    negateSelect.createEl('option', { value: 'is',     text: 'is'     }).selected = !filter.negate;
    negateSelect.createEl('option', { value: 'is-not', text: 'is not' }).selected =  filter.negate;
    negateSelect.addEventListener('change', () => {
      (this.working.filters[idx] as FfwNameFilter).negate = negateSelect.value === 'is-not';
    });

    const modeSelect = el.createEl('select', { cls: 'dropdown' });
    for (const { v, label } of [{ v: 'contains', label: 'contains' }, { v: 'starts-with', label: 'starts with' }, { v: 'ends-with', label: 'ends with' }, { v: 'regex', label: 'regex' }]) {
      const opt = modeSelect.createEl('option', { value: v, text: label });
      if (v === filter.matchMode) opt.selected = true;
    }
    modeSelect.addEventListener('change', () => {
      (this.working.filters[idx] as FfwNameFilter).matchMode = modeSelect.value as FfwNameFilter['matchMode'];
    });

    const patInput = el.createEl('input', { type: 'text', placeholder: 'pattern', value: filter.pattern, cls: 'ffw-text-input' });
    patInput.addEventListener('input', () => { (this.working.filters[idx] as FfwNameFilter).pattern = patInput.value; });

    const caseLbl   = el.createEl('label', { cls: 'ffw-checkbox' });
    const caseCheck = caseLbl.createEl('input', { type: 'checkbox' });
    caseCheck.checked = filter.caseSensitive;
    caseLbl.appendChild(document.createTextNode(' case sensitive'));
    caseCheck.addEventListener('change', () => { (this.working.filters[idx] as FfwNameFilter).caseSensitive = caseCheck.checked; });
  }

  private handleSave(): void {
    const title = this.working.title.trim();
    if (!title) { new Notice('Please enter a title for the section.'); return; }
    if (this.working.filters.length === 0) { new Notice('Add at least one filter to the section.'); return; }
    if ((this.working.sort.field === 'frontmatter-asc' || this.working.sort.field === 'frontmatter-desc') && !this.working.sort.frontmatterKey) {
      new Notice('Please specify a frontmatter key to sort by.'); return;
    }
    this.working.title = title;
    this.onSave(this.working);
    this.close();
  }
}
