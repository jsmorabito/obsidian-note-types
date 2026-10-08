import { StrokeOptions, getStroke } from 'perfect-freehand';
import { INK_FALLBACK_HEX, PRESET_HEX } from './constants.ts';

export type InkTool = 'marker' | 'highlighter';
/** x, y, pressure. */
export type InkPoint = [number, number, number];

/** The stroke field's value. Points are relative to the node origin, in a `vw` x `vh` box, so a resized stroke scales. */
export interface InkData {
  tool: InkTool;
  size: number;
  vw: number;
  vh: number;
  points: InkPoint[];
}

const STYLE: Record<InkTool, { size: number; opacity: number }> = {
  marker: { size: 6, opacity: 1 },
  highlighter: { size: 22, opacity: 0.35 },
};

export const inkSize = (tool: InkTool): number => STYLE[tool].size;

/** perfect-freehand options. `scale` is the zoom, for sizing a live preview in screen pixels. */
export function strokeOptions(tool: InkTool, penPressure: boolean, scale = 1): StrokeOptions {
  const size = STYLE[tool].size * scale;
  return tool === 'highlighter'
    ? { size, thinning: 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false }
    : { size, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: !penPressure };
}

/** Pen pressure is stored per point; a stroke whose pressure never varies came from a mouse or finger. */
const hasPressure = (points: InkPoint[]): boolean => points.some((p) => p[2] !== 0.5);

/** Options for the finished stroke. Using the same ones for the box and the SVG keeps the stroke inside its node. */
const finalOptions = (tool: InkTool, points: InkPoint[]): StrokeOptions => ({
  ...strokeOptions(tool, hasPressure(points)),
  last: true,
});

const fmt = (n: number): string => String(Math.round(n * 10) / 10);

/** SVG path for a stroke outline: quadratic curves through the midpoints, as perfect-freehand suggests. */
export function outlinePath(outline: number[][]): string {
  if (outline.length === 0) return '';
  const parts: string[] = ['M', fmt(outline[0][0]), fmt(outline[0][1]), 'Q'];
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length];
    parts.push(fmt(x0), fmt(y0), fmt((x0 + x1) / 2), fmt((y0 + y1) / 2));
  });
  parts.push('Z');
  return parts.join(' ');
}

/** A canvas colour (preset "1"-"6" or hex) as hex, or null for none. */
export function colorToHex(color: unknown): string | null {
  if (typeof color !== 'string' || !color) return null;
  return PRESET_HEX[color] ?? (/^#[0-9a-f]{3,8}$/i.test(color) ? color : null);
}

/**
 * The inline SVG that goes in the node's `text`, so stock Obsidian shows the
 * stroke too. The viewBox does the scaling when the node is resized.
 */
export function inkSvg(ink: InkData, hex: string | null): string {
  const outline = getStroke(ink.points, finalOptions(ink.tool, ink.points));
  const { opacity } = STYLE[ink.tool];
  const auto = hex === null;
  const path = `<path d="${outlinePath(outline)}" fill="${hex ?? INK_FALLBACK_HEX}"`
    + `${opacity < 1 ? ` opacity="${opacity}"` : ''}${auto ? ' class="ffc-ink-auto"' : ''}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ffc-ink" viewBox="0 0 ${fmt(ink.vw)} ${fmt(ink.vh)}" `
    + `width="100%" height="100%" preserveAspectRatio="none">${path}</svg>`;
}

export interface BuiltInk {
  pos: { x: number; y: number };
  size: { width: number; height: number };
  ink: InkData;
  text: string;
}

/** Turn a stroke drawn in canvas coordinates into the node that holds it. */
export function buildInk(world: InkPoint[], tool: InkTool, hex: string | null): BuiltInk {
  // A tap is a dot: perfect-freehand needs at least two points to draw one.
  const pts: InkPoint[] = world.length === 1 ? [world[0], [world[0][0], world[0][1], world[0][2]]] : world;
  const outline = getStroke(pts, finalOptions(tool, pts));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outline.length > 0 ? outline : pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const pad = 1;
  const x = Math.floor(minX - pad);
  const y = Math.floor(minY - pad);
  const width = Math.max(2, Math.ceil(maxX + pad) - x);
  const height = Math.max(2, Math.ceil(maxY + pad) - y);
  const round = (n: number, d: number): number => Math.round(n * d) / d;
  const ink: InkData = {
    tool, size: inkSize(tool), vw: width, vh: height,
    points: pts.map(([px, py, p]): InkPoint => [round(px - x, 10), round(py - y, 10), round(p, 100)]),
  };
  return { pos: { x, y }, size: { width, height }, ink, text: inkSvg(ink, hex) };
}
