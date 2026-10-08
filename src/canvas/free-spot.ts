import { Box, CanvasLike, nodeBox } from './adapter.ts';
import { PLACE_GAP } from './constants.ts';

const MAX_RINGS = 40;

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width + PLACE_GAP && a.x + a.width + PLACE_GAP > b.x
    && a.y < b.y + b.height + PLACE_GAP && a.y + a.height + PLACE_GAP > b.y;
}

/**
 * The free spot nearest `center` for a node of `size`: search outward in rings
 * on a grid with gaps of PLACE_GAP. Groups don't count as occupied, since
 * dropping a node into one is normal.
 */
export function findFreeSpot(
  canvas: CanvasLike,
  center: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  const occupied: Box[] = [];
  for (const node of canvas.nodes?.values() ?? []) {
    if (node.getData?.().type === 'group') continue;
    const box = nodeBox(node);
    if (box) occupied.push(box);
  }
  const stepX = size.width + PLACE_GAP;
  const stepY = size.height + PLACE_GAP;
  const origin = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    const candidates: Array<{ x: number; y: number }> = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        candidates.push({ x: origin.x + dx * stepX, y: origin.y + dy * stepY });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
    const hit = candidates.find((c) => !occupied.some((o) => overlaps({ ...c, ...size }, o)));
    if (hit) return { x: Math.round(hit.x), y: Math.round(hit.y) };
  }
  return { x: Math.round(origin.x), y: Math.round(origin.y) };
}
