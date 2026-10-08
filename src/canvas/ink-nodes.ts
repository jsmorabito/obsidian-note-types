import { CanvasLike, CanvasNodeLike, getExtra, nodeBox } from './adapter.ts';
import { FIELD_INK } from './constants.ts';
import { InkData, InkPoint } from './ink-render.ts';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** x and y are required; pressure is optional (perfect-freehand then assumes 0.5). */
const validPoint = (p: unknown): boolean =>
  Array.isArray(p) && p.length >= 2 && finite(p[0]) && finite(p[1]) && (p[2] === undefined || finite(p[2]));

/** Validation walks every point, so remember the verdict for each stored object. */
const verdicts = new WeakMap<object, InkData | null>();

function validate(v: Partial<InkData>): InkData | null {
  if (v.tool !== 'marker' && v.tool !== 'highlighter') return null;
  if (!finite(v.size) || !finite(v.vw) || !finite(v.vh) || v.vw <= 0 || v.vh <= 0) return null;
  if (!Array.isArray(v.points) || v.points.length === 0 || !v.points.every(validPoint)) return null;
  return v as InkData;
}

/**
 * The stroke a node holds, or null for any other node. A malformed
 * stroke field (hand-edited, or from another exporter) counts as not ink, so
 * it can't throw in the sweep, the eraser or the layers panel.
 */
export function readInk(node: CanvasNodeLike): InkData | null {
  const v = getExtra(node, FIELD_INK);
  if (!v || typeof v !== 'object') return null;
  if (!verdicts.has(v)) verdicts.set(v, validate(v));
  return verdicts.get(v) ?? null;
}

export const isInk = (node: CanvasNodeLike): boolean => readInk(node) !== null;

export function inkNodes(canvas: CanvasLike): CanvasNodeLike[] {
  return [...(canvas.nodes?.values() ?? [])].filter(isInk);
}

function distToSegment(px: number, py: number, a: InkPoint, b: InkPoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * Whether (x, y), in canvas coordinates, is within `radius` of the stroke's
 * centre line. The stored points are scaled by however far the node has been
 * resized since they were drawn.
 */
export function strokeHit(node: CanvasNodeLike, ink: InkData, x: number, y: number, radius: number): boolean {
  const box = nodeBox(node);
  if (!box) return false;
  const reach = radius + ink.size / 2;
  if (x < box.x - reach || x > box.x + box.width + reach || y < box.y - reach || y > box.y + box.height + reach) return false;
  const sx = box.width / ink.vw;
  const sy = box.height / ink.vh;
  const world = ink.points.map(([px, py, p]): InkPoint => [box.x + px * sx, box.y + py * sy, p]);
  if (world.length === 1) return Math.hypot(x - world[0][0], y - world[0][1]) <= reach;
  for (let i = 1; i < world.length; i++) {
    if (distToSegment(x, y, world[i - 1], world[i]) <= reach) return true;
  }
  return false;
}
