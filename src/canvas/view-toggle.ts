import { setIcon } from 'obsidian';
import { CanvasLike, CanvasNodeLike } from './adapter.ts';
import { toggleInfo, toggleViews, viewOf } from './note-card.ts';

const BUTTON_CLASS = 'ffc-view-btn';

/**
 * A button in the selection pop-up menu that moves the selected note cards
 * to their next view: card, then full embed, then styled link. It describes
 * where it will go, and updates as the view changes.
 */
export function injectViewToggleButton(canvas: CanvasLike, selected: CanvasNodeLike[], onToggled: () => void): void {
  const menuEl = canvas.menu?.menuEl;
  if (!menuEl) return;
  // Only when everything selected is a note card this plugin has dressed.
  const cards = selected.filter((n) => n.nodeEl?.hasAttribute('data-ffc-note-type'));
  if (cards.length === 0 || cards.length !== selected.length) return;

  let btn = menuEl.querySelector<HTMLElement>(`.${BUTTON_CLASS}`);
  if (!btn) {
    btn = menuEl.createEl('button', { cls: `clickable-icon ${BUTTON_CLASS}`, attr: { 'data-tooltip-position': 'top' } });
    btn.addEventListener('click', () => {
      toggleViews(canvas, cards);
      onToggled();
    });
  }
  const info = toggleInfo(cards.map(viewOf));
  if (btn.getAttribute('aria-label') !== info.label) {
    btn.setAttribute('aria-label', info.label);
    btn.empty();
    setIcon(btn, info.icon);
  }
}
