import { App, Notice, TFile } from 'obsidian';
import { CanvasLike, batch, reloadEmbeds } from './adapter.ts';

/**
 * Canvas undo only covers the canvas, so a note change made by a canvas action (a relation's
 * frontmatter, a key image) would survive Ctrl+Z. An effect is an undo/redo pair for the note side, tied
 * to the history entry the canvas side created: stepping over that entry runs it.
 */
export interface SideEffect {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** The notes this effect changes, so canvas embeds of them can be refreshed. */
  files?: TFile[];
  /** Shown once the note change has been undone / redone, so a change to your notes is never silent. */
  undoNotice?: string;
  redoNotice?: string;
}

/** Keyed by the history snapshot itself, not its index, so entries dropped off the front of the history can't shift it. */
const effects = new WeakMap<object, SideEffect[]>();

const apps = new WeakMap<CanvasLike, App>();

/**
 * After notes change, reload the embeds that show them, once Obsidian has
 * re-indexed the file (or soon after, if that event is missed).
 */
function refreshEmbeds(canvas: CanvasLike, files: TFile[] | undefined): void {
  const app = apps.get(canvas);
  if (!app || !files || files.length === 0) return;
  const paths = new Set(files.map((f) => f.path));
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    app.metadataCache.offref(ref);
    reloadEmbeds(canvas, paths);
  };
  const ref = app.metadataCache.on('changed', (file) => { if (paths.has(file.path)) finish(); });
  window.setTimeout(finish, 600);
}

/** Effects run one after another, so rapid undo and redo can't interleave their file writes. */
let queue: Promise<void> = Promise.resolve();

function run(canvas: CanvasLike, entry: unknown, direction: 'undo' | 'redo'): void {
  const list = typeof entry === 'object' && entry !== null ? effects.get(entry) : undefined;
  if (!list) return;
  // Undo unwinds in reverse order; redo replays in order.
  const ordered = direction === 'undo' ? [...list].reverse() : list;
  queue = queue.then(async () => {
    for (const effect of ordered) {
      try {
        await (direction === 'undo' ? effect.undo() : effect.redo());
        const notice = direction === 'undo' ? effect.undoNotice : effect.redoNotice;
        if (notice) new Notice(notice);
        refreshEmbeds(canvas, effect.files);
      } catch (err) {
        new Notice(`Could not ${direction} part of that change: ${(err as Error).message}`);
      }
    }
  });
}

/**
 * Like `batch`, and ties `effect` to the history entry it creates. When the
 * batch records no new entry, there is nothing for an undo to hang the effect
 * on, so it is dropped rather than attached to an older, unrelated entry.
 */
export function batchWithEffect<T>(canvas: CanvasLike, effect: SideEffect | null, fn: () => T): T {
  const history = canvas.history;
  const before = history ? history.data[history.current] : undefined;
  const result = batch(canvas, fn);
  // The note was already changed before the batch; show the change in any embed of it.
  if (effect) refreshEmbeds(canvas, effect.files);
  const after = history ? history.data[history.current] : undefined;
  if (effect && typeof after === 'object' && after !== null && after !== before) {
    effects.set(after, [...(effects.get(after) ?? []), effect]);
  }
  return result;
}

/** Wrap the canvas's undo and redo so they run the effects of the entry they step over. Returns a function that unwraps them. */
export function attachUndoJournal(canvas: CanvasLike, app: App): () => void {
  apps.set(canvas, app);
  const undo = canvas.undo;
  const redo = canvas.redo;
  if (!undo || !redo) return () => { /* internals changed: nothing to wrap */ };

  canvas.undo = () => {
    const h = canvas.history;
    // The entry being undone is the one the history currently points at.
    const entry = h?.canUndo?.() ? h.data[h.current] : undefined;
    undo.call(canvas);
    run(canvas, entry, 'undo');
  };
  canvas.redo = () => {
    const h = canvas.history;
    // The entry being redone is the one just after the current one.
    const entry = h?.canRedo?.() ? h.data[h.current + 1] : undefined;
    redo.call(canvas);
    run(canvas, entry, 'redo');
  };
  return () => {
    apps.delete(canvas);
    Reflect.deleteProperty(canvas, 'undo');
    Reflect.deleteProperty(canvas, 'redo');
  };
}
