import { Notice, SuggestModal, TFile, prepareFuzzySearch } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { NoteType } from '../types.ts';
import {
  CanvasLike, CanvasNodeLike, canvasFilePath, createFileNode, focusNode, viewportCenter,
} from './adapter.ts';
import { SIZE_NOTE_CARD } from './constants.ts';
import { findFreeSpot } from './free-spot.ts';
import { createdNoteEffect } from './created-note.ts';
import { fitNodeToCard, noteOfNode } from './note-card.ts';
import { SideEffect, batchWithEffect } from './undo-journal.ts';

type Item =
  | { kind: 'note'; file: TFile; type: NoteType }
  | { kind: 'create'; type: NoteType; title: string };

/**
 * Add a typed note to the canvas. Lists only notes that belong to a note type.
 * When nothing matches, offers "New <Type>: <query>" for each type, which
 * creates the note and its card together. A note already on the canvas is
 * selected and zoomed to instead of being added twice.
 */
export class NotePicker extends SuggestModal<Item> {
  constructor(
    private plugin: FilteredFileCommandsPlugin,
    private canvas: CanvasLike,
    /** Drop point (canvas coordinates, card centred on it). Omit to find a free spot near the view centre. */
    private at: { x: number; y: number } | null = null,
  ) {
    super(plugin.app);
    this.setPlaceholder('Add a note to the canvas…');
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'add to canvas' },
      { command: 'esc', purpose: 'dismiss' },
    ]);
  }

  private typedNotes(): Array<{ file: TFile; type: NoteType }> {
    const seen = new Set<string>();
    const out: Array<{ file: TFile; type: NoteType }> = [];
    for (const type of this.plugin.settings.noteTypes) {
      for (const file of this.plugin.getNoteTypeFiles(type)) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        out.push({ file, type });
      }
    }
    return out;
  }

  getSuggestions(query: string): Item[] {
    const q = query.trim();
    const notes = this.typedNotes();
    if (!q) {
      return notes
        .sort((a, b) => a.file.basename.localeCompare(b.file.basename))
        .map((n): Item => ({ kind: 'note', ...n }));
    }
    const match = prepareFuzzySearch(q);
    const scored: Array<{ item: Item; score: number }> = [];
    for (const n of notes) {
      const fm = this.app.metadataCache.getFileCache(n.file)?.frontmatter;
      const title = typeof fm?.title === 'string' ? fm.title : '';
      const hit = match(`${n.file.basename} ${title}`);
      if (hit) scored.push({ item: { kind: 'note', ...n }, score: hit.score });
    }
    if (scored.length > 0) return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
    return this.plugin.settings.noteTypes.map((type): Item => ({ kind: 'create', type, title: q }));
  }

  renderSuggestion(item: Item, el: HTMLElement): void {
    el.addClass('ffc-picker-row');
    if (item.kind === 'create') {
      el.createSpan({ text: `New ${item.type.name}: ${item.title}`, cls: 'suggestion-title' });
      return;
    }
    el.createSpan({ text: item.file.basename, cls: 'suggestion-title' });
    el.createSpan({ text: item.type.name, cls: 'ffc-note-chip' });
  }

  onChooseSuggestion(item: Item): void {
    if (item.kind === 'note') {
      this.addOrFocus(item.file);
      return;
    }
    void this.plugin.createNote(item.type, item.title).then(async (file) => {
      if (!file) return;
      // What the note holds right now, so undoing the card can take the note away only if nobody has touched it.
      const baseline = await this.app.vault.read(file);
      this.addOrFocus(file, createdNoteEffect(this.plugin, this.canvas, file, baseline, canvasFilePath(this.app, this.canvas)));
    });
  }

  private addOrFocus(file: TFile, effect: SideEffect | null = null): void {
    const existing = [...(this.canvas.nodes?.values() ?? [])].find((n: CanvasNodeLike) => noteOfNode(n)?.path === file.path);
    if (existing) {
      focusNode(this.canvas, existing);
      return;
    }
    try {
      const size = SIZE_NOTE_CARD;
      const pos = this.at
        ? { x: Math.round(this.at.x - size.width / 2), y: Math.round(this.at.y - size.height / 2) }
        : findFreeSpot(this.canvas, viewportCenter(this.canvas), size);
      const node = batchWithEffect(this.canvas, effect, () => createFileNode(this.canvas, { pos, size, file }));
      if (!node) return;
      fitNodeToCard(this.plugin, this.canvas, node);
      if (this.at) {
        this.canvas.deselectAll?.();
        this.canvas.selectOnly?.(node);
      } else {
        focusNode(this.canvas, node);
      }
    } catch (err) {
      new Notice(`Could not add note to canvas: ${(err as Error).message}`);
    }
  }
}
