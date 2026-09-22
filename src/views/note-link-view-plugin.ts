import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, StateEffect } from '@codemirror/state';
import { editorInfoField, getIcon } from 'obsidian';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { iconMaskUrl, prependIconSpan, statusIconDataUrl } from '../utils/icon-mask.ts';
import { statusSvg } from '../utils/status-svg.ts';

/** The file this editor is actually showing, for link-resolution purposes. */
function sourcePathOf(view: EditorView): string {
  return view.state.field(editorInfoField, false)?.file?.path ?? '';
}

/**
 * Dispatched to every editor by `refreshNoteLinkStyles()` after the styled-note
 * set is rebuilt (e.g. a settings change). CM6 only calls `update()` when a
 * transaction touches the doc/viewport/selection, so without this a link the
 * caret is currently inside keeps its stale decoration until the next edit.
 */
export const refreshNoteLinkStylesEffect = StateEffect.define<null>();

/**
 * Scans the CM6 document for wikilinks whose targets are detected notes with
 * styledLinks or showStatusInLinks enabled, and applies decorations.
 *
 * The type icon and status icon are both carried as CSS custom properties on
 * a single Decoration.mark() covering the whole link (see styles.css for the
 * ::before/::after rules that render them) rather than as a
 * Decoration.widget(). A widget placed *inside* a marked range forces CM6 to
 * split that mark into multiple sibling spans — one before the widget, one
 * after — each getting its own background, which breaks a styled link's pill
 * in two. A plain style attribute on one contiguous mark doesn't cause that
 * split.
 */
export function buildNoteLinkViewPlugin(ffcPlugin: FilteredFileCommandsPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
        this.applyFoldedLinkClasses(view);
      }

      update(update: ViewUpdate): void {
        const forced = update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(refreshNoteLinkStylesEffect)));
        if (forced || update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.build(update.view);
          this.applyFoldedLinkClasses(update.view);
        }
      }

      /**
       * When the cursor is outside a wikilink, Obsidian replaces CM6 spans with
       * a widget <a> element. Decoration.mark() doesn't reach those widgets, so
       * we apply the class directly to the DOM elements here (this is a rarer
       * path than build()'s mark-based rendering below — most Live Preview
       * wikilinks render as nested <span> without ever becoming a real <a>).
       */
      applyFoldedLinkClasses(view: EditorView): void {
        const basenames        = ffcPlugin.styledNoteBasenames;
        const previewBasenames = ffcPlugin.previewNoteBasenames;
        const statusMap        = ffcPlugin.statusNoteMap;
        const hasStyled  = basenames        && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;
        const hasStatus  = statusMap        && statusMap.size  > 0;
        const sourcePath = sourcePathOf(view);

        view.dom.querySelectorAll('a.internal-link[data-href]').forEach((el) => {
          const href     = (el.getAttribute('data-href') ?? '').split('#')[0].trim();
          const basename = href.includes('/') ? href.split('/').pop() ?? href : href;
          const isStyled = hasStyled && (basenames.has(href) || basenames.has(basename));
          (el as HTMLElement).classList.toggle('ffc-note-link', isStyled);
          (el as HTMLElement).classList.toggle('ffc-note-preview-link',
            hasPreview && (previewBasenames.has(href) || previewBasenames.has(basename)));

          const { color, icon: iconId } = isStyled ? ffcPlugin.noteLinkStyle(href, sourcePath) : {};
          if (color) (el as HTMLElement).style.setProperty('--ffc-note-link-color', color);
          else       (el as HTMLElement).style.removeProperty('--ffc-note-link-color');

          // Type icon prepended first, status second: prepend() always inserts
          // as the new first child, so the *later* call ends up leftmost —
          // keeps status visually first, matching the `order: -1` used for
          // the same pairing in build()'s CM6 mark path below.
          el.querySelector(':scope > .ffc-link-icon')?.remove();
          const iconSvg = iconId ? getIcon(iconId) : null;
          if (iconSvg) prependIconSpan(el as HTMLElement, iconSvg, 'ffc-link-icon');

          el.querySelector(':scope > .ffc-status-icon:not(.ffc-link-icon)')?.remove();
          const rawStatus = hasStatus ? (statusMap.get(basename) ?? statusMap.get(href)) : undefined;
          const statusSvgEl = rawStatus ? statusSvg(rawStatus) : null;
          if (statusSvgEl) prependIconSpan(el as HTMLElement, statusSvgEl);
        });
      }

      build(view: EditorView): DecorationSet {
        const basenames        = ffcPlugin.styledNoteBasenames;
        const previewBasenames = ffcPlugin.previewNoteBasenames;
        const statusMap        = ffcPlugin.statusNoteMap;
        const hasStyled  = basenames        && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;
        const hasStatus  = statusMap        && statusMap.size  > 0;
        if (!hasStyled && !hasPreview && !hasStatus) return Decoration.none;

        const builder    = new RangeSetBuilder<Decoration>();
        const text       = view.state.doc.toString();
        const re         = /\[\[([^\]|#\n]+)(?:[|#][^\]\n]*)?\]\]/g;
        const sourcePath = sourcePathOf(view);
        let m: RegExpExecArray | null;

        const selection = view.state.selection;

        while ((m = re.exec(text)) !== null) {
          const target         = m[1].trim();
          const targetBasename = target.includes('/') ? target.split('/').pop() ?? target : target;
          const isStyled  = hasStyled  && (basenames.has(target)        || basenames.has(targetBasename));
          const isPreview = hasPreview && (previewBasenames.has(target)  || previewBasenames.has(targetBasename));
          const linkFrom  = m.index;
          const linkTo    = m.index + m[0].length;
          const cursorOnLink = selection.ranges.some(r => r.from <= linkTo && r.to >= linkFrom);

          const rawStatus = hasStatus && !cursorOnLink
            ? (statusMap.get(targetBasename) ?? statusMap.get(target))
            : undefined;
          const statusUrl = rawStatus ? statusIconDataUrl(rawStatus) : null;

          if (isStyled || isPreview || statusUrl) {
            const { color, icon: rawIconId } = isStyled ? ffcPlugin.noteLinkStyle(target, sourcePath) : {};
            const iconId  = !cursorOnLink ? rawIconId : undefined;
            const iconUrl = iconId ? iconMaskUrl(iconId) : null;

            // A status-only link (showStatusInLinks on, styledLinks off)
            // gets no 'ffc-note-link' class, so it has no flex container of
            // its own — without one, the status icon's `order: -1` (which
            // needs a flex/grid parent to mean anything) is a no-op and the
            // icon renders in normal document order (after the text) rather
            // than pulled to the front. This lightweight host class exists
            // purely to give it that flex context.
            const clsParts = [
              isStyled ? 'ffc-note-link' : '',
              isPreview ? 'ffc-note-preview-link' : '',
              !isStyled && statusUrl ? 'ffc-note-status-host' : '',
            ];
            const cls = clsParts.filter(Boolean).join(' ');

            const styleParts: string[] = [];
            if (color)     styleParts.push(`--ffc-note-link-color: ${color}`);
            if (iconUrl)   styleParts.push(`--ffc-note-link-icon: ${iconUrl}`);
            if (statusUrl) styleParts.push(`--ffc-note-link-status-icon: ${statusUrl}`);

            const spec: Parameters<typeof Decoration.mark>[0] = {
              ...(cls ? { class: cls } : {}),
              ...(styleParts.length ? { attributes: { style: styleParts.join('; ') } } : {}),
            };
            builder.add(linkFrom, linkTo, Decoration.mark(spec));
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
