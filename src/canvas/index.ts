import { ItemView, WorkspaceLeaf, debounce } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { asCanvasView, isElement } from './adapter.ts';
import { CanvasController } from './controller.ts';
import { registerIcons } from './icons.ts';
import { actionForKey, toolForKey } from './tools.ts';

/** Elements where typing must never trigger a tool shortcut. */
function isTypingTarget(target: EventTarget | null): boolean {
  // Not `instanceof HTMLElement`: that is false for an element in a popout window.
  if (!isElement(target)) return false;
  return (target as HTMLElement).isContentEditable || target.closest('input, textarea, select, [contenteditable="true"], .cm-editor') !== null;
}

/**
 * Attaches canvas tools (toolbar, shortcuts, placement) to every open canvas
 * view, and tears them down on unload.
 */
export function registerCanvasTools(plugin: FilteredFileCommandsPlugin): void {
  plugin.register(registerIcons());
  const controllers = new Map<ItemView, CanvasController>();
  let active: CanvasController | null = null;

  // Shortcuts and "which canvas is active" are tracked per window: a popout window has its own document, and
  // events in it never reach the main window's. Each document is wired once, when a canvas first appears in it.
  const wired = new WeakSet<Document>();
  const wireDocument = (doc: Document): void => {
    if (wired.has(doc)) return;
    wired.add(doc);
    // "Active" means the last pointerdown or focus landed inside that canvas.
    plugin.registerDomEvent(doc, 'pointerdown', (e) => {
      const hit = [...controllers.values()].find((c) => c.contains(e.target));
      if (hit) { active = hit; return; }
      // Picking from a modal, menu or suggestion list shouldn't switch shortcuts off.
      const popup = isElement(e.target) && e.target.closest('.modal-container, .menu, .suggestion-container, .tooltip');
      if (!popup) active = null;
    }, true);
    plugin.registerDomEvent(doc, 'focusin', (e) => {
      const hit = [...controllers.values()].find((c) => c.contains(e.target));
      if (hit) active = hit;
    }, true);

    plugin.registerDomEvent(doc, 'keydown', (e) => {
      if (!active || e.defaultPrevented || e.isComposing) return;
      if (plugin.app.workspace.getActiveViewOfType(ItemView) !== active.view) return;
      if (e.key === 'Escape') {
        if (active.escape()) e.stopPropagation();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const action = e.shiftKey ? undefined : actionForKey(key);
      if (action) {
        e.preventDefault();
        active.runAction(action.id);
        return;
      }
      const tool = toolForKey(key, e.shiftKey);
      if (!tool) return;
      e.preventDefault();
      active.setTool(tool.id);
    }, true);
  };

  const sync = (): void => {
    const seen = new Set<ItemView>();
    plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      const view = asCanvasView(leaf.view);
      if (!view) return;
      seen.add(view);
      // A canvas moved into (or out of) a popout window now lives in another document: start over there.
      const existing = controllers.get(view);
      if (existing && existing.doc !== view.containerEl.doc) {
        existing.destroy();
        controllers.delete(view);
        if (active === existing) active = null;
      }
      if (!controllers.has(view)) {
        wireDocument(view.containerEl.doc);
        controllers.set(view, new CanvasController(plugin, view));
      }
    });
    for (const [view, controller] of controllers) {
      if (seen.has(view)) continue;
      controller.destroy();
      controllers.delete(view);
      if (active === controller) active = null;
    }
  };
  plugin.addCommand({
    id: 'toggle-canvas-note-card',
    name: 'Cycle selected canvas note cards between card, embed and styled link',
    checkCallback: (checking) => {
      const view = plugin.app.workspace.getActiveViewOfType(ItemView);
      const controller = view ? controllers.get(view) : undefined;
      if (!controller) return false;
      if (!checking) controller.toggleSelectedCards();
      return true;
    },
  });
  // The canvas mounts a beat after its leaf appears.
  const syncSoon = (): void => { window.setTimeout(() => { sync(); sweepVisible(); }, 50); };

  plugin.app.workspace.onLayoutReady(sync);
  plugin.registerEvent(plugin.app.workspace.on('active-leaf-change', syncSoon));
  plugin.registerEvent(plugin.app.workspace.on('layout-change', syncSoon));

  // Frontmatter edits (type, relations) restyle note cards without waiting for the timer.
  // Canvases in background tabs don't need redrawing; they catch up when shown again.
  const sweepVisible = (): void => {
    for (const controller of controllers.values()) {
      if (controller.view.containerEl.isShown()) controller.sweep();
    }
  };
  plugin.registerEvent(plugin.app.metadataCache.on('changed', debounce(sweepVisible, 300, true)));
  plugin.registerInterval(window.setInterval(sweepVisible, 1000));

  plugin.register(() => {
    for (const controller of controllers.values()) controller.destroy();
    controllers.clear();
    active = null;
  });
}
