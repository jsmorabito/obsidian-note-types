import { App, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { NoteType } from '../types.ts';

/**
 * Shows a hover card when the user hovers over a note link.
 * Works in both reading mode (<a class="internal-link">) and live-preview (CM6).
 */
export class NotePreviewPopup {
  private plugin: FilteredFileCommandsPlugin;
  private popup: HTMLElement | null        = null;
  private hideTimer: number | null = null;
  private showTimer: number | null = null;
  private _currentFile: TFile | null       = null;

  private readonly _onMouseOver: (e: MouseEvent) => void;
  private readonly _onMouseOut:  (e: MouseEvent) => void;

  constructor(plugin: FilteredFileCommandsPlugin) {
    this.plugin = plugin;

    this._onMouseOver = (e) => this._handleMouseOver(e);
    this._onMouseOut  = (e) => this._handleMouseOut(e);
    document.addEventListener('mouseover', this._onMouseOver, true);
    document.addEventListener('mouseout',  this._onMouseOut,  true);

    const leafChangeRef = plugin.app.workspace.on('active-leaf-change', () => this.hide());
    plugin.registerEvent(leafChangeRef);
  }

  // ── Mouse event handlers ──────────────────────────────────────────────────────

  private _handleMouseOver(e: MouseEvent): void {
    if (this.popup && this.popup.contains(e.target as Node)) return;
    const el = e.target as Element;
    let linkpath: string | null = null;

    const anchor = el.matches('a.internal-link[data-href]')
      ? el as HTMLAnchorElement
      : el.closest('a.internal-link[data-href]');
    if (anchor) {
      linkpath = (anchor.getAttribute('data-href') ?? '').split('#')[0].trim();
    }

    if (!linkpath) {
      const cmSpan = el.classList.contains('cm-hmd-internal-link')
        ? el
        : el.closest('.cm-hmd-internal-link');
      if (cmSpan) {
        linkpath = (cmSpan.textContent ?? '')
          .replace(/^\[\[/, '').replace(/\]\]$/, '')
          .split('|')[0].split('#')[0].trim();
      }
    }

    if (!linkpath) return;

    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, '');
    if (!file) return;

    const noteType = this._getNoteTypeForFile(file);
    if (!noteType) return;

    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    if (this.showTimer) window.clearTimeout(this.showTimer);
    if (this.popup && this._currentFile === file) return;

    const triggerEl = (anchor ?? el.closest('.cm-hmd-internal-link')) as HTMLElement | null;
    this.showTimer = window.setTimeout(() => {
      void this._showForFile(file, noteType, e.clientX, e.clientY, triggerEl);
    }, 280);
  }

  private _handleMouseOut(e: MouseEvent): void {
    if (this.showTimer) window.clearTimeout(this.showTimer);
    const toEl = e.relatedTarget as Node | null;
    if (this.popup && toEl && this.popup.contains(toEl)) return;
    this.hideTimer = window.setTimeout(() => this.hide(), 200);
  }

  // ── Build and position the popup ──────────────────────────────────────────────

  private async _showForFile(
    file: TFile,
    noteType: NoteType,
    clientX: number,
    clientY: number,
    triggerEl: HTMLElement | null,
  ): Promise<void> {
    const hasFields = (noteType.previewFields?.length ?? 0) > 0;
    const hasImage  = !!(noteType.showImageInPreview && noteType.imageKey);
    if (!hasFields && !hasImage) return;

    const app = this.plugin.app;
    const fm    = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const title = fm['title'] ? String(fm['title']) : file.basename;

    this.hide();

    const popup = createDiv();
    popup.className = 'ffc-preview-popup';

    if (hasImage && noteType.imageKey) {
      const rawImg = fm[noteType.imageKey] as string | undefined;
      const imgSrc = rawImg ? await this._resolveImageSrc(String(rawImg).trim(), app) : null;
      if (imgSrc) {
        const imgEl = popup.createEl('img', { cls: 'ffc-preview-image' });
        imgEl.src = imgSrc;
        imgEl.alt = title;
      }
    }

    const header = popup.createDiv({ cls: 'ffc-preview-header' });
    header.createSpan({ text: title, cls: 'ffc-preview-title' });
    popup.createEl('hr', { cls: 'ffc-preview-divider' });

    const body    = popup.createDiv({ cls: 'ffc-preview-body' });
    let   hasRows = false;

    const renderValue = (valueEl: HTMLElement, str: unknown): void => {
      const wikiMatch = String(str).match(/^\[\[(.+?)(?:\|(.+?))?\]\]$/);
      if (wikiMatch) {
        const linkPath  = wikiMatch[1];
        const linkLabel = wikiMatch[2] || wikiMatch[1];
        const a = valueEl.createEl('a', { text: linkLabel, cls: 'ffc-preview-wikilink internal-link' });
        a.dataset['href'] = linkPath;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.hide();
          void app.workspace.openLinkText(linkPath, '', false);
        });
      } else {
        valueEl.appendText(String(str));
      }
    };

    for (const pf of (noteType.previewFields ?? [])) {
      const key   = typeof pf === 'string' ? pf : (pf.key ?? '');
      const label = (typeof pf === 'string' ? pf : (pf.label || pf.key)) || key;
      if (!key) continue;
      const raw: unknown = fm[key];
      if (raw === undefined || raw === null || raw === '') continue;

      const row = body.createDiv({ cls: 'ffc-preview-row' });
      row.createSpan({ text: label, cls: 'ffc-preview-label' });
      const valueEl = row.createSpan({ cls: 'ffc-preview-value' });
      if (Array.isArray(raw)) {
        (raw as unknown[]).forEach((item, i) => {
          if (i > 0) valueEl.appendText(', ');
          renderValue(valueEl, item);
        });
      } else {
        renderValue(valueEl, raw);
      }
      hasRows = true;
    }

    if (!hasRows) {
      body.remove();
      popup.querySelector('.ffc-preview-divider')?.remove();
    }

    document.body.appendChild(popup);
    this.popup        = popup;
    this._currentFile = file;

    popup.addEventListener('mouseenter', () => { if (this.hideTimer) window.clearTimeout(this.hideTimer); });
    popup.addEventListener('mouseleave', () => {
      this.hideTimer = window.setTimeout(() => this.hide(), 200);
    });

    popup.addEventListener('click', (e) => {
      if ((e.target as Element).closest('.ffc-preview-wikilink')) return;
      const fileToOpen = this._currentFile;
      this.hide();
      if (fileToOpen) {
        const newLeaf: boolean | 'tab' = e.metaKey || e.ctrlKey ? 'tab' : false;
        void this.plugin.app.workspace.openLinkText(fileToOpen.basename, '', newLeaf);
      }
    });

    const margin = 12;
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;

    const positionPopup = (): void => {
      if (!this.popup) return;
      const pw = popup.offsetWidth  || 280;
      const ph = popup.offsetHeight || 120;
      let left: number, top: number;

      const r = triggerEl ? triggerEl.getBoundingClientRect() : null;
      if (r && (r.width > 0 || r.height > 0)) {
        left = r.left;
        top  = r.bottom + 6;
        if (top  + ph > vh - margin) top  = r.top - ph - 6;
        if (left + pw > vw - margin) left = vw - margin - pw;
      } else {
        left = clientX + margin;
        top  = clientY + margin;
        if (left + pw > vw - margin) left = clientX - pw - margin;
        if (top  + ph > vh - margin) top  = clientY - ph - margin;
      }
      popup.style.left = `${Math.max(margin, left)}px`;
      popup.style.top  = `${Math.max(margin, top)}px`;
    };
    window.requestAnimationFrame(positionPopup);
  }

  private async _resolveImageSrc(rawValue: string, app: App): Promise<string | null> {
    if (!rawValue) return null;
    const v = rawValue.trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    const linkPath  = v.replace(/^\[\[/, '').replace(/\]\]$/, '');
    const imageFile = app.metadataCache.getFirstLinkpathDest(linkPath, '');
    if (imageFile) return app.vault.getResourcePath(imageFile);
    return null;
  }

  private _getNoteTypeForFile(file: TFile): NoteType | null {
    for (const noteType of this.plugin.settings.noteTypes) {
      const hasContent = (noteType.previewFields?.length ?? 0) > 0 ||
                         (noteType.showImageInPreview && noteType.imageKey);
      if (!hasContent) continue;
      const files = this.plugin.getNoteTypeFiles(noteType);
      if (files.some((f) => f.path === file.path)) return noteType;
    }
    return null;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  hide(): void {
    if (this.popup) { this.popup.remove(); this.popup = null; }
    this._currentFile = null;
  }

  destroy(): void {
    this.hide();
    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    if (this.showTimer) window.clearTimeout(this.showTimer);
    document.removeEventListener('mouseover', this._onMouseOver, true);
    document.removeEventListener('mouseout',  this._onMouseOut,  true);
  }
}
