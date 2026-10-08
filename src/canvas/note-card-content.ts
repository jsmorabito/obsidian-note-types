import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import type { NoteType } from '../types.ts';
import { resolveLinktext } from '../relations.ts';
import { stringifyFrontmatterValue } from '../utils/helpers.ts';
import { displayValue } from './field-format.ts';

const IMAGE_RE = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;

/**
 * The colour a note type gives its links (**Link color** with **Style note links** on), or undefined. A type with
 * styled links off has uncoloured links, and its cards stay neutral to match.
 */
export function typeLinkColor(type: NoteType): string | undefined {
  return type.styledLinks ? type.linkColor?.trim() || undefined : undefined;
}

/** Where the card's key image came from: the type's image property, or the note body. */
export interface KeyImage {
  src: string;
  via: 'property' | 'body';
}

/** A property shown under the title: the label (or key) and its value. */
export interface CardField {
  label: string;
  value: string;
}

export interface CardContent {
  title: string;
  image: KeyImage | null;
  fields: CardField[];
}

function resolveImage(app: App, ref: string, fromPath: string): string | null {
  const value = ref.trim();
  if (/^https?:\/\//i.test(value)) return value;
  let path = value.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
  try { path = decodeURIComponent(path); } catch { /* keep as written */ }
  const file = app.metadataCache.getFirstLinkpathDest(path, fromPath);
  return file ? app.vault.getResourcePath(file) : null;
}

/**
 * The key image: the type's `imageKey` property when set, else the first image
 * in the note's first paragraph after the frontmatter.
 */
function findKeyImage(app: App, file: TFile, type: NoteType, fm: Record<string, unknown> | undefined, firstBlock: string): KeyImage | null {
  const key = type.imageKey?.trim();
  const raw = key ? fm?.[key] : undefined;
  if (raw) {
    const text = stringifyFrontmatterValue(raw).trim();
    const src = /^https?:\/\//i.test(text)
      ? text
      : (() => { const f = resolveLinktext(app, raw, file.path); return f ? app.vault.getResourcePath(f) : null; })();
    if (src) return { src, via: 'property' };
  }
  IMAGE_RE.lastIndex = 0;
  const m = IMAGE_RE.exec(firstBlock);
  const src = m ? resolveImage(app, m[1] ?? m[2] ?? '', file.path) : null;
  return src ? { src, via: 'body' } : null;
}

export async function readCardContent(app: App, file: TFile, type: NoteType): Promise<CardContent> {
  const cache = app.metadataCache.getFileCache(file);
  const text = await app.vault.cachedRead(file);
  const body = text.slice(cache?.frontmatterPosition?.end.offset ?? 0).replace(/^\s+/, '');
  const split = body.search(/\n\s*\n/);
  const firstBlock = split === -1 ? body : body.slice(0, split);
  const frontmatter = cache?.frontmatter;
  const fields = (type.canvasFields ?? []).flatMap((f): CardField[] => {
    const key = f.key?.trim();
    const value = key ? displayValue(frontmatter?.[key]) : '';
    return value ? [{ label: f.label?.trim() || key, value }] : [];
  });
  return { title: file.basename, image: findKeyImage(app, file, type, frontmatter, firstBlock), fields };
}

/** Fill `card` (cleared first) with the key image, if any, the title, and the type's configured properties. */
export function renderCard(card: HTMLElement, content: CardContent): void {
  card.empty();
  if (content.image) card.createEl('img', { cls: 'ffc-note-card-img', attr: { src: content.image.src, alt: '' } });
  card.createDiv({ cls: 'ffc-note-card-title', text: content.title });
  if (content.fields.length === 0) return;
  const fields = card.createDiv({ cls: 'ffc-note-card-fields' });
  for (const field of content.fields) {
    const row = fields.createDiv({ cls: 'ffc-note-card-field' });
    row.createSpan({ cls: 'ffc-note-card-field-label', text: field.label });
    row.createSpan({ cls: 'ffc-note-card-field-value', text: field.value });
  }
}

/**
 * Fill `pill` with the note as a styled link: the same pill the editor and reading
 * view draw. It is rendered as a real `[[link]]` so this plugin's own link processing
 * gives it the note type's colour, icon and status, and the two can never drift apart.
 */
export async function renderLinkPill(app: App, pill: HTMLElement, file: TFile, owner: Component): Promise<void> {
  pill.empty();
  const body = pill.createDiv({ cls: 'markdown-rendered ffc-link-pill-body' });
  await MarkdownRenderer.render(app, `[[${app.metadataCache.fileToLinktext(file, '', true)}]]`, body, '', owner);
}
