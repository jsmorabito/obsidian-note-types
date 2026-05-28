import type { Editor, EditorPosition } from 'obsidian';

/** A single item returned by an external trigger provider. */
export interface TriggerItem {
  /** Primary text shown in the suggestion row. */
  title: string;
  /** Optional secondary line shown below the title. */
  subtitle?: string;
  /** Arbitrary provider-owned payload; passed back verbatim to selectItem. */
  data?: unknown;
}

/**
 * Implemented by any plugin that wants to contribute items to the @ trigger menu.
 * Register via FilteredFileCommandsPlugin.registerTriggerProvider().
 * Unregister in your plugin's onunload() via unregisterTriggerProvider(id).
 */
export interface TriggerProvider {
  /** Stable unique ID — use your plugin's id, e.g. "obsidian-time-tools". */
  id: string;
  /**
   * Return items matching query (already lowercased).
   * Called on every keystroke; keep it fast.
   */
  getItems(query: string): TriggerItem[];
  /**
   * Optional custom renderer. If omitted the default title + subtitle render is used.
   */
  renderItem?(item: TriggerItem, el: HTMLElement): void;
  /**
   * Called when the user selects an item.
   * Replace [start, end] with your desired text (typically a wikilink).
   */
  selectItem(
    item: TriggerItem,
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
  ): void;
}
