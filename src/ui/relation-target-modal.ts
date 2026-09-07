import { App, FuzzySuggestModal, TFile } from 'obsidian';
import { stringifyFrontmatterValue } from '../utils/helpers.ts';

/**
 * Fuzzy picker for the target note of a relation. Modelled on
 * {@link FilteredFileModal}, but instead of opening the chosen file it hands it
 * back to `onChoose` so the caller can write the relation.
 */
export class RelationTargetModal extends FuzzySuggestModal<TFile> {
  private files: TFile[];
  private onChoose: (file: TFile) => void;

  constructor(app: App, files: TFile[], relationLabel: string, onChoose: (file: TFile) => void) {
    super(app);
    this.files    = files;
    this.onChoose = onChoose;
    this.setPlaceholder(`${relationLabel}…`);
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'relate' },
      { command: 'esc', purpose: 'dismiss' },
    ]);
  }

  private getTitle(file: TFile): string {
    const title: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.['title'];
    return title ? stringifyFrontmatterValue(title) : file.basename;
  }

  getItems(): TFile[] { return this.files; }

  getItemText(file: TFile): string { return `${this.getTitle(file)} ${file.path}`; }

  renderSuggestion(match: { item: TFile }, el: HTMLElement): void {
    const file = match.item;
    el.createSpan({ text: this.getTitle(file), cls: 'suggestion-title' });
    const folder = file.parent?.path;
    if (folder && folder !== '/') {
      el.createSpan({ text: folder, cls: 'suggestion-note' });
    }
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}
