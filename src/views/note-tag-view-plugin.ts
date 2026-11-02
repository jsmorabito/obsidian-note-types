import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { editorInfoField, Notice } from 'obsidian';
import type { Extension, Range } from '@codemirror/state';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteType } from '../types.ts';
import { sanitizeNoteTitle } from '../utils/helpers.ts';
import { iconMaskUrl } from '../utils/icon-mask.ts';
import { refreshNoteLinkStylesEffect } from './note-link-view-plugin.ts';

const TAG_CLASS = 'ffc-note-tag';
const TYPE_ATTR = 'data-ffc-note-tag-type';
const TAG_SEGMENT_PREFIX = 'tag-';
const ADD_ICON = 'lucide-file-input';

const LIST_PREFIX = /^(\s*)(\d+[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s+)?)/;
const BLOCK_MARKER = /^\s*(?:#{1,6}\s+|>\s*)/;

/** Tag names are letters, digits and dashes, without the leading `#`. */
export function normalizeNoteTag(raw: string): string {
  return raw.trim().replace(/^#+/, '');
}

export function noteTagError(raw: string): string | null {
  const tag = normalizeNoteTag(raw);
  if (!tag) return null;
  const bad = tag.match(/[^a-zA-Z0-9-]/);
  return bad ? `Tags can only contain letters, numbers and dashes (found "${bad[0]}").` : null;
}

/** The note title carried by a tagged line: the line without its list marker, block marker and tags. */
function titleFromTaggedLine(line: string): string {
  return sanitizeNoteTitle(line.replace(BLOCK_MARKER, '').replace(LIST_PREFIX, '').replace(/#[^\s]+/g, ''));
}

/** `tag-foo` from a hashtag syntax node name like `formatting_hashtag_tag-foo`; null for other nodes. */
function tagNameFromNode(nodeName: string): string | null {
  if (!nodeName.includes('hashtag')) return null;
  const segment = nodeName.split('_').find((p) => p.startsWith(TAG_SEGMENT_PREFIX) && p.length > TAG_SEGMENT_PREFIX.length);
  return segment ? segment.slice(TAG_SEGMENT_PREFIX.length) : null;
}

interface TagStyle { typeId: string; color: string }

function tagStyles(plugin: FilteredFileCommandsPlugin): Map<string, TagStyle> {
  const map = new Map<string, TagStyle>();
  for (const t of plugin.settings.noteTypes) {
    const tag = normalizeNoteTag(t.tag ?? '').toLowerCase();
    if (tag && !map.has(tag)) map.set(tag, { typeId: t.id, color: t.linkColor?.trim() ?? '' });
  }
  return map;
}

/**
 * Gives each note type a tag of its own. The tag is recoloured in the editor
 * (when the type has a link colour). Clicking the hover icon after it opens the
 * New note dialog to create a note of that type from the line, which then
 * becomes a link to the new note.
 */
export function buildNoteTagViewPlugin(plugin: FilteredFileCommandsPlugin): Extension {
  const noteTypeFor = (id: string | null): NoteType | undefined =>
    id ? plugin.settings.noteTypes.find((t) => t.id === id) : undefined;

  /** Create the note for the tagged line at `pos`, then replace the line with a link to it. */
  const createFromLine = (view: EditorView, pos: number, noteType: NoteType): void => {
    const line = view.state.doc.lineAt(pos);
    const title = titleFromTaggedLine(line.text);
    const original = line.text;
    const prefix = original.match(LIST_PREFIX)?.[0] ?? '';
    const sourcePath = view.state.field(editorInfoField, false)?.file?.path ?? '';

    // Other tags on the line stay, after the link.
    const tag = normalizeNoteTag(noteType.tag ?? '').toLowerCase();
    const otherTags = (original.match(/#[^\s]+/g) ?? []).filter((t) => t.slice(1).toLowerCase() !== tag);

    /** The line still holding `original`, nearest where it was: lines may have moved while the dialog was open. */
    const findLine = (): { from: number; to: number } | null => {
      const doc = view.state.doc;
      let best: { from: number; to: number } | null = null;
      let bestDistance = Infinity;
      for (let n = 1; n <= doc.lines; n++) {
        const l = doc.line(n);
        if (l.text !== original) continue;
        const distance = Math.abs(n - line.number);
        if (distance < bestDistance) { best = { from: l.from, to: l.to }; bestDistance = distance; }
      }
      return best;
    };

    const finish = (file: Parameters<typeof plugin.app.fileManager.generateMarkdownLink>[0]): void => {
      const current = findLine();
      if (!current) { new Notice('The line changed, so it was not replaced with a link.'); return; }
      const link = plugin.app.fileManager.generateMarkdownLink(file, sourcePath);
      view.dispatch({ changes: { from: current.from, to: current.to, insert: [prefix + link, ...otherTags].join(' ') } });
    };

    // The same New note dialog as the New note command, on this tag's type and the line's text.
    plugin.openNewNoteModal(async (selectedType, finalTitle, fieldValues, description) => {
      const file = await plugin.createNote(selectedType, finalTitle, fieldValues, description);
      if (file) finish(file);
    }, title, '', null, undefined, noteType);
  };

  const decorations = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      // Settings changes arrive as refreshNoteLinkStylesEffect (see refreshNoteLinkStyles).
      update(update: ViewUpdate): void {
        const forced = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshNoteLinkStylesEffect)));
        if (forced || update.docChanged || update.viewportChanged) this.decorations = this.build(update.view);
      }

      build(view: EditorView): DecorationSet {
        const styles = tagStyles(plugin);
        if (styles.size === 0) return Decoration.none;
        const ranges: { from: number; to: number; style: TagStyle }[] = [];
        for (const { from, to } of view.visibleRanges) {
          syntaxTree(view.state).iterate({
            from, to,
            enter: (node) => {
              const name = tagNameFromNode(node.name);
              const style = name ? styles.get(name.toLowerCase()) : undefined;
              if (style) ranges.push({ from: node.from, to: node.to, style });
            },
          });
        }
        ranges.sort((a, b) => a.from - b.from);
        // Obsidian splits a tag into `#` and name nodes; one mark per tag keeps the fill unbroken.
        const merged: typeof ranges = [];
        for (const r of ranges) {
          const prev = merged[merged.length - 1];
          if (prev && prev.to === r.from && prev.style.typeId === r.style.typeId) prev.to = r.to;
          else merged.push({ ...r });
        }
        const iconUrl = iconMaskUrl(ADD_ICON); // retried on every rebuild if the icon isn't registered yet
        const addIconVar = iconUrl ? `--ffc-note-tag-icon: ${iconUrl}` : '';
        const marks: Range<Decoration>[] = merged.map(({ from, to, style }) =>
          Decoration.mark({
            class: TAG_CLASS,
            attributes: {
              [TYPE_ATTR]: style.typeId,
              style: [style.color && `--ffc-note-tag-color: ${style.color}`, addIconVar].filter(Boolean).join('; '),
            },
          }).range(from, to));
        return Decoration.set(marks);
      }
    },
    { decorations: (v) => v.decorations },
  );

  /** True when the pointer is over the hover icon after the tag name, which only exists while it is showing. */
  const onIcon = (event: MouseEvent, tagEl: HTMLElement): boolean => {
    if (!tagEl.parentElement?.classList.contains('cm-hashtag-end')) return false;
    const after = getComputedStyle(tagEl, '::after');
    const iconWidth = parseFloat(after.width);
    if (!(iconWidth > 0)) return false;
    const rects = tagEl.getClientRects();
    const last = rects.item(rects.length - 1);
    if (!last) return false;
    return event.clientX >= last.right - iconWidth && event.clientX <= last.right
      && event.clientY >= last.top && event.clientY <= last.bottom;
  };

  const click = EditorView.domEventHandlers({
    click: (event, view) => {
      const tagEl = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(`.${TAG_CLASS}`);
      const noteType = noteTypeFor(tagEl?.getAttribute(TYPE_ATTR) ?? null);
      if (!tagEl || !noteType || !onIcon(event, tagEl)) return false;
      event.preventDefault();
      event.stopPropagation();
      createFromLine(view, view.posAtDOM(tagEl), noteType);
      return true;
    },
  });

  return [decorations, click];
}
