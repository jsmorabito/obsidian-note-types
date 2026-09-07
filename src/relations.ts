// ─── Frontmatter-based relations ─────────────────────────────────────────────
//
// Relations are stored as wikilinks in each note's frontmatter. A relation type
// names the key written on the note you mark (`frontmatterKey`) and, for
// bidirectional relations, the key written back on the target (`reverseKey`).
// The built-in "Related to" relation is symmetric: both sides use `related_to`.

import { App, TFile } from 'obsidian';
import type { PluginSettings, RelationType } from './types.ts';
import { stringifyFrontmatterValue } from './utils/helpers.ts';

export const BUILTIN_RELATION_TYPE_ID = 'related-to';

/** The built-in generic "Related to" relation. */
export function defaultRelationType(): RelationType {
  return {
    id: BUILTIN_RELATION_TYPE_ID,
    name: 'Related to',
    frontmatterKey: 'related_to',
    reverseName: '',
    reverseKey: '',
    builtin: true,
  };
}

/**
 * Ensure `settings.relationTypes` exists and contains the built-in "Related to"
 * relation. An existing built-in row keeps any edits the user made to its
 * labels/keys. Returns true when it mutated `settings` (so the caller can save).
 */
export function ensureRelationTypes(settings: PluginSettings): boolean {
  let changed = false;
  if (!Array.isArray(settings.relationTypes)) {
    settings.relationTypes = [];
    changed = true;
  }
  const builtin = settings.relationTypes.find((rt) => rt.id === BUILTIN_RELATION_TYPE_ID);
  if (!builtin) {
    settings.relationTypes.unshift(defaultRelationType());
    changed = true;
  } else if (!builtin.builtin) {
    builtin.builtin = true;
    changed = true;
  }
  for (const rt of settings.relationTypes) {
    if (rt.reverseName === undefined) { rt.reverseName = ''; changed = true; }
    if (rt.reverseKey === undefined)  { rt.reverseKey = '';  changed = true; }
  }
  return changed;
}

/** Lowercase a label into a frontmatter-key-safe slug (e.g. "Blocked by" → "blocked_by"). */
function slugifyKey(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Forward / reverse keys and labels for a relation type, with blanks resolved.
 *
 * A blank reverse key normally reuses the forward key (symmetric relation). But
 * if the reverse *label* differs from the forward label, reusing the key would
 * write the forward key/label onto the target and invert the reverse direction,
 * so a distinct key is derived from the reverse label instead.
 */
export function resolvedRelation(rt: RelationType): {
  forwardKey: string;
  reverseKey: string;
  forwardName: string;
  reverseName: string;
  symmetric: boolean;
} {
  const forwardKey  = (rt.frontmatterKey || '').trim();
  const forwardName = rt.name || 'Untitled relation';
  const reverseName = (rt.reverseName || '').trim() || forwardName;
  let reverseKey = (rt.reverseKey || '').trim();
  if (!reverseKey) {
    reverseKey = reverseName !== forwardName ? (slugifyKey(reverseName) || forwardKey) : forwardKey;
  }
  return { forwardKey, reverseKey, forwardName, reverseName, symmetric: forwardKey === reverseKey };
}

/** Strip `[[ ]]`, a leading `!`, a trailing `|alias`, and a `#heading` from a link string. */
export function stripLinktext(raw: unknown): string {
  let s = stringifyFrontmatterValue(raw).trim();
  const m = s.match(/^!?\[\[(.*?)\]\]$/);
  if (m) s = m[1];
  s = s.split('|')[0];
  s = s.split('#')[0];
  return s.trim();
}

/**
 * A wikilink string for `target` suitable for storing in `fromPath`'s
 * frontmatter. Always a `[[wikilink]]` regardless of the vault's "Use
 * [[Wikilinks]]" setting — Obsidian only resolves wikilinks inside frontmatter.
 */
export function relationLinkText(app: App, target: TFile, fromPath: string): string {
  return `[[${app.metadataCache.fileToLinktext(target, fromPath, true)}]]`;
}

/** Resolve a frontmatter link string to a file in the vault, or null. */
export function resolveLinktext(app: App, raw: unknown, fromPath: string): TFile | null {
  const path = stripLinktext(raw);
  if (!path) return null;
  return app.metadataCache.getFirstLinkpathDest(path, fromPath);
}

/** True when the frontmatter link string `raw` resolves to `target`. */
export function linkResolvesTo(app: App, raw: unknown, fromPath: string, target: TFile): boolean {
  return resolveLinktext(app, raw, fromPath)?.path === target.path;
}

/** Coerce a frontmatter value into an array of entries (scalar → [scalar], null → []). */
export function toEntryArray(value: unknown): unknown[] {
  if (value == null || value === '') return [];
  return Array.isArray(value) ? (value as unknown[]).slice() : [value];
}

/** Collapse a list back to how Obsidian stores properties: [] → undefined, [x] → x. */
export function collapseEntries(entries: unknown[]): unknown {
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];
  return entries;
}
