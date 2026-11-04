// ─── CLI handlers (for scripts and AI agents) ────────────────────────────────
//
// Registers non-interactive commands with Obsidian's CLI (1.12.2+), so a shell
// or an agent can read note types and create typed notes. Every handler returns
// JSON, or `{ "error": "..." }` when it can't do what was asked. Command IDs are
// stable API: `filtered-file-commands:<action>`.

import { normalizePath, TFile, type CliData, type CliFlags } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteField, NoteType, RelationType } from '../types.ts';
import { sanitizeNoteTitle } from '../utils/helpers.ts';

const PREFIX = 'filtered-file-commands';

class CliError extends Error {}

function fail(message: string): never {
  throw new CliError(message);
}

function reply(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Wrap a handler so thrown errors come back as JSON instead of an unhandled rejection. */
function safe(run: (p: CliData) => unknown) {
  return async (params: CliData): Promise<string> => {
    try {
      return reply(await run(params));
    } catch (err) {
      return reply({ error: err instanceof CliError ? err.message : `Unexpected error: ${(err as Error).message}` });
    }
  };
}

function required(params: CliData, name: string): string {
  const v = params[name];
  if (typeof v !== 'string' || !v.trim() || v === 'true') fail(`Missing ${name}=<value>.`);
  return v.trim();
}

function same(a: string | undefined, b: string): boolean {
  return !!a && a.trim().toLowerCase() === b.toLowerCase();
}

/**
 * The one item that matches `query` at the first tier that matches anything.
 * Tiers run from the most to the least specific (id, then name, then slug or
 * key), so an exact id never loses to a lookalike name. Several matches in one
 * tier are ambiguous and reported with their ids.
 */
function pick<T extends { id: string }>(
  items: readonly T[],
  query: string,
  tiers: ((item: T) => (string | undefined)[])[],
  kind: string,
  label: (item: T) => string,
): T {
  for (const tier of tiers) {
    const hits = items.filter((item) => tier(item).some((v) => same(v, query)));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) fail(`"${query}" matches several ${kind}s (${hits.map((h) => h.id).join(', ')}). Use an id.`);
  }
  return fail(`No ${kind} "${query}". Available: ${items.map(label).join(', ') || '(none)'}.`);
}

function findNoteType(plugin: FilteredFileCommandsPlugin, query: string): NoteType {
  return pick(plugin.api.getNoteTypes(), query,
    [(t) => [t.id], (t) => [t.name], (t) => [t.commandSlug]], 'note type', (t) => t.name);
}

function findRelationType(plugin: FilteredFileCommandsPlugin, query: string): RelationType {
  const r = (rt: RelationType) => plugin.api.resolveRelation(rt);
  return pick(plugin.api.getRelationTypes(), query, [
    (rt) => [rt.id],
    (rt) => [r(rt).forwardName, r(rt).reverseName],
    (rt) => [r(rt).forwardKey, r(rt).reverseKey],
  ], 'relation type', (rt) => r(rt).forwardName);
}

/** A note by vault path (with or without `.md`) or by link name. */
function findFile(plugin: FilteredFileCommandsPlugin, query: string): TFile {
  const { vault, metadataCache } = plugin.app;
  const direct = vault.getAbstractFileByPath(query) ?? vault.getAbstractFileByPath(`${query}.md`);
  if (direct instanceof TFile) return direct;
  const linked = metadataCache.getFirstLinkpathDest(query.replace(/^\[\[|\]\]$/g, ''), '');
  if (linked) return linked;
  return fail(`No note found for "${query}".`);
}

function describeType(t: NoteType) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    saveFolder: t.saveFolder,
    fields: (t.fields ?? []).filter((f) => f.key?.trim()).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      note: f.type === 'list' ? 'comma-separated values' : undefined,
    })),
  };
}

