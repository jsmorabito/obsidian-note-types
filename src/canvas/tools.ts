import { NOTE_TYPES_ICON } from './icons.ts';

export type ToolId = 'select' | 'text' | 'card' | 'group' | 'marker' | 'highlighter' | 'eraser';

export interface ToolDef {
  id: ToolId;
  label: string;
  icon: string;
  /** Single-key shortcut, lower case. */
  key: string;
  /** Needs Shift held (the highlighter is Shift+M). */
  shift?: boolean;
}

/** The tools and their shortcuts. The bottom menu decides which of them get a button. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'select',      label: 'Select',      icon: 'mouse-pointer-2', key: 'v' },
  { id: 'text',        label: 'Text',        icon: 'type',            key: 't' },
  { id: 'card',        label: 'Card',        icon: 'sticky-note',     key: 'c' },
  { id: 'group',       label: 'Group',       icon: 'frame',           key: 'g' },
  { id: 'marker',      label: 'Marker',      icon: 'pencil',          key: 'm' },
  { id: 'highlighter', label: 'Highlighter', icon: 'highlighter',     key: 'm', shift: true },
  { id: 'eraser',      label: 'Eraser',      icon: 'eraser',          key: 'e' },
];

export function toolForKey(key: string, shift: boolean): ToolDef | undefined {
  return TOOLS.find((t) => t.key === key && !!t.shift === shift);
}

/** Tools that place a node by clicking or dragging on the canvas. */
export function isPlacementTool(tool: ToolId): tool is 'text' | 'card' | 'group' {
  return tool === 'text' || tool === 'card' || tool === 'group';
}

/** Freehand tools, which capture drags on the canvas and stay active until another tool is picked. */
export function isInkTool(tool: ToolId): tool is 'marker' | 'highlighter' | 'eraser' {
  return tool === 'marker' || tool === 'highlighter' || tool === 'eraser';
}

/** Tools that draw with a colour. */
export function isPenTool(tool: ToolId): tool is 'marker' | 'highlighter' {
  return tool === 'marker' || tool === 'highlighter';
}

export type ActionId = 'picker';

export interface ActionDef {
  id: ActionId;
  label: string;
  icon: string;
  key: string;
}

/** One-shot actions (they don't change the active tool). */
export const ACTIONS: readonly ActionDef[] = [
  { id: 'picker', label: 'Add note', icon: NOTE_TYPES_ICON, key: 'n' },
];

export function actionForKey(key: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.key === key);
}
