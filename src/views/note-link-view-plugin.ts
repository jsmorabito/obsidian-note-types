import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, StateEffect } from '@codemirror/state';
import type { FilteredFileCommandsPlugin } from '../main.ts';
import { statusToClass, statusSvg } from '../utils/status-svg.ts';

/**
 * Dispatched to every editor by `refreshNoteLinkStyles()` after the styled-note
 * set is rebuilt (e.g. a settings change). CM6 only calls `update()` when a
 * transaction touches the doc/viewport/selection, so without this a link the
 * caret is currently inside keeps its stale decoration until the next edit.
 */
export const refreshNoteLinkStylesEffect = StateEffect.define<null>();

class StatusIconWidget extends WidgetType {
  constructor(private readonly cls: string, private readonly svg: SVGElement) { super(); }

  toDOM(): HTMLElement {
    const span = createSpan();
    span.className = `ffc-status-icon ${this.cls}`;
    span.appendChild(this.svg);
    return span;
  }

  eq(other: StatusIconWidget): boolean { return other.cls === this.cls; }
  ignoreEvent(): boolean { return true; }
}

/**
 * Scans the CM6 document for wikilinks whose targets are detected notes with
 * styledLinks or showStatusInLinks enabled, and applies decorations.
 *
 * Status icons use Decoration.widget() (a point decoration before the [[) so
 * CM6 never splits them — unlike Decoration.mark() which gets split into one
 * span per bracket/text segment when the cursor enters the link.
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
       * we apply the class directly to the DOM elements here.
       */
      applyFoldedLinkClasses(view: EditorView): void {
        const basenames        = ffcPlugin.styledNoteBasenames;
        const previewBasenames = ffcPlugin.previewNoteBasenames;
        const hasStyled  = basenames        && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;

        view.dom.querySelectorAll('a.internal-link[data-href]').forEach((el) => {
          const href     = (el.getAttribute('data-href') ?? '').split('#')[0].trim();
          const basename = href.includes('/') ? href.split('/').pop() ?? href : href;
          const isStyled = hasStyled && (basenames.has(href) || basenames.has(basename));
          (el as HTMLElement).classList.toggle('ffc-note-link', isStyled);
          (el as HTMLElement).classList.toggle('ffc-note-preview-link',
            hasPreview && (previewBasenames.has(href) || previewBasenames.has(basename)));
          const color = isStyled ? ffcPlugin.noteLinkColor(href) : undefined;
          if (color) (el as HTMLElement).style.setProperty('--ffc-note-link-color', color);
          else       (el as HTMLElement).style.removeProperty('--ffc-note-link-color');
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

        const builder = new RangeSetBuilder<Decoration>();
        const text    = view.state.doc.toString();
        const re      = /\[\[([^\]|#\n]+)(?:[|#][^\]\n]*)?\]\]/g;
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

          if (isStyled || isPreview) {
            const cls = [isStyled ? 'ffc-note-link' : '', isPreview ? 'ffc-note-preview-link' : ''].filter(Boolean).join(' ');
            const color = isStyled ? ffcPlugin.noteLinkColor(target) : undefined;
            const spec: Parameters<typeof Decoration.mark>[0] = color
              ? { class: cls, attributes: { style: `--ffc-note-link-color: ${color}` } }
              : { class: cls };
            builder.add(linkFrom, linkTo, Decoration.mark(spec));
          }

          if (hasStatus && !cursorOnLink) {
            const rawStatus = statusMap.get(targetBasename) ?? statusMap.get(target);
            if (rawStatus) {
              const cls = statusToClass(rawStatus);
              const svg = statusSvg(rawStatus);
              if (cls && svg) {
                builder.add(linkFrom + 2, linkFrom + 2, Decoration.widget({
                  widget: new StatusIconWidget(cls, svg),
                  side: -1,
                }));
              }
            }
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
