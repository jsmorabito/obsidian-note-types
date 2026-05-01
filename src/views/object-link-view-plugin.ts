import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { FilteredFileCommandsPlugin } from '../main.ts';

/**
 * Scans the CM6 document for wikilinks whose targets are detected objects with
 * styledLinks enabled, and marks those ranges with CSS classes so styling can
 * be applied.
 */
export function buildObjectLinkViewPlugin(ffcPlugin: FilteredFileCommandsPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
        this.applyFoldedLinkClasses(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
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
        const basenames        = ffcPlugin.styledObjectBasenames;
        const previewBasenames = ffcPlugin.previewObjectBasenames;
        const hasStyled  = basenames        && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;

        view.dom.querySelectorAll('a.internal-link[data-href]').forEach((el) => {
          const href     = (el.getAttribute('data-href') ?? '').split('#')[0].trim();
          const basename = href.includes('/') ? href.split('/').pop() ?? href : href;
          (el as HTMLElement).classList.toggle('ffc-obj-link',
            hasStyled  && (basenames.has(href) || basenames.has(basename)));
          (el as HTMLElement).classList.toggle('ffc-obj-preview-link',
            hasPreview && (previewBasenames.has(href) || previewBasenames.has(basename)));
        });
      }

      build(view: EditorView): DecorationSet {
        const basenames        = ffcPlugin.styledObjectBasenames;
        const previewBasenames = ffcPlugin.previewObjectBasenames;
        const hasStyled  = basenames        && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;
        if (!hasStyled && !hasPreview) return Decoration.none;

        const builder = new RangeSetBuilder<Decoration>();
        const text    = view.state.doc.toString();
        const re      = /\[\[([^\]|#\n]+)(?:[|#][^\]\n]*)?\]\]/g;
        let m: RegExpExecArray | null;

        while ((m = re.exec(text)) !== null) {
          const target         = m[1].trim();
          const targetBasename = target.includes('/') ? target.split('/').pop() ?? target : target;
          const isStyled  = hasStyled  && (basenames.has(target)        || basenames.has(targetBasename));
          const isPreview = hasPreview && (previewBasenames.has(target)  || previewBasenames.has(targetBasename));
          if (isStyled || isPreview) {
            const cls = [isStyled ? 'ffc-obj-link' : '', isPreview ? 'ffc-obj-preview-link' : ''].filter(Boolean).join(' ');
            builder.add(m.index, m.index + m[0].length, Decoration.mark({ class: cls }));
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
