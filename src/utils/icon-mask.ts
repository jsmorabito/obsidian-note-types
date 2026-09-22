import { getIcon } from 'obsidian';
import { statusSvg } from './status-svg.ts';

/**
 * Serializes an SVG element to a `url("data:image/svg+xml,...")` CSS value.
 * Used to put an icon on a CM6 `Decoration.mark()`'s own `style` attribute
 * rather than as an appended widget — inserting a *widget* inside a marked
 * range forces CodeMirror to split it into multiple sibling spans (breaking
 * a shared pill background in two); a plain custom property on the mark's
 * own style attribute doesn't.
 */
function svgToDataUrl(svg: SVGElement): string {
  const markup = new XMLSerializer().serializeToString(svg);
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

/**
 * Shared memoization for `iconMaskUrl`/`statusIconDataUrl`. Only successful
 * resolutions are cached — a `null` (icon not found) is returned but never
 * stored, so a transient miss (e.g. the id is looked up before a slower
 * icon-pack plugin has finished registering it) gets retried on the next
 * call instead of being suppressed for the rest of the session.
 */
function cachedDataUrl(cache: Map<string, string>, key: string, resolve: () => SVGElement | null): string | null {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const svg = resolve();
  if (!svg) return null;

  const url = svgToDataUrl(svg);
  cache.set(key, url);
  return url;
}

const iconCache = new Map<string, string>();

/**
 * Resolves a Lucide icon id to a data-URL for use as a `mask-image`. Masks
 * discard the source SVG's own colours (only alpha/luminance survives), so
 * pair this with `background-color: currentColor` — that's what lets one
 * note type's icon automatically match its link colour without us having to
 * resolve/track that colour here.
 */
export function iconMaskUrl(iconId: string): string | null {
  return cachedDataUrl(iconCache, iconId, () => getIcon(iconId));
}

const statusCache = new Map<string, string>();

/**
 * Resolves a status name to a data-URL for use as a `background-image`
 * (unlike `iconMaskUrl`, NOT a mask — status SVGs carry their own explicit
 * per-status colour, e.g. amber for "In Progress", and a mask would discard
 * that in favour of `currentColor`).
 */
export function statusIconDataUrl(status: string): string | null {
  return cachedDataUrl(statusCache, status, () => statusSvg(status));
}

/**
 * Prepends a small icon span (matching the sizing/spacing already defined
 * for `.ffc-status-icon` in styles.css) as the first child of `el`. Shared
 * by every DOM-child icon-rendering call site (reading view, folded Live
 * Preview links) so the "look up icon → wrap in a span → prepend" sequence
 * lives in one place.
 */
export function prependIconSpan(el: HTMLElement, svg: SVGElement, extraClass?: string): void {
  const span = createSpan({ cls: extraClass ? `ffc-status-icon ${extraClass}` : 'ffc-status-icon' });
  span.appendChild(svg);
  el.prepend(span);
}
