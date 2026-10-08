import { Component, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteType } from '../types.ts';
import { CanvasLike, CanvasNodeLike, batch, getExtra, nodeBox, patchData } from './adapter.ts';
import { FIELD_CARD_SIZE, SIZE_NOTE_CARD } from './constants.ts';
import { readCardContent, renderCard, renderLinkPill, typeLinkColor } from './note-card-content.ts';

/** The label an earlier version added in place of Obsidian's own; removed if one is left over. */
const LEGACY_LABEL_CLASS = 'ffc-node-label';
const CARD_CLASS   = 'ffc-note-card';
const PILL_CLASS   = 'ffc-link-pill';

/** Extension field on a file node: `"embed"` or `"link"`. Absent means card. */
export const FIELD_VIEW = 'ffcView';
export type ViewMode = 'card' | 'embed' | 'link';

/** What was last drawn into a node's card or link, so an unchanged note isn't re-rendered every sweep. */
const drawn = new WeakMap<CanvasNodeLike, { key: string }>();

/** Owns the markdown renderers behind styled links; set by each canvas's controller. */
const owners = new WeakMap<CanvasLike, Component>();
export function setCardOwner(canvas: CanvasLike, owner: Component | null): void {
  if (owner) owners.set(canvas, owner);
  else owners.delete(canvas);
}

/** File node → its note, when it points at a markdown note. */
export function noteOfNode(node: CanvasNodeLike): TFile | null {
  const file = node.file;
  return file && file.extension === 'md' ? file : null;
}

export function viewOf(node: CanvasNodeLike): ViewMode {
  const v = getExtra(node, FIELD_VIEW);
  return v === 'embed' ? 'embed' : v === 'link' ? 'link' : 'card';
}

/** Card, then the full embed, then the styled link, then back to the card. */
const NEXT: Record<ViewMode, ViewMode> = { card: 'embed', embed: 'link', link: 'card' };

/** The tooltip and icon for the button that moves a card to its next view: they describe where it will go. */
const NEXT_LABEL: Record<ViewMode, { label: string; icon: string }> = {
  embed: { label: 'Show as embed', icon: 'file-text' },
  link: { label: 'Show as styled link', icon: 'link' },
  card: { label: 'Show as card', icon: 'sticky-note' },
};

/** What to show on the toggle for nodes in these views: the next view's label, or a general one when they differ. */
export function toggleInfo(modes: ViewMode[]): { label: string; icon: string } {
  const first = modes[0];
  return first !== undefined && modes.every((m) => m === first)
    ? NEXT_LABEL[NEXT[first]]
    : { label: 'Change view', icon: 'repeat' };
}

function readCardSize(node: CanvasNodeLike): { width: number; height: number } | null {
  const v = getExtra(node, FIELD_CARD_SIZE) as { width?: unknown; height?: unknown } | undefined;
  return v && typeof v.width === 'number' && typeof v.height === 'number' && v.width > 0 && v.height > 0
    ? { width: v.width, height: v.height }
    : null;
}

/**
 * Move note cards to their next view, as one undo step. Entering the styled link
 * view remembers the node's size, because the node then shrinks to fit the link;
 * leaving it gives that size back.
 */
export function toggleViews(canvas: CanvasLike, nodes: CanvasNodeLike[]): void {
  if (nodes.length === 0) return;
  batch(canvas, () => {
    for (const node of nodes) {
      const mode = viewOf(node);
      const next = NEXT[mode];
      const box = nodeBox(node);
      const patch: Record<string, unknown> = { [FIELD_VIEW]: next === 'card' ? undefined : next };
      if (next === 'link' && box) patch[FIELD_CARD_SIZE] = { width: box.width, height: box.height };
      if (mode === 'link') {
        patch[FIELD_CARD_SIZE] = undefined;
        if (box) node.moveAndResize?.({ ...box, ...(readCardSize(node) ?? SIZE_NOTE_CARD) });
      }
      patchData(node, patch);
    }
  });
}

/**
 * Dress file nodes that point at a typed note: a card, the full embed or a styled link in place of the
 * native view (changed from the selection toolbar). The node keeps Obsidian's own label, which shows the
 * file name. Idempotent, so safe to run on a timer.
 */
