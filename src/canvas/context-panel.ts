import { TFile, setIcon } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteType, RelationType } from '../types.ts';
import { resolvedRelation } from '../relations.ts';
import {
  CanvasEdgeLike, CanvasLike, CanvasNodeLike, CanvasViewLike, batch, createFileNode, dropEdge, focusNode,
  isEdge, newEdgeId, nodeBox, putEdge, removeNode, shieldFromCanvas,
} from './adapter.ts';
import { PLACE_GAP, SIZE_NOTE_CARD } from './constants.ts';
import { fitNodeToCard, noteOfNode } from './note-card.ts';
import { NoteRef, noteRefFor } from './relation-logic.ts';

/** Gap between the selected card and the column its related notes are added in. */
const COLUMN_GAP = 240;

interface Item {
  file: TFile;
  type: NoteType | undefined;
}

interface Group {
  key: string;
  title: string;
  rt: RelationType;
  /** True when the selected note is the source of the relation. */
  outgoing: boolean;
  items: Item[];
}

/**
 * Floating panel for the selected note card: its relations, grouped by
 * relation and direction. "+" brings a related note onto the canvas with a
 * labelled edge; "−" takes it off again. The graph is never changed here.
 * The panel holds no state of its own; it is rebuilt from the notes.
 */
export class ContextPanel {
  private el: HTMLElement;
  private shown = '';

  constructor(private plugin: FilteredFileCommandsPlugin, private view: CanvasViewLike) {
    this.el = view.contentEl.createDiv({ cls: 'ffc-context-panel' });
    this.el.hide();
    shieldFromCanvas(this.el);
  }

  private get canvas(): CanvasLike | undefined { return this.view.canvas; }

  destroy(): void {
    this.el.remove();
  }

  /** Re-read the selection and the notes, redrawing only when something changed. */
  update(): void {
    const canvas = this.canvas;
    const ref = canvas ? this.selectedNote(canvas) : null;
    if (!canvas || !ref) {
      this.shown = '';
      this.el.hide();
      return;
    }
    const groups = this.groupsFor(ref);
    const signature = JSON.stringify([
      ref.file.path, ref.type.name,
      groups.map((g) => [g.key, g.title, g.items.map((i) => [i.file.path, this.stateOf(canvas, ref, g, i)])]),
    ]);
    if (signature === this.shown) return;
    this.shown = signature;
    this.render(canvas, ref, groups);
    this.el.show();
  }

  /** The one selected node, when it is a typed note card. */
  private selectedNote(canvas: CanvasLike): { node: CanvasNodeLike } & NoteRef | null {
    const selected = [...(canvas.selection ?? [])];
    if (selected.length !== 1 || isEdge(selected[0])) return null;
    const node = selected[0] as CanvasNodeLike;
    const ref = noteRefFor(this.plugin, node);
    return ref ? { node, ...ref } : null;
  }

  private groupsFor(ref: NoteRef): Group[] {
    const groups = new Map<string, Group>();
    for (const rel of this.plugin.listRelationsForFile(ref.file)) {
      if (!rel.targetFile) continue;
      const outgoing = rel.direction === 'forward';
      const rt = this.plugin.settings.relationTypes.find((r) => {
        const x = resolvedRelation(r);
        return (outgoing ? x.forwardKey : x.reverseKey) === rel.ownKey;
      });
      if (!rt) continue;
      const r = resolvedRelation(rt);
      // Incoming groups read as the complement, or "← relation" when there isn't one.
      const title = outgoing ? r.forwardName : (rt.reverseName.trim() ? r.reverseName : `← ${r.forwardName}`);
      const key = `${outgoing ? 'out' : 'in'}:${rt.id}`;
      let group = groups.get(key);
      if (!group) groups.set(key, group = { key, title, rt, outgoing, items: [] });
      group.items.push({ file: rel.targetFile, type: this.plugin.getNoteTypeForFile(rel.targetFile) });
    }
    const list = [...groups.values()];
    for (const g of list) g.items.sort((a, b) => a.file.basename.localeCompare(b.file.basename));
    // Outgoing relations first, then incoming.
    return list.sort((a, b) => Number(b.outgoing) - Number(a.outgoing) || a.title.localeCompare(b.title));
  }

  // ── Canvas state of an item ─────────────────────────────────────────────────

  private nodeFor(canvas: CanvasLike, file: TFile): CanvasNodeLike | undefined {
    return [...(canvas.nodes?.values() ?? [])].find((n) => noteOfNode(n)?.path === file.path);
  }

  /** The edge for this relation between the two nodes, running the way the relation runs. */
  private edgeFor(canvas: CanvasLike, selected: CanvasNodeLike, other: CanvasNodeLike, group: Group): CanvasEdgeLike | undefined {
    const [from, to] = group.outgoing ? [selected, other] : [other, selected];
    const label = resolvedRelation(group.rt).forwardName;
    return [...(canvas.edges?.values() ?? [])]
      .find((e) => e.from.node === from && e.to.node === to && e.label === label);
  }

