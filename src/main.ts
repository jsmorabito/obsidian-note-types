import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettingTab } from './settings.ts';
import { PluginSettings, ObjectType, CommandSpec } from './types.ts';
import { nameToCommandSlug } from './utils/helpers.ts';
import { FFW_VIEW_TYPE } from './utils/ffw-utils.ts';
import { FilteredFileModal } from './ui/filtered-file-modal.ts';
import { NewObjectModal } from './ui/new-object-modal.ts';
import { CombinedNewObjectModal } from './ui/combined-new-object-modal.ts';
import { ObjectTypeSuggest } from './ui/object-type-suggest.ts';
import { ObjectPreviewPopup } from './ui/object-preview-popup.ts';
import { CanvasObjectSwitcher, ObsidianCanvas } from './ui/canvas-object-switcher.ts';
import { FilteredFilesWidgetView } from './views/filtered-files-widget.ts';
import { buildObjectLinkViewPlugin } from './views/object-link-view-plugin.ts';
import type { TriggerProvider } from './trigger-registry.ts';

// Command reference type returned by addCommand
type CommandRef = { name: string };

export class FilteredFileCommandsPlugin extends Plugin {
  settings!: PluginSettings;
  commandRefs: Record<string, CommandRef> = {};
  registeredCommandIds = new Set<string>();

  styledObjectBasenames:  Set<string> = new Set();
  styledObjectPaths:      Set<string> = new Set();
  previewObjectBasenames: Set<string> = new Set();
  previewObjectPaths:     Set<string> = new Set();

  private previewPopup!: ObjectPreviewPopup;

  // ── Trigger provider registry ─────────────────────────────────────────────────

  /**
   * External plugins can contribute items to the @ trigger menu by calling
   * registerTriggerProvider(). They should call unregisterTriggerProvider()
   * in their own onunload() to avoid holding a dead reference.
   */
  readonly triggerProviders: Map<string, TriggerProvider> = new Map();

  registerTriggerProvider(provider: TriggerProvider): void {
    this.triggerProviders.set(provider.id, provider);
  }

  unregisterTriggerProvider(id: string): void {
    this.triggerProviders.delete(id);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new MyPluginSettingTab(this.app, this));

    // ── Filtered Files Widget ───────────────────────────────────────────────────
    this.registerView(FFW_VIEW_TYPE, (leaf) => new FilteredFilesWidgetView(leaf, this));
    this.addRibbonIcon('file-sliders', 'Open filtered files widget', () => this.activateWidgetView());
    this.addCommand({
      id:       'ffc-open-filtered-files-widget',
      name:     'Open filtered files widget',
      callback: () => this.activateWidgetView(),
    });

    for (const cmd of this.settings.commands)      this.registerFilterCommand(cmd);
    for (const obj of this.settings.objectTypes) {
      this.registerObjectTypeCommand(obj);
      if (obj.enableFindCommand) this.registerFindCommand(obj);
    }
    this.registerNewObjectCommand();

    this.registerEditorSuggest(new ObjectTypeSuggest(this.app, this));

    // ── Object link styling ─────────────────────────────────────────────────────
    this.buildStyledObjectSet();

    this.previewPopup = new ObjectPreviewPopup(this);
    this.register(() => this.previewPopup.destroy());

    this.registerMarkdownPostProcessor((el) => {
      el.querySelectorAll('a.internal-link[data-href]').forEach((link) => {
        const href     = (link.getAttribute('data-href') ?? '').split('#')[0].trim();
        const basename = href.includes('/') ? href.split('/').pop() ?? href : href;
        if (this.styledObjectBasenames.has(href) || this.styledObjectBasenames.has(basename)) {
          link.classList.add('ffc-obj-link');
        }
        if (this.previewObjectBasenames.has(href) || this.previewObjectBasenames.has(basename)) {
          link.classList.add('ffc-obj-preview-link');
        }
      });
    });

    this.registerEditorExtension(buildObjectLinkViewPlugin(this));

    this.registerEvent(
      this.app.metadataCache.on('resolved', () => {
        this.buildStyledObjectSet();
        this.refreshObjectLinkStyles();
      })
    );

    // ── "Object from selection" context menu ────────────────────────────────────
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const selection = editor.getSelection()?.trim();
        if (!selection) return;
        const types = this.settings.objectTypes;
        if (types.length === 0) return;