export function decorateNoteCards(
  plugin: FilteredFileCommandsPlugin, canvas: CanvasLike,
): void {
  for (const node of canvas.nodes?.values() ?? []) {
    const el = node.nodeEl;
    if (!el) continue;
    const file = noteOfNode(node);
    const type = file ? plugin.getNoteTypeForFile(file) : undefined;
    const container = el.querySelector<HTMLElement>('.canvas-node-container');

    if (!file || !type || !container) {
      clearNode(node);
      continue;
    }

    const mode = viewOf(node);
    const embed = mode === 'embed';
    el.querySelector(`.${LEGACY_LABEL_CLASS}`)?.remove();
    el.setAttribute('data-ffc-note-type', type.id);
    // Same variable the link pills use, so the card takes the colour the links have. Empty removes it.
    el.setCssProps({ '--ffc-note-link-color': typeLinkColor(type) ?? '' });
    el.setAttribute('data-ffc-view', mode);

    if (mode === 'link') {
      container.querySelector(`.${CARD_CLASS}`)?.remove();
      decorateLink(plugin, canvas, node, container, file, type);
      continue;
    }
    container.querySelector(`.${PILL_CLASS}`)?.remove();

    let card = container.querySelector<HTMLElement>(`.${CARD_CLASS}`);
    if (embed) {
      card?.remove();
      drawn.delete(node);
      continue;
    }
    card ??= container.createDiv({ cls: CARD_CLASS });
    // Re-render only when the note, its type, or the type's card settings changed.
    const key = `${file.path}|${file.stat.mtime}|${type.id}|${type.imageKey ?? ''}|${JSON.stringify(type.canvasFields ?? [])}`;
    if (drawn.get(node)?.key === key && card.childElementCount > 0) continue;
    drawn.set(node, { key });
    void readCardContent(plugin.app, file, type)
      .then((content) => {
        renderCard(card, content);
        // The selection toolbar reads this to offer "Add" or "Replace / Remove".
        if (content.image) node.nodeEl?.setAttribute('data-ffc-key-image', content.image.via);
        else node.nodeEl?.removeAttribute('data-ffc-key-image');
      });
  }
}

/**
 * The styled link view: the note drawn as the link pill from the editor, with the node
 * shrunk to hug it. A node that has the wrong size for its pill (just switched, or
 * restored by redo) is resized to fit, without an undo step of its own.
 */
function decorateLink(
  plugin: FilteredFileCommandsPlugin, canvas: CanvasLike, node: CanvasNodeLike,
  container: HTMLElement, file: TFile, type: NoteType,
): void {
  const owner = owners.get(canvas);
  if (!owner) return;
  const pill = container.querySelector<HTMLElement>(`.${PILL_CLASS}`) ?? container.createDiv({ cls: PILL_CLASS });
  // The link takes its look from the type's link settings and the note's own status.
  const key = `${file.path}|${file.stat.mtime}|${JSON.stringify([type.id, type.styledLinks, type.linkColor, type.linkIcon, type.showLinkIcon, type.showStatusInLinks])}`;
  if (drawn.get(node)?.key !== key || pill.childElementCount === 0) {
    drawn.set(node, { key });
    void renderLinkPill(plugin.app, pill, file, owner).then(() => fitToPill(canvas, node, pill, container));
    return;
  }
  fitToPill(canvas, node, pill, container);
}

/** Size the node to the link: its fill is the whole box, plus the node's own border on every side. */
function fitToPill(canvas: CanvasLike, node: CanvasNodeLike, pill: HTMLElement, container: HTMLElement): void {
  const box = nodeBox(node);
  const border = parseFloat(container.win.getComputedStyle(container).borderLeftWidth) || 0;
  const width = pill.offsetWidth + 2 * border;
  const height = pill.offsetHeight + 2 * border;
  if (!box || pill.offsetWidth === 0 || pill.offsetHeight === 0) return;
  if (Math.abs(box.width - width) <= 1 && Math.abs(box.height - height) <= 1) return;
  node.moveAndResize?.({ ...box, width, height });
  canvas.requestSave?.(false);
}

function clearNode(node: CanvasNodeLike): void {
  const el = node.nodeEl;
  if (!el) return;
  el.querySelector(`.${LEGACY_LABEL_CLASS}`)?.remove();
  el.querySelector(`.${CARD_CLASS}`)?.remove();
  el.querySelector(`.${PILL_CLASS}`)?.remove();
  el.removeAttribute('data-ffc-note-type');
  el.setCssProps({ '--ffc-note-link-color': '' });
  el.removeAttribute('data-ffc-view');
  el.removeAttribute('data-ffc-key-image');
  drawn.delete(node);
}

export function clearNoteCards(canvas: CanvasLike): void {
  for (const node of canvas.nodes?.values() ?? []) clearNode(node);
}

/**
 * Grow a card you've just added, once, so the rows of its configured
 * properties aren't clipped by the default height. Not an undo step: undoing
 * the add removes the whole card. Existing cards are never resized.
 */
export function fitNodeToCard(plugin: FilteredFileCommandsPlugin, canvas: CanvasLike, node: CanvasNodeLike): void {
  const attempt = (tries: number): void => {
    // The card is drawn by the next decoration pass; run it now instead of waiting for the timer.
    decorateNoteCards(plugin, canvas);
    const card = node.nodeEl?.querySelector<HTMLElement>(`.${CARD_CLASS}`);
    if (!card?.querySelector('.ffc-note-card-title')) {
      if (tries > 0) window.requestAnimationFrame(() => attempt(tries - 1));
      return;
    }
    const extra = card.scrollHeight - card.clientHeight;
    const box = nodeBox(node);
    if (extra <= 0 || !box) return;
    node.moveAndResize?.({ ...box, height: box.height + extra });
    canvas.requestSave?.(false);
  };
  attempt(120);
}
