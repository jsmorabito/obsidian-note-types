import { ItemView, WorkspaceLeaf, debounce, Menu, Notice, SearchComponent, setIcon } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { FfwSection } from '../types.ts';
import { FFW_VIEW_TYPE, ffwGetSectionFiles, ffwFuzzyMatch, ffwGetIconicIcon, ffwSetIconEl, ffwSortLabel, ffwNewSectionId } from '../utils/ffw-utils.ts';
import { FfwSectionEditModal } from './ffw-section-edit-modal.ts';
import { TFile } from 'obsidian';

export class FilteredFilesWidgetView extends ItemView {
  private query        = '';
  private rootEl:      HTMLElement | null = null;
  private sectionsEl:  HTMLElement | null = null;
  private dragSourceId: string | null     = null;
  private plugin: FilteredFileCommandsPlugin;
  readonly refresh: () => void;

  constructor(leaf: WorkspaceLeaf, plugin: FilteredFileCommandsPlugin) {
    super(leaf);
    this.plugin  = plugin;
    this.refresh = debounce(() => this.render(), 80, true);
  }

  getViewType():    string { return FFW_VIEW_TYPE; }
  getDisplayText(): string { return 'Filtered files'; }
  getIcon():        string { return 'file-sliders'; }

  async onOpen(): Promise<void> {
    this.rootEl = this.containerEl.children[1] as HTMLElement;
    this.rootEl.empty();
    this.rootEl.addClass('ffw-root');
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.refresh()));
    this.registerEvent(this.app.metadataCache.on('changed',  () => this.refresh()));
    this.registerEvent(this.app.vault.on('create', () => this.refresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.refresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('iconic:icon-changed' as 'css-change', () => this.refresh()));
    this.render();
  }

  async onClose(): Promise<void> { this.containerEl.empty(); }

  render(): void {
    if (!this.rootEl) return;
    this.rootEl.empty();
    this.renderHeader(this.rootEl);
    this.sectionsEl = this.rootEl.createDiv({ cls: 'ffw-sections' });
    this.renderSections();
  }

  private renderHeader(el: HTMLElement): void {
    const row    = el.createDiv({ cls: 'ffw-header' }).createDiv({ cls: 'ffw-search-row' });
    const search = new SearchComponent(row);
    search.setPlaceholder('Filter...');
    search.setValue(this.query);
    search.onChange((v) => { this.query = v; this.renderSections(); });

    const addBtn = row.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Add filter section' } });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => this.openAddModal());
  }

  renderSections(): void {
    if (!this.sectionsEl) return;
    this.sectionsEl.empty();
    const sections = this.plugin.settings.ffwSections;
    if (sections.length === 0) {
      const empty = this.sectionsEl.createDiv({ cls: 'ffw-empty-state' });
      empty.createEl('p', { text: 'No filter sections yet.' });
      empty.createEl('p', { cls: 'setting-item-description', text: 'Use the + button above to create your first filter section.' });
      return;
    }
    sections.forEach((section) => this.renderSection(section));
  }

  private renderSection(section: FfwSection): void {
    if (!this.sectionsEl) return;

    const sectionEl = this.sectionsEl.createDiv({ cls: 'ffw-section' });
    sectionEl.dataset['sectionId'] = section.id;
    if (section.collapsed) sectionEl.addClass('is-collapsed');
    sectionEl.setAttr('draggable', 'true');
    sectionEl.addEventListener('dragstart', (e) => this.handleDragStart(e, section.id));
    sectionEl.addEventListener('dragover',  (e) => this.handleDragOver(e, sectionEl));
    sectionEl.addEventListener('dragleave', ()  => sectionEl.removeClass('is-drag-over'));
    sectionEl.addEventListener('drop',      (e) => void this.handleDrop(e, section.id, sectionEl));
    sectionEl.addEventListener('dragend',   ()  => this.clearDragState());

    const header = sectionEl.createDiv({ cls: 'ffw-section-header' });

    const dragHandle = header.createSpan({ cls: 'ffw-drag-handle' });
    setIcon(dragHandle, 'grip-vertical');
    dragHandle.setAttr('aria-label', 'Drag to reorder');

    const collapseToggle = header.createSpan({ cls: 'ffw-collapse-toggle' });
    setIcon(collapseToggle, section.collapsed ? 'chevron-right' : 'chevron-down');
    collapseToggle.setAttr('aria-label', section.collapsed ? 'Expand section' : 'Collapse section');
    collapseToggle.addEventListener('click', (e) => { e.stopPropagation(); void this.toggleCollapse(section); });

    const titleWrap = header.createDiv({ cls: 'ffw-section-title-wrap' });
    titleWrap.createDiv({ cls: 'ffw-section-title', text: section.title });
    titleWrap.createDiv({
      cls:  'ffw-section-meta',
      text: `${section.filters.length} filter${section.filters.length === 1 ? '' : 's'} · ${ffwSortLabel(section.sort)}`,
    });
    titleWrap.addEventListener('click', () => void this.toggleCollapse(section));

    const controls = header.createDiv({ cls: 'ffw-section-controls' });
    this.addIconButton(controls, 'more-vertical', 'More actions', (e) => this.openSectionMenu(section, e));

    const body = sectionEl.createDiv({ cls: 'ffw-section-body' });
    if (!section.collapsed) {
      try {
        const files    = ffwGetSectionFiles(this.app, section);
        const filtered = this.query
          ? files.filter((f) => ffwFuzzyMatch(this.query, f.basename) || ffwFuzzyMatch(this.query, f.path))
          : files;

        if (filtered.length === 0) {
          body.createDiv({ cls: 'ffw-no-results', text: this.query ? 'No files match the search.' : 'No files match the filters.' });
          return;
        }

        const list = body.createDiv({ cls: 'ffw-file-list' });
        filtered.forEach((f) => this.renderFileRow(list, f));

        if (files.length > filtered.length) {
          body.createDiv({ cls: 'ffw-truncated', text: `${files.length - filtered.length} hidden by search` });
        }
      } catch (err) {
        body.createDiv({ cls: 'ffw-error', text: `Error rendering section: ${(err as Error).message}` });
      }
    }
  }

  private renderFileRow(el: HTMLElement, file: TFile): void {
    const row    = el.createDiv({ cls: 'ffw-file-row' });
    const iconEl = row.createSpan({ cls: 'ffw-file-icon' });

    const iconicIcon = ffwGetIconicIcon(this.app, file);
    if (iconicIcon?.icon) {
      ffwSetIconEl(iconEl, iconicIcon.icon, iconicIcon.color);
    } else {
      setIcon(iconEl, 'file-text');
    }

    const labelEl    = row.createDiv({ cls: 'ffw-file-label' });
    const key        = this.plugin.settings.ffwDisplayNameKey;
    const fmCache    = key ? this.app.metadataCache.getFileCache(file)?.frontmatter : null;
    const displayName = (key && fmCache?.[key] != null) ? String(fmCache[key]) : file.basename;
    labelEl.createDiv({ cls: 'ffw-file-name', text: displayName });

    const folder = file.parent?.path && file.parent.path !== '/' ? file.parent.path : '';
    if (folder) labelEl.createDiv({ cls: 'ffw-file-path', text: folder });

    row.addEventListener('click', (e) => {
      void this.app.workspace.openLinkText(file.path, '', e.ctrlKey || e.metaKey);
    });

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => item.setTitle('Open').setIcon('file-text')
        .onClick(() => this.app.workspace.openLinkText(file.path, '', false)));
      menu.addItem((item) => item.setTitle('Open in new tab').setIcon('file-plus')
        .onClick(() => this.app.workspace.openLinkText(file.path, '', true)));
      menu.addItem((item) => item.setTitle('Reveal in file explorer').setIcon('folder')
        .onClick(() => {
          /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
             Core plugin internals (app.internalPlugins) aren't part of the public Obsidian API. */
          const fe   = (this.app as any).internalPlugins?.getPluginById?.('file-explorer');
          const inst = fe?.instance;
          if (inst?.revealInFolder) {
            try { inst.revealInFolder(file); return; } catch { /* ignore */ }
          }
          /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
             End of the internalPlugins reflection block. */
          new Notice('Could not reveal file in the file explorer.');
        }));
      menu.showAtMouseEvent(e);
    });
  }

  private addIconButton(el: HTMLElement, icon: string, label: string, onClick: (e: MouseEvent) => void): void {
    const btn = el.createEl('button', { cls: 'clickable-icon' });
    setIcon(btn, icon);
    btn.setAttr('aria-label', label);
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(e); });
  }

  private openSectionMenu(section: FfwSection, e: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle('Edit').setIcon('pencil').onClick(() => this.openEditModal(section)));
    menu.addItem((item) => item.setTitle('Duplicate').setIcon('copy').onClick(() => this.duplicateSection(section)));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle('Delete section').setIcon('trash').onClick(() => this.deleteSection(section.id)));
    menu.showAtMouseEvent(e);
  }

  private openAddModal(): void {
    new FfwSectionEditModal(this.app, null, (section) => {
      this.plugin.settings.ffwSections.push(section);
      void this.persistAndRender();
    }).open();
  }

  private openEditModal(section: FfwSection): void {
    new FfwSectionEditModal(this.app, section, (updated) => {
      const idx = this.plugin.settings.ffwSections.findIndex((s) => s.id === section.id);
      if (idx >= 0) {
        this.plugin.settings.ffwSections[idx] = updated;
        void this.persistAndRender();
      }
    }).open();
  }

  private async persistAndRender(): Promise<void> {
    await this.plugin.saveSettings();
    this.renderSections();
  }

  private async toggleCollapse(section: FfwSection): Promise<void> {
    section.collapsed = !section.collapsed;
    await this.plugin.saveSettings();
    this.renderSections();
  }

  private async duplicateSection(section: FfwSection): Promise<void> {
    const copy  = JSON.parse(JSON.stringify(section)) as FfwSection;
    copy.id     = ffwNewSectionId();
    copy.title  = `${section.title} (copy)`;
    const idx   = this.plugin.settings.ffwSections.findIndex((s) => s.id === section.id);
    this.plugin.settings.ffwSections.splice(idx + 1, 0, copy);
    await this.plugin.saveSettings();
    this.renderSections();
  }

  private async deleteSection(id: string): Promise<void> {
    const sections = this.plugin.settings.ffwSections;
    const idx      = sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const [removed] = sections.splice(idx, 1);
    await this.plugin.saveSettings();
    this.renderSections();
    if (removed) new Notice(`Removed "${removed.title}"`);
  }

  // ── Drag-and-drop reorder ─────────────────────────────────────────────────────

  private handleDragStart(e: DragEvent, id: string): void {
    this.dragSourceId = id;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }
  }

  private handleDragOver(e: DragEvent, el: HTMLElement): void {
    if (!this.dragSourceId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    el.addClass('is-drag-over');
  }

  private async handleDrop(e: DragEvent, targetId: string, el: HTMLElement): Promise<void> {
    e.preventDefault();
    el.removeClass('is-drag-over');
    const sourceId = this.dragSourceId;
    this.dragSourceId = null;
    if (!sourceId || sourceId === targetId) return;

    const sections = this.plugin.settings.ffwSections;
    const fromIdx  = sections.findIndex((s) => s.id === sourceId);
    const toIdx    = sections.findIndex((s) => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = sections.splice(fromIdx, 1);
    if (!moved) return;
    const newIdx = sections.findIndex((s) => s.id === targetId);
    sections.splice(newIdx < 0 ? sections.length : newIdx, 0, moved);
    await this.plugin.saveSettings();
    this.renderSections();
  }

  private clearDragState(): void {
    this.dragSourceId = null;
    this.containerEl.querySelectorAll('.ffw-section.is-drag-over')
      .forEach((el) => (el as HTMLElement).classList.remove('is-drag-over'));
  }
}
