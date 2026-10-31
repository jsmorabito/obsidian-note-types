import { EditorState, StateEffect, StateField } from '@codemirror/state';
import type { NoteType } from '../types.ts';
import { refreshNoteLinkStylesEffect } from './note-link-view-plugin.ts';

/**
 * State of an in-progress "Create typed note inline" flow.
 *
 * Two stages share one anchor (the document position where the flow began):
 * while `typeId` is null the text from `anchor` to the cursor is the picker's
 * search query; once a type is picked that text is gone, a pill is drawn
 * there, and the text from `anchor` to `end` is the title.
 *
 * `end` grows with typing but stops short of any text that was already after
 * the cursor when the flow began, so that text is never part of the title.
 */
export interface InlineNoteState {
  anchor: number;
  end: number;
  typeId: string | null;
  /** Raw highlight offset; wrap with `wrapIndex` against the filtered list. */
  index: number;
}

export const startInlineNote  = StateEffect.define<number>();
export const pickInlineType   = StateEffect.define<string>();
export const moveInlineIndex  = StateEffect.define<number>();
export const cancelInlineNote = StateEffect.define<null>();

export const inlineNoteField = StateField.define<InlineNoteState | null>({
  create: () => null,
  update(value, tr) {
    let next = value;
    if (next && tr.docChanged) {
      next = {
        ...next,
        anchor: tr.changes.mapPos(next.anchor, -1),
        end: tr.changes.mapPos(next.end, 1),
        index: next.typeId ? next.index : 0,
      };
    }
    for (const e of tr.effects) {
      if (e.is(startInlineNote))               next = { anchor: e.value, end: e.value, typeId: null, index: 0 };
      else if (!next)                          continue;
      else if (e.is(cancelInlineNote))         return null;
      else if (e.is(pickInlineType))           next = { ...next, typeId: e.value, index: 0 };
      else if (e.is(moveInlineIndex))          next = { ...next, index: next.index + e.value };
      // A fresh object makes decorations re-read note type settings (rename, recolour).
      else if (e.is(refreshNoteLinkStylesEffect)) next = { ...next };
    }
    if (!next) return null;

    // Leaving the typed text (or moving before the anchor) ends the flow.
    const head = tr.state.selection.main.head;
    if (head < next.anchor || head > next.end) return null;
    return next;
  },
});

/** The picker's search text: everything between the anchor and the cursor. */
export function inlineQuery(state: EditorState, s: InlineNoteState): string {
  return state.doc.sliceString(s.anchor, state.selection.main.head);
}

export function matchingNoteTypes(types: NoteType[], query: string): NoteType[] {
  const q = query.trim().toLowerCase();
  return q ? types.filter((t) => t.name.toLowerCase().includes(q)) : types;
}

export function wrapIndex(index: number, length: number): number {
  return length === 0 ? 0 : ((index % length) + length) % length;
}
