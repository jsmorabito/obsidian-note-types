import {
  CanvasLike, CanvasNodeLike, batch, createGroupNode, createTextNode, removeNode, setExtra,
} from './adapter.ts';
import {
  FIELD_KIND, KIND_TEXT, MIN_DRAW_HEIGHT, MIN_DRAW_HEIGHT_TEXT, MIN_DRAW_WIDTH,
  SIZE_CARD, SIZE_GROUP, SIZE_TEXT,
} from './constants.ts';

type PlaceTool = 'text' | 'card' | 'group';
type Point = { x: number; y: number };
export interface PlacedRect { pos: Point; size: { width: number; height: number } }

const DEFAULT_SIZE: Record<PlaceTool, { width: number; height: number }> = {
  text: SIZE_TEXT, card: SIZE_CARD, group: SIZE_GROUP,
};

/**
 * Where a node lands. A click (`end` null) puts text at the click point and
 * centres cards and groups on it; a drag sets the box, with minimum sizes.
 */
export function placementRect(tool: PlaceTool, start: Point, end: Point | null): PlacedRect {
  if (!end) {
    const size = DEFAULT_SIZE[tool];
    const pos = tool === 'text'
      ? start
      : { x: start.x - size.width / 2, y: start.y - size.height / 2 };
    return { pos: { x: Math.round(pos.x), y: Math.round(pos.y) }, size };
  }
  const minH = tool === 'text' ? MIN_DRAW_HEIGHT_TEXT : MIN_DRAW_HEIGHT;
  return {
    pos: { x: Math.round(Math.min(start.x, end.x)), y: Math.round(Math.min(start.y, end.y)) },
    size: {
      width: Math.round(Math.max(Math.abs(end.x - start.x), MIN_DRAW_WIDTH)),
      height: Math.round(Math.max(Math.abs(end.y - start.y), minH)),
    },
  };
}

/** Create the node for `tool` as one undo step and drop the user into editing it. */
export function placeNode(canvas: CanvasLike, tool: PlaceTool, rect: PlacedRect): CanvasNodeLike | undefined {
  return batch(canvas, () => {
    if (tool === 'group') {
      const group = createGroupNode(canvas, { ...rect, focus: true });
      if (group) beginLabelEdit(group);
      return group;
    }
    const node = createTextNode(canvas, { ...rect, focus: true });
    if (node && tool === 'text') {
      setExtra(node, FIELD_KIND, KIND_TEXT);
      removeWhenLeftEmpty(canvas, node);
    }
    node?.startEditing?.();
    return node;
  });
}

/**
 * Free text left empty after editing removes itself. It only arms once the editor has had focus and
 * only fires when focus has left the whole node, so a focus change while the editor mounts can't
 * delete a box the user is about to type in.
 */
function removeWhenLeftEmpty(canvas: CanvasLike, node: CanvasNodeLike): void {
  const attach = (tries: number): void => {
    const el = node.nodeEl;
    if (!el) {
      if (tries > 0) window.requestAnimationFrame(() => attach(tries - 1));
      return;
    }
    let armed = el.contains(el.doc.activeElement);
    el.addEventListener('focusin', () => { armed = true; });
    el.addEventListener('focusout', () => {
      if (!armed) return;
      window.setTimeout(() => {
        if (!el.isConnected || el.contains(el.doc.activeElement)) return;
        if ((node.text ?? '').trim() === '') batch(canvas, () => removeNode(canvas, node));
      }, 80);
    });
  };
  attach(10);
}

/** A fresh group starts in label edit. Group nodes have no consistent startEditing, so focus the label. */
export function beginLabelEdit(group: CanvasNodeLike): void {
  const tryFocus = (tries: number): void => {
    try { group.startEditing?.(); } catch { /* group may not expose startEditing */ }
    const label = group.nodeEl?.querySelector<HTMLElement>('.canvas-node-label');
    if (label) {
      label.focus();
      label.win.getSelection()?.selectAllChildren(label);
    } else if (tries > 0) {
      window.requestAnimationFrame(() => tryFocus(tries - 1));
    }
  };
  tryFocus(10);
}
