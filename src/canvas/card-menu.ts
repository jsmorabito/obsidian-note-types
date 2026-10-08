import { setIcon } from 'obsidian';
import { CanvasLike } from './adapter.ts';
import { SIZE_NOTE_CARD } from './constants.ts';
import { NOTE_TYPES_ICON } from './icons.ts';
import { ACTIONS, TOOLS, ToolId, isPenTool } from './tools.ts';

export interface CardMenuHooks {
  onPick: (tool: ToolId) => void;
  /** The note button was clicked, not dragged. */
  onNoteClick: () => void;
  /** The note button was dragged onto the canvas and dropped. `pos` is the top-left of the card. */
  onNoteDrop: (pos: { x: number; y: number }) => void;
  onPenColor: (color: string) => void;
}

/**
 * Select on its own at the left, then Obsidian's own draggable Card, Note and Media buttons with ours, then
 * the rest of the tools you pick (text, group, and the drawing tools) together at the right.
 */
const LEADING: ToolId[][] = [['select']];
const TRAILING: ToolId[] = ['text', 'group', 'marker', 'highlighter', 'eraser'];

const ITEM_CLASS = 'ffc-card-menu-item';
/** The button an earlier version added to this menu on its own. */
const LEGACY_CLASS = 'ffc-canvas-note-btn';

function shortcut(key: string, shift = false): string {
  return `${shift ? '⇧' : ''}${key.toUpperCase()}`;
}

/**
 * Adds this plugin's tools to Obsidian's own bottom card menu (`canvas-card-menu`), so one bar holds
 * everything. Tools you pick are control items; Add note is a real `canvas-card-menu-button
 * mod-draggable`, so Obsidian's own CSS gives it the lift, grab cursor and accent hover, and its own
 * `dragTempNode` does the drag.
 */
export class CardMenu {
  private toolItems = new Map<ToolId, HTMLElement>();
  private penRow: HTMLElement;
  private swatches = new Map<string, HTMLElement>();

  constructor(private canvas: CanvasLike, private menuEl: HTMLElement, hooks: CardMenuHooks) {
    // Anything left by an earlier load, or an earlier version, has dead handlers: replace it.
    menuEl.querySelectorAll(`.${ITEM_CLASS}, .${LEGACY_CLASS}`).forEach((el) => el.remove());

    // Before Obsidian's buttons: select, then a divider.
    const front: HTMLElement[] = [];
    for (const ids of LEADING) {
      front.push(this.toolGroup(ids, hooks), menuEl.createDiv({ cls: `canvas-card-menu-divider ${ITEM_CLASS}` }));
    }
    menuEl.prepend(...front);

    // After them: our draggable button, then a divider and the other tools.
    this.addNoteButton(hooks);
    menuEl.createDiv({ cls: `canvas-card-menu-divider ${ITEM_CLASS}` });
    this.toolGroup(TRAILING, hooks);

    // Pen colours: none and the six canvas presets, using core's colour picker items.
    this.penRow = menuEl.createDiv({ cls: `canvas-menu ffc-pen-colors ${ITEM_CLASS}` });
    for (const value of ['', '1', '2', '3', '4', '5', '6']) {
      const swatch = this.penRow.createDiv({
        cls: `canvas-color-picker-item${value ? ` mod-canvas-color-${value}` : ''}`,
        attr: { 'aria-label': value ? `Color ${value}` : 'No color', 'data-tooltip-position': 'top' },
      });
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        hooks.onPenColor(value);
      });
      this.swatches.set(value, swatch);
    }
    this.penRow.hide();
  }

  /** A row of control items, one per tool. */
  private toolGroup(ids: ToolId[], hooks: CardMenuHooks): HTMLElement {
    // Created as a child of the menu (so it is built in the menu's own window), then moved if it belongs at the front.
    const group = this.menuEl.createDiv({ cls: `${ITEM_CLASS} ffc-menu-tools` });
    for (const id of ids) {
      const tool = TOOLS.find((t) => t.id === id);
      if (!tool) continue;
      const item = group.createDiv({
        cls: 'canvas-control-item',
        attr: { 'aria-label': `${tool.label} (${shortcut(tool.key, tool.shift)})`, 'data-tooltip-position': 'top' },
      });
      setIcon(item, tool.icon);
      item.addEventListener('click', () => hooks.onPick(id));
      this.toolItems.set(id, item);
    }
    return group;
  }

  private addNoteButton(hooks: CardMenuHooks): void {
    const key = shortcut(ACTIONS[0]?.key ?? 'n');
    const btn = this.menuEl.createDiv({
      cls: `canvas-card-menu-button mod-draggable ${ITEM_CLASS}`,
      attr: { 'aria-label': `Drag to add note (${key})`, 'data-tooltip-position': 'top' },
    });
    setIcon(btn, NOTE_TYPES_ICON);
    btn.addEventListener('click', () => hooks.onNoteClick());
    // Obsidian's own drag from a menu button: it shows the outline of the card, snaps it, and
    // reports where it was dropped (not at all if it was dropped outside the canvas).
    btn.addEventListener('pointerdown', (e) => {
      this.canvas.dragTempNode?.(e, SIZE_NOTE_CARD, (pos) => hooks.onNoteDrop(pos));
    });
  }

  /** Mark the armed tool: its control item turns accent coloured, as core's active controls do. */
  setActive(tool: ToolId): void {
    for (const [id, el] of this.toolItems) el.toggleClass('is-active', id === tool);
    this.penRow.toggle(isPenTool(tool));
  }

  /** Mark which pen colour is selected. */
  setPenColor(color: string): void {
    for (const [value, el] of this.swatches) el.toggleClass('is-active', value === color);
  }

  destroy(): void {
    this.menuEl.querySelectorAll(`.${ITEM_CLASS}`).forEach((el) => el.remove());
    this.toolItems.clear();
    this.swatches.clear();
  }
}
