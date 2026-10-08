import { Menu, Notice, TFile, setIcon } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteType } from '../types.ts';
import { CanvasLike, CanvasNodeLike, nodeBox } from './adapter.ts';
import { SideEffect, batchWithEffect } from './undo-journal.ts';
import { SIZE_NOTE_CARD } from './constants.ts';
import { addKeyImage, removeKeyImage, replaceKeyImage } from './key-image-text.ts';
import { noteRefFor } from './relation-logic.ts';

const BUTTON_CLASS = 'ffc-key-image-btn';
const IMAGE_URL_RE = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?\S*)?$/i;

export type ImageSource = { kind: 'file'; file: File } | { kind: 'url'; url: string };

/** An image file or image URL from a drop, or null. */
export function imageFromDrop(dt: DataTransfer | null): ImageSource | null {
  if (!dt) return null;
  const file = Array.from(dt.files).find((f) => f.type.startsWith('image/'));
  if (file) return { kind: 'file', file };
  const url = (dt.getData('text/uri-list') || dt.getData('text/plain')).split('\n')[0]?.trim() ?? '';
  return IMAGE_URL_RE.test(url) ? { kind: 'url', url } : null;
}

function chooseImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = createEl('input', { type: 'file', attr: { accept: 'image/*' } });
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Escape spaces and parentheses so a source stays one piece inside `![](…)`. */
function escapeSource(src: string): string {
  return src.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

interface Prepared {
  /** Markup for the note body. */
  markup: string;
  /** Value for the type's image property. */
  property: string;
  /** What the card's <img> will load, for measuring. */
  src: string;
}

/** Write the file before anything points at it, so a card never shows a missing image. */
async function prepare(plugin: FilteredFileCommandsPlugin, note: TFile, source: ImageSource): Promise<Prepared> {
  const { app } = plugin;
  if (source.kind === 'url') {
    return { markup: `![](${escapeSource(source.url)})`, property: source.url, src: source.url };
  }
  const path = await app.fileManager.getAvailablePathForAttachment(source.file.name, note.path);
  const saved = await app.vault.createBinary(path, await source.file.arrayBuffer());
  const link = app.fileManager.generateMarkdownLink(saved, note.path);
  return {
    markup: link.startsWith('!') ? link : `!${link}`,
    property: `[[${app.metadataCache.fileToLinktext(saved, note.path, true)}]]`,
    src: app.vault.getResourcePath(saved),
  };
}

function measure(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), 3000);
    img.onload = () => { window.clearTimeout(timer); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { window.clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

/** The note card's own layout, read from the rendered card so it can't drift from the stylesheet. */
interface CardMetrics {
  /** Left plus right padding. */
  padding: number;
  /** Gap between the image and the title. */
  gap: number;
  /** Tallest the image may render (`--ffc-card-image-max`). */
  maxImage: number;
}

/** Null when the node isn't showing as a card (the full embed has no key image to size for). */
function cardMetrics(node: CanvasNodeLike): CardMetrics | null {
  const card = node.nodeEl?.querySelector<HTMLElement>('.ffc-note-card');
  if (!card) return null;
  const style = card.win.getComputedStyle(card);
  return {
    padding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
    gap: parseFloat(style.rowGap) || 0,
    maxImage: parseFloat(style.getPropertyValue('--ffc-card-image-max')) || Infinity,
  };
}

/** Height the image takes in a card of `cardWidth`: full width, capped, never past its natural height. */
function renderedHeight(natural: { width: number; height: number } | null, cardWidth: number, m: CardMetrics): number {
  if (!natural || natural.width === 0) return 0;
  const scaled = natural.height * ((cardWidth - m.padding) / natural.width);
  return Math.round(Math.min(m.maxImage, natural.height, scaled)) + m.gap;
}

/** What the card's image takes right now, read from the rendered card. */
function currentContribution(node: CanvasNodeLike, m: CardMetrics): number {
  const img = node.nodeEl?.querySelector<HTMLElement>('.ffc-note-card-img');
  return img ? img.offsetHeight + m.gap : 0;
}

/** Resize a card whose image went from taking `before` to taking `after` of its height. Call inside a batch. */
function resizeBy(node: CanvasNodeLike, before: number, after: number): void {
  const box = nodeBox(node);
  if (!box || before === after) return;
  const height = Math.max(SIZE_NOTE_CARD.height, Math.round(box.height - before + after));
  node.moveAndResize?.({ ...box, height });
}

/**
 * The note side of a key image change, for undo: put the note's text back to
 * what it was, but only while it is still exactly what we wrote, so an edit made
 * since is never overwritten. (The saved image file is kept either way.)
 */
function noteTextEffect(plugin: FilteredFileCommandsPlugin, file: TFile, before: string, after: string): SideEffect | null {
  if (before === after) return null;
  const swap = async (from: string, to: string, done: string): Promise<void> => {
    let swapped = true;
    await plugin.app.vault.process(file, (current) => {
      if (current !== from) { swapped = false; return current; }
      return to;
    });
    new Notice(swapped ? done : 'The note changed since, so its key image was left as it is.');
  };
  return {
    files: [file],
    undo: () => swap(after, before, `Reverted the key image in ${file.basename}.`),
    redo: () => swap(before, after, `Reapplied the key image in ${file.basename}.`),
  };
}

/**
 * Add or replace the key image. The type's image property wins when it has one; otherwise the note body.
 * The canvas undo step covers the card's resize and, through the journal, the note edit.
 */
export async function setKeyImage(
  plugin: FilteredFileCommandsPlugin, canvas: CanvasLike, node: CanvasNodeLike, source: ImageSource,
): Promise<void> {
  const ref = noteRefFor(plugin, node);
  if (!ref) return;
  try {
    const metrics = cardMetrics(node);
    const before = metrics ? currentContribution(node, metrics) : 0;
    const via = node.nodeEl?.getAttribute('data-ffc-key-image');
    const prepared = await prepare(plugin, ref.file, source);
    const effect = await write(plugin, ref.file, ref.type, via ? 'replace' : 'add', prepared);
    const after = metrics
      ? renderedHeight(await measure(prepared.src), nodeBox(node)?.width ?? SIZE_NOTE_CARD.width, metrics)
      : before;
    // Always record a history entry, even when the card doesn't change size, so undo has something to hang the note edit on.
    batchWithEffect(canvas, effect, () => resizeBy(node, before, after));
  } catch (err) {
    new Notice(`Could not set the key image: ${(err as Error).message}`);
  }
}

export async function removeKeyImageFrom(
  plugin: FilteredFileCommandsPlugin, canvas: CanvasLike, node: CanvasNodeLike,
): Promise<void> {
  const ref = noteRefFor(plugin, node);
  if (!ref) return;
  try {
    const metrics = cardMetrics(node);
    const before = metrics ? currentContribution(node, metrics) : 0;
    const effect = await write(plugin, ref.file, ref.type, 'remove');
    batchWithEffect(canvas, effect, () => resizeBy(node, before, 0));
  } catch (err) {
    new Notice(`Could not remove the key image: ${(err as Error).message}`);
  }
}

/** Edit the note and return how to undo it (null when nothing changed). */
async function write(
  plugin: FilteredFileCommandsPlugin, file: TFile, type: NoteType, mode: 'add' | 'replace' | 'remove', prepared?: Prepared,
): Promise<SideEffect | null> {
  const { app } = plugin;
  const before = await app.vault.read(file);
  const key = type.imageKey?.trim();
  if (key) {
    await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (mode === 'remove') delete fm[key];
      else fm[key] = prepared?.property;
    });
  } else {
    await app.vault.process(file, (text) => {
      if (mode === 'remove') return removeKeyImage(text);
      const markup = prepared?.markup ?? '';
      return mode === 'replace' ? replaceKeyImage(text, markup) : addKeyImage(text, markup);
    });
  }
  return noteTextEffect(plugin, file, before, await app.vault.read(file));
}

