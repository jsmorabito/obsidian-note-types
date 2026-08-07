import { App, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Editor, TFile } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import type { TriggerProvider, TriggerItem } from '../trigger-registry.ts';

// ── Suggestion item types ──────────────────────────────────────────────────────

interface NoteSuggestionItem {
  kind: 'note';
  file: TFile;
  title: string;
}

interface ProviderSuggestionItem {
  kind: 'provider';
  provider: TriggerProvider;
  item: TriggerItem;
}

type SuggestionItem = NoteSuggestionItem | ProviderSuggestionItem;

// ── Suggest class ──────────────────────────────────────────────────────────────

/**
 * Watches the editor for the user-configured trigger key (e.g. "@") and opens
 * a fuzzy suggestion menu populated by:
 *   1. All files that match any note type's match filters.
 *   2. Items from any registered TriggerProviders (e.g. obsidian-time-tools).
 *
 * Selecting an item inserts a [[wikilink]] or delegates to the provider.
 */
export class NoteTypeSuggest extends EditorSuggest<SuggestionItem> {
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

    // ── Note-type items (existing behaviour) ───────────────────────────────────
    const noteItems: NoteSuggestionItem[] = this._getMatchingFiles()
      .map((file) => {
        const cache = this.app.metadataCache.getFileCache(file);
        const title = cache?.frontmatter?.['title']
          ? String(cache.frontmatter['title'])
          : file.basename;
        return { kind: 'note' as const, file, title };
      })
      .filter(({ title }) => title.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.title.localeCompare(b.title);
      });

    // ── Provider items ─────────────────────────────────────────────────────────
    const providerItems: ProviderSuggestionItem[] = [];
    for (const provider of this.plugin.triggerProviders.values()) {
      for (const item of provider.getItems(query)) {
        providerItems.push({ kind: 'provider', provider, item });
      }
    }

    return [...noteItems, ...providerItems].slice(0, 30);
  }

  private _getMatchingFiles(): TFile[] {
    const seen   = new Set<string>();
    const result: TFile[] = [];
    for (const noteType of this.plugin.settings.noteTypes) {
      if (!noteType.showInTriggerMenu) continue;
      for (const file of this.plugin.getNoteTypeFiles(noteType)) {
        if (!seen.has(file.path)) {
          seen.add(file.path);
          result.push(file);
        }
      }
    }
    return result;
  }

  renderSuggestion(suggestion: SuggestionItem, el: HTMLElement): void {
    if (suggestion.kind === 'provider') {
      if (suggestion.provider.renderItem) {
        suggestion.provider.renderItem(suggestion.item, el);
      } else {
        el.createSpan({ text: suggestion.item.title, cls: 'suggestion-title' });
        if (suggestion.item.subtitle) {
          el.createSpan({ text: suggestion.item.subtitle, cls: 'suggestion-note' });
        }
      }
      return;
    }

    // Note-type item (existing behaviour)
    el.createSpan({ text: suggestion.title, cls: 'suggestion-title' });
    const folder = suggestion.file.parent?.path;
    if (folder && folder !== '/') {
      el.createSpan({ text: folder, cls: 'suggestion-note' });
    }
  }

  selectSuggestion(suggestion: SuggestionItem): void {
    const context = this.context;
    if (!context) return;

    if (suggestion.kind === 'provider') {
      suggestion.provider.selectItem(
        suggestion.item,
        context.editor,
        context.start,
        context.end,
      );
      return;
    }

    // Note-type item (existing behaviour)
    const { file, title } = suggestion;
    const link = title !== file.basename
      ? `[[${file.basename}|${title}]]`
      : `[[${file.basename}]]`;
    context.editor.replaceRange(link, context.start, context.end);
  }
}