  /** `add`: not on the canvas. `link`: on the canvas but not connected. `remove`: on the canvas and connected. */
  private stateOf(canvas: CanvasLike, ref: { node: CanvasNodeLike }, group: Group, item: Item): 'add' | 'link' | 'remove' {
    const node = this.nodeFor(canvas, item.file);
    if (!node) return 'add';
    return this.edgeFor(canvas, ref.node, node, group) ? 'remove' : 'link';
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private render(canvas: CanvasLike, ref: { node: CanvasNodeLike } & NoteRef, groups: Group[]): void {
    this.el.empty();
    const header = this.el.createDiv({ cls: 'ffc-context-header' });
    header.createSpan({ cls: 'ffc-note-chip', text: ref.type.name });
    this.titleLink(header, ref.file.basename, ref.file, () => false);

    if (groups.length === 0) {
      this.el.createDiv({ cls: 'ffc-context-empty', text: 'No relations yet.' });
      return;
    }
    for (const group of groups) {
      const section = this.el.createDiv({ cls: 'ffc-context-group' });
      section.createDiv({ cls: 'ffc-context-group-title', text: group.title });
      for (const item of group.items) this.renderItem(section, canvas, ref, group, item);
    }
  }

  private renderItem(
    section: HTMLElement, canvas: CanvasLike, ref: { node: CanvasNodeLike } & NoteRef, group: Group, item: Item,
  ): void {
    const row = section.createDiv({ cls: 'ffc-context-item' });
    if (item.type) row.createSpan({ cls: 'ffc-note-chip', text: item.type.name });
    this.titleLink(row, item.file.basename, item.file, () => {
      const node = this.nodeFor(canvas, item.file);
      if (node) focusNode(canvas, node);
      return !!node;
    });

    const state = this.stateOf(canvas, ref, group, item);
    const btn = row.createEl('button', {
      cls: 'clickable-icon ffc-context-action',
      attr: { 'aria-label': state === 'remove' ? 'Take off the canvas' : state === 'link' ? 'Connect on the canvas' : 'Add to the canvas' },
    });
    setIcon(btn, state === 'remove' ? 'minus' : 'plus');
    btn.addEventListener('click', () => {
      if (state === 'remove') this.takeOff(canvas, ref.node, item);
      else this.bringOn(canvas, ref.node, group, item);
      this.update();
    });
  }

  /** A title that zooms to its card when it's on the canvas, else opens the note (shift: in the sidebar). */
  private titleLink(parent: HTMLElement, text: string, file: TFile, zoom: () => boolean): void {
    const link = parent.createSpan({ cls: 'ffc-context-title', text });
    link.addEventListener('click', (e) => {
      if (!e.shiftKey && zoom()) return;
      const leaf = e.shiftKey ? this.plugin.app.workspace.getRightLeaf(false) : this.plugin.app.workspace.getLeaf('tab');
      void leaf?.openFile(file);
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  /** One undo step: the card (unless it's already there) and the edge, labelled with the relation as it really runs. */
  private bringOn(canvas: CanvasLike, selected: CanvasNodeLike, group: Group, item: Item): void {
    const box = nodeBox(selected);
    if (!box) return;
    batch(canvas, () => {
      let other = this.nodeFor(canvas, item.file);
      if (!other) {
        other = createFileNode(canvas, { pos: this.nextInColumn(canvas, box), size: SIZE_NOTE_CARD, file: item.file });
        if (other) fitNodeToCard(this.plugin, canvas, other);
      }
      if (!other?.id || !selected.id) return;
      const [from, to] = group.outgoing ? [selected, other] : [other, selected];
      const fromBox = nodeBox(from);
      const toBox = nodeBox(to);
      const toTheRight = fromBox && toBox ? toBox.x >= fromBox.x : true;
      putEdge(canvas, {
        id: newEdgeId(),
        fromNode: from.id, fromSide: toTheRight ? 'right' : 'left',
        toNode: to.id, toSide: toTheRight ? 'left' : 'right',
        toEnd: 'arrow',
        label: resolvedRelation(group.rt).forwardName,
      });
    });
  }

  /** Below the notes already in the column to the right of the selected card. */
  private nextInColumn(canvas: CanvasLike, selected: { x: number; y: number; width: number }): { x: number; y: number } {
    const x = Math.round(selected.x + selected.width + COLUMN_GAP);
    let y = selected.y;
    for (const node of canvas.nodes?.values() ?? []) {
      const box = nodeBox(node);
      if (!box || Math.abs(box.x - x) > 10) continue;
      y = Math.max(y, box.y + box.height + PLACE_GAP);
    }
    return { x, y: Math.round(y) };
  }

  /** Takes the card and its edges off the canvas. The notes and relations are untouched. */
  private takeOff(canvas: CanvasLike, selected: CanvasNodeLike, item: Item): void {
    const node = this.nodeFor(canvas, item.file);
    if (!node || node === selected) return;
    batch(canvas, () => {
      for (const edge of [...(canvas.edges?.values() ?? [])]) {
        if (edge.from.node === node || edge.to.node === node) dropEdge(canvas, edge);
      }
      removeNode(canvas, node);
    });
  }
}
