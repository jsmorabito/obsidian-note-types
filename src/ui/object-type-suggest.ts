import { App, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Editor, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';

interface SuggestionItem {
  file: TFile;
  title: string;
}

/**
 * Watches the editor for the user-configured trigger key (e.g. "@") and opens
 * a fuzzy suggestion menu populated by all files that match any object type's
 * match filters. Selecting an item inserts a [[wikilink]] at the cursor.
 */
export class ObjectTypeSuggest extends EditorSuggest<SuggestionItem> {
  private plugin: FilteredFileCommandsPlugin;

  constructor(app: App, plugin: FilteredFileCommandsPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onTrigger(cursor: { line: number; ch: number }, editor: Editor): EditorSuggestTriggerInfo | null {
    const triggerKey = this.plugin.settings.triggerKey;
    if (!triggerKey) return null;

    const line = editor.getLine(cursor.line);
    const sub  = line.substring(0, cursor.ch);

    const triggerIndex = sub.lastIndexOf(triggerKey);
    if (triggerIndex === -1) return null;

    const query         = sub.substring(triggerIndex + triggerKey.length);
    const beforeTrigger = sub.substring(0, triggerIndex);
    if (beforeTrigger.includes('[[') && !beforeTrigger.includes(']]')) return null;

    return {
      start: { line: cursor.line, ch: triggerIndex },
      end: cursor,
      query,
    };
  }

  getSuggestions(context: EditorSuggestContext): SuggestionItem[] {
    const query = context.query.toLowerCase();
    const files = this._getMatchingFiles();
    return files
      .map((file) => {
        const cache = this.app.metadataCache.getFileCache(file);
        const title = cache?.frontmatter?.['title'] ? String(cache.frontmatter['title']) : file.basename;
        return { file, title };
      })
      .filter(({ title }) => title.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.title.localeCompare(b.title);
      })
      .slice(0, 30);
  }

  private _getMatchingFiles(): TFile[] {
    const seen   = new Set<string>();
    const result: TFile[] = [];
    for (const objType of this.plugin.settings.objectTypes) {
      if (!objType.showInTriggerMenu) continue;
      for (const file of this.plugin.getObjectTypeFiles(objType)) {
        if (!seen.has(file.path)) {
          seen.add(file.path);
          result.push(file);
        }
      }
    }
    return result;
  }

  renderSuggestion({ file, title }: SuggestionItem, el: HTMLElement): void {
    el.createEl('span', { text: title, cls: 'suggestion-title' });
    const folder = file.parent?.path;
    if (folder && folder !== '/') {
      el.createEl('span', { text: folder, cls: 'suggestion-note' });
    }
  }

  selectSuggestion({ file, title }: SuggestionItem): void {
    const context = this.context;
    if (!context) return;
    const link = title !== file.basename
      ? `[[${file.basename}|${title}]]`
      : `[[${file.basename}]]`;
    context.editor.replaceRange(link, context.start, context.end);
  }
}