/** A field value as the text the note template takes: a string, number, boolean, or a list of those. */
function fieldValueText(key: string, value: unknown): string {
  const scalar = (v: unknown): string => {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    return fail(`Field "${key}" must be text, a number, a boolean, or a list of those.`);
  };
  return Array.isArray(value) ? value.map(scalar).join(', ') : scalar(value);
}

function parseFields(raw: string | undefined, type: NoteType): Record<string, string> {
  if (!raw || raw === 'true') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('fields must be a JSON object, e.g. fields=\'{"status":"open"}\'.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('fields must be a JSON object.');
  const known = new Set((type.fields ?? []).map((f) => f.key));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!known.has(key)) fail(`"${key}" is not a field of ${type.name}. Fields: ${[...known].join(', ') || '(none)'}.`);
    out[key] = fieldValueText(key, value);
  }
  return out;
}

/** Fields as a JSON array of keys (`["status"]`) or objects (`{"key","label","type"}`). */
/** A folder path relative to the vault root, or fail if it points outside the vault. */
function vaultFolder(raw: string): string {
  if (!raw) return '';
  const folder = normalizePath(raw).replace(/^\/+|\/+$/g, '');
  if (folder.split('/').some((seg) => seg === '..') || /^[a-z]:/i.test(folder)) {
    fail(`folder must be inside the vault: ${raw}.`);
  }
  return folder === '.' ? '' : folder;
}

function parseFieldDefs(raw: string | undefined): NoteField[] {
  if (!raw || raw === 'true') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('fields must be a JSON array, e.g. fields=\'["status",{"key":"tags","type":"list"}]\'.');
  }
  if (!Array.isArray(parsed)) fail('fields must be a JSON array.');
  const seen = new Set<string>();
  return parsed.map((item: unknown): NoteField => {
    const def = typeof item === 'string' ? { key: item } : (item as Partial<NoteField> | null);
    const key = typeof def?.key === 'string' ? def.key.trim() : '';
    if (!key) fail('Every field needs a "key".');
    if (seen.has(key)) fail(`Duplicate field key "${key}".`);
    seen.add(key);
    if (def?.type !== undefined && def.type !== 'text' && def.type !== 'list') fail(`Field "${key}": type must be "text" or "list".`);
    return { key, label: def?.label?.trim() || key, type: def?.type ?? 'text' };
  });
}

