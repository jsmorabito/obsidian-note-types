/**
 * The only module that touches Obsidian's undocumented canvas internals.
 * Canvas has no public view API, so everything else in src/canvas talks to the
 * canvas through the typed helpers here. If an Obsidian update breaks the
 * canvas integration, this is the file to patch.
 */
import type { App, ItemView, TFile } from 'obsidian';

export interface CanvasNodeLike {
  id?: string;
  nodeEl?: HTMLElement;
  text?: string;
  /** Set on file nodes. */
  file?: TFile;
  /** A file node's embedded note view, loaded on demand. `dirty` means it holds edits not yet saved. */
  child?: { dirty?: boolean };
  unloadChild?: () => void;
  filePath?: string;
  setFile?: (file: TFile, subpath?: string, force?: boolean) => void;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  startEditing?: () => void;
  moveAndResize?: (rect: { x: number; y: number; width: number; height: number }) => void;
  getData?: () => Record<string, unknown>;
  setData?: (data: Record<string, unknown>) => void;
  /** Obsidian round-trips unrecognised node fields through this bag. */
  unknownData?: Record<string, unknown>;
}

export interface EdgeEnd {
  node: CanvasNodeLike;
  side: string;
  end: string;
}

export interface CanvasEdgeLike {
  id: string;
  label?: string;
  from: EdgeEnd;
  to: EdgeEnd;
  lineGroupEl?: Element;
  labelElement?: { wrapperEl?: HTMLElement; focus?: (...args: unknown[]) => void };
  editLabel?: () => void;
  getData: () => Record<string, unknown>;
}

