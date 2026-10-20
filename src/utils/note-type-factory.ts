import type { NoteType } from '../types.ts';
import { uniqueCommandSlug } from './helpers.ts';

export type SaveLocation = NonNullable<NoteType['saveLocation']>;

/** Where a note type's notes are created, defaulting legacy types by whether they have a folder. */
export function effectiveSaveLocation(noteType: Pick<NoteType, 'saveLocation' | 'saveFolder'>): SaveLocation {
  return noteType.saveLocation ?? (noteType.saveFolder?.trim() ? 'folder' : 'vault');
}

/** A note type with every collection and flag at its default; `overrides` wins. */
export function buildNoteType(
  name: string,
  existing: NoteType[],
  overrides: Partial<NoteType> = {},
): NoteType {
  const taken = new Set(existing.map((o) => o.commandSlug).filter(Boolean));
  return {
    id: `ffc-notetype-${Date.now()}`,
    commandSlug: uniqueCommandSlug(name, taken),
    name,
    templatePath: '',
    saveFolder: '',
    fields: [], matchFilters: [], matchMode: 'all', enableFindCommand: false,
    showInTriggerMenu: false, previewFields: [], canvasFields: [],
    ...overrides,
  };
}
