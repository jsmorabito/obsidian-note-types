/** Extra field on a `text` node marking free text, which has no card chrome. Stored in canvas files, so the name must not change. */
export const FIELD_KIND = 'athensKind';
export const KIND_TEXT = 'text';

/** Default node sizes, in canvas units. */
export const SIZE_CARD  = { width: 260, height: 120 };
export const SIZE_TEXT  = { width: 240, height: 40 };
export const SIZE_GROUP = { width: 480, height: 320 };

/** Minimums when drag-creating a node. */
export const MIN_DRAW_WIDTH       = 80;
export const MIN_DRAW_HEIGHT      = 40;
export const MIN_DRAW_HEIGHT_TEXT = 24;

/** Screen-pixel travel under which a press counts as a click, not a drag. */
export const CLICK_SLOP_PX = 5;

/** Note card (a file node for a typed note). */
export const SIZE_NOTE_CARD = { width: 260, height: 100 };

/** Gap kept between nodes when auto-placing a new note card. */
export const PLACE_GAP = 24;

/** Extra field on a `text` node holding one freehand stroke. Stored in canvas files, so the name must not change. */
export const FIELD_INK = 'athensInk';

/** Canvas preset colours as hex, for SVG that has to carry its own colour (matches Obsidian's palette). */
export const PRESET_HEX: Record<string, string> = {
  '1': '#e93147', '2': '#ec7500', '3': '#e0ac00', '4': '#08b94e', '5': '#00bfbc', '6': '#7852ee',
};

/** Ink with no colour. In the canvas it follows the theme's text colour instead. */
export const INK_FALLBACK_HEX = '#1a1a1a';

/** Screen pixels around the pointer that count as touching a stroke when erasing. */
export const ERASER_RADIUS_PX = 8;

/** Extension field on a file node in the styled link view: the size to go back to when it leaves that view. */
export const FIELD_CARD_SIZE = 'ffcCardSize';
