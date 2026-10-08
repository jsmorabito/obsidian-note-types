import { getStroke } from 'perfect-freehand';
import {
  CanvasLike, CanvasNodeLike, CanvasViewLike, batch, createTextNode, patchData, removeNode, toCanvasPoint,
} from './adapter.ts';
import { ERASER_RADIUS_PX, FIELD_INK } from './constants.ts';
import { InkPoint, InkTool, buildInk, colorToHex, outlinePath, strokeOptions } from './ink-render.ts';
import { inkNodes, readInk, strokeHit } from './ink-nodes.ts';
import { trackPointer } from './pointer-session.ts';

const ERASING_CLASS = 'ffc-ink-erasing';
/** Interpolation step for the eraser, so a fast swipe can't jump over a thin stroke. */
const ERASE_STEP_PX = 3;

type Client = { clientX: number; clientY: number };

/**
 * Freehand drawing and erasing on a canvas. Each session runs from pointer
 * down to up on document listeners; `begin*` returns a function that abandons
 * it (Esc, or switching tool).
 */
export class InkTools {
  /** Pen colour: '' for none, a preset "1"-"6", or hex. */
  penColor = '';

  constructor(private view: CanvasViewLike) {}

  private get canvas(): CanvasLike { return this.view.canvas!; }

  /** Screen pixels per canvas unit. */
  private zoom(): number {
    const rect = this.canvas.wrapperEl.getBoundingClientRect();
    const bb = this.canvas.getViewportBBox?.();
    return bb && bb.maxX > bb.minX && rect.width > 0 ? rect.width / (bb.maxX - bb.minX) : 1;
  }

  /** Draw one stroke with the marker or highlighter. The stroke becomes a node on pointer up, as one undo step. */
  beginDraw(tool: InkTool, down: PointerEvent, onEnd: () => void): () => void {
    const canvas = this.canvas;
    const zoom = this.zoom();
    const world: InkPoint[] = [];
    const screen: InkPoint[] = [];
    const hex = colorToHex(this.penColor);

    const doc = this.view.containerEl.doc;
    const svg = doc.body.createSvg('svg', { cls: 'ffc-ink-preview' });
    const path = svg.createSvg('path');
    path.setAttribute('fill', hex ?? 'currentColor');
    if (tool === 'highlighter') path.setAttribute('opacity', '0.35');

    const add = (e: PointerEvent): void => {
      const w = toCanvasPoint(canvas, e);
      if (!w) return;
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      world.push([w.x, w.y, pressure]);
      screen.push([e.clientX, e.clientY, pressure]);
    };
    const redraw = (): void => {
      const pen = screen.some((p) => p[2] !== 0.5);
      path.setAttribute('d', outlinePath(getStroke(screen, strokeOptions(tool, pen, zoom))));
    };
    const stopTracking = trackPointer(doc, down.pointerId, {
      move: (e) => {
        // Some engines return an empty list rather than none; always keep the event itself.
        const coalesced = e.getCoalescedEvents?.();
        for (const sample of coalesced && coalesced.length > 0 ? coalesced : [e]) add(sample);
        redraw();
      },
      up: (e) => {
        add(e);
        stop();
        if (world.length === 0) return;
        const built = buildInk(world, tool, hex);
        batch(canvas, () => {
          // focus: false, or Obsidian opens the new node for editing and shows the SVG source.
          const node = createTextNode(canvas, { pos: built.pos, size: built.size, text: built.text, focus: false });
          if (!node) return;
          patchData(node, { [FIELD_INK]: built.ink, ...(this.penColor ? { color: this.penColor } : {}) });
        });
        canvas.deselectAll?.();
      },
      cancel: () => stop(),
    });
    const stop = (): void => {
      stopTracking();
      svg.remove();
      onEnd();
    };

    add(down);
    redraw();
    return stop;
  }

  /**
   * Erase whole strokes. Anything the pointer touches fades, and is deleted on
   * pointer up, so one swipe is one undo step. Only ink is erased.
   */
  beginErase(down: PointerEvent, onEnd: () => void): () => void {
    const canvas = this.canvas;
    const doc = this.view.containerEl.doc;
    const zoom = this.zoom();
    const strokes = inkNodes(canvas);
    const touched = new Set<CanvasNodeLike>();
    let last: Client = down;

    const touchAt = (c: Client): void => {
      const w = toCanvasPoint(canvas, c);
      if (!w) return;
      for (const node of strokes) {
        const ink = readInk(node);
        if (!ink || touched.has(node)) continue;
        if (strokeHit(node, ink, w.x, w.y, ERASER_RADIUS_PX / zoom)) {
          touched.add(node);
          node.nodeEl?.addClass(ERASING_CLASS);
        }
      }
    };
    const sweepTo = (to: Client): void => {
      const dist = Math.hypot(to.clientX - last.clientX, to.clientY - last.clientY);
      const steps = Math.max(1, Math.ceil(dist / ERASE_STEP_PX));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        touchAt({
          clientX: last.clientX + (to.clientX - last.clientX) * t,
          clientY: last.clientY + (to.clientY - last.clientY) * t,
        });
      }
      last = to;
    };
    const stopTracking = trackPointer(doc, down.pointerId, {
      move: (e) => sweepTo(e),
      up: (e) => {
        sweepTo(e);
        const hit = [...touched];
        finish();
        if (hit.length > 0) batch(canvas, () => { for (const node of hit) removeNode(canvas, node); });
      },
      cancel: () => finish(),
    });
    const finish = (): void => {
      stopTracking();
      for (const node of touched) node.nodeEl?.removeClass(ERASING_CLASS);
      onEnd();
    };

    touchAt(down);
    return finish;
  }
}

