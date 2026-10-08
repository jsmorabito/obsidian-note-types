export interface PointerSession {
  move?: (e: PointerEvent) => void;
  up: (e: PointerEvent) => void;
  cancel: () => void;
}

/**
 * Follow one pointer from press to release on `doc`, in the capture phase so nothing on the page can
 * swallow its events. Events from other pointers (a second finger, a palm) are ignored. Returns a
 * function that stops following it.
 */
export function trackPointer(doc: Document, pointerId: number, session: PointerSession): () => void {
  const own = (fn: (e: PointerEvent) => void) => (e: PointerEvent): void => {
    if (e.pointerId === pointerId) fn(e);
  };
  const move = own((e) => session.move?.(e));
  const up = own(session.up);
  const cancel = own(() => session.cancel());
  doc.addEventListener('pointermove', move, true);
  doc.addEventListener('pointerup', up, true);
  doc.addEventListener('pointercancel', cancel, true);
  return () => {
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', up, true);
    doc.removeEventListener('pointercancel', cancel, true);
  };
}