/**
 * "Add key image" (or "Replace / Remove" when the note has one) in the
 * selection pop-up menu of a single selected note card. Obsidian rebuilds the
 * menu on every selection change; between rebuilds this keeps the button in
 * step with whether the note has an image yet.
 */
export function injectKeyImageButton(plugin: FilteredFileCommandsPlugin, canvas: CanvasLike, selected: CanvasNodeLike[]): void {
  const menuEl = canvas.menu?.menuEl;
  if (!menuEl) return;
  const node = selected.length === 1 ? selected[0] : null;
  if (!node || !node.nodeEl?.hasAttribute('data-ffc-note-type') || !noteRefFor(plugin, node)) return;
  // A styled link has no image to show, so there is nothing to add or replace.
  if (node.nodeEl.getAttribute('data-ffc-view') === 'link') return;

  const hasImage = (): boolean => node.nodeEl?.hasAttribute('data-ffc-key-image') ?? false;
  let btn = menuEl.querySelector<HTMLElement>(`.${BUTTON_CLASS}`);
  if (!btn) {
    btn = menuEl.createEl('button', { cls: `clickable-icon ${BUTTON_CLASS}`, attr: { 'data-tooltip-position': 'top' } });
    const choose = async (): Promise<void> => {
      const file = await chooseImageFile();
      if (file) await setKeyImage(plugin, canvas, node, { kind: 'file', file });
    };
    btn.addEventListener('click', (e) => {
      if (!hasImage()) { void choose(); return; }
      const menu = new Menu();
      menu.addItem((item) => item.setTitle('Replace key image…').setIcon('image-up').onClick(() => { void choose(); }));
      menu.addItem((item) => item.setTitle('Remove key image').setIcon('image-off').onClick(() => {
        void removeKeyImageFrom(plugin, canvas, node);
      }));
      menu.showAtMouseEvent(e);
    });
  }
  const has = hasImage();
  if (btn.dataset.has !== String(has)) {
    btn.dataset.has = String(has);
    btn.setAttribute('aria-label', has ? 'Key image' : 'Add key image');
    btn.empty();
    setIcon(btn, has ? 'image' : 'image-plus');
  }
}