export function registerCliHandlers(plugin: FilteredFileCommandsPlugin): void {
  const add = (
    action: string,
    description: string,
    flags: CliFlags | null,
    run: (p: CliData) => unknown,
  ) => {
    // registerCliHandler throws if the ID is taken (a reload that left it behind).
    // A missing CLI command must never stop the rest of the plugin from loading.
    try {
      plugin.registerCliHandler(`${PREFIX}:${action}`, description, flags, safe(run));
    } catch (err) {
      console.warn(`Note Types: could not register CLI command ${action}:`, err);
    }
  };

  add('types', 'List note types with their creation fields', null, () =>
    plugin.api.getNoteTypes().map(describeType));

  add('create-type', 'Create a note type (also adds its New note command)', {
    name:        { value: '<name>',   description: 'Note type name', required: true },
    description: { value: '<text>',   description: 'What the type is for' },
    template:    { value: '<path>',   description: 'Vault path of a template note, e.g. Templates/Meeting.md' },
    folder:      { value: '<folder>', description: 'Save new notes in this folder (default: vault root)' },
    fields:      { value: '<json>',   description: 'Creation fields: JSON array of keys or {key,label,type} objects; type is text or list' },
  }, async (p) => {
    const name = required(p, 'name');
    if (plugin.api.getNoteTypes().some((t) => same(t.name, name))) fail(`A note type named "${name}" already exists.`);
    const str = (k: string) => (typeof p[k] === 'string' && p[k] !== 'true' ? p[k].trim() : '');
    const template = str('template');
    if (template && !(plugin.app.vault.getAbstractFileByPath(template) instanceof TFile)) fail(`Template not found: ${template}.`);
    const folder = vaultFolder(str('folder'));
    const fields = parseFieldDefs(p.fields);
    // No await between the duplicate check above and createNoteType's synchronous
    // push, so two parallel calls can't both pass the check.
    const noteType = await plugin.createNoteType(name, {
      description: str('description') || undefined,
      templatePath: template,
      saveFolder: folder,
      saveLocation: folder ? 'folder' : 'vault',
      fields,
    });
    return describeType(noteType);
  });

  add('notes', 'List the notes that match a note type', {
    type: { value: '<name>', description: 'Note type name, id or command slug', required: true },
  }, (p) => {
    const type = findNoteType(plugin, required(p, 'type'));
    return plugin.api.getNoteTypeFiles(type).map((f) => f.path);
  });

  add('create', 'Create a note of a note type from its template', {
    type:        { value: '<name>',  description: 'Note type name, id or command slug', required: true },
    title:       { value: '<title>', description: 'Note title (becomes the file name)', required: true },
    fields:      { value: '<json>',  description: 'Field values as a JSON object keyed by field key; see the types command' },
    description: { value: '<text>',  description: 'Text appended to the note body' },
  }, async (p) => {
    const type  = findNoteType(plugin, required(p, 'type'));
    const title = sanitizeNoteTitle(required(p, 'title'));
    if (!title) fail('title has no usable characters.');
    const desc = typeof p.description === 'string' && p.description !== 'true' ? p.description : '';
    const fields = parseFields(p.fields, type);
    if (type.templatePath && !(plugin.app.vault.getAbstractFileByPath(type.templatePath) instanceof TFile)) {
      fail(`The template for ${type.name} is missing: ${type.templatePath}.`);
    }
    const folder = plugin.resolveSaveFolder(type);
    const path   = `${folder ? `${folder}/` : ''}${title}.md`;
    if (plugin.app.vault.getAbstractFileByPath(path)) fail(`A note already exists at ${path}.`);
    const file = await plugin.api.createNote(type, title, fields, desc);
    if (!file) fail(`Could not create ${path}.`);
    return { path: file.path, type: type.name };
  });

  add('relation-types', 'List relation types and their frontmatter keys', null, () =>
    plugin.api.getRelationTypes().map((rt) => {
      const r = plugin.api.resolveRelation(rt);
      return { id: rt.id, name: r.forwardName, key: r.forwardKey, reverseName: r.reverseName, reverseKey: r.reverseKey };
    }));

  add('relations', "List a note's relations to other notes", {
    file: { value: '<path>', description: 'Note path or link name', required: true },
  }, (p) => {
    const file = findFile(plugin, required(p, 'file'));
    return plugin.api.listRelationsForFile(file).map((r) => ({
      relation: r.label,
      direction: r.direction,
      key: r.ownKey,
      target: r.targetFile?.path ?? null,
      linktext: r.linktext,
    }));
  });

  add('relate', 'Link two notes with a relation type (written on both notes)', {
    source:   { value: '<path>', description: 'Source note path or link name', required: true },
    target:   { value: '<path>', description: 'Target note path or link name', required: true },
    relation: { value: '<name>', description: 'Relation type name, id or frontmatter key', required: true },
  }, async (p) => {
    const source = findFile(plugin, required(p, 'source'));
    const target = findFile(plugin, required(p, 'target'));
    const rt     = findRelationType(plugin, required(p, 'relation'));
    if (source.path === target.path) fail('Source and target are the same note.');
    const resolved = plugin.api.resolveRelation(rt);
    if (!resolved.forwardKey) fail(`The relation type "${resolved.forwardName}" has no frontmatter key set.`);
    const sides = await plugin.api.addRelation(source, target, rt);
    return {
      source: source.path,
      target: target.path,
      relation: resolved.forwardName,
      written: sides,
      alreadyRelated: !sides.forward && !sides.reverse,
    };
  });
}
