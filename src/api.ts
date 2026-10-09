// ─── Public API for other plugins ────────────────────────────────────────────
//
// Other plugins (Canvas Plus, for one) read note types and relations through
// this object rather than reaching into the plugin class:
//
//   const api = app.plugins.getPlugin('filtered-file-commands')?.api;
//   if (api?.version >= 1) api.getNoteTypeForFile(file);
//
// Treat it as a stable contract: add members freely, but bump `version` and keep
// the old members working when changing what one does.

import type { TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from './main.ts';
import type { NoteType, RelationType } from './types.ts';
import { RelationSides, resolvedRelation } from './relations.ts';

export const NOTE_TYPES_API_VERSION = 1;

/** One relation entry found in a note's frontmatter (see `listRelationsForFile`). */
export interface RelationRef {
  /** Frontmatter key on the note this relation was read from. */
  ownKey: string;
  /** Frontmatter key on the other note (for removing the back-link). */
  otherKey: string;
  /** Human label for the menu, e.g. "Related to" or "Blocked by". */
  label: string;
  direction: 'forward' | 'reverse';
  /** The raw link text, stripped of `[[ ]]` / alias. */
  linktext: string;
  /** Resolved target file, or null if the link is unresolved. */
  targetFile: TFile | null;
}

/** A relation type's keys and labels with blanks filled in (see `resolvedRelation`). */
export type ResolvedRelation = ReturnType<typeof resolvedRelation>;

export interface NoteTypesApi {
  readonly version: number;

  /** The configured note types. Live objects: read them, don't edit them. */
  getNoteTypes(): readonly NoteType[];
  /** The first note type whose detection rules match `file`, or undefined. */
  getNoteTypeForFile(file: TFile): NoteType | undefined;
  /** Every markdown note that matches `type`. */
  getNoteTypeFiles(type: NoteType): TFile[];
  /** Create a note of `type` from its template. Null when it already exists or creation failed (a notice says why). */
  createNote(type: NoteType, title: string, fieldValues?: Record<string, string>, description?: string): Promise<TFile | null>;

  /** The configured relation types. Live objects: read them, don't edit them. */
  getRelationTypes(): readonly RelationType[];
  resolveRelation(rt: RelationType): ResolvedRelation;
  /** Add a relation type with a forward name and an optional reverse name. Keys are derived and kept unique. */
  addRelationType(name: string, reverseName?: string): Promise<RelationType>;
  /** Put back a relation type removed with `removeRelationType` (no-op if its id is present). */
  restoreRelationType(rt: RelationType): Promise<void>;
  /** Remove a relation type's definition. Notes keep their frontmatter. The built-in type can't be removed. */
  removeRelationType(id: string): Promise<void>;

  /** Every relation entry in `file`'s frontmatter, across all relation types. */
  listRelationsForFile(file: TFile): RelationRef[];
  /** Whether `file`'s frontmatter holds a link to `target` under `key`. */
  hasRelationLink(file: TFile, key: string, target: TFile): boolean;
  /** Write the relation on both notes. Reports which sides it actually wrote, so a caller can undo exactly that. */
  addRelation(source: TFile, target: TFile, rt: RelationType): Promise<RelationSides>;
  /** Write just the given sides of a relation. */
  writeRelationSides(source: TFile, target: TFile, rt: RelationType, sides: RelationSides): Promise<void>;
  /** Remove just the given sides of a relation, leaving any other link between the notes alone. */
  removeRelationSides(source: TFile, target: TFile, rt: RelationType, sides: RelationSides): Promise<void>;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function createApi(plugin: FilteredFileCommandsPlugin): NoteTypesApi {
  return {
    version: NOTE_TYPES_API_VERSION,

    getNoteTypes: () => plugin.settings.noteTypes,
    getNoteTypeForFile: (file) => plugin.getNoteTypeForFile(file),
    getNoteTypeFiles: (type) => plugin.getNoteTypeFiles(type),
    createNote: (type, title, fieldValues, description) => plugin.createNote(type, title, fieldValues, description),

    getRelationTypes: () => plugin.settings.relationTypes,
    resolveRelation: (rt) => resolvedRelation(rt),
    addRelationType: async (name, reverseName = '') => {
      const types = plugin.settings.relationTypes;
      const taken = new Set(types.flatMap((rt) => [rt.id, rt.frontmatterKey, rt.reverseKey]));
      const base = slugify(name) || 'relation';
      let key = base;
      for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
      const rt: RelationType = {
        id: `rel-${key}`,
        name: name.trim(),
        frontmatterKey: key,
        reverseName: reverseName.trim(),
        reverseKey: '',
      };
      types.push(rt);
      await plugin.saveSettings();
      return rt;
    },
    restoreRelationType: async (rt) => {
      if (plugin.settings.relationTypes.some((r) => r.id === rt.id)) return;
      plugin.settings.relationTypes.push(rt);
      await plugin.saveSettings();
    },
    removeRelationType: async (id) => {
      const types = plugin.settings.relationTypes;
      if (!types.some((r) => r.id === id && !r.builtin)) return;
      plugin.settings.relationTypes = types.filter((r) => r.id !== id);
      await plugin.saveSettings();
    },

    listRelationsForFile: (file) => plugin.listRelationsForFile(file),
    hasRelationLink: (file, key, target) => plugin.hasRelationLink(file, key, target),
    addRelation: (source, target, rt) => plugin.addRelation(source, target, rt),
    writeRelationSides: (source, target, rt, sides) => plugin.writeRelationSides(source, target, rt, sides),
    removeRelationSides: (source, target, rt, sides) => plugin.removeRelationSides(source, target, rt, sides),
  };
}