        const from = editor.getCursor('from');
        const to   = editor.getCursor('to');

        menu.addItem((item) => {
          item.setTitle('Object from selection').setIcon('box-select');
          const submenu = (item as any).setSubmenu();
          for (const objType of types) {
            submenu.addItem((subItem: any) => {
              subItem.setTitle(objType.name)
                .onClick(() => {
                  const current = this.settings.objectTypes.find((o) => o.id === objType.id);
                  if (!current) { new Notice('Object type not found. Try reloading.'); return; }
                  new NewObjectModal(
                    this.app, current,
                    async (title, fv, desc) => {
                      editor.replaceRange(`[[${title}]]`, from, to);
                      await this.createObject(current, title, fv, desc);
                    },
                    selection,
                  ).open();
                });
            });
          }
        });
      })
    );

    // ── Canvas card menu buttons ────────────────────────────────────────────────
    this.injectCanvasButtons();
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        setTimeout(() => this.injectCanvasButtons(), 50);
      })
    );
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        setTimeout(() => this.injectCanvasButtons(), 50);
      })
    );
  }

  // ── Canvas card menu button ───────────────────────────────────────────────────

  injectCanvasButtons(): void {
    this.app.workspace.iterateAllLeaves((leaf) => this._injectIntoCanvasLeaf(leaf));
  }

  private _injectIntoCanvasLeaf(leaf: WorkspaceLeaf): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = leaf?.view as any;
    if (view?.getViewType?.() !== 'canvas') return;

    const container = view.containerEl as HTMLElement;
    const menuEl    = container.querySelector('.canvas-card-menu') as HTMLElement | null;
    if (!menuEl || menuEl.querySelector('.ffc-canvas-object-btn')) return;

    const canvas = view.canvas as ObsidianCanvas;

    const btn = menuEl.createEl('div', {
      cls: 'canvas-card-menu-button mod-draggable ffc-canvas-object-btn',
    });
    btn.setAttribute('aria-label', 'Add object card');
    btn.setAttribute('data-tooltip-position', 'top');
    const { setIcon } = require('obsidian');
    setIcon(btn, 'shapes');

    const wrapperEl = canvas.wrapperEl ?? canvas.canvasEl ?? container;

    btn.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const CARD_W = 300;
      const CARD_H = 160;

      let zoom = 1;
      const _wRect = wrapperEl.getBoundingClientRect();
      if (typeof canvas.getViewportBBox === 'function' && _wRect.width > 0) {
        const _bb = canvas.getViewportBBox();
        const _canvasW = _bb.maxX - _bb.minX;
        if (_canvasW > 0) zoom = _wRect.width / _canvasW;
      } else {
        const _z = canvas.zoom;
        if (typeof _z === 'number' && isFinite(_z) && _z > 0) zoom = _z;
      }

      const GHOST_W = CARD_W * zoom;
      const GHOST_H = CARD_H * zoom;

      const ghost = document.body.createEl('div', { cls: 'ffc-canvas-drop-ghost' });
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText =
        `width:${GHOST_W}px;height:${GHOST_H}px;` +
        `position:fixed;pointer-events:none;display:none;` +
        `transform:translate(-50%,-50%);`;

      const startX   = e.clientX;
      const startY   = e.clientY;
      let   dragging = false;

      const onMouseMove = (me: MouseEvent): void => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (!dragging && Math.sqrt(dx * dx + dy * dy) >= 5) {
          dragging = true;
          ghost.style.display = '';
          btn.classList.add('is-dragging');
        }
        if (dragging) {
          ghost.style.left = `${me.clientX}px`;
          ghost.style.top  = `${me.clientY}px`;
        }
      };

      const onMouseUp = (ue: MouseEvent): void => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);
        ghost.remove();
        btn.classList.remove('is-dragging');

        if (!dragging) {
          new CanvasObjectSwitcher(this.app, this, canvas, null).open();
          return;
        }

        const rect = wrapperEl.getBoundingClientRect();
        if (
          ue.clientX < rect.left || ue.clientX > rect.right ||
          ue.clientY < rect.top  || ue.clientY > rect.bottom
        ) return;

        let pos: { x: number; y: number };
        const relX = ue.clientX - rect.left;
        const relY = ue.clientY - rect.top;
        if (typeof canvas.getViewportBBox === 'function') {
          const bb = canvas.getViewportBBox();
          pos = {
            x: bb.minX + (relX / rect.width)  * (bb.maxX - bb.minX),
            y: bb.minY + (relY / rect.height) * (bb.maxY - bb.minY),
          };
        } else {
          const z = canvas.zoom ?? 1;
          pos = {
            x: (relX - (canvas.x ?? 0)) / z,
            y: (relY - (canvas.y ?? 0)) / z,
          };
        }

        new CanvasObjectSwitcher(this.app, this, canvas, pos).open();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);
    });
  }

  // ── Filtered Files Widget helpers ─────────────────────────────────────────────

  async activateWidgetView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(FFW_VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      const newLeaf = workspace.getLeftLeaf(false);
      if (newLeaf) {
        await newLeaf.setViewState({ type: FFW_VIEW_TYPE, active: true });
        leaf = newLeaf;
      }
    }
    if (leaf) await workspace.revealLeaf(leaf);
  }

  refreshWidgetViews(): void {
    this.app.workspace.getLeavesOfType(FFW_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof FilteredFilesWidgetView) leaf.view.render();
    });
  }

  // ── Filtered file commands ────────────────────────────────────────────────────

  registerFilterCommand(cmd: CommandSpec): void {
    if (this.registeredCommandIds.has(cmd.id)) return;
    const registered = this.addCommand({
      id: cmd.id,
      name: cmd.name,
      callback: () => {
        const current = this.settings.commands.find((c) => c.id === cmd.id);
        if (!current) { new Notice('Objects: Command not found. Try reloading.'); return; }
        const files = this.getFilteredFiles(current);
        if (files.length === 0) { new Notice('Objects: No files match the current filters.'); return; }
        new FilteredFileModal(this.app, files).open();
      },
    });
    this.commandRefs[cmd.id] = registered as CommandRef;
    this.registeredCommandIds.add(cmd.id);
  }

  getFilteredFiles(cmd: CommandSpec): TFile[] {
    const fileTypes = (cmd.fileTypes || '').split(',')
      .map((e) => e.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
    const allFiles = fileTypes.length > 0
      ? this.app.vault.getFiles().filter((f) => fileTypes.includes(f.extension.toLowerCase()))
      : this.app.vault.getMarkdownFiles();
    if (!cmd.filters || cmd.filters.length === 0) return allFiles;
    return allFiles.filter((file) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fm = (this.app.metadataCache.getFileCache(file) as any)?.frontmatter ?? {};
      const results = cmd.filters.map((f) => this.evaluateFilter(fm, f, file));
      return cmd.matchMode === 'all' ? results.every(Boolean) : results.some(Boolean);
    });
  }

  getObjectTypeFiles(obj: ObjectType): TFile[] {
    const filters  = obj.matchFilters ?? [];
    const matchMode = obj.matchMode ?? 'all';
    return this.app.vault.getMarkdownFiles().filter((file) => {
      if (filters.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fm = (this.app.metadataCache.getFileCache(file) as any)?.frontmatter ?? {};
        const results = filters.map((f) => this.evaluateFilter(fm, f, file));
        return matchMode === 'all' ? results.every(Boolean) : results.some(Boolean);
      } else if (obj.saveFolder?.trim()) {
        const prefix = obj.saveFolder.trim().replace(/\/$/, '') + '/';
        return file.path.startsWith(prefix);
      }
      return false;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluateFilter(fm: Record<string, any>, filter: { key: string; operator: string; value: string }, file?: TFile): boolean {
    const { key, operator, value } = filter;
    if (operator === 'in_folder' || operator === 'not_in_folder') {
      if (!file) return true;
      const folder   = value.trim().replace(/\/$/, '');
      const inFolder = file.path.startsWith(folder + '/') || file.path === folder;
      return operator === 'in_folder' ? inFolder : !inFolder;
    }
    if (!key?.trim()) return true;
    const raw = fm[key];
    switch (operator) {
      case 'exists':     return raw !== undefined && raw !== null && raw !== '';
      case 'equals':     return Array.isArray(raw) ? (raw as unknown[]).map(String).includes(value) : String(raw ?? '') === value;
      case 'not_equals': return Array.isArray(raw) ? !(raw as unknown[]).map(String).includes(value) : String(raw ?? '') !== value;
      case 'contains':   return Array.isArray(raw)
        ? (raw as unknown[]).some((v) => String(v).toLowerCase().includes(value.toLowerCase()))
        : String(raw ?? '').toLowerCase().includes(value.toLowerCase());
      default: return true;
    }
  }

  // ── Object type commands ──────────────────────────────────────────────────────

  registerObjectTypeCommand(obj: ObjectType): void {
    const cmdId = `ffc-objtype-${obj.commandSlug}`;
    if (this.registeredCommandIds.has(cmdId)) return;
    const registered = this.addCommand({
      id: cmdId,
      name: `Create new ${obj.name}`,
      callback: () => {
        const current = this.settings.objectTypes.find((o) => o.id === obj.id);
        if (!current) { new Notice('Object type not found. Try reloading.'); return; }
        new NewObjectModal(this.app, current, (title, fieldValues, description) =>
          this.createObject(current, title, fieldValues, description)
        ).open();
      },
    });
    this.commandRefs[cmdId] = registered as CommandRef;
    this.registeredCommandIds.add(cmdId);
  }

  registerFindCommand(obj: ObjectType): void {
    const cmdId = `ffc-objtype-${obj.commandSlug}-find`;
    if (this.registeredCommandIds.has(cmdId)) return;
    const registered = this.addCommand({
      id: cmdId,
      name: `Find ${obj.name}`,
      callback: () => {
        const current = this.settings.objectTypes.find((o) => o.id === obj.id);
        if (!current) { new Notice('Objects: Object type not found. Try reloading.'); return; }
        const files = this.getObjectTypeFiles(current);
        if (files.length === 0) { new Notice('Objects: No files match this object type.'); return; }
        new FilteredFileModal(this.app, files, current.name).open();
      },
    });
    this.commandRefs[cmdId] = registered as CommandRef;
    this.registeredCommandIds.add(cmdId);
  }

  private registerNewObjectCommand(): void {
    this.addCommand({
      id: 'ffc-new-object',
      name: 'New object',
      callback: () => {
        const types = this.settings.objectTypes;
        if (types.length === 0) {
          new Notice('No object types defined. Add one in the Objects settings.');
          return;
        }
        if (types.length === 1) {
          new NewObjectModal(this.app, types[0], (title, fv, desc) =>
            this.createObject(types[0], title, fv, desc)
          ).open();
          return;
        }
        new CombinedNewObjectModal(this.app, types, (objType, title, fv, desc) =>
          this.createObject(objType, title, fv, desc)
        ).open();
      },
    });
  }

  // ── File creation ─────────────────────────────────────────────────────────────

  async createObject(
    objType: ObjectType,
    title: string,
    fieldValues: Record<string, string> = {},
    description = '',
  ): Promise<void> {
    const saveFolder = objType.saveFolder?.trim() ?? '';
    const filePath   = saveFolder ? `${saveFolder}/${title}.md` : `${title}.md`;

    if (this.app.vault.getAbstractFileByPath(filePath)) {
      new Notice(`A file named "${title}" already exists at that location.`);
      return;
    }

    let content = '';
    if (objType.templatePath) {
      const tplFile = this.app.vault.getAbstractFileByPath(objType.templatePath);
      if (tplFile instanceof TFile) {
        content = await this.app.vault.read(tplFile);
      } else {
        new Notice(`Template not found: ${objType.templatePath}`);
      }
    }

    const now = new Date();
    content = content
      .replace(/\{\{title\}\}/gi, title)
      .replace(/\{\{date\}\}/gi, now.toISOString().split('T')[0])
      .replace(/\{\{time\}\}/gi, now.toTimeString().split(' ')[0]);

    content = this.injectFieldsIntoContent(content, objType, fieldValues);
    if (description.trim()) {
      content = this.appendDescriptionToContent(content, description.trim());
    }

    if (saveFolder && !this.app.vault.getAbstractFileByPath(saveFolder)) {
      try { await this.app.vault.createFolder(saveFolder); } catch { /* race: already exists */ }
    }

    try {
      const newFile = await this.app.vault.create(filePath, content);
      await this.app.workspace.getLeaf(false).openFile(newFile);
      new Notice(`Created: ${title}`);
    } catch (err) {
      new Notice(`Failed to create file: ${(err as Error).message}`);
    }
  }

  private injectFieldsIntoContent(
    content: string,
    objType: ObjectType,
    fieldValues: Record<string, string>,
  ): string {
    const fields = (objType.fields ?? []).filter((f) => f.key?.trim());
    if (fields.length === 0) return content;
    for (const field of fields) {
      const raw = (fieldValues[field.key] ?? '').trim();
      if (!raw) continue;
      if (field.type === 'list') {
        const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
        content = this.upsertListInFrontmatter(content, field.key, items);
      } else {
        content = this.upsertTextInFrontmatter(content, field.key, raw);
      }
    }
    return content;
  }

  private appendDescriptionToContent(content: string, description: string): string {
    const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/);
    if (fmMatch) {
      const fmEnd = fmMatch.index! + fmMatch[0].length;
      const body  = content.slice(fmEnd);
      if (body.trim()) {
        return content.trimEnd() + '\n\n' + description + '\n';
      } else {
        return content.slice(0, fmEnd) + '\n' + description + '\n';
      }
    } else {
      return content.trim() ? content.trimEnd() + '\n\n' + description + '\n' : description + '\n';
    }
  }

  private keyBlockRegex(esc: string): RegExp {
    return new RegExp(`^${esc}:[^\\n]*((?:\\r?\\n  - [^\\r\\n]*)*)`, 'm');
  }

  private upsertListInFrontmatter(content: string, key: string, newItems: string[]): string {
    if (!newItems.length) return content;
    content = this.ensureFrontmatter(content);
    const esc      = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const yamlItem = (i: string): string => /^\[\[.*\]\]$/.test(i) ? `"${i}"` : i;

    const inlineRe = new RegExp(`(^${esc}:\\s*\\[)([^\\]]*)(\\])`, 'm');
    if (inlineRe.test(content)) {
      return content.replace(inlineRe, (_, open, body, close) => {
        const existing = (body as string).split(',').map((s: string) => s.trim()).filter(Boolean);
        const merged   = [...new Set([...existing, ...newItems])];
        return `${open}${merged.map(yamlItem).join(', ')}${close}`;
      });
    }

    const blockRe = this.keyBlockRegex(esc);
    const m       = content.match(blockRe);
    if (m) {
      const blockPart = m[1];
      let existing: string[] = [];
      if (blockPart.trim()) {
        existing = [...blockPart.matchAll(/- ([^\r\n]+)/g)].map((x) => x[1].trim());
      } else {
        const scalarVal = m[0].replace(new RegExp(`^${esc}:\\s*`), '').trim();
        if (scalarVal) existing = [scalarVal];
      }
      const merged      = [...new Set([...existing, ...newItems])];
      const replacement = `${key}:\n` + merged.map((i) => `  - ${yamlItem(i)}`).join('\n');
      return content.replace(blockRe, replacement);
    }

    return content.replace(/^(---\r?\n)/, `$1${key}: [${newItems.map(yamlItem).join(', ')}]\n`);
  }

  private upsertTextInFrontmatter(content: string, key: string, value: string): string {
    content = this.ensureFrontmatter(content);
    const esc       = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const yamlValue = /^\[\[.*\]\]$/.test(value) ? `"${value}"` : value;
    const blockRe   = this.keyBlockRegex(esc);
    if (blockRe.test(content)) {
      return content.replace(blockRe, `${key}: ${yamlValue}`);
    }
    return content.replace(/^(---\r?\n)/, `$1${key}: ${yamlValue}\n`);
  }

  private ensureFrontmatter(content: string): string {
    if (/^---\r?\n/.test(content)) return content;
    return `---\n---\n\n${content}`;
  }

  // ── Template helpers ──────────────────────────────────────────────────────────

  private getTemplatesFolder(): string {
    if (this.settings.templatesFolder) return this.settings.templatesFolder;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (this.app as any).internalPlugins?.plugins?.['templates'];
      if (core?.enabled) return core.instance?.options?.folder ?? '';
    } catch { /* ignore */ }
    return '';
  }

  getTemplateFiles(): TFile[] {
    const folder = this.getTemplatesFolder();
    const allMd  = this.app.vault.getMarkdownFiles();
    if (!folder) return allMd;
    const prefix = folder.endsWith('/') ? folder : folder + '/';
    return allMd.filter((f) => f.path.startsWith(prefix));
  }

  // ── Persistence ───────────────────────────────────────────────────────────────

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as PluginSettings;
    if (!this.settings.objectTypes)                  this.settings.objectTypes = [];
    if (this.settings.templatesFolder === undefined)  this.settings.templatesFolder = '';
    if (this.settings.triggerKey === undefined)       this.settings.triggerKey = '';
    if (!Array.isArray(this.settings.ffwSections))   this.settings.ffwSections = [];
    if (this.settings.ffwDisplayNameKey === undefined) this.settings.ffwDisplayNameKey = '';

    this.settings.ffwSections = this.settings.ffwSections.filter((s) =>
      s && typeof s === 'object' &&
      typeof s.id === 'string' && typeof s.title === 'string' &&
      Array.isArray(s.filters) && !!s.sort
    );

    const takenSlugs = new Set(
      this.settings.objectTypes.filter((o) => o.commandSlug).map((o) => o.commandSlug)
    );

    let needsSave = false;
    for (const obj of this.settings.objectTypes) {
      if (!obj.fields)                           { obj.fields = [];         needsSave = true; }
      if (!obj.matchFilters)                     { obj.matchFilters = [];   needsSave = true; }
      if (!obj.matchMode)                        { obj.matchMode = 'all';   needsSave = true; }
      if (obj.enableFindCommand === undefined)   { obj.enableFindCommand = false; needsSave = true; }
      if (obj.showInTriggerMenu === undefined)   { obj.showInTriggerMenu = false; needsSave = true; }
      if (obj.styledLinks === undefined)         { obj.styledLinks = false; needsSave = true; }
      if (!obj.previewFields)                    { obj.previewFields = [];  needsSave = true; }
      if (!obj.canvasFields)                     { obj.canvasFields = [];   needsSave = true; }
      if (!obj.imageKey)                         { obj.imageKey = '';       needsSave = true; }
      if (obj.showImageInPreview === undefined)  { obj.showImageInPreview = false; needsSave = true; }
      if (obj.showImageInCanvas  === undefined)  { obj.showImageInCanvas  = false; needsSave = true; }

      if (!obj.commandSlug) {
        const base = nameToCommandSlug(obj.name);
        let slug = base; let n = 2;
        while (takenSlugs.has(slug)) slug = `${base}-${n++}`;
        obj.commandSlug = slug;
        takenSlugs.add(slug);
        needsSave = true;
      }
    }

    if (needsSave) await this.saveSettings();
  }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }

  // ── Object link styling ───────────────────────────────────────────────────────

  buildStyledObjectSet(): void {
    this.styledObjectBasenames  = new Set();
    this.styledObjectPaths      = new Set();
    this.previewObjectBasenames = new Set();
    this.previewObjectPaths     = new Set();
    for (const objType of this.settings.objectTypes) {
      const hasPreview = (objType.previewFields ?? []).length > 0;
      if (!objType.styledLinks && !hasPreview) continue;
      for (const file of this.getObjectTypeFiles(objType)) {
        if (objType.styledLinks) {
          this.styledObjectBasenames.add(file.basename);
          this.styledObjectPaths.add(file.path);
        }
        if (hasPreview) {
          this.previewObjectBasenames.add(file.basename);
          this.previewObjectPaths.add(file.path);
        }
      }
    }
  }

  refreshObjectLinkStyles(): void {
    document.querySelectorAll('a.internal-link[data-href]').forEach((link) => {
      const href      = (link.getAttribute('data-href') ?? '').split('#')[0].trim();
      const basename  = href.includes('/') ? href.split('/').pop() ?? href : href;
      const isStyled  = this.styledObjectBasenames.has(href)  || this.styledObjectBasenames.has(basename);
      const isPreview = this.previewObjectBasenames.has(href)  || this.previewObjectBasenames.has(basename);
      (link as HTMLElement).classList.toggle('ffc-obj-link',         isStyled);
      (link as HTMLElement).classList.toggle('ffc-obj-preview-link', isPreview);
    });
  }
}

export default FilteredFileCommandsPlugin;
