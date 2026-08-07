import { App, FuzzySuggestModal, Notice, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { NoteType } from '../types.ts';
import { stringifyFrontmatterValue } from '../utils/helpers.ts';

interface CanvasItem {
  file: TFile;
  noteType: NoteType;
}

// Minimal interface for the undocumented Obsidian Canvas API
interface ObsidianCanvas {
  createTextNode: (opts: { pos: { x: number; y: number }; size: { width: number; height: number }; text: string; focus: boolean; save: boolean }) => unknown;
  deselectAll?: () => void;
  selectOnly?: (node: unknown) => void;
  getViewportBBox?: () => { minX: number; maxX: number; minY: number; maxY: number };
  zoom?: number;
  x?: number;
  y?: number;
  wrapperEl?: HTMLElement;
  canvasEl?: HTMLElement;
  containerEl?: HTMLElement;
}

/**
 * Fuzzy quick-switcher that searches across all note files from every note
 * type. Selecting a file creates a canvas text node using that type's configured
 * canvasFields.
 */
export class CanvasNoteSwitcher extends FuzzySuggestModal<CanvasItem> {
  private plugin: FilteredFileCommandsPlugin;
  private canvas: ObsidianCanvas;
  private dropPos: { x: number; y: number } | null;
  private _items: CanvasItem[];

  constructor(
    app: App,
    plugin: FilteredFileCommandsPlugin,
    canvas: ObsidianCanvas,
    dropPos: { x: number; y: number } | null,
  ) {
    super(app);
    this.plugin  = plugin;
    this.canvas  = canvas;
    this.dropPos = dropPos;

    this.setPlaceholder('Search notes…');
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵',  purpose: 'add to canvas' },
      { command: 'esc', purpose: 'dismiss' },
    ]);

    const seen = new Set<string>();
    this._items = [];
    for (const noteType of plugin.settings.noteTypes) {
      for (const file of plugin.getNoteTypeFiles(noteType)) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        this._items.push({ file, noteType });
      }
    }
  }

  getItems(): CanvasItem[] { return this._items; }

  getItemText({ file, noteType }: CanvasItem): string {
    const fm    = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const title = fm['title'] ? String(fm['title']) : file.basename;
    return `${title} ${file.basename} ${noteType.name}`;
  }

  renderSuggestion({ item: { file, noteType } }: { item: CanvasItem }, el: HTMLElement): void {
    const fm    = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const title = fm['title'] ? String(fm['title']) : file.basename;
    el.createSpan({ text: title,        cls: 'suggestion-title' });
    el.createSpan({ text: noteType.name, cls: 'suggestion-note'  });
  }

  onChooseItem({ file, noteType }: CanvasItem): void {
    this._createCanvasCard(file, noteType);
  }

  private _createCanvasCard(file: TFile, noteType: NoteType): void {
    const fm           = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const title        = fm['title'] ? stringifyFrontmatterValue(fm['title']) : file.basename;
    const canvasFields = noteType.canvasFields ?? [];

    let imageEmbed = '';
    if (noteType.showImageInCanvas && noteType.imageKey) {
      const rawImg: unknown = fm[noteType.imageKey];
      if (rawImg) {
        const v = stringifyFrontmatterValue(rawImg).trim();
        if (/^https?:\/\//i.test(v)) {
          imageEmbed = `![](${v})\n`;
        } else {
          const inner = v.replace(/^\[\[/, '').replace(/\]\]$/, '');
          imageEmbed = `![[${inner}]]\n`;
        }
      }
    }

    let text = `${imageEmbed}**${title}**`;
    for (const pf of canvasFields) {
      const key   = typeof pf === 'string' ? pf : (pf.key   ?? '');
      const label = typeof pf === 'string' ? pf : (pf.label || pf.key || key);
      if (!key) continue;
      const raw: unknown = fm[key];
      if (raw === undefined || raw === null || raw === '') continue;
      const displayVal = Array.isArray(raw) ? (raw as unknown[]).map(stringifyFrontmatterValue).join(', ') : stringifyFrontmatterValue(raw);
      text += `\n${label}: ${displayVal}`;
    }
    text += `\n\n[[${file.basename}]]`;

    const pos        = this.dropPos ?? this._getViewportCenter();
    const imageExtra = imageEmbed ? 200 : 0;
    const size = { width: 300, height: Math.max(160, 60 + canvasFields.length * 28 + imageExtra) };

    try {
      const node = this.canvas.createTextNode({
        pos:  { x: pos.x - size.width / 2, y: pos.y - size.height / 2 },
        size,
        text,
        focus: false,
        save:  true,
      });
      this.canvas.deselectAll?.();
      if (node) this.canvas.selectOnly?.(node);
      new Notice(`Added "${title}" to canvas`);
    } catch (err) {
      new Notice(`Could not add card to canvas: ${(err as Error).message}`);
    }
  }

  private _getViewportCenter(): { x: number; y: number } {
    try {
      const c = this.canvas;
      if (typeof c.getViewportBBox === 'function') {
        const bb = c.getViewportBBox();
        return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
      }
      const el   = c.wrapperEl ?? c.canvasEl ?? c.containerEl;
      const rect = el?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const zoom = c.zoom ?? 1;
      return {
        x: (rect.width  / 2 - (c.x ?? 0)) / zoom,
        y: (rect.height / 2 - (c.y ?? 0)) / zoom,
      };
    } catch { return { x: 0, y: 0 }; }
  }
}

export type { ObsidianCanvas };
