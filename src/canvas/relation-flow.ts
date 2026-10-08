import { Notice, setIcon } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { resolvedRelation } from '../relations.ts';
import {
  CanvasEdgeLike, CanvasLike, CanvasViewLike, batch, dropEdge, isConnected, isEdge, isElement, putEdge, relabeled,
} from './adapter.ts';
import { batchWithEffect } from './undo-journal.ts';
import { MenuChoice, RelationMenu } from './relation-menu.ts';
import {
  NoteRef, addedRelationEffect, createRelationType, noteRefFor, relationOfEdge, removeRelationOf, removedRelationEffect,
} from './relation-logic.ts';

const CONNECTION_POINT = '.canvas-node-connection-point';
const BUTTON_CLASS = 'ffc-relation-btn';

/**
 * Relations on a canvas: connecting two note cards opens the relation menu, relation edges are styled
 * and locked, and the edge menu gains Make / Remove relation. The relation lives in the notes'
 * frontmatter; the edge is a view of it.
 */
export class RelationFlow {
  /** Edge ids present when a connection drag started, to tell which edge the drag made. */
  private snapshot: Set<string> | null = null;
  /** Edges made by a drag that haven't been connected to a second node yet. */
  private pending = new Set<string>();
  private busy = false;
  private observer: MutationObserver | null = null;

  constructor(private plugin: FilteredFileCommandsPlugin, private view: CanvasViewLike) {
    const menuEl = this.canvas?.menu?.menuEl;
    if (menuEl) {
      this.observer = new MutationObserver(() => this.injectButtons());
      this.observer.observe(menuEl, { childList: true });
    }
  }

  private get canvas(): CanvasLike | undefined { return this.view.canvas; }

  onPointerDown(e: PointerEvent): void {
    const canvas = this.canvas;
    const target = e.target;
    if (!canvas?.edges || !isElement(target) || !target.closest(CONNECTION_POINT)) return;
    if (!this.view.containerEl.contains(target)) return;
    this.snapshot = new Set(canvas.edges.keys());
  }

  onPointerUp(): void {
    const canvas = this.canvas;
    const before = this.snapshot;
    this.snapshot = null;
    if (!canvas?.edges || !before) return;
    // Let Obsidian finish the drop first; it connects the edge in its own pointerup handler.
    window.setTimeout(() => {
      for (const id of canvas.edges?.keys() ?? []) if (!before.has(id)) this.pending.add(id);
      void this.processPending();
    }, 60);
  }

  sweep(): void {
    void this.processPending();
    this.decorateEdges();
    this.injectButtons();
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.pending.clear();
    for (const edge of this.canvas?.edges?.values() ?? []) {
      edge.lineGroupEl?.classList.remove('ffc-relation-edge');
      edge.labelElement?.wrapperEl?.classList.remove('ffc-relation-label');
      this.unlock(edge);
    }
    this.canvas?.menu?.menuEl?.querySelector(`.${BUTTON_CLASS}`)?.remove();
  }

  // ── New connections ─────────────────────────────────────────────────────────

  private async processPending(): Promise<void> {
    const canvas = this.canvas;
    if (!canvas?.edges || this.busy) return;
    for (const id of [...this.pending]) {
      const edge = canvas.edges.get(id);
      if (!edge) { this.pending.delete(id); continue; }
      // Still being dragged, or waiting on Obsidian's own "create a card" menu.
      if (!isConnected(canvas, edge)) continue;
      this.pending.delete(id);
      try {
        await this.connect(edge);
      } catch (err) {
        console.error('Note Types: could not connect the relation', err);
      }
      return;
    }
  }

