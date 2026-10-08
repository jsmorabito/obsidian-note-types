import type { App, Menu, MenuItem, MetadataCache } from 'obsidian';

/**
 * Obsidian internals the public typings leave out. Each is declared once here,
 * with only the part this plugin uses, so call sites stay typed. All of them are
 * private API and can change between Obsidian versions, so callers must cope
 * with them being absent.
 */

/** `MenuItem#setSubmenu`: turns an item into a nested menu. */
export function submenuOf(item: MenuItem): Menu {
  return (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();
}

/** Every tag in the vault, with its leading `#` (from `MetadataCache#getTags`). */
export function allTags(cache: MetadataCache): string[] {
  const { getTags } = cache as MetadataCache & { getTags?: () => Record<string, number> | undefined };
  return Object.keys(getTags?.call(cache) ?? {});
}

interface HotkeyManager {
  customKeys?: Record<string, unknown[] | undefined>;
  save?: () => void;
}

export function hotkeyManager(app: App): HotkeyManager | undefined {
  return (app as App & { hotkeyManager?: HotkeyManager }).hotkeyManager;
}

interface CorePlugin {
  enabled?: boolean;
  instance?: unknown;
}

interface CorePlugins {
  plugins?: Record<string, CorePlugin | undefined>;
  getPluginById?: (id: string) => CorePlugin | undefined;
}

/** Obsidian's built-in plugins (`app.internalPlugins`). */
export function corePlugins(app: App): CorePlugins | undefined {
  return (app as App & { internalPlugins?: CorePlugins }).internalPlugins;
}