export interface CanvasLike {
  wrapperEl: HTMLElement;
  nodes?: Map<string, CanvasNodeLike>;
  posFromEvt?: (evt: { clientX: number; clientY: number }) => { x: number; y: number };
  createTextNode?: (opts: {
    pos: { x: number; y: number };
    size?: { width: number; height: number };
    text?: string;
    save?: boolean;
    focus?: boolean;
  }) => CanvasNodeLike | undefined;
  createGroupNode?: (opts: {
    pos: { x: number; y: number };
    size: { width: number; height: number };
    label?: string;
    save?: boolean;
    focus?: boolean;
  }) => CanvasNodeLike | undefined;
  createFileNode?: (opts: {
    pos: { x: number; y: number };
    size?: { width: number; height: number };
    file: TFile;
    save?: boolean;
    focus?: boolean;
  }) => CanvasNodeLike | undefined;
  removeNode?: (node: CanvasNodeLike) => void;
  selectOnly?: (node: CanvasNodeLike) => void;
  toggleSelect?: (node: CanvasNodeLike) => void;
  zoomToBbox?: (bbox: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  getViewportBBox?: () => { minX: number; minY: number; maxX: number; maxY: number };
  /** `false` saves without recording an undo step. */
  requestSave?: (pushHistory?: boolean) => void;
  /** Obsidian's debounced (250ms) history push; `.run()` flushes it now. */
  requestPushHistory?: { run?: () => void; cancel?: () => void };
  pushHistory?: (data: unknown) => void;
  history?: { data: unknown[]; current: number; canUndo?: () => boolean; canRedo?: () => boolean };
  undo?: () => void;
  redo?: () => void;
  getData?: () => unknown;
  deselectAll?: () => void;
  selection?: Set<object>;
  edges?: Map<string, CanvasEdgeLike>;
  removeEdge?: (edge: CanvasEdgeLike) => void;
  markDirty?: (node: CanvasNodeLike) => void;
  /** Obsidian's own bottom menu (Card, Note, Media buttons). */
  cardMenuEl?: HTMLElement;
  /**
   * Obsidian's drag from a menu button: shows an outline of `size` that follows the pointer (with
   * snapping) and calls `onDrop` with the top-left of where it landed, if that is on the canvas.
   */
  dragTempNode?: (e: PointerEvent, size: { width: number; height: number }, onDrop: (pos: { x: number; y: number }) => void) => void;
  importData?: (data: { nodes: unknown[]; edges: unknown[] }, replace?: boolean) => unknown;
  /** The selection pop-up menu. Obsidian empties and rebuilds `menuEl` on every selection change. */
  menu?: { menuEl?: HTMLElement };
}

export interface CanvasViewLike extends ItemView {
  canvas?: CanvasLike;
}

/** Returns the view as a canvas view whose canvas has finished mounting, else null. */
export function asCanvasView(view: unknown): CanvasViewLike | null {
  const v = view as Partial<CanvasViewLike> | null | undefined;
  if (!v || typeof v.getViewType !== 'function' || v.getViewType() !== 'canvas') return null;
  return v.canvas?.wrapperEl ? (v as CanvasViewLike) : null;
}

/** Client (screen) coordinates → canvas coordinates. */
export function toCanvasPoint(
  canvas: CanvasLike,
  evt: { clientX: number; clientY: number },
): { x: number; y: number } | null {
  return canvas.posFromEvt ? canvas.posFromEvt(evt) : null;
}

export function getExtra(node: CanvasNodeLike, key: string): unknown {
  return node.getData?.()[key] ?? node.unknownData?.[key];
}

/** Merge fields into a node's data. Fields Obsidian doesn't know about are kept in `unknownData` by `setData`. */
export function patchData(node: CanvasNodeLike, patch: Record<string, unknown>): void {
  if (node.getData && node.setData) node.setData({ ...node.getData(), ...patch });
}

export function setExtra(node: CanvasNodeLike, key: string, value: unknown): void {
  if (node.unknownData) node.unknownData[key] = value;
  if (node.getData && node.setData) {
    const data = node.getData();
    data[key] = value;
    node.setData(data);
  }
}

/**
 * Run `fn` as one undo step. An empty canvas has no baseline history entry
 * (Obsidian calls createPlaceholder instead of pushHistory), so the first
 * edit would otherwise be un-undoable; push the pre-edit state first. After
 * `fn`, flush the debounced history push so rapid gestures don't merge.
 */
export function batch<T>(canvas: CanvasLike, fn: () => T): T {
  if (canvas.history?.data.length === 0) canvas.pushHistory?.(canvas.getData?.());
  const result = fn();
  canvas.requestSave?.();
  canvas.requestPushHistory?.run?.();
  return result;
}

export function createTextNode(
  canvas: CanvasLike,
  opts: { pos: { x: number; y: number }; size: { width: number; height: number }; text?: string; focus?: boolean },
): CanvasNodeLike | undefined {
  if (!canvas.createTextNode) throw new Error('Canvas internals changed: createTextNode is unavailable');
  return canvas.createTextNode({ ...opts, text: opts.text ?? '', save: true });
}

export function createGroupNode(
  canvas: CanvasLike,
  opts: { pos: { x: number; y: number }; size: { width: number; height: number }; label?: string; focus?: boolean },
): CanvasNodeLike | undefined {
  if (!canvas.createGroupNode) throw new Error('Canvas internals changed: createGroupNode is unavailable');
  return canvas.createGroupNode({ ...opts, label: opts.label ?? '', save: true });
}

export function removeNode(canvas: CanvasLike, node: CanvasNodeLike): void {
  canvas.removeNode?.(node);
}

export function createFileNode(
  canvas: CanvasLike,
  opts: { pos: { x: number; y: number }; size: { width: number; height: number }; file: TFile },
): CanvasNodeLike | undefined {
  if (!canvas.createFileNode) throw new Error('Canvas internals changed: createFileNode is unavailable');
  return canvas.createFileNode({ ...opts, save: true, focus: false });
}

export interface Box { x: number; y: number; width: number; height: number }

export function nodeBox(node: CanvasNodeLike): Box | null {
  const { x, y, width, height } = node;
  return x === undefined || y === undefined || width === undefined || height === undefined
    ? null
    : { x, y, width, height };
}

/**
 * Select `node` and zoom the view onto it. `insetLeftPx` keeps the node clear
 * of a floating panel on the left: the box is padded on that side, by an
 * amount worked out from the zoom Obsidian will pick (it fits a box with 10% margin, max zoom 1).
 */
export function focusNode(canvas: CanvasLike, node: CanvasNodeLike, insetLeftPx = 0): void {
  const box = nodeBox(node);
  canvas.deselectAll?.();
  canvas.selectOnly?.(node);
  if (!box) return;
  const rect = canvas.wrapperEl.getBoundingClientRect();
  const fitZoom = (w: number): number => Math.min(1, rect.width / (1.1 * w), rect.height / (1.1 * box.height));
  let pad = 0;
  if (insetLeftPx > 0 && rect.width > 0 && rect.height > 0) {
    for (let i = 0; i < 3; i++) pad = insetLeftPx / fitZoom(box.width + pad);
  }
  canvas.zoomToBbox?.({ minX: box.x - pad, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height });
}

/** Centre of what the user is looking at, in canvas coordinates. */
export function viewportCenter(canvas: CanvasLike): { x: number; y: number } {
  const bb = canvas.getViewportBBox?.();
  return bb ? { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 } : { x: 0, y: 0 };
}

export function isEdge(o: object): o is CanvasEdgeLike {
  return 'from' in o && 'to' in o && 'getData' in o;
}

export function selectedNodes(canvas: CanvasLike): CanvasNodeLike[] {
  return [...(canvas.selection ?? [])].filter((o): o is CanvasNodeLike => !isEdge(o));
}

/**
 * While a connection is being dragged, the edge's far end is a temporary
 * pseudo-node that isn't part of the canvas. True once both ends are real.
 */
export function isConnected(canvas: CanvasLike, edge: CanvasEdgeLike): boolean {
  const real = (n: CanvasNodeLike): boolean => n.id !== undefined && canvas.nodes?.get(n.id) === n;
  return real(edge.from.node) && real(edge.to.node);
}

/**
 * Edge data with a new label. When `reversed`, the end nodes swap and the
 * arrow follows, so the edge always points the way the relation really runs.
 */
export function relabeled(data: Record<string, unknown>, label: string | undefined, reversed = false): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data, label };
  if (!label) delete out.label;
  if (reversed) {
    out.fromNode = data.toNode; out.fromSide = data.toSide;
    out.toNode = data.fromNode; out.toSide = data.fromSide;
    out.toEnd = 'arrow';
    delete out.fromEnd;
  }
  return out;
}