  private async connect(edge: CanvasEdgeLike): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) return;
    const from = noteRefFor(this.plugin, edge.from.node);
    const to = noteRefFor(this.plugin, edge.to.node);
    // Only two typed note cards get the relation menu; any other edge stays a plain arrow.
    if (!from || !to || edge.from.node === edge.to.node) return;

    // Take the arrow off until the user decides, so cancelling leaves no trace, undo history included.
    const plain = relabeled(edge.getData(), undefined);
    dropEdge(canvas, edge);
    canvas.requestPushHistory?.cancel?.();
    canvas.requestSave?.(false);

    this.busy = true;
    try {
      const choice = await new RelationMenu(this.plugin, from, to).choose();
      await this.apply(plain, from, to, choice, null);
    } finally {
      this.busy = false;
    }
  }

  /**
   * Commit a menu choice as one canvas undo step. `existing` is the edge being
   * converted by "Make relation", or null when the edge was taken off the canvas.
   */
  private async apply(
    plain: Record<string, unknown>, from: NoteRef, to: NoteRef, choice: MenuChoice | null, existing: CanvasEdgeLike | null,
  ): Promise<void> {
    const canvas = this.canvas;
    if (!canvas || !choice) return;
    if (choice.kind === 'arrow') {
      if (!existing) batch(canvas, () => putEdge(canvas, plain));
      return;
    }
    try {
      const created = choice.kind === 'create';
      const rt = choice.kind === 'create'
        ? await createRelationType(this.plugin, choice.name, choice.complement)
        : choice.rt;
      const reversed = choice.kind === 'relation' && choice.reversed;
      const [source, target] = reversed ? [to, from] : [from, to];
      const sides = await this.plugin.addRelation(source.file, target.file, rt);
      const label = resolvedRelation(rt).forwardName;
      // One undo step covers the edge, the relation in the notes, and a type made for it.
      const effect = created || sides.forward || sides.reverse
        ? addedRelationEffect(this.plugin, source.file, target.file, rt, sides, created)
        : null;
      batchWithEffect(canvas, effect, () => {
        if (existing) dropEdge(canvas, existing);
        putEdge(canvas, relabeled(plain, label, reversed));
      });
    } catch (err) {
      new Notice(`Could not add the relation: ${(err as Error).message}`);
      // The arrow was taken off while the menu was open; don't lose the connection.
      if (!existing) batch(canvas, () => putEdge(canvas, plain));
    }
  }

  // ── Edge pop-up menu ────────────────────────────────────────────────────────

  private injectButtons(): void {
    const canvas = this.canvas;
    const menuEl = canvas?.menu?.menuEl;
    if (!canvas || !menuEl || menuEl.querySelector(`.${BUTTON_CLASS}`)) return;
    const selected = [...(canvas.selection ?? [])];
    const edge = selected.length === 1 && isEdge(selected[0]) ? selected[0] : null;
    if (!edge) return;
    const from = noteRefFor(this.plugin, edge.from.node);
    const to = noteRefFor(this.plugin, edge.to.node);
    if (!from || !to) return;

    const isRelation = relationOfEdge(this.plugin, edge) !== null;
    const btn = menuEl.createEl('button', {
      cls: `clickable-icon ${BUTTON_CLASS}`,
      attr: {
        'aria-label': isRelation ? 'Remove relation (from the notes too)' : 'Make relation',
        'data-tooltip-position': 'top',
      },
    });
    setIcon(btn, isRelation ? 'unlink' : 'link');
    btn.addEventListener('click', () => {
      if (isRelation) void this.removeRelation(edge);
      else void this.makeRelation(edge, from, to);
    });
  }

  private async makeRelation(edge: CanvasEdgeLike, from: NoteRef, to: NoteRef): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const plain = relabeled(edge.getData(), undefined);
      const choice = await new RelationMenu(this.plugin, from, to).choose();
      await this.apply(plain, from, to, choice, edge);
    } finally {
      this.busy = false;
    }
  }

  /** Removes the relation from both notes and the edge from the canvas. */
  private async removeRelation(edge: CanvasEdgeLike): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) return;
    const removed = await removeRelationOf(this.plugin, edge);
    batchWithEffect(canvas, removed ? removedRelationEffect(this.plugin, removed) : null, () => dropEdge(canvas, edge));
  }

  // ── Relation edge styling ───────────────────────────────────────────────────

  private decorateEdges(): void {
    for (const edge of this.canvas?.edges?.values() ?? []) {
      const relation = isConnected(this.canvas!, edge) && relationOfEdge(this.plugin, edge) !== null;
      edge.lineGroupEl?.classList.toggle('ffc-relation-edge', relation);
      edge.labelElement?.wrapperEl?.classList.toggle('ffc-relation-label', relation);
      if (relation) this.lock(edge);
      else this.unlock(edge);
    }
  }

  /** A relation's label is its name, so it isn't editable on the edge. */
  private lock(edge: CanvasEdgeLike): void {
    edge.editLabel = () => { new Notice('Relation labels can’t be edited. Remove the relation and make a new one.'); };
    if (edge.labelElement) edge.labelElement.focus = () => { /* locked */ };
  }

  private unlock(edge: CanvasEdgeLike): void {
    if (Object.prototype.hasOwnProperty.call(edge, 'editLabel')) Reflect.deleteProperty(edge, 'editLabel');
    const label = edge.labelElement;
    if (label && Object.prototype.hasOwnProperty.call(label, 'focus')) Reflect.deleteProperty(label, 'focus');
  }
}
