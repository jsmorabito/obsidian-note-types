import { Decoration, EditorView, keymap, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { Extension, Prec } from '@codemirror/state';
import { Editor, editorInfoField, getIcon, Notice, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteType } from '../types.ts';
import { NewNoteModal } from '../ui/new-note-modal.ts';
import { sanitizeNoteTitle } from '../utils/helpers.ts';
import { noteLinkStyleParts } from '../utils/icon-mask.ts';
import {
  cancelInlineNote, inlineNoteField, inlineQuery, InlineNoteState, matchingNoteTypes,
  moveInlineIndex, pickInlineType, startInlineNote, wrapIndex,
} from './inline-note-state.ts';

function iconOf(noteType: NoteType): string { return noteType.linkIcon?.trim() ?? ''; }

/**
 * The pill's look comes from the same `ffc-note-link` rules as a finished
 * styled link: colour and icon travel as CSS custom properties on the element.
 */
function pillStyle(noteType: NoteType): string {
  return noteLinkStyleParts(noteType.linkColor, iconOf(noteType)).join('; ');
}

/** The pill on its own, shown before any title is typed (the icon, or the type name without one). */
class TypePillWidget extends WidgetType {
  constructor(private name: string, private style: string) { super(); }

  eq(other: TypePillWidget): boolean { return other.name === this.name && other.style === this.style; }

  toDOM(): HTMLElement {
    const el = createSpan({ cls: 'ffc-note-link ffc-inline-pill', attr: { 'aria-label': this.name } });
    if (this.style) el.setAttribute('style', this.style);
    if (!this.style.includes('--ffc-note-link-icon')) el.setText(this.name);
    return el;
  }

  ignoreEvent(): boolean { return true; }
}

/** Begin the flow at the cursor. */
export function startInlineTypedNote(plugin: FilteredFileCommandsPlugin, editor: Editor): void {
  const view = (editor as unknown as { cm?: EditorView }).cm;
  if (!view) { new Notice('Create typed note inline needs an editor to be open.'); return; }
  if (plugin.settings.noteTypes.length === 0) { new Notice('Create a note type first.'); return; }
  view.dispatch({ effects: startInlineNote.of(view.state.selection.main.head) });
  view.focus();
}

export function buildInlineTypedNote(plugin: FilteredFileCommandsPlugin): Extension {
  const noteTypeFor = (id: string | null): NoteType | undefined =>
    id ? plugin.settings.noteTypes.find((t) => t.id === id) : undefined;

  const filtered = (view: EditorView, s: InlineNoteState): NoteType[] =>
    matchingNoteTypes(plugin.settings.noteTypes, inlineQuery(view.state, s));

  const commitPick = (view: EditorView, s: InlineNoteState, typeId: string): void => {
    view.dispatch({
      changes: { from: s.anchor, to: view.state.selection.main.head },
      selection: { anchor: s.anchor },
      effects: pickInlineType.of(typeId),
    });
  };

  const linkFor = (view: EditorView, file: TFile): string =>
    plugin.app.fileManager.generateMarkdownLink(file, view.state.field(editorInfoField, false)?.file?.path ?? '');

  /** Swap `[from, to]` for `insert`, but only if it still holds `original` (the editor may have moved on). */
  const replaceIfUnchanged = (view: EditorView, from: number, to: number, original: string, insert: string): void => {
    const doc = view.state.doc;
    if (to > doc.length || doc.sliceString(from, to) !== original) return;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      effects: cancelInlineNote.of(null),
    });
  };

  const hasFields = (noteType: NoteType): boolean => (noteType.fields ?? []).some((f) => f.key?.trim());

  // Views with a create call in flight, so a second Enter can't create twice.
  const creating = new WeakSet<EditorView>();

  /**
   * Create the note, then swap the typed title for a link to it. The link is
   * only written once the note exists, so a failed or duplicate create leaves
   * the pill and title in place to edit.
   */
  const finish = async (view: EditorView, s: InlineNoteState, noteType: NoteType): Promise<void> => {
    const original = view.state.doc.sliceString(s.anchor, s.end);
    const title = sanitizeNoteTitle(original);
    if (!title) { new Notice('Please enter a title.'); return; }

    if (hasFields(noteType)) {
      // The note type asks for fields, so hand over to the New note dialog.
      const { anchor: from, end: to } = s;
      view.dispatch({ effects: cancelInlineNote.of(null) });
      new NewNoteModal(plugin.app, noteType, async (finalTitle, fieldValues, description) => {
        const file = await plugin.createNote(noteType, finalTitle, fieldValues, description);
        if (file) replaceIfUnchanged(view, from, to, original, linkFor(view, file));
      }, title).open();
      return;
    }

    if (creating.has(view)) return;
    creating.add(view);
    try {
      const file = await plugin.createNote(noteType, title);
      if (!file) return;
      const current = view.state.field(inlineNoteField, false);
      if (current && current.typeId === s.typeId) {
        const link = linkFor(view, file);
        view.dispatch({
          changes: { from: current.anchor, to: current.end, insert: link },
          selection: { anchor: current.anchor + link.length },
          effects: cancelInlineNote.of(null),
        });
      }
    } finally {
      creating.delete(view);
    }
  };

  const move = (delta: number) => (view: EditorView): boolean => {
    const s = view.state.field(inlineNoteField);
    if (!s || s.typeId) return false;
    view.dispatch({ effects: moveInlineIndex.of(delta) });
    return true;
  };

  const keys = Prec.highest(keymap.of([
    { key: 'ArrowDown', run: move(1) },
    { key: 'ArrowUp',   run: move(-1) },
    {
      key: 'Enter',
      run: (view) => {
        const s = view.state.field(inlineNoteField);
        if (!s || view.composing) return false;
        if (!s.typeId) {
          const items = filtered(view, s);
          const picked = items[wrapIndex(s.index, items.length)];
          if (picked) commitPick(view, s, picked.id);
          return true;
        }
        const noteType = noteTypeFor(s.typeId);
        if (!noteType) { view.dispatch({ effects: cancelInlineNote.of(null) }); return false; }
        void finish(view, s, noteType);
        return true;
      },
    },
    {
      key: 'Escape',
      run: (view) => {
        if (!view.state.field(inlineNoteField)) return false;
        view.dispatch({ effects: cancelInlineNote.of(null) });
        return true;
      },
    },
    {
      // Backspace with nothing left to delete removes the pill (or closes the picker).
      key: 'Backspace',
      run: (view) => {
        const s = view.state.field(inlineNoteField);
        const sel = view.state.selection.main;
        if (!s || !sel.empty || sel.head !== s.anchor) return false;
        view.dispatch({ effects: cancelInlineNote.of(null) });
        return true;
      },
    },
  ]));

  // Clicking elsewhere or switching tabs abandons the flow (the typed text stays).
  const blur = EditorView.domEventHandlers({
    blur: (_e, view) => {
      if (view.state.field(inlineNoteField, false)) view.dispatch({ effects: cancelInlineNote.of(null) });
      return false;
    },
  });

  // Pill while a type is picked; a subtle box around the picker's search text.
  const decorations = EditorView.decorations.compute([inlineNoteField], (state): DecorationSet => {
    const s = state.field(inlineNoteField);
    if (!s) return Decoration.none;
    if (!s.typeId) {
      const head = state.selection.main.head;
      return head > s.anchor
        ? Decoration.set([Decoration.mark({ class: 'ffc-inline-query' }).range(s.anchor, head)])
        : Decoration.none;
    }
    const noteType = noteTypeFor(s.typeId);
    if (!noteType) return Decoration.none;
    const style = pillStyle(noteType);
    if (s.end === s.anchor) {
      const pill = new TypePillWidget(noteType.name, style);
      return Decoration.set([Decoration.widget({ widget: pill, side: -1 }).range(s.anchor)]);
    }
    // With a title typed, one mark carries the whole pill, as a finished link does.
    const attributes: Record<string, string> = { 'data-ffc-type-name': noteType.name };
    if (style) attributes.style = style;
    const mark = Decoration.mark({ class: 'ffc-note-link ffc-inline-pill', attributes });
    return Decoration.set([mark.range(s.anchor, s.end)]);
  });

  const popup = ViewPlugin.fromClass(class {
    private el: HTMLElement | null = null;
    private list: HTMLElement | null = null;
    private contentKey = '';

    constructor(private view: EditorView) {}

    update(update: ViewUpdate): void {
      const s = update.state.field(inlineNoteField);
      if (!s) { this.close(); return; }
      if (s.typeId) {
        this.close();
        // The picked type was deleted in settings: nothing left to create.
        if (!noteTypeFor(s.typeId)) {
          queueMicrotask(() => {
            if (this.view.state.field(inlineNoteField, false)) this.view.dispatch({ effects: cancelInlineNote.of(null) });
          });
        }
        return;
      }

      const items    = filtered(update.view, s);
      const selected = wrapIndex(s.index, items.length);
      const key      = `${selected}|${items.map((t) => `${t.id}:${t.name}:${iconOf(t)}`).join(',')}`;

      let moved = false;
      if (!this.el) {
        // Owner document, not the global one: the editor may live in a popout window.
        this.el = update.view.dom.ownerDocument.body.createDiv({
          cls: 'suggestion-container ffc-inline-popup ffc-inline-popup-hidden',
        });
        this.list = this.el.createDiv({ cls: 'suggestion' });
        moved = true;
      }
      if (key !== this.contentKey) {
        this.contentKey = key;
        this.fill(items, selected);
        moved = true;
      }
      if (moved || update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged) {
        this.position();
      }
    }

    private fill(items: NoteType[], selected: number): void {
      const list = this.list;
      if (!list) return;
      list.empty();
      if (items.length === 0) {
        list.createDiv({ cls: 'suggestion-item ffc-inline-popup-empty', text: 'No note types found' });
      }
      items.forEach((noteType, i) => {
        const row = list.createDiv({ cls: 'suggestion-item ffc-inline-popup-item' });
        if (i === selected) row.addClass('is-selected');
        const svg = iconOf(noteType) ? getIcon(iconOf(noteType)) : null;
        if (svg) row.createSpan({ cls: 'ffc-inline-popup-icon' }).appendChild(svg);
        row.createSpan({ text: noteType.name });
        // mousedown (not click) with preventDefault keeps focus in the editor.
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const current = this.view.state.field(inlineNoteField);
          if (current && !current.typeId) commitPick(this.view, current, noteType.id);
        });
      });
      list.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
    }

    /** Below the caret, flipped above it near the window's bottom, kept inside the window. */
    private position(): void {
      const el = this.el;
      if (!el) return;
      // Layout can't be read inside update(), so position once CM has measured.
      this.view.requestMeasure({
        key: this,
        read: (v) => {
          const win = v.dom.ownerDocument.defaultView;
          return {
            coords: v.coordsAtPos(v.state.selection.main.head),
            size: el.getBoundingClientRect(),
            winW: win?.innerWidth ?? 0,
            winH: win?.innerHeight ?? 0,
          };
        },
        write: ({ coords, size, winW, winH }) => {
          if (this.el !== el) return;
          if (coords) {
            const gap = 4;
            const below = coords.bottom + gap;
            const top = below + size.height > winH && coords.top - gap - size.height >= 0
              ? coords.top - gap - size.height
              : below;
            const left = Math.max(8, Math.min(coords.left, winW - size.width - 8));
            el.setCssProps({ left: `${left}px`, top: `${top}px` });
          }
          el.removeClass('ffc-inline-popup-hidden');
        },
      });
    }

    private close(): void {
      this.el?.remove();
      this.el = null;
      this.list = null;
      this.contentKey = '';
    }

    destroy(): void { this.close(); }
  });

  return [inlineNoteField, keys, blur, decorations, popup];
}
