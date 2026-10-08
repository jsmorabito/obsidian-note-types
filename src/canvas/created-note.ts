import { App, Notice, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { CanvasLike, rebindFileNodes } from './adapter.ts';
import type { SideEffect } from './undo-journal.ts';

/** Whether any note other than the note itself and `ignore` (the canvas it sits on) links to `path`. */
function linkedElsewhere(app: App, path: string, ignore: string | undefined): boolean {
  return Object.entries(app.metadataCache.resolvedLinks)
    .some(([source, targets]) => source !== path && source !== ignore && (targets[path] ?? 0) > 0);
}

/**
 * Undo for a note the picker just created: removing its card also moves the note to the trash, but
 * only while that is safe (unchanged since creation, nothing else links to it), so it can be recovered.
 * Redo recreates it and re-points the restored card.
 */
export function createdNoteEffect(
  plugin: FilteredFileCommandsPlugin, canvas: CanvasLike, file: TFile, baseline: string, canvasPath: string | undefined,
): SideEffect {
  const { app } = plugin;
  // Keep the path, not the TFile: after a redo the note is a new file object at the same place.
  const { path, basename } = file;
  return {
    undo: async () => {
      const current = app.vault.getAbstractFileByPath(path);
      if (!(current instanceof TFile)) return;
      const unchanged = (await app.vault.read(current)) === baseline;
      if (!unchanged || linkedElsewhere(app, path, canvasPath)) {
        new Notice(`Kept ${basename}: it has changed or is linked from elsewhere, so only the card was removed.`);
        return;
      }
      await app.fileManager.trashFile(current);
      new Notice(`Moved ${basename} to the trash.`);
    },
    redo: async () => {
      // Something already sits at that path (the user made their own note): leave it alone.
      if (app.vault.getAbstractFileByPath(path)) return;
      const recreated = await app.vault.create(path, baseline);
      // The card came back with the redo while the note was still gone; reconnect it.
      rebindFileNodes(canvas, recreated);
      new Notice(`Recreated ${basename}.`);
    },
  };
}
