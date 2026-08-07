import { App, FuzzySuggestModal, TFile } from 'obsidian';
import { stringifyFrontmatterValue } from '../utils/helpers.ts';

export class FilteredFileModal extends FuzzySuggestModal<TFile> {
  private files: TFile[];

  constructor(app: App, files: TFile[], typeName?: string) {
    super(app);
    this.files = files;
    this.setPlaceholder(typeName ? `Search ${typeName}…` : 'Type to search filtered files…');
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'open' },
      { command: 'esc', purpose: 'dismiss' },
    ]);
  }

  private getTitle(file: TFile): string {
    const cache = this.app.metadataCache.getFileCache(file);
    const title: unknown = cache?.frontmatter?.['title'];
    return title ? stringifyFrontmatterValue(title) : file.basename;
  }

  getItems(): TFile[] { return this.files; }

  getItemText(file: TFile): string { return this.getTitle(file); }

  renderSuggestion(match: { item: TFile }, el: HTMLElement): void {
    const file = match.item;
    el.createSpan({ text: this.getTitle(file), cls: 'suggestion-title' });
    const folder = file.parent?.path;
    if (folder && folder !== '/') {
      el.createSpan({ text: folder, cls: 'suggestion-note' });
    }
  }

  onChooseItem(file: TFile): void {
    void this.app.workspace.getLeaf(false).openFile(file);
  }
}