/** Remove an edge without saving; the caller saves or restores it. */
export function dropEdge(canvas: CanvasLike, edge: CanvasEdgeLike): void {
  canvas.removeEdge?.(edge);
}

/** Add (or replace, by id) an edge from JSON Canvas data. */
export function putEdge(canvas: CanvasLike, data: Record<string, unknown>): void {
  if (!canvas.importData) throw new Error('Canvas internals changed: importData is unavailable');
  canvas.importData({ nodes: [], edges: [data] }, false);
}

/** A fresh edge id, in the form Obsidian uses (16 hex characters). */
export function newEdgeId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Call `cb` whenever the selection changes. Obsidian rebuilds the selection
 * pop-up menu on every change, so a child-list observer on it is the signal.
 * Returns a function that stops watching.
 */
export function watchSelection(canvas: CanvasLike, cb: () => void): () => void {
  const menuEl = canvas.menu?.menuEl;
  if (!menuEl) return () => { /* nothing to stop */ };
  const observer = new MutationObserver(cb);
  observer.observe(menuEl, { childList: true });
  return () => observer.disconnect();
}

/**
 * Reload the embedded note of file nodes showing one of `paths`. An embed keeps its own copy of the
 * text, so after the plugin edits a note it can keep showing the old version. This is what Obsidian does
 * when a node's file changes (drop the child, let the next render reload it); an embed with unsaved
 * typing is skipped.
 */
export function reloadEmbeds(canvas: CanvasLike, paths: ReadonlySet<string>): void {
  for (const node of canvas.nodes?.values() ?? []) {
    if (!node.file || !paths.has(node.file.path) || node.child?.dirty) continue;
    node.unloadChild?.();
    canvas.markDirty?.(node);
  }
}

/** The path of the file a canvas shows, found through the view that owns it. */
export function canvasFilePath(app: App, canvas: CanvasLike): string | undefined {
  let path: string | undefined;
  app.workspace.iterateAllLeaves((leaf) => {
    const view = asCanvasView(leaf.view);
    if (view?.canvas === canvas) path = (view as { file?: TFile | null }).file?.path;
  });
  return path;
}

/**
 * Point file nodes whose note was missing at `file`. A file node looks its note up
 * only when its path is set, so a node restored by redo while the note was gone keeps
 * showing a missing-file placeholder after the note is recreated, unless it is re-bound.
 */
export function rebindFileNodes(canvas: CanvasLike, file: TFile): void {
  for (const node of canvas.nodes?.values() ?? []) {
    if (node.filePath === file.path && !node.file) node.setFile?.(file, '', true);
  }
}

/*
 * `instanceof Element` (or Node, HTMLElement) is false for an element that lives in another window, such as
 * a canvas popped out of the main window, because each window has its own copy of those classes. Check
 * what the object can do instead.
 */
export function isElement(target: EventTarget | null | undefined): target is Element {
  return !!target && typeof (target as Element).closest === 'function';
}

export function isNode(target: EventTarget | null | undefined): target is Node {
  return !!target && typeof (target as Node).nodeType === 'number';
}

/** Keep presses and scrolling on a floating panel from reaching the canvas underneath. */
export function shieldFromCanvas(el: HTMLElement): void {
  for (const type of ['pointerdown', 'wheel'] as const) el.addEventListener(type, (e) => e.stopPropagation());
}
