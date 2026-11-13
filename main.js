"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  FilteredFileCommandsPlugin: () => FilteredFileCommandsPlugin,
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian32 = require("obsidian");

// src/settings.ts
var import_obsidian18 = require("obsidian");

// src/utils/helpers.ts
var import_obsidian2 = require("obsidian");

// src/utils/obsidian-internals.ts
function submenuOf(item) {
  return item.setSubmenu();
}
function allTags(cache) {
  var _a;
  const { getTags } = cache;
  return Object.keys((_a = getTags == null ? void 0 : getTags.call(cache)) != null ? _a : {});
}
function hotkeyManager(app) {
  return app.hotkeyManager;
}
function corePlugins(app) {
  return app.internalPlugins;
}
function communityPluginSettings(app, id) {
  var _a, _b;
  const plugins = app.plugins;
  return (_b = (_a = plugins == null ? void 0 : plugins.plugins) == null ? void 0 : _a[id]) == null ? void 0 : _b.settings;
}

// src/ui/frontmatter-value-suggest.ts
var import_obsidian = require("obsidian");
function stringifyFrontmatterValue(v) {
  if (v == null)
    return "";
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch (e) {
    return "";
  }
}
var FrontmatterValueSuggest = class {
  constructor(app, inputEl, key, fieldType) {
    this.dropdown = null;
    this.suggestions = [];
    this.selectedIndex = -1;
    this.app = app;
    this.inputEl = inputEl;
    this.key = key;
    this.fieldType = fieldType;
    this._onInput = () => this.refresh();
    this._onFocus = () => this.refresh();
    this._onBlur = () => window.setTimeout(() => this.close(), 150);
    this._onKeydown = (e) => this.handleKeydown(e);
    inputEl.addEventListener("input", this._onInput);
    inputEl.addEventListener("focus", this._onFocus);
    inputEl.addEventListener("blur", this._onBlur);
    inputEl.addEventListener("keydown", this._onKeydown);
  }
  // ── Data ──────────────────────────────────────────────────────────────────────
  getVaultValues() {
    var _a, _b;
    const values = /* @__PURE__ */ new Set();
    if (this.key === "tags" || this.key === "tag") {
      for (const tag of allTags(this.app.metadataCache)) {
        values.add(tag.startsWith("#") ? tag.slice(1) : tag);
      }
    }
    for (const file of this.app.vault.getMarkdownFiles()) {
      const raw = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b[this.key];
      if (raw == null)
        continue;
      if (Array.isArray(raw)) {
        raw.forEach((v) => {
          if (v != null)
            values.add(stringifyFrontmatterValue(v).trim());
        });
      } else {
        const s = stringifyFrontmatterValue(raw).trim();
        if (s)
          values.add(s);
      }
    }
    return [...values].filter(Boolean).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }
  activeTerm() {
    var _a;
    return this.fieldType === "list" ? ((_a = this.inputEl.value.split(",").pop()) != null ? _a : "").trim() : this.inputEl.value.trim();
  }
  alreadyEntered() {
    if (this.fieldType !== "list")
      return [];
    return this.inputEl.value.split(",").slice(0, -1).map((s) => s.trim().toLowerCase());
  }
  // ── Selection ─────────────────────────────────────────────────────────────────
  select(value) {
    if (this.fieldType === "list") {
      const parts = this.inputEl.value.split(",");
      parts[parts.length - 1] = value;
      this.inputEl.value = parts.map((s) => s.trim()).join(", ");
    } else {
      this.inputEl.value = value;
    }
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
    this.inputEl.focus();
  }
  // ── Keyboard ──────────────────────────────────────────────────────────────────
  handleKeydown(e) {
    if (!this.dropdown)
      return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
      this.updateHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateHighlight();
    } else if (e.key === "Enter") {
      if (this.selectedIndex >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.select(this.suggestions[this.selectedIndex]);
      }
    } else if (e.key === "Escape") {
      this.close();
    }
  }
  // ── Dropdown UI ───────────────────────────────────────────────────────────────
  refresh() {
    const term = this.activeTerm().toLowerCase();
    const entered = this.alreadyEntered();
    const matches = this.getVaultValues().filter(
      (v) => v.toLowerCase().includes(term) && !entered.includes(v.toLowerCase())
    );
    if (matches.length === 0 || document.activeElement !== this.inputEl) {
      this.close();
      return;
    }
    this.suggestions = matches;
    this.selectedIndex = -1;
    if (!this.dropdown) {
      this.dropdown = createDiv();
      this.dropdown.className = "suggestion-container ffc-suggest-dropdown";
      document.body.appendChild(this.dropdown);
    }
    this.dropdown.empty();
    const rect = this.inputEl.getBoundingClientRect();
    Object.assign(this.dropdown.style, {
      position: "fixed",
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: "9999",
      maxHeight: "200px",
      overflowY: "auto"
    });
    matches.forEach((value, i) => {
      const isLink = /^\[\[.*\]\]$/.test(value);
      const displayText = isLink ? value.slice(2, -2) : value;
      const item = this.dropdown.createDiv({ cls: "suggestion-item ffc-suggest-item" });
      item.createSpan({ cls: "ffc-suggest-label", text: displayText });
      if (isLink) {
        const icon = item.createSpan({ cls: "ffc-suggest-link-icon" });
        (0, import_obsidian.setIcon)(icon, "link");
      }
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });
      item.addEventListener("click", () => {
        this.select(value);
      });
      item.addEventListener("mouseover", () => {
        this.selectedIndex = i;
        this.updateHighlight();
      });
    });
  }
  updateHighlight() {
    if (!this.dropdown)
      return;
    this.dropdown.querySelectorAll(".suggestion-item").forEach((el, i) => {
      el.classList.toggle("is-selected", i === this.selectedIndex);
    });
  }
  close() {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    this.suggestions = [];
    this.selectedIndex = -1;
  }
  destroy() {
    this.close();
    this.inputEl.removeEventListener("input", this._onInput);
    this.inputEl.removeEventListener("focus", this._onFocus);
    this.inputEl.removeEventListener("blur", this._onBlur);
    this.inputEl.removeEventListener("keydown", this._onKeydown);
  }
};

// src/utils/helpers.ts
function stringifyFrontmatterValue2(v) {
  if (v == null)
    return "";
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch (e) {
    return "";
  }
}
function isUrl(text) {
  return /^https?:\/\/\S+$/i.test(text.trim());
}
function sanitizeNoteTitle(raw) {
  return raw.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100).trim();
}
function nameToCommandSlug(name) {
  return (name || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "note";
}
function uniqueCommandSlug(name, taken) {
  const base = nameToCommandSlug(name);
  let slug = base;
  for (let n = 2; taken.has(slug); n++)
    slug = `${base}-${n}`;
  return slug;
}
function renderFieldInputs(container, app, noteType, fieldValues, onEnter, insertBefore = null) {
  var _a;
  container.querySelectorAll("[data-ffc-field]").forEach((el) => el.remove());
  const fields = (_a = noteType == null ? void 0 : noteType.fields) != null ? _a : [];
  for (const field of fields) {
    const s = new import_obsidian2.Setting(container).setName(field.label || field.key).setDesc(field.type === "list" ? "Separate multiple values with commas" : "").addText((text) => {
      var _a2, _b;
      text.setPlaceholder(field.type === "list" ? "e.g. tag1, tag2" : "").setValue((_a2 = fieldValues[field.key]) != null ? _a2 : "").onChange((v) => {
        fieldValues[field.key] = v;
      });
      if ((_b = field.key) == null ? void 0 : _b.trim()) {
        new FrontmatterValueSuggest(app, text.inputEl, field.key, field.type);
      }
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          onEnter();
      });
    });
    s.settingEl.dataset["ffcField"] = "true";
    if (insertBefore)
      container.insertBefore(s.settingEl, insertBefore);
  }
}

// src/utils/note-type-factory.ts
function effectiveSaveLocation(noteType) {
  var _a, _b;
  return (_b = noteType.saveLocation) != null ? _b : ((_a = noteType.saveFolder) == null ? void 0 : _a.trim()) ? "folder" : "vault";
}
function buildNoteType(name, existing, overrides = {}) {
  const taken = new Set(existing.map((o) => o.commandSlug).filter(Boolean));
  const ids = new Set(existing.map((o) => o.id));
  let id = `ffc-notetype-${Date.now()}`;
  for (let n = 2; ids.has(id); n++)
    id = `ffc-notetype-${Date.now()}-${n}`;
  return {
    id,
    commandSlug: uniqueCommandSlug(name, taken),
    name,
    templatePath: "",
    saveFolder: "",
    fields: [],
    matchFilters: [],
    matchMode: "all",
    enableFindCommand: false,
    showInTriggerMenu: false,
    previewFields: [],
    canvasFields: [],
    ...overrides
  };
}

// src/ui/note-type-settings-page.ts
var import_obsidian13 = require("obsidian");

// src/ui/save-location-setting.ts
var import_obsidian4 = require("obsidian");

// src/ui/folder-suggest.ts
var import_obsidian3 = require("obsidian");
var FolderInputSuggest = class extends import_obsidian3.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.app.vault.getAllFolders(false).filter((f) => f.path.toLowerCase().includes(q));
  }
  renderSuggestion(folder, el) {
    el.setText(folder.path);
  }
  selectSuggestion(folder) {
    this.inputEl.value = folder.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
};

// src/ui/save-location-setting.ts
function addSaveLocationSettings(app, container, target, onChange = () => {
}) {
  const folderEl = container.createDiv();
  const renderFolder = () => {
    folderEl.empty();
    if (effectiveSaveLocation(target) !== "folder")
      return;
    new import_obsidian4.Setting(folderEl).setName("Folder to create new notes in").setDesc("Newly created notes will appear in this folder.").addText((text) => {
      text.setPlaceholder("Example: folder 1/folder").setValue(target.saveFolder || "").onChange(async (v) => {
        target.saveFolder = v.trim();
        await onChange();
      });
      new FolderInputSuggest(app, text.inputEl);
    });
  };
  const dropdownSetting = new import_obsidian4.Setting(container).setName("Default location for new notes").setDesc("Where notes of this type are placed.").addDropdown((dd) => dd.addOption("vault", "Vault folder").addOption("current", "Same folder as current file").addOption("folder", "In the folder specified below").setValue(effectiveSaveLocation(target)).onChange(async (v) => {
    target.saveLocation = v;
    await onChange();
    renderFolder();
  }));
  container.insertBefore(folderEl, dropdownSetting.settingEl.nextSibling);
  renderFolder();
}

// src/ui/note-type-filter-modal.ts
var import_obsidian5 = require("obsidian");
var NoteTypeFilterModal = class extends import_obsidian5.Modal {
  constructor(app, plugin, filter, onDismiss) {
    super(app);
    this.plugin = plugin;
    this.filter = filter;
    this.onDismiss = onDismiss;
  }
  onOpen() {
    this._render();
  }
  _render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ffc-item-modal");
    const filter = this.filter;
    const isPathOp = filter.operator === "in_folder" || filter.operator === "not_in_folder";
    contentEl.createEl("h2", { text: "Detection filter", cls: "ffc-modal-title" });
    if (!isPathOp) {
      new import_obsidian5.Setting(contentEl).setName("Property key").setDesc("Frontmatter property to test on each file.").addText((text) => {
        var _a;
        return text.setPlaceholder("Example: type").setValue((_a = filter.key) != null ? _a : "").onChange(async (value) => {
          filter.key = value.trim();
          await this.plugin.saveSettings();
        });
      });
    }
    new import_obsidian5.Setting(contentEl).setName("Condition").setDesc("How the property is compared.").addDropdown((dd) => dd.addOption("equals", "Equals").addOption("not_equals", "Does not equal").addOption("contains", "Contains").addOption("exists", "Exists").addOption("in_folder", "In folder").addOption("not_in_folder", "Not in folder").setValue(filter.operator).onChange(async (value) => {
      filter.operator = value;
      await this.plugin.saveSettings();
      this._render();
    }));
    if (filter.operator !== "exists") {
      new import_obsidian5.Setting(contentEl).setName(isPathOp ? "Folder path" : "Value").setDesc(isPathOp ? "Files under this path match (e.g. Projects/tasks)." : "Value to compare the property against.").addText((text) => {
        var _a;
        return text.setPlaceholder(isPathOp ? "E.g. Projects/tasks" : "Value").setValue((_a = filter.value) != null ? _a : "").onChange(async (value) => {
          filter.value = value;
          await this.plugin.saveSettings();
        });
      });
    }
    new import_obsidian5.Setting(contentEl).addButton((btn) => btn.setButtonText("Done").setCta().onClick(() => this.close()));
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.onDismiss) == null ? void 0 : _a.call(this);
  }
};

// src/ui/note-field-modal.ts
var import_obsidian6 = require("obsidian");
var NoteFieldModal = class extends import_obsidian6.Modal {
  constructor(app, plugin, field, onDismiss) {
    super(app);
    this.plugin = plugin;
    this.field = field;
    this.onDismiss = onDismiss;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ffc-item-modal");
    const field = this.field;
    contentEl.createEl("h2", { text: "Creation field", cls: "ffc-modal-title" });
    new import_obsidian6.Setting(contentEl).setName("Label").setDesc("Shown next to the input in the creation dialog.").addText((text) => {
      var _a;
      return text.setPlaceholder("E.g. Status").setValue((_a = field.label) != null ? _a : "").onChange(async (value) => {
        field.label = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(contentEl).setName("Frontmatter key").setDesc("Property key written into the new file.").addText((text) => {
      var _a;
      return text.setPlaceholder("Example: status").setValue((_a = field.key) != null ? _a : "").onChange(async (value) => {
        field.key = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(contentEl).setName("Type").setDesc("List splits comma-separated input into a YAML array.").addDropdown((dd) => {
      var _a;
      return dd.addOption("text", "Text").addOption("list", "List").setValue((_a = field.type) != null ? _a : "text").onChange(async (value) => {
        field.type = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian6.Setting(contentEl).addButton((btn) => btn.setButtonText("Done").setCta().onClick(() => this.close()));
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.onDismiss) == null ? void 0 : _a.call(this);
  }
};

// src/ui/new-template-modal.ts
var import_obsidian7 = require("obsidian");
var NewTemplateModal = class extends import_obsidian7.Modal {
  constructor(app, plugin, onCreated) {
    super(app);
    this.plugin = plugin;
    this.onCreated = onCreated;
    this.name = "";
    this.busy = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "New template" });
    new import_obsidian7.Setting(contentEl).setName("Name").setDesc(`Created in ${this.plugin.getNewTemplateFolder() || "the vault root"}.`).addText((text) => {
      text.setPlaceholder("Meeting").onChange((v) => {
        this.name = v;
      });
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          void this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new import_obsidian7.ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    new import_obsidian7.ButtonComponent(buttons).setButtonText("Create").setCta().onClick(() => {
      void this.submit();
    });
  }
  async submit() {
    if (this.busy)
      return;
    this.busy = true;
    try {
      const file = await this.plugin.createTemplateFile(this.name);
      this.close();
      this.onCreated(file);
    } catch (err) {
      this.busy = false;
      new import_obsidian7.Notice(err instanceof Error ? err.message : "Could not create the template.");
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
function addNewTemplateButton(app, plugin, setting, onCreated) {
  setting.addExtraButton((btn) => {
    btn.setIcon("plus").setTooltip("Add new template").onClick(() => new NewTemplateModal(app, plugin, onCreated).open());
    setting.controlEl.prepend(btn.extraSettingsEl);
  });
}
function addOpenTemplateButton(app, setting, getPath) {
  let el = null;
  setting.addExtraButton((btn) => {
    btn.setIcon("file-pen").setTooltip("Open template to edit").onClick(() => {
      const file = app.vault.getFileByPath(getPath());
      if (file)
        void app.workspace.getLeaf("tab").openFile(file);
    });
    el = btn.extraSettingsEl;
  });
  const sync = () => {
    if (!el)
      return;
    const show = !!app.vault.getFileByPath(getPath());
    if (!show) {
      el.detach();
      return;
    }
    const input = Array.from(setting.controlEl.children).find((c) => !c.hasClass("extra-setting-button"));
    setting.controlEl.insertBefore(el, input != null ? input : null);
  };
  sync();
  return sync;
}

// src/ui/key-label-field-modal.ts
var import_obsidian8 = require("obsidian");
var KeyLabelFieldModal = class extends import_obsidian8.Modal {
  constructor(app, plugin, entry, opts) {
    super(app);
    this.plugin = plugin;
    this.entry = entry;
    this.heading = opts.heading;
    this.afterChange = opts.afterChange;
    this.onDismiss = opts.onDismiss;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ffc-item-modal");
    const entry = this.entry;
    contentEl.createEl("h2", { text: this.heading, cls: "ffc-modal-title" });
    new import_obsidian8.Setting(contentEl).setName("Display label").setDesc("Leave blank to use the key name.").addText((text) => {
      var _a;
      return text.setPlaceholder("E.g. Status").setValue((_a = entry.label) != null ? _a : "").onChange(async (value) => {
        var _a2;
        entry.label = value;
        await this.plugin.saveSettings();
        (_a2 = this.afterChange) == null ? void 0 : _a2.call(this);
      });
    });
    new import_obsidian8.Setting(contentEl).setName("Frontmatter key").setDesc("Property key whose value is shown.").addText((text) => {
      var _a;
      return text.setPlaceholder("Example: status").setValue((_a = entry.key) != null ? _a : "").onChange(async (value) => {
        var _a2;
        entry.key = value.trim();
        await this.plugin.saveSettings();
        (_a2 = this.afterChange) == null ? void 0 : _a2.call(this);
      });
    });
    new import_obsidian8.Setting(contentEl).addButton((btn) => btn.setButtonText("Done").setCta().onClick(() => this.close()));
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.onDismiss) == null ? void 0 : _a.call(this);
  }
};

// src/ui/icon-suggest.ts
var import_obsidian9 = require("obsidian");
var IconInputSuggest = class extends import_obsidian9.AbstractInputSuggest {
  constructor(app, inputEl, onPick) {
    super(app, inputEl);
    this.allIcons = (0, import_obsidian9.getIconIds)();
    this.onSelect((iconId) => {
      this.setValue(iconId);
      this.close();
      onPick(iconId);
    });
  }
  getSuggestions(query) {
    const q = query.trim().toLowerCase();
    const matches = q ? this.allIcons.filter((id) => id.toLowerCase().includes(q)) : this.allIcons;
    return matches.slice(0, 100);
  }
  renderSuggestion(iconId, el) {
    el.addClass("ffc-icon-suggestion-item");
    const iconEl = el.createSpan({ cls: "ffc-icon-suggestion-icon" });
    (0, import_obsidian9.setIcon)(iconEl, iconId);
    el.createSpan({ cls: "ffc-icon-suggestion-label", text: iconId.replace(/^lucide-/, "") });
  }
};

// src/views/note-tag-view-plugin.ts
var import_view2 = require("@codemirror/view");
var import_language = require("@codemirror/language");
var import_obsidian12 = require("obsidian");

// src/utils/icon-mask.ts
var import_obsidian10 = require("obsidian");

// src/utils/status-svg.ts
var VALID_STATUSES = /* @__PURE__ */ new Set(["Backlog", "Todo", "In Progress", "Done", "Cancelled"]);
var STATUS_SVG_MARKUP = {
  "Backlog": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4"/></svg>`,
  "Todo": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round"/></svg>`,
  "In Progress": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#BD8E37" stroke-width="2" stroke-linecap="round"/><path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6V18Z" fill="#BD8E37"/></svg>`,
  "Done": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM15.707 9.29297C15.3165 8.90244 14.6835 8.90244 14.293 9.29297L11 12.5859L9.70703 11.293C9.31651 10.9024 8.68349 10.9024 8.29297 11.293C7.90244 11.6835 7.90244 12.3165 8.29297 12.707L10.293 14.707C10.6835 15.0976 11.3165 15.0976 11.707 14.707L15.707 10.707C16.0976 10.3165 16.0976 9.68349 15.707 9.29297Z" fill="#8E68F5"/></svg>`,
  "Cancelled": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM15.707 8.29297C15.3165 7.90244 14.6835 7.90244 14.293 8.29297L12 10.5859L9.70703 8.29297C9.31651 7.90244 8.68349 7.90244 8.29297 8.29297C7.90244 8.68349 7.90244 9.31651 8.29297 9.70703L10.5859 12L8.29297 14.293C7.90244 14.6835 7.90244 15.3165 8.29297 15.707C8.68349 16.0976 9.31651 16.0976 9.70703 15.707L12 13.4141L14.293 15.707C14.6835 16.0976 15.3165 16.0976 15.707 15.707C16.0976 15.3165 16.0976 14.6835 15.707 14.293L13.4141 12L15.707 9.70703C16.0976 9.31651 16.0976 8.68349 15.707 8.29297Z" fill="#A1A1A1"/></svg>`
};
var parser = new DOMParser();
var statusSvgElCache = /* @__PURE__ */ new Map();
function statusSvg(status) {
  const cached = statusSvgElCache.get(status);
  if (cached)
    return cached.cloneNode(true);
  const markup = STATUS_SVG_MARKUP[status];
  if (!markup)
    return null;
  const svg = parser.parseFromString(markup, "image/svg+xml").documentElement;
  statusSvgElCache.set(status, svg);
  return svg.cloneNode(true);
}

// src/utils/icon-mask.ts
function svgToDataUrl(svg) {
  const markup = new XMLSerializer().serializeToString(svg);
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}
function cachedDataUrl(cache, key, resolve) {
  const cached = cache.get(key);
  if (cached !== void 0)
    return cached;
  const svg = resolve();
  if (!svg)
    return null;
  const url = svgToDataUrl(svg);
  cache.set(key, url);
  return url;
}
var iconCache = /* @__PURE__ */ new Map();
function iconMaskUrl(iconId) {
  return cachedDataUrl(iconCache, iconId, () => (0, import_obsidian10.getIcon)(iconId));
}
var SAFE_CSS_COLOR = /^[#a-z0-9(),.%\s/-]+$/i;
function noteLinkStyleParts(color, iconId) {
  const parts = [];
  const safeColor = color == null ? void 0 : color.trim();
  if (safeColor && SAFE_CSS_COLOR.test(safeColor) && !/url\(/i.test(safeColor)) {
    parts.push(`--ffc-note-link-color: ${safeColor}`);
  }
  const iconUrl = iconId ? iconMaskUrl(iconId) : null;
  if (iconUrl)
    parts.push(`--ffc-note-link-icon: ${iconUrl}`);
  return parts;
}
var statusCache = /* @__PURE__ */ new Map();
function statusIconDataUrl(status) {
  return cachedDataUrl(statusCache, status, () => statusSvg(status));
}
function prependIconSpan(el, svg, extraClass) {
  const span = createSpan({ cls: extraClass ? `ffc-status-icon ${extraClass}` : "ffc-status-icon" });
  span.appendChild(svg);
  el.prepend(span);
}

// src/views/note-link-view-plugin.ts
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var import_obsidian11 = require("obsidian");
function sourcePathOf(view) {
  var _a, _b, _c;
  return (_c = (_b = (_a = view.state.field(import_obsidian11.editorInfoField, false)) == null ? void 0 : _a.file) == null ? void 0 : _b.path) != null ? _c : "";
}
var refreshNoteLinkStylesEffect = import_state.StateEffect.define();
function buildNoteLinkViewPlugin(ffcPlugin) {
  return import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view);
        this.applyFoldedLinkClasses(view);
      }
      update(update) {
        const forced = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshNoteLinkStylesEffect)));
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
      applyFoldedLinkClasses(view) {
        const basenames = ffcPlugin.styledNoteBasenames;
        const previewBasenames = ffcPlugin.previewNoteBasenames;
        const statusMap = ffcPlugin.statusNoteMap;
        const hasStyled = basenames && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;
        const hasStatus = statusMap && statusMap.size > 0;
        const sourcePath = sourcePathOf(view);
        view.dom.querySelectorAll("a.internal-link[data-href]").forEach((el) => {
          var _a, _b, _c, _d, _e;
          const href = ((_a = el.getAttribute("data-href")) != null ? _a : "").split("#")[0].trim();
          const basename = href.includes("/") ? (_b = href.split("/").pop()) != null ? _b : href : href;
          const isStyled = hasStyled && (basenames.has(href) || basenames.has(basename));
          el.classList.toggle("ffc-note-link", isStyled);
          el.classList.toggle(
            "ffc-note-preview-link",
            hasPreview && (previewBasenames.has(href) || previewBasenames.has(basename))
          );
          const { color, icon: iconId } = isStyled ? ffcPlugin.noteLinkStyle(href, sourcePath) : {};
          if (color)
            el.style.setProperty("--ffc-note-link-color", color);
          else
            el.style.removeProperty("--ffc-note-link-color");
          (_c = el.querySelector(":scope > .ffc-link-icon")) == null ? void 0 : _c.remove();
          const iconSvg = iconId ? (0, import_obsidian11.getIcon)(iconId) : null;
          if (iconSvg)
            prependIconSpan(el, iconSvg, "ffc-link-icon");
          (_d = el.querySelector(":scope > .ffc-status-icon:not(.ffc-link-icon)")) == null ? void 0 : _d.remove();
          const rawStatus = hasStatus ? (_e = statusMap.get(basename)) != null ? _e : statusMap.get(href) : void 0;
          const statusSvgEl = rawStatus ? statusSvg(rawStatus) : null;
          if (statusSvgEl)
            prependIconSpan(el, statusSvgEl);
        });
      }
      build(view) {
        var _a, _b;
        const basenames = ffcPlugin.styledNoteBasenames;
        const previewBasenames = ffcPlugin.previewNoteBasenames;
        const statusMap = ffcPlugin.statusNoteMap;
        const hasStyled = basenames && basenames.size > 0;
        const hasPreview = previewBasenames && previewBasenames.size > 0;
        const hasStatus = statusMap && statusMap.size > 0;
        if (!hasStyled && !hasPreview && !hasStatus)
          return import_view.Decoration.none;
        const builder = new import_state.RangeSetBuilder();
        const text = view.state.doc.toString();
        const re = /\[\[([^\]|#\n]+)(?:[|#][^\]\n]*)?\]\]/g;
        const sourcePath = sourcePathOf(view);
        let m;
        const selection = view.state.selection;
        while ((m = re.exec(text)) !== null) {
          const target = m[1].trim();
          const targetBasename = target.includes("/") ? (_a = target.split("/").pop()) != null ? _a : target : target;
          const isStyled = hasStyled && (basenames.has(target) || basenames.has(targetBasename));
          const isPreview = hasPreview && (previewBasenames.has(target) || previewBasenames.has(targetBasename));
          const linkFrom = m.index;
          const linkTo = m.index + m[0].length;
          const cursorOnLink = selection.ranges.some((r) => r.from <= linkTo && r.to >= linkFrom);
          const rawStatus = hasStatus && !cursorOnLink ? (_b = statusMap.get(targetBasename)) != null ? _b : statusMap.get(target) : void 0;
          const statusUrl = rawStatus ? statusIconDataUrl(rawStatus) : null;
          if (isStyled || isPreview || statusUrl) {
            const { color, icon: rawIconId } = isStyled ? ffcPlugin.noteLinkStyle(target, sourcePath) : {};
            const iconId = !cursorOnLink ? rawIconId : void 0;
            const clsParts = [
              isStyled ? "ffc-note-link" : "",
              isPreview ? "ffc-note-preview-link" : "",
              !isStyled && statusUrl ? "ffc-note-status-host" : "",
              // Expanded for editing: CM6 splits the mark into fragments, so
              // the pill's horizontal padding is dropped (see styles.css).
              isStyled && cursorOnLink ? "ffc-note-link-editing" : ""
            ];
            const cls = clsParts.filter(Boolean).join(" ");
            const styleParts = noteLinkStyleParts(color, iconId);
            if (statusUrl)
              styleParts.push(`--ffc-note-link-status-icon: ${statusUrl}`);
            const spec = {
              ...cls ? { class: cls } : {},
              ...styleParts.length ? { attributes: { style: styleParts.join("; ") } } : {}
            };
            builder.add(linkFrom, linkTo, import_view.Decoration.mark(spec));
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );
}

// src/views/note-tag-view-plugin.ts
var TAG_CLASS = "ffc-note-tag";
var TYPE_ATTR = "data-ffc-note-tag-type";
var TAG_SEGMENT_PREFIX = "tag-";
var ADD_ICON = "lucide-file-input";
var LIST_PREFIX = /^(\s*)(\d+[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s+)?)/;
var BLOCK_MARKER = /^\s*(?:#{1,6}\s+|>\s*)/;
function normalizeNoteTag(raw) {
  return raw.trim().replace(/^#+/, "");
}
function noteTagError(raw) {
  const tag = normalizeNoteTag(raw);
  if (!tag)
    return null;
  const bad = tag.match(/[^a-zA-Z0-9-]/);
  return bad ? `Tags can only contain letters, numbers and dashes (found "${bad[0]}").` : null;
}
function titleFromTaggedLine(line) {
  return sanitizeNoteTitle(line.replace(BLOCK_MARKER, "").replace(LIST_PREFIX, "").replace(/#[^\s]+/g, ""));
}
function tagNameFromNode(nodeName) {
  if (!nodeName.includes("hashtag"))
    return null;
  const segment = nodeName.split("_").find((p) => p.startsWith(TAG_SEGMENT_PREFIX) && p.length > TAG_SEGMENT_PREFIX.length);
  return segment ? segment.slice(TAG_SEGMENT_PREFIX.length) : null;
}
function tagStyles(plugin) {
  var _a, _b, _c;
  const map = /* @__PURE__ */ new Map();
  for (const t of plugin.settings.noteTypes) {
    const tag = normalizeNoteTag((_a = t.tag) != null ? _a : "").toLowerCase();
    if (tag && !map.has(tag))
      map.set(tag, { typeId: t.id, color: (_c = (_b = t.linkColor) == null ? void 0 : _b.trim()) != null ? _c : "" });
  }
  return map;
}
function buildNoteTagViewPlugin(plugin) {
  const noteTypeFor = (id) => id ? plugin.settings.noteTypes.find((t) => t.id === id) : void 0;
  const createFromLine = (view, pos, noteType) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const line = view.state.doc.lineAt(pos);
    const title = titleFromTaggedLine(line.text);
    const original = line.text;
    const prefix = (_b = (_a = original.match(LIST_PREFIX)) == null ? void 0 : _a[0]) != null ? _b : "";
    const sourcePath = (_e = (_d = (_c = view.state.field(import_obsidian12.editorInfoField, false)) == null ? void 0 : _c.file) == null ? void 0 : _d.path) != null ? _e : "";
    const tag = normalizeNoteTag((_f = noteType.tag) != null ? _f : "").toLowerCase();
    const otherTags = ((_g = original.match(/#[^\s]+/g)) != null ? _g : []).filter((t) => t.slice(1).toLowerCase() !== tag);
    const findLine = () => {
      const doc = view.state.doc;
      let best = null;
      let bestDistance = Infinity;
      for (let n = 1; n <= doc.lines; n++) {
        const l = doc.line(n);
        if (l.text !== original)
          continue;
        const distance = Math.abs(n - line.number);
        if (distance < bestDistance) {
          best = { from: l.from, to: l.to };
          bestDistance = distance;
        }
      }
      return best;
    };
    const finish = (file) => {
      const current = findLine();
      if (!current) {
        new import_obsidian12.Notice("The line changed, so it was not replaced with a link.");
        return;
      }
      const link = plugin.app.fileManager.generateMarkdownLink(file, sourcePath);
      view.dispatch({ changes: { from: current.from, to: current.to, insert: [prefix + link, ...otherTags].join(" ") } });
    };
    plugin.openNewNoteModal(async (selectedType, finalTitle, fieldValues, description) => {
      const file = await plugin.createNote(selectedType, finalTitle, fieldValues, description);
      if (file)
        finish(file);
    }, title, "", null, void 0, noteType);
  };
  const decorations = import_view2.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view);
      }
      // Settings changes arrive as refreshNoteLinkStylesEffect (see refreshNoteLinkStyles).
      update(update) {
        const forced = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshNoteLinkStylesEffect)));
        if (forced || update.docChanged || update.viewportChanged)
          this.decorations = this.build(update.view);
      }
      build(view) {
        const styles = tagStyles(plugin);
        if (styles.size === 0)
          return import_view2.Decoration.none;
        const ranges = [];
        for (const { from, to } of view.visibleRanges) {
          (0, import_language.syntaxTree)(view.state).iterate({
            from,
            to,
            enter: (node) => {
              const name = tagNameFromNode(node.name);
              const style = name ? styles.get(name.toLowerCase()) : void 0;
              if (style)
                ranges.push({ from: node.from, to: node.to, style });
            }
          });
        }
        ranges.sort((a, b) => a.from - b.from);
        const merged = [];
        for (const r of ranges) {
          const prev = merged[merged.length - 1];
          if (prev && prev.to === r.from && prev.style.typeId === r.style.typeId)
            prev.to = r.to;
          else
            merged.push({ ...r });
        }
        const iconUrl = iconMaskUrl(ADD_ICON);
        const addIconVar = iconUrl ? `--ffc-note-tag-icon: ${iconUrl}` : "";
        const marks = merged.map(({ from, to, style }) => import_view2.Decoration.mark({
          class: TAG_CLASS,
          attributes: {
            [TYPE_ATTR]: style.typeId,
            style: [style.color && `--ffc-note-tag-color: ${style.color}`, addIconVar].filter(Boolean).join("; ")
          }
        }).range(from, to));
        return import_view2.Decoration.set(marks);
      }
    },
    { decorations: (v) => v.decorations }
  );
  const onIcon = (event, tagEl) => {
    var _a;
    if (!((_a = tagEl.parentElement) == null ? void 0 : _a.classList.contains("cm-hashtag-end")))
      return false;
    const after = getComputedStyle(tagEl, "::after");
    const iconWidth = parseFloat(after.width);
    if (!(iconWidth > 0))
      return false;
    const rects = tagEl.getClientRects();
    const last = rects.item(rects.length - 1);
    if (!last)
      return false;
    return event.clientX >= last.right - iconWidth && event.clientX <= last.right && event.clientY >= last.top && event.clientY <= last.bottom;
  };
  const ICON_GROWTH_EM = 1.25;
  const flagEdgeTag = (target) => {
    const hashtag = target.closest(".cm-hashtag");
    if (!hashtag)
      return;
    const endPart = hashtag.classList.contains("cm-hashtag-end") ? hashtag : hashtag.nextElementSibling;
    if (!(endPart == null ? void 0 : endPart.classList.contains("cm-hashtag-end")))
      return;
    const tagEl = endPart.querySelector(`.${TAG_CLASS}`);
    const line = endPart.closest(".cm-line");
    if (!tagEl || !(line == null ? void 0 : line.lastChild))
      return;
    const rects = tagEl.getClientRects();
    const last = rects.item(rects.length - 1);
    if (!last)
      return;
    const tail = document.createRange();
    tail.setStartAfter(endPart);
    tail.setEndAfter(line.lastChild);
    const isLast = tail.toString().trim() === "";
    const after = getComputedStyle(tagEl, "::after");
    const grown = (parseFloat(after.width) || 0) + (parseFloat(after.marginLeft) || 0);
    const lineRight = line.getBoundingClientRect().right - (parseFloat(getComputedStyle(line).paddingRight) || 0);
    const needed = (parseFloat(getComputedStyle(tagEl).fontSize) || 16) * ICON_GROWTH_EM;
    const edge = isLast && lineRight - (last.right - grown) < needed;
    if (tagEl.classList.contains("ffc-tag-edge") !== edge)
      tagEl.classList.toggle("ffc-tag-edge", edge);
  };
  let edgeFrame = 0;
  let edgeTarget = null;
  const click = import_view2.EditorView.domEventHandlers({
    // mousemove (not just mouseover) so the flag is re-evaluated after edits or a resize while the
    // pointer rests on a tag; throttled to one layout read per frame.
    mousemove: (event) => {
      var _a;
      const target = event.target;
      if (!((_a = target == null ? void 0 : target.closest) == null ? void 0 : _a.call(target, ".cm-hashtag")))
        return false;
      edgeTarget = target;
      if (!edgeFrame) {
        edgeFrame = window.requestAnimationFrame(() => {
          edgeFrame = 0;
          if (edgeTarget == null ? void 0 : edgeTarget.isConnected)
            flagEdgeTag(edgeTarget);
        });
      }
      return false;
    },
    click: (event, view) => {
      var _a, _b, _c;
      const tagEl = (_b = (_a = event.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, `.${TAG_CLASS}`);
      const noteType = noteTypeFor((_c = tagEl == null ? void 0 : tagEl.getAttribute(TYPE_ATTR)) != null ? _c : null);
      if (!tagEl || !noteType || !onIcon(event, tagEl))
        return false;
      event.preventDefault();
      event.stopPropagation();
      createFromLine(view, view.posAtDOM(tagEl), noteType);
      return true;
    }
  });
  return [decorations, click];
}

// src/ui/note-type-settings-page.ts
function normalizeIconId(raw) {
  const value = raw.trim();
  if (!value)
    return "";
  if ((0, import_obsidian13.getIcon)(value))
    return value;
  const prefixed = `lucide-${value}`;
  return (0, import_obsidian13.getIcon)(prefixed) ? prefixed : value;
}
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
var OP_LABELS = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  exists: "exists",
  in_folder: "in folder",
  not_in_folder: "not in folder"
};
var NoteTypeSettingsPage = class extends import_obsidian13.SettingPage {
  constructor(plugin, index, onDataChange) {
    var _a;
    super();
    this.plugin = plugin;
    this.index = index;
    this.onDataChange = onDataChange;
    this.title = ((_a = plugin.settings.noteTypes[index]) == null ? void 0 : _a.name) || "Note type";
  }
  display() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    const contentEl = this.containerEl;
    const scroller = this._scrollParent(contentEl);
    const prevScroll = (_a = scroller == null ? void 0 : scroller.scrollTop) != null ? _a : 0;
    contentEl.empty();
    const obj = this.plugin.settings.noteTypes[this.index];
    if (!obj) {
      contentEl.createEl("p", { text: "Note type not found." });
      return;
    }
    new import_obsidian13.Setting(contentEl).setName("Note type name").setDesc('Creates a "Create new {name}" command in the palette.').addText(
      (text) => text.setPlaceholder("E.g. Task").setValue(obj.name).onChange(async (value) => {
        var _a2, _b2;
        obj.name = value;
        await this.plugin.saveSettings();
        const cmdId = `ffc-notetype-${obj.commandSlug}`;
        const refs = this.plugin.commandRefs;
        if (refs[cmdId])
          refs[cmdId].name = `Create new ${value}`;
        const findCmdId = `${cmdId}-find`;
        if (refs[findCmdId])
          refs[findCmdId].name = `Find ${value}`;
        this.title = value || "Note type";
        (_a2 = this.titlebarEl.querySelector(".setting-page-title")) == null ? void 0 : _a2.setText(this.title);
        (_b2 = this.onDataChange) == null ? void 0 : _b2.call(this);
      })
    );
    new import_obsidian13.Setting(contentEl).setName("Description").setDesc("Short description shown beneath the note type name in the settings list.").addText(
      (text) => text.setPlaceholder("E.g. Tracks actionable to-dos").setValue(obj.description || "").onChange(async (value) => {
        var _a2;
        obj.description = value;
        await this.plugin.saveSettings();
        (_a2 = this.onDataChange) == null ? void 0 : _a2.call(this);
      })
    );
    const onAddNoteDetectionFilters = () => {
      var _a2;
      return this.addItem(
        (_a2 = obj.matchFilters) != null ? _a2 : obj.matchFilters = [],
        { key: "", operator: "equals", value: "" },
        (item) => new NoteTypeFilterModal(this.plugin.app, this.plugin, item, () => this.display()).open()
      );
    };
    addHeadingWithInfo(
      contentEl,
      "Note detection filters",
      'Filters that identify existing files of this type. Used by the trigger menu and the "find" command. If no filters are set, files in the save folder are used as a fallback.',
      { label: "Add detection filter", onClick: onAddNoteDetectionFilters }
    );
    new import_obsidian13.Setting(contentEl).setName("Filter match mode").setDesc("Should a file match all filters (and) or at least one filter (or)?").addDropdown(
      (dd) => {
        var _a2;
        return dd.addOption("all", "Match all (and)").addOption("any", "Match any (or)").setValue((_a2 = obj.matchMode) != null ? _a2 : "all").onChange(async (value) => {
          obj.matchMode = value;
          await this.plugin.saveSettings();
        });
      }
    );
    if (!obj.matchFilters || obj.matchFilters.length === 0) {
      contentEl.createEl("p", { text: "No filters \u2014 save folder will be used as a fallback.", cls: "ffc-hint" });
    }
    for (let fi = 0; fi < ((_b = obj.matchFilters) != null ? _b : []).length; fi++) {
      const filter = obj.matchFilters[fi];
      new import_obsidian13.Setting(contentEl).setName(this._filterSummary(filter)).addExtraButton((btn) => btn.setIcon("pencil").setTooltip("Edit filter").onClick(() => new NoteTypeFilterModal(this.plugin.app, this.plugin, filter, () => this.display()).open())).addExtraButton((btn) => btn.setIcon("trash-2").setTooltip("Remove filter").onClick(async () => {
        obj.matchFilters.splice(fi, 1);
        await this.plugin.saveSettings();
        this.display();
      }));
    }
    new import_obsidian13.Setting(contentEl).setName("Show in trigger menu").setDesc(`When enabled, matching files appear in the "${this.plugin.settings.triggerKey || "@"}" inline trigger menu.`).addToggle(
      (toggle) => {
        var _a2;
        return toggle.setValue((_a2 = obj.showInTriggerMenu) != null ? _a2 : false).onChange(async (value) => {
          obj.showInTriggerMenu = value;
          await this.plugin.saveSettings();
        });
      }
    );
    new import_obsidian13.Setting(contentEl).setName('Enable "find" command').setDesc(`When enabled, adds a "Find ${obj.name}" command to the palette for fuzzy-searching files of this type.`).addToggle(
      (toggle) => {
        var _a2;
        return toggle.setValue((_a2 = obj.enableFindCommand) != null ? _a2 : false).onChange(async (value) => {
          obj.enableFindCommand = value;
          await this.plugin.saveSettings();
          if (value)
            this.plugin.registerFindCommand(obj);
        });
      }
    );
    new import_obsidian13.Setting(contentEl).setName("Note tag").setDesc("A tag that marks a line as a note of this type, without the #. Select the icon that appears when you hover the tag to create the note from that line. The tag takes the link color when one is set.").addText((text) => {
      var _a2;
      text.setPlaceholder(`${obj.commandSlug || "tag"}`).setValue((_a2 = obj.tag) != null ? _a2 : "").onChange(async (value) => {
        const error = noteTagError(value);
        text.inputEl.toggleClass("mod-error", !!error);
        text.inputEl.title = error != null ? error : "";
        if (error)
          return;
        const tag = normalizeNoteTag(value);
        const clash = this.plugin.settings.noteTypes.find(
          (t) => t !== obj && t.tag && normalizeNoteTag(t.tag).toLowerCase() === tag.toLowerCase()
        );
        if (tag && clash) {
          text.inputEl.addClass("mod-error");
          text.inputEl.title = `"${clash.name}" already uses this tag.`;
          return;
        }
        obj.tag = tag || void 0;
        await this.plugin.saveSettings();
        this.plugin.refreshNoteLinkStyles();
      });
    });
    new import_obsidian13.Setting(contentEl).setName("Style note links").setDesc("When enabled, inline links to files of this type will have their underline removed and a background fill applied.").addToggle(
      (toggle) => {
        var _a2;
        return toggle.setValue((_a2 = obj.styledLinks) != null ? _a2 : false).onChange(async (value) => {
          obj.styledLinks = value;
          await this.plugin.saveSettings();
          this.plugin.buildStyledNoteSet();
          this.plugin.refreshNoteLinkStyles();
          this.display();
        });
      }
    );
    if (obj.styledLinks) {
      const isDefault = () => {
        var _a2;
        return !((_a2 = obj.linkColor) == null ? void 0 : _a2.trim());
      };
      const colorSetting = new import_obsidian13.Setting(contentEl).setName("Link color").setDesc("Color for styled links of this type: the text uses this color and the pill background is a translucent tint of it. Unset means the theme default.");
      let restoreBtn;
      colorSetting.addExtraButton(
        (btn) => (restoreBtn = btn).setIcon("rotate-ccw").setTooltip("Restore default").setDisabled(isDefault()).onClick(async () => {
          if (isDefault())
            return;
          obj.linkColor = void 0;
          await this.plugin.saveSettings();
          this.plugin.buildStyledNoteSet();
          this.plugin.refreshNoteLinkStyles();
          this.display();
        })
      );
      colorSetting.addColorPicker(
        (picker) => {
          var _a2;
          return picker.setValue(((_a2 = obj.linkColor) == null ? void 0 : _a2.trim()) || this._accentColorHex()).onChange(async (value) => {
            obj.linkColor = value;
            restoreBtn == null ? void 0 : restoreBtn.setDisabled(isDefault());
            await this.plugin.saveSettings();
            this.plugin.buildStyledNoteSet();
            this.plugin.refreshNoteLinkStyles();
          });
        }
      );
      const iconSetting = new import_obsidian13.Setting(contentEl).setName("Link icon").setDesc("Lucide icon shown at the start of styled links of this type.");
      let previewBtn;
      let clearBtn;
      iconSetting.addExtraButton((btn) => {
        var _a2;
        previewBtn = btn;
        btn.setIcon(((_a2 = obj.linkIcon) == null ? void 0 : _a2.trim()) || "image-off").setDisabled(true);
        btn.extraSettingsEl.addClass("ffc-icon-preview");
      });
      iconSetting.addExtraButton((btn) => {
        var _a2;
        clearBtn = btn;
        btn.setIcon("x").setTooltip("Clear icon").setDisabled(!((_a2 = obj.linkIcon) == null ? void 0 : _a2.trim())).onClick(async () => {
          var _a3;
          if (!((_a3 = obj.linkIcon) == null ? void 0 : _a3.trim()))
            return;
          obj.linkIcon = void 0;
          await this.plugin.saveSettings();
          this.plugin.buildStyledNoteSet();
          this.plugin.refreshNoteLinkStyles();
          this.display();
        });
      });
      const scheduleLinkStyleRefresh = (0, import_obsidian13.debounce)(() => {
        void this.plugin.saveSettings();
        this.plugin.buildStyledNoteSet();
        this.plugin.refreshNoteLinkStyles();
      }, 300, true);
      iconSetting.addText((text) => {
        var _a2;
        text.setPlaceholder("Example: check-circle").setValue((_a2 = obj.linkIcon) != null ? _a2 : "").onChange((value) => {
          var _a3;
          obj.linkIcon = normalizeIconId(value) || void 0;
          const trimmed = (_a3 = obj.linkIcon) == null ? void 0 : _a3.trim();
          previewBtn == null ? void 0 : previewBtn.setIcon(trimmed || "image-off");
          clearBtn == null ? void 0 : clearBtn.setDisabled(!trimmed);
          scheduleLinkStyleRefresh();
        });
        new IconInputSuggest(this.plugin.app, text.inputEl, (iconId) => {
          obj.linkIcon = iconId;
          void this.plugin.saveSettings().then(() => {
            this.plugin.buildStyledNoteSet();
            this.plugin.refreshNoteLinkStyles();
          });
          this.display();
        });
      });
      new import_obsidian13.Setting(contentEl).setName("Show icon in links").setDesc("When enabled, the icon above is shown at the start of styled links to files of this type.").addToggle(
        (toggle) => {
          var _a2;
          return toggle.setValue((_a2 = obj.showLinkIcon) != null ? _a2 : false).onChange(async (value) => {
            obj.showLinkIcon = value;
            await this.plugin.saveSettings();
            this.plugin.buildStyledNoteSet();
            this.plugin.refreshNoteLinkStyles();
          });
        }
      );
    }
    new import_obsidian13.Setting(contentEl).setName("Show status in links").setDesc('When enabled, a status icon is shown on inline links to files of this type that have a "status" frontmatter field.').addToggle(
      (toggle) => {
        var _a2;
        return toggle.setValue((_a2 = obj.showStatusInLinks) != null ? _a2 : false).onChange(async (value) => {
          obj.showStatusInLinks = value;
          await this.plugin.saveSettings();
          this.plugin.buildStyledNoteSet();
          this.plugin.refreshNoteLinkStyles();
        });
      }
    );
    const templateFiles = this.plugin.getTemplateFiles();
    let syncOpenButton = () => {
    };
    const templateSetting = templateFiles.length > 0 ? new import_obsidian13.Setting(contentEl).setName("Template").setDesc("Template file applied when creating a new note of this type.").addDropdown((dd) => {
      dd.addOption("", "\u2014 none \u2014");
      for (const f of templateFiles)
        dd.addOption(f.path, f.basename);
      if (obj.templatePath && !templateFiles.some((f) => f.path === obj.templatePath)) {
        dd.addOption(obj.templatePath, `${obj.templatePath} (missing)`);
      }
      dd.setValue(obj.templatePath || "");
      dd.onChange(async (value) => {
        obj.templatePath = value;
        await this.plugin.saveSettings();
        syncOpenButton();
      });
    }) : new import_obsidian13.Setting(contentEl).setName("Template").setDesc("No templates found. Add one with +, set the templates folder in the main settings, or type a path.").addText(
      (text) => text.setPlaceholder("path/to/template.md").setValue(obj.templatePath || "").onChange(async (value) => {
        obj.templatePath = value.trim();
        await this.plugin.saveSettings();
        syncOpenButton();
      })
    );
    syncOpenButton = addOpenTemplateButton(this.plugin.app, templateSetting, () => obj.templatePath || "");
    addNewTemplateButton(this.plugin.app, this.plugin, templateSetting, (file) => {
      obj.templatePath = file.path;
      void this.plugin.saveSettings().then(() => this.display());
    });
    addSaveLocationSettings(this.plugin.app, contentEl, obj, () => this.plugin.saveSettings());
    const onAddNoteCreationFields = () => {
      var _a2;
      return this.addItem(
        (_a2 = obj.fields) != null ? _a2 : obj.fields = [],
        { key: "", label: "", type: "text" },
        (item) => new NoteFieldModal(this.plugin.app, this.plugin, item, () => this.display()).open()
      );
    };
    addHeadingWithInfo(
      contentEl,
      "Note creation fields",
      "Fields shown in the creation dialog. Values are written into the new file's frontmatter.",
      { label: "Add field", onClick: onAddNoteCreationFields }
    );
    for (let fi = 0; fi < ((_c = obj.fields) != null ? _c : []).length; fi++) {
      const field = obj.fields[fi];
      new import_obsidian13.Setting(contentEl).setName(((_d = field.label) == null ? void 0 : _d.trim()) || ((_e = field.key) == null ? void 0 : _e.trim()) || "Unnamed field").setDesc(this._fieldDesc(field)).addExtraButton((btn) => btn.setIcon("pencil").setTooltip("Edit field").onClick(() => new NoteFieldModal(this.plugin.app, this.plugin, field, () => this.display()).open())).addExtraButton((btn) => btn.setIcon("trash-2").setTooltip("Remove field").onClick(async () => {
        obj.fields.splice(fi, 1);
        await this.plugin.saveSettings();
        this.display();
      }));
    }
    const urlFieldOptions = ((_f = obj.fields) != null ? _f : []).filter((f) => {
      var _a2;
      return (_a2 = f.key) == null ? void 0 : _a2.trim();
    });
    new import_obsidian13.Setting(contentEl).setName("Field for highlighted URL").setDesc("When you create a note of this type from a highlighted URL, the URL is written into this field instead of becoming the title.").addDropdown((dd) => {
      var _a2, _b2;
      dd.addOption("", "\u2014 none \u2014");
      for (const f of urlFieldOptions) {
        dd.addOption(f.key, ((_a2 = f.label) == null ? void 0 : _a2.trim()) ? `${f.label} (${f.key})` : f.key);
      }
      if (obj.urlFieldKey && !urlFieldOptions.some((f) => f.key === obj.urlFieldKey)) {
        dd.addOption(obj.urlFieldKey, `${obj.urlFieldKey} (missing field)`);
      }
      dd.setValue((_b2 = obj.urlFieldKey) != null ? _b2 : "");
      dd.onChange(async (value) => {
        obj.urlFieldKey = value || void 0;
        await this.plugin.saveSettings();
      });
    });
    const onAddLinkHoverPreviewFields = () => {
      var _a2;
      return this.addItem(
        (_a2 = obj.previewFields) != null ? _a2 : obj.previewFields = [],
        { key: "", label: "" },
        (item) => new KeyLabelFieldModal(this.plugin.app, this.plugin, item, {
          heading: "Preview field",
          afterChange: () => {
            this.plugin.buildStyledNoteSet();
            this.plugin.refreshNoteLinkStyles();
          },
          onDismiss: () => this.display()
        }).open()
      );
    };
    addHeadingWithInfo(
      contentEl,
      "Link hover preview fields",
      "Frontmatter keys shown when hovering over a link to a note of this type.",
      { label: "Add preview field", onClick: onAddLinkHoverPreviewFields }
    );
    for (let fi = 0; fi < ((_g = obj.previewFields) != null ? _g : []).length; fi++) {
      const field = obj.previewFields[fi];
      new import_obsidian13.Setting(contentEl).setName(((_h = field.label) == null ? void 0 : _h.trim()) || ((_i = field.key) == null ? void 0 : _i.trim()) || "Unnamed key").setDesc(((_j = field.key) == null ? void 0 : _j.trim()) ? `key: ${field.key}` : "no key set").addExtraButton((btn) => btn.setIcon("pencil").setTooltip("Edit key").onClick(() => new KeyLabelFieldModal(this.plugin.app, this.plugin, field, {
        heading: "Preview field",
        afterChange: () => {
          this.plugin.buildStyledNoteSet();
          this.plugin.refreshNoteLinkStyles();
        },
        onDismiss: () => this.display()
      }).open())).addExtraButton((btn) => btn.setIcon("trash-2").setTooltip("Remove key").onClick(async () => {
        obj.previewFields.splice(fi, 1);
        await this.plugin.saveSettings();
        this.plugin.buildStyledNoteSet();
        this.plugin.refreshNoteLinkStyles();
        this.display();
      }));
    }
    new import_obsidian13.Setting(contentEl).setName("Show cover image in preview").setDesc("When enabled, the image from the image key is shown at the top of the hover card.").addToggle(
      (toggle) => {
        var _a2;
        return toggle.setValue((_a2 = obj.showImageInPreview) != null ? _a2 : false).onChange(async (value) => {
          obj.showImageInPreview = value;
          await this.plugin.saveSettings();
        });
      }
    );
    const onAddCanvasCardFields = () => {
      var _a2;
      return this.addItem(
        (_a2 = obj.canvasFields) != null ? _a2 : obj.canvasFields = [],
        { key: "", label: "" },
        (item) => new KeyLabelFieldModal(this.plugin.app, this.plugin, item, {
          heading: "Canvas card field",
          onDismiss: () => this.display()
        }).open()
      );
    };
    addHeadingWithInfo(
      contentEl,
      "Canvas card fields",
      "Properties shown under the title on canvas cards for notes of this type. Empty values are skipped.",
      { label: "Add canvas field", onClick: onAddCanvasCardFields }
    );
    for (let fi = 0; fi < ((_k = obj.canvasFields) != null ? _k : []).length; fi++) {
      const field = obj.canvasFields[fi];
      new import_obsidian13.Setting(contentEl).setName(((_l = field.label) == null ? void 0 : _l.trim()) || ((_m = field.key) == null ? void 0 : _m.trim()) || "Unnamed key").setDesc(((_n = field.key) == null ? void 0 : _n.trim()) ? `key: ${field.key}` : "no key set").addExtraButton((btn) => btn.setIcon("pencil").setTooltip("Edit key").onClick(() => new KeyLabelFieldModal(this.plugin.app, this.plugin, field, {
        heading: "Canvas card field",
        onDismiss: () => this.display()
      }).open())).addExtraButton((btn) => btn.setIcon("trash-2").setTooltip("Remove key").onClick(async () => {
        obj.canvasFields.splice(fi, 1);
        await this.plugin.saveSettings();
        this.display();
      }));
    }
    addHeadingWithInfo(
      contentEl,
      "Cover image",
      'The frontmatter key whose value is an image path or wikilink (e.g. "cover" or "image"). It is also where the canvas key image is stored, when set.'
    );
    new import_obsidian13.Setting(contentEl).setName("Image frontmatter key").setDesc("Examples: cover, image, thumbnail").addText(
      (text) => {
        var _a2;
        return text.setPlaceholder("Example: cover").setValue((_a2 = obj.imageKey) != null ? _a2 : "").onChange(async (value) => {
          obj.imageKey = value.trim();
          await this.plugin.saveSettings();
        });
      }
    );
    new import_obsidian13.Setting(contentEl).setName("Image on canvas cards").setDesc("When a card is too short for its image, fill crops the image to the card; fit shrinks it to show all of it.").addDropdown(
      (dropdown) => {
        var _a2;
        return dropdown.addOption("fill", "Fill").addOption("fit", "Fit").setValue((_a2 = obj.canvasImageFit) != null ? _a2 : "fill").onChange(async (value) => {
          obj.canvasImageFit = value === "fit" ? "fit" : "fill";
          await this.plugin.saveSettings();
        });
      }
    );
    if (scroller && prevScroll) {
      scroller.scrollTop = Math.min(prevScroll, scroller.scrollHeight - scroller.clientHeight);
    }
  }
  _filterSummary(f) {
    var _a, _b, _c;
    if (f.operator === "in_folder" || f.operator === "not_in_folder") {
      return `${OP_LABELS[f.operator]}: ${((_a = f.value) == null ? void 0 : _a.trim()) || "(unset)"}`;
    }
    const key = ((_b = f.key) == null ? void 0 : _b.trim()) || "(no key)";
    if (f.operator === "exists")
      return `${key} exists`;
    return `${key} ${OP_LABELS[f.operator]} ${((_c = f.value) == null ? void 0 : _c.trim()) ? `"${f.value}"` : '""'}`;
  }
  _fieldDesc(f) {
    var _a;
    const parts = [];
    if ((_a = f.key) == null ? void 0 : _a.trim())
      parts.push(`key: ${f.key}`);
    parts.push(f.type === "list" ? "list" : "text");
    return parts.join(" \xB7 ");
  }
  /**
   * The current theme's accent colour as `#rrggbb`, for use as the colour
   * picker's swatch while `linkColor` is unset (mirrors Obsidian's own
   * "Accent color" setting). Reads the `--accent-h/s/l` custom properties the
   * app sets on `<body>`; falls back to black if they can't be resolved.
   */
  _accentColorHex() {
    const s = getComputedStyle(document.body);
    const h = parseFloat(s.getPropertyValue("--accent-h"));
    const sat = parseFloat(s.getPropertyValue("--accent-s"));
    const lig = parseFloat(s.getPropertyValue("--accent-l"));
    if (![h, sat, lig].every(Number.isFinite))
      return "#000000";
    return hslToHex(h, sat, lig);
  }
  /** Nearest vertically-scrollable ancestor of `el`, or null. */
  _scrollParent(el) {
    let node = el.parentElement;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }
  async addItem(list, item, openModal) {
    list.push(item);
    await this.plugin.saveSettings();
    this.display();
    openModal(item);
  }
};
function addHeadingWithInfo(containerEl, title, info, add) {
  const setting = new import_obsidian13.Setting(containerEl).setName(title).setHeading();
  if (add) {
    setting.addExtraButton((btn) => btn.setIcon("plus").setTooltip(add.label).onClick(() => {
      add.onClick().catch((err) => {
        console.error(err);
        new import_obsidian13.Notice(`Could not ${add.label.toLowerCase()}.`);
      });
    }));
  }
  setting.addExtraButton((btn) => btn.setIcon("info").setTooltip(info).onClick(() => {
    new import_obsidian13.Notice(info, 8e3);
  }));
}

// src/ui/note-type-delete-modal.ts
var import_obsidian14 = require("obsidian");
var NoteTypeDeleteModal = class extends import_obsidian14.Modal {
  constructor(app, plugin, index, onDismiss) {
    super(app);
    this.plugin = plugin;
    this.index = index;
    this.onDismiss = onDismiss;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ffc-confirm-modal");
    const obj = this.plugin.settings.noteTypes[this.index];
    contentEl.createEl("h2", { text: "Delete note type?" });
    contentEl.createEl("p", {
      text: `Are you sure you want to delete "${(obj == null ? void 0 : obj.name) || "this note type"}"? This will remove it from your settings. Existing files will not be affected.`,
      cls: "ffc-confirm-desc"
    });
    const btnRow = contentEl.createDiv({ cls: "ffc-confirm-buttons" });
    btnRow.createEl("button", { text: "Cancel", cls: "ffc-btn-cancel" }).onclick = () => {
      this.close();
    };
    const deleteBtn = btnRow.createEl("button", { text: "Delete", cls: "mod-warning" });
    deleteBtn.onclick = async () => {
      this.plugin.settings.noteTypes.splice(this.index, 1);
      await this.plugin.saveSettings();
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
    if (this.onDismiss)
      this.onDismiss();
  }
};

// src/ui/filtered-command-settings-modal.ts
var import_obsidian15 = require("obsidian");
var FilteredCommandSettingsModal = class extends import_obsidian15.Modal {
  constructor(app, plugin, index, onDismiss) {
    super(app);
    this.plugin = plugin;
    this.index = index;
    this.onDismiss = onDismiss;
  }
  onOpen() {
    this._render();
  }
  _render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ffc-item-modal");
    const cmd = this.plugin.settings.commands[this.index];
    if (!cmd) {
      contentEl.createEl("p", { text: "Command not found." });
      return;
    }
    contentEl.createEl("h2", { text: cmd.name || "Command settings", cls: "ffc-modal-title" });
    new import_obsidian15.Setting(contentEl).setName("Command name").setDesc("Shown in the command palette and hotkey settings.").addText(
      (text) => text.setPlaceholder("E.g. Show active projects").setValue(cmd.name).onChange(async (value) => {
        cmd.name = value;
        await this.plugin.saveSettings();
        const ref = this.plugin.commandRefs[cmd.id];
        if (ref)
          ref.name = value;
        const titleEl = contentEl.querySelector(".ffc-modal-title");
        if (titleEl)
          titleEl.textContent = value || "Command settings";
      })
    );
    new import_obsidian15.Setting(contentEl).setName("Filter match mode").setDesc("Should a file match all filters (and) or at least one filter (or)?").addDropdown(
      (dd) => dd.addOption("all", "Match all filters (and)").addOption("any", "Match any filter (or)").setValue(cmd.matchMode).onChange(async (value) => {
        cmd.matchMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian15.Setting(contentEl).setName("File types").setDesc("Comma-separated extensions, such as md and canvas. Leave blank for Markdown only.").addText(
      (text) => text.setPlaceholder("Example: md, canvas").setValue(cmd.fileTypes || "").onChange(async (value) => {
        cmd.fileTypes = value;
        await this.plugin.saveSettings();
      })
    );
    const filtersSection = contentEl.createDiv({ cls: "ffc-filters-section" });
    filtersSection.createEl("p", { text: "Frontmatter filters", cls: "ffc-filters-title" });
    if (cmd.filters.length === 0) {
      filtersSection.createEl("p", { text: "No filters \u2014 all files of the specified type(s) will be shown.", cls: "ffc-hint" });
    }
    for (let fi = 0; fi < cmd.filters.length; fi++)
      this._renderFilter(filtersSection, fi);
    new import_obsidian15.Setting(filtersSection).addButton(
      (btn) => btn.setButtonText("\uFF0B add filter").onClick(async () => {
        cmd.filters.push({ key: "", operator: "equals", value: "" });
        await this.plugin.saveSettings();
        this._render();
      })
    );
  }
  _renderFilter(container, filterIndex) {
    const cmd = this.plugin.settings.commands[this.index];
    const filter = cmd.filters[filterIndex];
    const row = container.createDiv({ cls: "ffc-filter-row" });
    const keyInput = row.createEl("input", { cls: "ffc-input ffc-input-key" });
    keyInput.type = "text";
    keyInput.placeholder = "Property key";
    keyInput.value = filter.key;
    keyInput.addEventListener("change", () => {
      filter.key = keyInput.value.trim();
      void this.plugin.saveSettings();
    });
    const opSelect = row.createEl("select", { cls: "ffc-select" });
    for (const op of [{ value: "equals", label: "=" }, { value: "not_equals", label: "\u2260" }, { value: "contains", label: "contains" }, { value: "exists", label: "exists" }]) {
      const opt = opSelect.createEl("option", { text: op.label, value: op.value });
      if (filter.operator === op.value)
        opt.selected = true;
    }
    opSelect.addEventListener("change", () => {
      filter.operator = opSelect.value;
      void this.plugin.saveSettings();
      this._render();
    });
    if (filter.operator !== "exists") {
      const valInput = row.createEl("input", { cls: "ffc-input ffc-input-val" });
      valInput.type = "text";
      valInput.placeholder = "Value";
      valInput.value = filter.value;
      valInput.addEventListener("change", () => {
        filter.value = valInput.value;
        void this.plugin.saveSettings();
      });
    }
    row.createEl("button", { text: "\u2715", cls: "ffc-btn-remove" }).onclick = async () => {
      cmd.filters.splice(filterIndex, 1);
      await this.plugin.saveSettings();
      this._render();
    };
  }
  onClose() {
    this.contentEl.empty();
    if (this.onDismiss)
      this.onDismiss();
  }
};

// src/ui/filtered-command-delete-modal.ts
var import_obsidian16 = require("obsidian");
var FilteredCommandDeleteModal = class extends import_obsidian16.Modal {
  constructor(app, plugin, index, onDismiss) {
    super(app);
    this.plugin = plugin;
    this.index = index;
    this.onDismiss = onDismiss;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ffc-confirm-modal");
    const cmd = this.plugin.settings.commands[this.index];
    contentEl.createEl("h2", { text: "Delete command?" });
    contentEl.createEl("p", {
      text: `Are you sure you want to delete "${(cmd == null ? void 0 : cmd.name) || "this command"}"? This will remove it from your settings.`,
      cls: "ffc-confirm-desc"
    });
    const btnRow = contentEl.createDiv({ cls: "ffc-confirm-buttons" });
    btnRow.createEl("button", { text: "Cancel", cls: "ffc-btn-cancel" }).onclick = () => {
      this.close();
    };
    const deleteBtn = btnRow.createEl("button", { text: "Delete", cls: "mod-warning" });
    deleteBtn.onclick = async () => {
      this.plugin.settings.commands.splice(this.index, 1);
      await this.plugin.saveSettings();
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
    if (this.onDismiss)
      this.onDismiss();
  }
};

// src/ui/relation-type-modal.ts
var import_obsidian17 = require("obsidian");
var RelationTypeModal = class extends import_obsidian17.Modal {
  constructor(app, plugin, rt, onDismiss) {
    super(app);
    this.plugin = plugin;
    this.rt = rt;
    this.onDismiss = onDismiss;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ffc-item-modal");
    const rt = this.rt;
    contentEl.createEl("h2", { text: "Relation type", cls: "ffc-modal-title" });
    if (rt.builtin) {
      contentEl.createEl("p", {
        text: "The built-in generic relation. Every note type can use it. You can change its labels and keys, but it can\u2019t be removed.",
        cls: "ffc-hint"
      });
    }
    new import_obsidian17.Setting(contentEl).setName("Name").setDesc("The relation\u2019s name in menus, for example related to or blocks.").addText((text) => {
      var _a;
      return text.setPlaceholder("E.g. Blocks").setValue((_a = rt.name) != null ? _a : "").onChange(async (value) => {
        rt.name = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian17.Setting(contentEl).setName("Frontmatter key").setDesc('Property key written on the note you mark, e.g. "blocks".').addText((text) => {
      var _a;
      return text.setPlaceholder("Example: blocks").setValue((_a = rt.frontmatterKey) != null ? _a : "").onChange(async (value) => {
        rt.frontmatterKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian17.Setting(contentEl).setName("Reverse label").setDesc("The name from the target note\u2019s side, for example blocked by. Leave blank if the relation reads the same both ways.").addText((text) => {
      var _a;
      return text.setPlaceholder("E.g. Blocked by").setValue((_a = rt.reverseName) != null ? _a : "").onChange(async (value) => {
        rt.reverseName = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian17.Setting(contentEl).setName("Reverse frontmatter key").setDesc("Property key written back on the target note. Leave blank to reuse the key above, or to derive one from the reverse label when that label differs.").addText((text) => {
      var _a;
      return text.setPlaceholder("Example: blocked_by").setValue((_a = rt.reverseKey) != null ? _a : "").onChange(async (value) => {
        rt.reverseKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian17.Setting(contentEl).addButton((btn) => btn.setButtonText("Done").setCta().onClick(() => this.close()));
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.onDismiss) == null ? void 0 : _a.call(this);
  }
};

// src/relations.ts
var BUILTIN_RELATION_TYPE_ID = "related-to";
function defaultRelationType() {
  return {
    id: BUILTIN_RELATION_TYPE_ID,
    name: "Related to",
    frontmatterKey: "related_to",
    reverseName: "",
    reverseKey: "",
    builtin: true
  };
}
function ensureRelationTypes(settings) {
  let changed = false;
  if (!Array.isArray(settings.relationTypes)) {
    settings.relationTypes = [];
    changed = true;
  }
  const builtin = settings.relationTypes.find((rt) => rt.id === BUILTIN_RELATION_TYPE_ID);
  if (!builtin) {
    settings.relationTypes.unshift(defaultRelationType());
    changed = true;
  } else if (!builtin.builtin) {
    builtin.builtin = true;
    changed = true;
  }
  for (const rt of settings.relationTypes) {
    if (rt.reverseName === void 0) {
      rt.reverseName = "";
      changed = true;
    }
    if (rt.reverseKey === void 0) {
      rt.reverseKey = "";
      changed = true;
    }
  }
  return changed;
}
function slugifyKey(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function resolvedRelation(rt) {
  const forwardKey = (rt.frontmatterKey || "").trim();
  const forwardName = rt.name || "Untitled relation";
  const reverseName = (rt.reverseName || "").trim() || forwardName;
  let reverseKey = (rt.reverseKey || "").trim();
  if (!reverseKey) {
    reverseKey = reverseName !== forwardName ? slugifyKey(reverseName) || forwardKey : forwardKey;
  }
  return { forwardKey, reverseKey, forwardName, reverseName, symmetric: forwardKey === reverseKey };
}
function stripLinktext(raw) {
  let s = stringifyFrontmatterValue2(raw).trim();
  const m = s.match(/^!?\[\[(.*?)\]\]$/);
  if (m)
    s = m[1];
  s = s.split("|")[0];
  s = s.split("#")[0];
  return s.trim();
}
function relationLinkText(app, target, fromPath) {
  return `[[${app.metadataCache.fileToLinktext(target, fromPath, true)}]]`;
}
function resolveLinktext(app, raw, fromPath) {
  const path = stripLinktext(raw);
  if (!path)
    return null;
  return app.metadataCache.getFirstLinkpathDest(path, fromPath);
}
function linkResolvesTo(app, raw, fromPath, target) {
  var _a;
  return ((_a = resolveLinktext(app, raw, fromPath)) == null ? void 0 : _a.path) === target.path;
}
function toEntryArray(value) {
  if (value == null || value === "")
    return [];
  return Array.isArray(value) ? value.slice() : [value];
}
function collapseEntries(entries) {
  if (entries.length === 0)
    return void 0;
  if (entries.length === 1)
    return entries[0];
  return entries;
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  commands: [],
  filteredCommandsEnabled: false,
  filteredWidgetEnabled: false,
  filteredWidgetRibbon: false,
  noteTypes: [],
  relationTypes: [defaultRelationType()],
  templatesFolder: "",
  triggerKey: "",
  fetchUrlTitles: false,
  ffwSections: [],
  ffwDisplayNameKey: ""
};
var MyPluginSettingTab = class extends import_obsidian18.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  /** Route declarative `control` reads/writes through the plugin's own store. */
  getControlValue(key) {
    return this.plugin.settings[key];
  }
  setControlValue(key, value) {
    this.plugin.settings[key] = value;
    return this.plugin.saveSettings();
  }
  getSettingDefinitions() {
    const s = this.plugin.settings;
    return [
      // ── General ─────────────────────────────────────────────────────────────
      {
        name: "Trigger key",
        desc: 'Character that opens the inline note picker while editing (e.g. "@"). Leave blank to disable.',
        render: (setting) => {
          setting.addText((text) => text.setPlaceholder("E.g. @").setValue(s.triggerKey || "").onChange(async (value) => {
            s.triggerKey = value.trim().slice(0, 1);
            await this.plugin.saveSettings();
          }));
        }
      },
      {
        name: "Templates folder",
        desc: "Folder holding your templates. Leave blank to auto-detect from the core Templates plugin.",
        control: { type: "folder", key: "templatesFolder", placeholder: "Templates" }
      },
      {
        name: "Fetch page title from URL",
        desc: "When creating a note from a highlighted URL, fetch the linked page and use its title (makes a network request to that site).",
        control: { type: "toggle", key: "fetchUrlTitles" }
      },
      {
        name: "Filtered file commands",
        desc: "Create palette commands that open a fuzzy file picker filtered by frontmatter.",
        render: (setting) => {
          setting.addToggle((toggle) => toggle.setValue(s.filteredCommandsEnabled).onChange(async (value) => {
            s.filteredCommandsEnabled = value;
            await this.plugin.saveSettings();
            this.update();
          }));
        }
      },
      {
        name: "Filtered files widget",
        desc: "A sidebar panel that shows lists of files matching configurable filter rules.",
        render: (setting) => {
          setting.addToggle((toggle) => toggle.setValue(s.filteredWidgetEnabled).onChange(async (value) => {
            s.filteredWidgetEnabled = value;
            await this.plugin.saveSettings();
            this.plugin.refreshWidgetRibbonIcon();
            this.update();
          }));
        }
      },
      // ── Note types ─────────────────────────────────────────────────────────
      {
        type: "list",
        heading: "Definitions",
        emptyState: "No note types defined yet.",
        addItem: {
          name: "Add note type",
          action: () => {
            void this.addNoteType();
          }
        },
        onReorder: (from, to) => {
          const list = s.noteTypes;
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          void this.plugin.saveSettings();
          this.update();
        },
        onDelete: (index) => {
          new NoteTypeDeleteModal(this.app, this.plugin, index, () => this.update()).open();
        },
        // Rows are `action` items, not `type: 'page'` — Obsidian's list renderer
        // skips the delete/reorder affordances on page rows, so navigation to the
        // sub-page is done by hand in `openNoteTypePage`.
        items: s.noteTypes.map((obj) => {
          return {
            name: obj.name || "Untitled note type",
            desc: obj.description || void 0,
            searchable: false,
            action: (_el, index) => this.openNoteTypePage(index)
          };
        })
      },
      // ── Relations ──────────────────────────────────────────────────────────
      {
        type: "list",
        heading: "Relations",
        emptyState: "No relation types defined yet.",
        addItem: {
          name: "Add relation type",
          action: () => {
            void this.addRelationType();
          }
        },
        onReorder: (from, to) => {
          const list = s.relationTypes;
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          void this.plugin.saveSettings();
          this.update();
        },
        onDelete: (index) => {
          var _a;
          if ((_a = s.relationTypes[index]) == null ? void 0 : _a.builtin) {
            new import_obsidian18.Notice("The built-in relation can\u2019t be removed.");
            this.update();
            return;
          }
          s.relationTypes.splice(index, 1);
          void this.plugin.saveSettings();
          this.update();
        },
        items: s.relationTypes.map((rt) => {
          const r = resolvedRelation(rt);
          const desc = r.symmetric ? `key: ${r.forwardKey || "(unset)"}` : `key: ${r.forwardKey || "(unset)"} \xB7 reverse: ${r.reverseName} (${r.reverseKey || "(unset)"})`;
          return {
            name: rt.name || "Untitled relation",
            desc,
            searchable: false,
            action: () => {
              new RelationTypeModal(this.app, this.plugin, rt, () => this.update()).open();
            }
          };
        })
      },
      // ── Filtered file commands ─────────────────────────────────────────────
      {
        type: "list",
        heading: "Filtered file commands",
        visible: () => s.filteredCommandsEnabled,
        emptyState: "No filtered commands defined yet.",
        addItem: {
          name: "Add filtered command",
          action: () => {
            void this.addFilteredCommand();
          }
        },
        onReorder: (from, to) => {
          const list = s.commands;
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          void this.plugin.saveSettings();
          this.update();
        },
        onDelete: (index) => {
          new FilteredCommandDeleteModal(this.app, this.plugin, index, () => this.update()).open();
        },
        items: s.commands.map((cmd, i) => {
          const n = cmd.filters.length;
          const desc = `${n} filter${n === 1 ? "" : "s"}${cmd.fileTypes ? ` \xB7 ${cmd.fileTypes}` : ""}`;
          return {
            name: cmd.name || "Untitled command",
            desc,
            action: () => {
              new FilteredCommandSettingsModal(this.app, this.plugin, i, () => this.update()).open();
            }
          };
        })
      },
      // ── Filtered files widget ─────────────────────────────────────────────
      {
        type: "group",
        heading: "Filtered files widget",
        visible: () => s.filteredWidgetEnabled,
        items: [
          {
            name: "Show ribbon icon",
            desc: "Add a button to the left ribbon that opens the filtered files widget.",
            render: (setting) => {
              setting.addToggle((toggle) => toggle.setValue(s.filteredWidgetRibbon).onChange(async (value) => {
                s.filteredWidgetRibbon = value;
                await this.plugin.saveSettings();
                this.plugin.refreshWidgetRibbonIcon();
              }));
            }
          },
          {
            name: "Open the widget",
            desc: "Reveal the filtered files widget in the left sidebar.",
            action: () => {
              void this.plugin.activateWidgetView();
            }
          },
          {
            name: "Display name frontmatter key",
            desc: 'Show a frontmatter value instead of the filename in the widget (e.g. "title"). Leave blank to use the filename.',
            render: (setting) => {
              setting.addText((text) => text.setPlaceholder("Example: title").setValue(s.ffwDisplayNameKey).onChange(async (value) => {
                s.ffwDisplayNameKey = value.trim();
                await this.plugin.saveSettings();
                this.plugin.refreshWidgetViews();
              }));
            }
          },
          {
            name: "Reset all filter sections",
            desc: "Remove every filter section from the widget. This cannot be undone.",
            render: (setting) => {
              setting.addButton((btn) => btn.setButtonText("Reset").setDestructive().onClick(async () => {
                s.ffwSections = [];
                await this.plugin.saveSettings();
                this.plugin.refreshWidgetViews();
              }));
            }
          }
        ]
      }
    ];
  }
  /**
   * Open a note type's editor as a settings sub-page. `app.setting.openPage` is
   * the same call Obsidian's own list renderer makes for `type: 'page'` rows; we
   * invoke it directly because our rows are `action` rows (see the note types
   * list above).
   */
  openNoteTypePage(index) {
    const settingModal = this.app.setting;
    const page = new NoteTypeSettingsPage(this.plugin, index, () => this.update());
    if (settingModal == null ? void 0 : settingModal.openPage) {
      settingModal.openPage(page);
    } else {
      console.error("Note Types: could not open the note type sub-page (app.setting.openPage unavailable).");
    }
  }
  async addNoteType() {
    await this.plugin.addNoteType(buildNoteType("New Note", this.plugin.settings.noteTypes));
    this.update();
  }
  async addRelationType() {
    const s = this.plugin.settings;
    const rt = {
      id: `rel-${Date.now()}`,
      name: "New relation",
      frontmatterKey: "",
      reverseName: "",
      reverseKey: ""
    };
    s.relationTypes.push(rt);
    await this.plugin.saveSettings();
    this.update();
    new RelationTypeModal(this.app, this.plugin, rt, () => this.update()).open();
  }
  async addFilteredCommand() {
    const s = this.plugin.settings;
    const id = `ffc-command-${Date.now()}`;
    s.commands.push({ id, name: "New Filtered Command", matchMode: "all", filters: [] });
    await this.plugin.saveSettings();
    this.plugin.registerFilterCommand(s.commands[s.commands.length - 1]);
    this.update();
  }
};

// src/ui/relation-target-modal.ts
var import_obsidian19 = require("obsidian");
var RelationTargetModal = class extends import_obsidian19.FuzzySuggestModal {
  constructor(app, files, relationLabel, onChoose) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
    this.setPlaceholder(`${relationLabel}\u2026`);
    this.setInstructions([
      { command: "\u2191\u2193", purpose: "navigate" },
      { command: "\u21B5", purpose: "relate" },
      { command: "esc", purpose: "dismiss" }
    ]);
  }
  getTitle(file) {
    var _a, _b;
    const title = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b["title"];
    return title ? stringifyFrontmatterValue2(title) : file.basename;
  }
  getItems() {
    return this.files;
  }
  getItemText(file) {
    return `${this.getTitle(file)} ${file.path}`;
  }
  renderSuggestion(match, el) {
    var _a;
    const file = match.item;
    el.createSpan({ text: this.getTitle(file), cls: "suggestion-title" });
    const folder = (_a = file.parent) == null ? void 0 : _a.path;
    if (folder && folder !== "/") {
      el.createSpan({ text: folder, cls: "suggestion-note" });
    }
  }
  onChooseItem(file) {
    this.onChoose(file);
  }
};

// src/utils/fetch-title.ts
var import_obsidian20 = require("obsidian");
async function fetchPageTitle(url, timeoutMs = 8e3) {
  return Promise.race([
    extractTitle(url),
    new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs))
  ]);
}
async function extractTitle(url) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  let res;
  try {
    res = await (0, import_obsidian20.requestUrl)({ url, method: "GET", throw: false });
  } catch (e) {
    return null;
  }
  if (res.status < 200 || res.status >= 300)
    return null;
  const headers = (_a = res.headers) != null ? _a : {};
  const contentType = ((_c = (_b = headers["content-type"]) != null ? _b : headers["Content-Type"]) != null ? _c : "").toLowerCase();
  if (contentType && !contentType.includes("html") && !contentType.includes("xml"))
    return null;
  const html = res.text;
  if (!html)
    return null;
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch (e) {
    return null;
  }
  const meta = (selector) => {
    var _a2, _b2;
    const v = (_b2 = (_a2 = doc.querySelector(selector)) == null ? void 0 : _a2.getAttribute("content")) == null ? void 0 : _b2.trim();
    return v ? v : null;
  };
  const title = (_h = (_g = (_d = meta('meta[property="og:title"]')) != null ? _d : meta('meta[name="twitter:title"]')) != null ? _g : (_f = (_e = doc.querySelector("title")) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) != null ? _h : null;
  return title && title.length ? title : null;
}

// src/utils/ffw-utils.ts
var import_obsidian21 = require("obsidian");
var FFW_VIEW_TYPE = "filtered-files-widget-view";
var FFW_FILTER_TYPE_LABELS = {
  tag: "Tag",
  frontmatter: "Frontmatter",
  path: "Path / folder",
  name: "File name"
};
var FFW_SORT_OPTIONS = [
  { value: "modified-desc", label: "Modified (newest)" },
  { value: "modified-asc", label: "Modified (oldest)" },
  { value: "created-desc", label: "Created (newest)" },
  { value: "created-asc", label: "Created (oldest)" },
  { value: "name-asc", label: "Name (A\u2192Z)" },
  { value: "name-desc", label: "Name (Z\u2192A)" },
  { value: "frontmatter-asc", label: "Frontmatter field (asc)" },
  { value: "frontmatter-desc", label: "Frontmatter field (desc)" }
];
function ffwNewSectionId() {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function ffwDefaultFilter(type) {
  switch (type) {
    case "tag":
      return { type: "tag", tag: "", include: true };
    case "frontmatter":
      return { type: "frontmatter", key: "", value: "", comparison: "equals" };
    case "path":
      return { type: "path", pattern: "", matchMode: "starts-with", negate: false };
    case "name":
      return { type: "name", pattern: "", matchMode: "contains", caseSensitive: false, negate: false };
  }
}
function ffwDefaultSort() {
  return { field: "modified-desc" };
}
function ffwSortLabel(sort) {
  var _a, _b;
  switch (sort.field) {
    case "created-desc":
      return "Created (newest)";
    case "created-asc":
      return "Created (oldest)";
    case "modified-desc":
      return "Modified (newest)";
    case "modified-asc":
      return "Modified (oldest)";
    case "name-asc":
      return "Name (A-Z)";
    case "name-desc":
      return "Name (Z-A)";
    case "frontmatter-asc":
      return `Frontmatter "${(_a = sort.frontmatterKey) != null ? _a : ""}" (asc)`;
    case "frontmatter-desc":
      return `Frontmatter "${(_b = sort.frontmatterKey) != null ? _b : ""}" (desc)`;
    default:
      return sort.field;
  }
}
function ffwFuzzyMatch(query, str) {
  if (!query)
    return true;
  const q = query.toLowerCase();
  const s = str.toLowerCase();
  let n = 0;
  for (let i = 0; i < s.length && n < q.length; i++) {
    if (s[i] === q[n])
      n++;
  }
  return n === q.length;
}
var asRecord = (v) => typeof v === "object" && v !== null ? v : null;
function iconicEntry(entry, allowDefault) {
  var _a;
  const r = asRecord(entry);
  const icon = allowDefault ? (_a = r == null ? void 0 : r.icon) != null ? _a : r == null ? void 0 : r.iconDefault : r == null ? void 0 : r.icon;
  if (typeof icon !== "string" || icon === "")
    return null;
  return { icon, color: typeof (r == null ? void 0 : r.color) === "string" ? r.color : null };
}
function ffwGetIconicIcon(app, file) {
  var _a, _b, _c, _d;
  try {
    const registry = asRecord(app.plugins);
    const iconic = asRecord((_a = asRecord(registry == null ? void 0 : registry.plugins)) == null ? void 0 : _a.iconic);
    if (!iconic)
      return null;
    if (typeof iconic.getFileItem === "function") {
      const item = iconic.getFileItem.call(iconic, file.path);
      const hit = iconicEntry(item, false);
      if (hit)
        return hit;
    }
    const rulings = (_b = asRecord(iconic.ruleManager)) == null ? void 0 : _b.fileRulings;
    if (rulings instanceof Map) {
      const hit = iconicEntry(rulings.get(file.path), true);
      if (hit)
        return hit;
    }
    for (const src of [iconic.settings, iconic.data]) {
      for (const key of ["fileIcons", "file", "files"]) {
        const hit = iconicEntry((_d = asRecord((_c = asRecord(src)) == null ? void 0 : _c[key])) == null ? void 0 : _d[file.path], false);
        if (hit)
          return hit;
      }
    }
  } catch (e) {
  }
  return null;
}
function ffwSetIconEl(el, icon, color) {
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon)) {
    (0, import_obsidian21.setIcon)(el, icon);
  } else {
    el.setText(icon);
    el.addClass("ffw-file-icon--emoji");
  }
  if (color)
    el.style.color = color;
}
function ffwFormatValue(v) {
  if (v == null)
    return "";
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch (e) {
    return "";
  }
}
function ffwNormalizeTag(tag) {
  return (tag || "").trim().replace(/^#/, "").toLowerCase();
}
function ffwEvalTagFilter(cache, filter) {
  var _a;
  const tag = ffwNormalizeTag(filter.tag);
  if (!tag)
    return true;
  const allTags2 = cache ? ((_a = (0, import_obsidian21.getAllTags)(cache)) != null ? _a : []).map(ffwNormalizeTag) : [];
  const has = allTags2.includes(tag);
  return filter.include ? has : !has;
}
function ffwEvalFrontmatterFilter(cache, filter) {
  if (!filter.key)
    return true;
  const fm = cache == null ? void 0 : cache.frontmatter;
  if (!fm)
    return filter.comparison === "not-equals";
  const raw = fm[filter.key];
  if (filter.comparison === "exists")
    return raw != null && raw !== "";
  if (raw == null)
    return filter.comparison === "not-equals";
  const needle = filter.value.trim().toLowerCase();
  const values = Array.isArray(raw) ? raw.map(ffwFormatValue) : [ffwFormatValue(raw)];
  switch (filter.comparison) {
    case "equals":
      return values.some((v) => v.toLowerCase() === needle);
    case "not-equals":
      return !values.some((v) => v.toLowerCase() === needle);
    case "contains":
      return values.some((v) => v.toLowerCase().includes(needle));
    default:
      return true;
  }
}
function ffwEvalPathFilter(file, filter) {
  if (!filter.pattern)
    return true;
  const path = file.path;
  const pattern = filter.pattern;
  let matches;
  switch (filter.matchMode) {
    case "starts-with":
      matches = path.startsWith(pattern);
      break;
    case "ends-with":
      matches = path.endsWith(pattern);
      break;
    case "equals":
      matches = path === pattern;
      break;
    case "contains":
      matches = path.includes(pattern);
      break;
    default:
      matches = false;
  }
  return filter.negate ? !matches : matches;
}
function ffwEvalNameFilter(file, filter) {
  if (!filter.pattern)
    return true;
  const name = filter.caseSensitive ? file.basename : file.basename.toLowerCase();
  const pattern = filter.caseSensitive ? filter.pattern : filter.pattern.toLowerCase();
  let matches;
  switch (filter.matchMode) {
    case "contains":
      matches = name.includes(pattern);
      break;
    case "starts-with":
      matches = name.startsWith(pattern);
      break;
    case "ends-with":
      matches = name.endsWith(pattern);
      break;
    case "regex":
      try {
        matches = new RegExp(filter.pattern, filter.caseSensitive ? "" : "i").test(file.basename);
      } catch (e) {
        matches = false;
      }
      break;
    default:
      matches = false;
  }
  return filter.negate ? !matches : matches;
}
function ffwApplyFilter(file, cache, filter) {
  switch (filter.type) {
    case "tag":
      return ffwEvalTagFilter(cache, filter);
    case "frontmatter":
      return ffwEvalFrontmatterFilter(cache, filter);
    case "path":
      return ffwEvalPathFilter(file, filter);
    case "name":
      return ffwEvalNameFilter(file, filter);
    default:
      return true;
  }
}
function ffwGetFrontmatterSortValue(app, file, key) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  if (!fm)
    return void 0;
  const val = fm[key];
  if (val == null || val === "")
    return void 0;
  return typeof val === "number" || typeof val === "string" ? val : Array.isArray(val) ? val.map(ffwFormatValue).join(", ") : ffwFormatValue(val);
}
function ffwSortFiles(files, app, sort) {
  const arr = files.slice();
  switch (sort.field) {
    case "created-desc":
      return arr.sort((a, b) => b.stat.ctime - a.stat.ctime);
    case "created-asc":
      return arr.sort((a, b) => a.stat.ctime - b.stat.ctime);
    case "modified-desc":
      return arr.sort((a, b) => b.stat.mtime - a.stat.mtime);
    case "modified-asc":
      return arr.sort((a, b) => a.stat.mtime - b.stat.mtime);
    case "name-asc":
      return arr.sort((a, b) => a.basename.localeCompare(b.basename, void 0, { sensitivity: "base" }));
    case "name-desc":
      return arr.sort((a, b) => b.basename.localeCompare(a.basename, void 0, { sensitivity: "base" }));
    case "frontmatter-asc":
    case "frontmatter-desc": {
      const key = sort.frontmatterKey;
      if (!key)
        return arr;
      const dir = sort.field === "frontmatter-asc" ? 1 : -1;
      return arr.sort((a, b) => {
        const va = ffwGetFrontmatterSortValue(app, a, key);
        const vb = ffwGetFrontmatterSortValue(app, b, key);
        if (va === void 0 && vb === void 0)
          return 0;
        if (va === void 0)
          return 1;
        if (vb === void 0)
          return -1;
        if (typeof va === "number" && typeof vb === "number")
          return (va - vb) * dir;
        return String(va).localeCompare(String(vb), void 0, { sensitivity: "base" }) * dir;
      });
    }
    default:
      return arr;
  }
}
function ffwGetSectionFiles(app, section) {
  const files = app.vault.getMarkdownFiles().filter((file) => {
    const cache = app.metadataCache.getFileCache(file);
    return section.filters.every((filter) => ffwApplyFilter(file, cache, filter));
  });
  const sorted = ffwSortFiles(files, app, section.sort);
  return section.maxResults && section.maxResults > 0 ? sorted.slice(0, section.maxResults) : sorted;
}

// src/ui/filtered-file-modal.ts
var import_obsidian22 = require("obsidian");
var FilteredFileModal = class extends import_obsidian22.FuzzySuggestModal {
  constructor(app, files, typeName) {
    super(app);
    this.files = files;
    this.setPlaceholder(typeName ? `Search ${typeName}\u2026` : "Type to search filtered files\u2026");
    this.setInstructions([
      { command: "\u2191\u2193", purpose: "navigate" },
      { command: "\u21B5", purpose: "open" },
      { command: "esc", purpose: "dismiss" }
    ]);
  }
  getTitle(file) {
    var _a;
    const cache = this.app.metadataCache.getFileCache(file);
    const title = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a["title"];
    return title ? stringifyFrontmatterValue2(title) : file.basename;
  }
  getItems() {
    return this.files;
  }
  getItemText(file) {
    return this.getTitle(file);
  }
  renderSuggestion(match, el) {
    var _a;
    const file = match.item;
    el.createSpan({ text: this.getTitle(file), cls: "suggestion-title" });
    const folder = (_a = file.parent) == null ? void 0 : _a.path;
    if (folder && folder !== "/") {
      el.createSpan({ text: folder, cls: "suggestion-note" });
    }
  }
  onChooseItem(file) {
    void this.app.workspace.getLeaf(false).openFile(file);
  }
};

// src/ui/new-note-modal.ts
var import_obsidian23 = require("obsidian");
var NewNoteModal = class extends import_obsidian23.Modal {
  constructor(app, noteType, onSubmit, initialTitle = "", urlSelection = "", titlePromise = null) {
    super(app);
    this.fieldValues = {};
    this.descriptionValue = "";
    this.titleTouched = false;
    this.noteType = noteType;
    this.onSubmit = onSubmit;
    this.titleValue = initialTitle;
    this.titlePromise = titlePromise;
    if (urlSelection && noteType.urlFieldKey) {
      this.fieldValues[noteType.urlFieldKey] = urlSelection;
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ffc-new-note-modal");
    contentEl.createEl("h2", { text: `New ${this.noteType.name}` });
    new import_obsidian23.Setting(contentEl).setName("Title").addText((text) => {
      const basePlaceholder = `Enter ${this.noteType.name} title\u2026`;
      text.setPlaceholder(this.titlePromise ? "Fetching title\u2026" : basePlaceholder).setValue(this.titleValue).onChange((v) => {
        this.titleValue = v;
        this.titleTouched = true;
      });
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          this.submit();
        if (e.key === "Escape")
          this.close();
      });
      window.setTimeout(() => {
        text.inputEl.focus();
        text.inputEl.select();
      }, 50);
      if (this.titlePromise) {
        void this.titlePromise.then((fetched) => {
          text.setPlaceholder(basePlaceholder);
          if (this.titleTouched || !fetched)
            return;
          const clean = sanitizeNoteTitle(fetched);
          if (!clean)
            return;
          this.titleValue = clean;
          text.setValue(clean);
          text.inputEl.select();
        });
      }
    });
    const descSetting = new import_obsidian23.Setting(contentEl).setName("Description").setDesc("Added to the body of the created page").addTextArea((ta) => {
      ta.setPlaceholder("Optional description\u2026").onChange((v) => {
        this.descriptionValue = v;
      });
      ta.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Escape")
          this.close();
      });
    });
    renderFieldInputs(contentEl, this.app, this.noteType, this.fieldValues, () => this.submit(), descSetting.settingEl);
    new import_obsidian23.Setting(contentEl).addButton((btn) => btn.setButtonText("Create").setCta().onClick(() => this.submit())).addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }
  submit() {
    const title = this.titleValue.trim();
    if (!title) {
      new import_obsidian23.Notice("Please enter a title.");
      return;
    }
    this.close();
    void this.onSubmit(title, this.fieldValues, this.descriptionValue);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/create-note-type-modal.ts
var import_obsidian24 = require("obsidian");
var CreateNoteTypeModal = class extends import_obsidian24.Modal {
  constructor(app, plugin, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
    this.values = { name: "", description: "", templatePath: "", saveFolder: "", saveLocation: "vault", matchFilters: [], matchMode: "all" };
    this.saved = false;
    /** Called once the modal has closed, with whether a note type was saved. */
    this.onClosed = null;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("Create note type");
    new import_obsidian24.Setting(contentEl).setName("Name").addText((text) => {
      text.setPlaceholder("E.g. Meeting").onChange((v) => {
        this.values.name = v;
      });
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          void this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian24.Setting(contentEl).setName("Description").addText((text) => text.setPlaceholder("Optional").onChange((v) => {
      this.values.description = v;
    }));
    const templateFiles = this.plugin.getTemplateFiles();
    let onTemplateCreated = (_file) => {
    };
    let templateSetting;
    if (templateFiles.length > 0) {
      templateSetting = new import_obsidian24.Setting(contentEl).setName("Template").addDropdown((dd) => {
        dd.addOption("", "None");
        for (const f of templateFiles)
          dd.addOption(f.path, f.basename);
        dd.setValue("").onChange((v) => {
          this.values.templatePath = v;
        });
        onTemplateCreated = (file) => {
          dd.addOption(file.path, file.basename);
          dd.setValue(file.path);
        };
      });
    } else {
      templateSetting = new import_obsidian24.Setting(contentEl).setName("Template").setDesc("No templates found. Add one with +, or set the templates folder in the main settings.").addText((text) => {
        text.setPlaceholder("Templates/Meeting.md").onChange((v) => {
          this.values.templatePath = v.trim();
        });
        onTemplateCreated = (file) => {
          text.setValue(file.path);
        };
      });
    }
    addNewTemplateButton(this.app, this.plugin, templateSetting, (file) => {
      this.values.templatePath = file.path;
      onTemplateCreated(file);
    });
    addSaveLocationSettings(this.app, contentEl, this.values);
    new import_obsidian24.Setting(contentEl).setName("Detection filters").setDesc("Notes matching these filters are treated as this type. Without filters, only a specific folder location lets notes be detected.").addButton((btn) => btn.setButtonText("Add filter").onClick(() => {
      this.values.matchFilters.push({ key: "", operator: "equals", value: "" });
      this.renderFilters();
    }));
    this.filtersEl = contentEl.createDiv();
    this.renderFilters();
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new import_obsidian24.ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    new import_obsidian24.ButtonComponent(buttons).setButtonText("Save").setCta().onClick(() => {
      void this.submit();
    });
  }
  renderFilters() {
    const el = this.filtersEl;
    el.empty();
    const filters = this.values.matchFilters;
    if (filters.length > 1) {
      new import_obsidian24.Setting(el).setName("Match").addDropdown((dd) => dd.addOption("all", "All filters").addOption("any", "Any filter").setValue(this.values.matchMode).onChange((v) => {
        this.values.matchMode = v;
      }));
    }
    filters.forEach((filter, i) => {
      const row = new import_obsidian24.Setting(el).setClass("ffc-create-filter-row");
      const isPathOp = () => filter.operator === "in_folder" || filter.operator === "not_in_folder";
      row.addText((t) => {
        t.setPlaceholder("Property").setValue(filter.key).onChange((v) => {
          filter.key = v.trim();
        });
        if (isPathOp())
          t.inputEl.hide();
      });
      row.addDropdown((dd) => dd.addOption("equals", "Equals").addOption("not_equals", "Does not equal").addOption("contains", "Contains").addOption("exists", "Exists").addOption("in_folder", "In folder").addOption("not_in_folder", "Not in folder").setValue(filter.operator).onChange((v) => {
        filter.operator = v;
        this.renderFilters();
      }));
      if (filter.operator !== "exists") {
        row.addText((t) => t.setPlaceholder(isPathOp() ? "Folder path" : "Value").setValue(filter.value).onChange((v) => {
          filter.value = v;
        }));
      }
      row.addExtraButton((b) => b.setIcon("trash").setTooltip("Remove filter").onClick(() => {
        filters.splice(i, 1);
        this.renderFilters();
      }));
    });
  }
  async submit() {
    if (!this.values.name.trim()) {
      new import_obsidian24.Notice("Enter a name for the note type.");
      return;
    }
    this.values.name = this.values.name.trim();
    this.values.matchFilters = this.values.matchFilters.filter((f) => f.operator === "in_folder" || f.operator === "not_in_folder" ? !!f.value.trim() : f.operator === "exists" ? !!f.key : !!f.key && !!f.value);
    if (this.values.saveLocation !== "folder")
      this.values.saveFolder = "";
    try {
      await this.onSubmit(this.values);
      this.saved = true;
      this.close();
    } catch (err) {
      console.error("Create note type failed:", err);
      new import_obsidian24.Notice("Could not create the note type. See the console for details.");
    }
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.onClosed) == null ? void 0 : _a.call(this, this.saved);
  }
};

// src/ui/combined-new-note-modal.ts
var import_obsidian25 = require("obsidian");
var CombinedNewNoteModal = class extends import_obsidian25.Modal {
  constructor(app, noteTypes, onSubmit, initialTitle = "", urlSelection = "", titlePromise = null, initialType) {
    super(app);
    this.titleValue = "";
    this.fieldValues = {};
    this.descriptionValue = "";
    this.titleTouched = false;
    this.submitted = false;
    /** Called when the modal closes without creating anything. */
    this.onDismiss = null;
    /**
     * When set, the Type row shows a plus button. It hands over a `done` callback
     * to call once the user finishes (or cancels) creating a type; this modal then
     * reopens with its entered values intact.
     */
    this.onAddType = null;
    this.switching = false;
    this.noteTypes = noteTypes;
    this.selectedType = initialType && noteTypes.includes(initialType) ? initialType : noteTypes[0];
    this.onSubmit = onSubmit;
    this.initialTitle = initialTitle;
    this.urlSelection = urlSelection;
    this.titlePromise = titlePromise;
    this.applyUrlPrefill();
  }
  /**
   * Seed the selected type's designated URL field with the highlighted URL, if
   * both are present. Re-run whenever the selected type changes, since switching
   * type resets the field-value map.
   */
  applyUrlPrefill() {
    var _a;
    const key = (_a = this.selectedType) == null ? void 0 : _a.urlFieldKey;
    if (this.urlSelection && key)
      this.fieldValues[key] = this.urlSelection;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ffc-new-note-modal");
    contentEl.createEl("h2", { text: "New note" });
    let descSettingEl = null;
    const typeSetting = new import_obsidian25.Setting(contentEl).setName("Type");
    if (this.onAddType) {
      typeSetting.addExtraButton((btn) => btn.setIcon("plus").setTooltip("Add note type").onClick(() => this.addType()));
    }
    typeSetting.addDropdown((dd) => {
      for (const obj of this.noteTypes)
        dd.addOption(obj.id, obj.name);
      dd.setValue(this.selectedType.id);
      dd.onChange((id) => {
        var _a;
        this.selectedType = (_a = this.noteTypes.find((o) => o.id === id)) != null ? _a : this.noteTypes[0];
        this.fieldValues = {};
        this.applyUrlPrefill();
        renderFieldInputs(contentEl, this.app, this.selectedType, this.fieldValues, () => this.submit(), descSettingEl);
      });
    });
    new import_obsidian25.Setting(contentEl).setName("Title").addText((text) => {
      text.setPlaceholder(this.titlePromise ? "Fetching title\u2026" : "Enter title\u2026").setValue(this.initialTitle).onChange((v) => {
        this.titleValue = v;
        this.titleTouched = true;
      });
      this.titleValue = this.initialTitle;
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          this.submit();
        if (e.key === "Escape")
          this.close();
      });
      window.setTimeout(() => {
        text.inputEl.focus();
        text.inputEl.select();
      }, 50);
      if (this.titlePromise) {
        void this.titlePromise.then((fetched) => {
          text.setPlaceholder("Enter title\u2026");
          if (this.titleTouched || !fetched)
            return;
          const clean = sanitizeNoteTitle(fetched);
          if (!clean)
            return;
          this.titleValue = clean;
          text.setValue(clean);
          text.inputEl.select();
        });
      }
    });
    const descSetting = new import_obsidian25.Setting(contentEl).setName("Description").setDesc("Added to the body of the created page").addTextArea((ta) => {
      ta.setPlaceholder("Optional description\u2026").setValue(this.descriptionValue).onChange((v) => {
        this.descriptionValue = v;
      });
      ta.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Escape")
          this.close();
      });
    });
    descSettingEl = descSetting.settingEl;
    renderFieldInputs(contentEl, this.app, this.selectedType, this.fieldValues, () => this.submit(), descSettingEl);
    new import_obsidian25.Setting(contentEl).addButton((btn) => btn.setButtonText("Create").setCta().onClick(() => this.submit())).addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }
  addType() {
    var _a;
    this.initialTitle = this.titleValue;
    this.switching = true;
    this.close();
    (_a = this.onAddType) == null ? void 0 : _a.call(this, (created) => {
      this.switching = false;
      if (created) {
        this.selectedType = created;
        this.fieldValues = {};
        this.applyUrlPrefill();
      }
      this.open();
    });
  }
  submit() {
    if (this.submitted)
      return;
    const title = this.titleValue.trim();
    if (!title) {
      new import_obsidian25.Notice("Please enter a title.");
      return;
    }
    this.submitted = true;
    this.close();
    void this.onSubmit(this.selectedType, title, this.fieldValues, this.descriptionValue);
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    if (!this.submitted && !this.switching)
      (_a = this.onDismiss) == null ? void 0 : _a.call(this);
  }
};

// src/ui/note-type-suggest.ts
var import_obsidian26 = require("obsidian");
var NoteTypeSuggest = class extends import_obsidian26.EditorSuggest {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onTrigger(cursor, editor) {
    const triggerKey = this.plugin.settings.triggerKey;
    if (!triggerKey)
      return null;
    const line = editor.getLine(cursor.line);
    const sub = line.substring(0, cursor.ch);
    const triggerIndex = sub.lastIndexOf(triggerKey);
    if (triggerIndex === -1)
      return null;
    const query = sub.substring(triggerIndex + triggerKey.length);
    const beforeTrigger = sub.substring(0, triggerIndex);
    if (beforeTrigger.includes("[[") && !beforeTrigger.includes("]]"))
      return null;
    return {
      start: { line: cursor.line, ch: triggerIndex },
      end: cursor,
      query
    };
  }
  getSuggestions(context) {
    const query = context.query.toLowerCase();
    const noteItems = this._getMatchingFiles().map((file) => {
      var _a;
      const cache = this.app.metadataCache.getFileCache(file);
      const title = ((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a["title"]) ? String(cache.frontmatter["title"]) : file.basename;
      return { kind: "note", file, title };
    }).filter(({ title }) => title.toLowerCase().includes(query)).sort((a, b) => {
      const aStarts = a.title.toLowerCase().startsWith(query) ? 0 : 1;
      const bStarts = b.title.toLowerCase().startsWith(query) ? 0 : 1;
      return aStarts - bStarts || a.title.localeCompare(b.title);
    });
    const providerItems = [];
    for (const provider of this.plugin.triggerProviders.values()) {
      for (const item of provider.getItems(query)) {
        providerItems.push({ kind: "provider", provider, item });
      }
    }
    return [...noteItems, ...providerItems].slice(0, 30);
  }
  _getMatchingFiles() {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const noteType of this.plugin.settings.noteTypes) {
      if (!noteType.showInTriggerMenu)
        continue;
      for (const file of this.plugin.getNoteTypeFiles(noteType)) {
        if (!seen.has(file.path)) {
          seen.add(file.path);
          result.push(file);
        }
      }
    }
    return result;
  }
  renderSuggestion(suggestion, el) {
    var _a;
    if (suggestion.kind === "provider") {
      if (suggestion.provider.renderItem) {
        suggestion.provider.renderItem(suggestion.item, el);
      } else {
        el.createSpan({ text: suggestion.item.title, cls: "suggestion-title" });
        if (suggestion.item.subtitle) {
          el.createSpan({ text: suggestion.item.subtitle, cls: "suggestion-note" });
        }
      }
      return;
    }
    el.createSpan({ text: suggestion.title, cls: "suggestion-title" });
    const folder = (_a = suggestion.file.parent) == null ? void 0 : _a.path;
    if (folder && folder !== "/") {
      el.createSpan({ text: folder, cls: "suggestion-note" });
    }
  }
  selectSuggestion(suggestion) {
    const context = this.context;
    if (!context)
      return;
    if (suggestion.kind === "provider") {
      suggestion.provider.selectItem(
        suggestion.item,
        context.editor,
        context.start,
        context.end
      );
      return;
    }
    const { file, title } = suggestion;
    const link = title !== file.basename ? `[[${file.basename}|${title}]]` : `[[${file.basename}]]`;
    context.editor.replaceRange(link, context.start, context.end);
  }
};

// src/ui/note-preview-popup.ts
var NotePreviewPopup = class {
  constructor(plugin) {
    this.popup = null;
    this.hideTimer = null;
    this.showTimer = null;
    this._currentFile = null;
    this.plugin = plugin;
    this._onMouseOver = (e) => this._handleMouseOver(e);
    this._onMouseOut = (e) => this._handleMouseOut(e);
    document.addEventListener("mouseover", this._onMouseOver, true);
    document.addEventListener("mouseout", this._onMouseOut, true);
    const leafChangeRef = plugin.app.workspace.on("active-leaf-change", () => this.hide());
    plugin.registerEvent(leafChangeRef);
  }
  // ── Mouse event handlers ──────────────────────────────────────────────────────
  _handleMouseOver(e) {
    var _a, _b;
    if (this.popup && this.popup.contains(e.target))
      return;
    const el = e.target;
    let linkpath = null;
    const anchor = el.matches("a.internal-link[data-href]") ? el : el.closest("a.internal-link[data-href]");
    if (anchor) {
      linkpath = ((_a = anchor.getAttribute("data-href")) != null ? _a : "").split("#")[0].trim();
    }
    if (!linkpath) {
      const cmSpan = el.classList.contains("cm-hmd-internal-link") ? el : el.closest(".cm-hmd-internal-link");
      if (cmSpan) {
        linkpath = ((_b = cmSpan.textContent) != null ? _b : "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
      }
    }
    if (!linkpath)
      return;
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, "");
    if (!file)
      return;
    const noteType = this._getNoteTypeForFile(file);
    if (!noteType)
      return;
    if (this.hideTimer)
      window.clearTimeout(this.hideTimer);
    if (this.showTimer)
      window.clearTimeout(this.showTimer);
    if (this.popup && this._currentFile === file)
      return;
    const triggerEl = anchor != null ? anchor : el.closest(".cm-hmd-internal-link");
    this.showTimer = window.setTimeout(() => {
      void this._showForFile(file, noteType, e.clientX, e.clientY, triggerEl);
    }, 280);
  }
  _handleMouseOut(e) {
    if (this.showTimer)
      window.clearTimeout(this.showTimer);
    const toEl = e.relatedTarget;
    if (this.popup && toEl && this.popup.contains(toEl))
      return;
    this.hideTimer = window.setTimeout(() => this.hide(), 200);
  }
  // ── Build and position the popup ──────────────────────────────────────────────
  async _showForFile(file, noteType, clientX, clientY, triggerEl) {
    var _a, _b, _c, _d, _e, _f, _g;
    const hasFields = ((_b = (_a = noteType.previewFields) == null ? void 0 : _a.length) != null ? _b : 0) > 0;
    const hasImage = !!(noteType.showImageInPreview && noteType.imageKey);
    if (!hasFields && !hasImage)
      return;
    const app = this.plugin.app;
    const fm = (_d = (_c = app.metadataCache.getFileCache(file)) == null ? void 0 : _c.frontmatter) != null ? _d : {};
    const title = fm["title"] ? String(fm["title"]) : file.basename;
    this.hide();
    const popup = createDiv();
    popup.className = "ffc-preview-popup";
    if (hasImage && noteType.imageKey) {
      const rawImg = fm[noteType.imageKey];
      const imgSrc = rawImg ? await this._resolveImageSrc(String(rawImg).trim(), app) : null;
      if (imgSrc) {
        const imgEl = popup.createEl("img", { cls: "ffc-preview-image" });
        imgEl.src = imgSrc;
        imgEl.alt = title;
      }
    }
    const header = popup.createDiv({ cls: "ffc-preview-header" });
    header.createSpan({ text: title, cls: "ffc-preview-title" });
    popup.createEl("hr", { cls: "ffc-preview-divider" });
    const body = popup.createDiv({ cls: "ffc-preview-body" });
    let hasRows = false;
    const renderValue = (valueEl, str) => {
      const wikiMatch = String(str).match(/^\[\[(.+?)(?:\|(.+?))?\]\]$/);
      if (wikiMatch) {
        const linkPath = wikiMatch[1];
        const linkLabel = wikiMatch[2] || wikiMatch[1];
        const a = valueEl.createEl("a", { text: linkLabel, cls: "ffc-preview-wikilink internal-link" });
        a.dataset["href"] = linkPath;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.hide();
          void app.workspace.openLinkText(linkPath, "", false);
        });
      } else {
        valueEl.appendText(String(str));
      }
    };
    for (const pf of (_e = noteType.previewFields) != null ? _e : []) {
      const key = typeof pf === "string" ? pf : (_f = pf.key) != null ? _f : "";
      const label = (typeof pf === "string" ? pf : pf.label || pf.key) || key;
      if (!key)
        continue;
      const raw = fm[key];
      if (raw === void 0 || raw === null || raw === "")
        continue;
      const row = body.createDiv({ cls: "ffc-preview-row" });
      row.createSpan({ text: label, cls: "ffc-preview-label" });
      const valueEl = row.createSpan({ cls: "ffc-preview-value" });
      if (Array.isArray(raw)) {
        raw.forEach((item, i) => {
          if (i > 0)
            valueEl.appendText(", ");
          renderValue(valueEl, item);
        });
      } else {
        renderValue(valueEl, raw);
      }
      hasRows = true;
    }
    if (!hasRows) {
      body.remove();
      (_g = popup.querySelector(".ffc-preview-divider")) == null ? void 0 : _g.remove();
    }
    document.body.appendChild(popup);
    this.popup = popup;
    this._currentFile = file;
    popup.addEventListener("mouseenter", () => {
      if (this.hideTimer)
        window.clearTimeout(this.hideTimer);
    });
    popup.addEventListener("mouseleave", () => {
      this.hideTimer = window.setTimeout(() => this.hide(), 200);
    });
    popup.addEventListener("click", (e) => {
      if (e.target.closest(".ffc-preview-wikilink"))
        return;
      const fileToOpen = this._currentFile;
      this.hide();
      if (fileToOpen) {
        const newLeaf = e.metaKey || e.ctrlKey ? "tab" : false;
        void this.plugin.app.workspace.openLinkText(fileToOpen.basename, "", newLeaf);
      }
    });
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const positionPopup = () => {
      if (!this.popup)
        return;
      const pw = popup.offsetWidth || 280;
      const ph = popup.offsetHeight || 120;
      let left, top;
      const r = triggerEl ? triggerEl.getBoundingClientRect() : null;
      if (r && (r.width > 0 || r.height > 0)) {
        left = r.left;
        top = r.bottom + 6;
        if (top + ph > vh - margin)
          top = r.top - ph - 6;
        if (left + pw > vw - margin)
          left = vw - margin - pw;
      } else {
        left = clientX + margin;
        top = clientY + margin;
        if (left + pw > vw - margin)
          left = clientX - pw - margin;
        if (top + ph > vh - margin)
          top = clientY - ph - margin;
      }
      popup.style.left = `${Math.max(margin, left)}px`;
      popup.style.top = `${Math.max(margin, top)}px`;
    };
    window.requestAnimationFrame(positionPopup);
  }
  async _resolveImageSrc(rawValue, app) {
    if (!rawValue)
      return null;
    const v = rawValue.trim();
    if (!v)
      return null;
    if (/^https?:\/\//i.test(v))
      return v;
    const linkPath = v.replace(/^\[\[/, "").replace(/\]\]$/, "");
    const imageFile = app.metadataCache.getFirstLinkpathDest(linkPath, "");
    if (imageFile)
      return app.vault.getResourcePath(imageFile);
    return null;
  }
  _getNoteTypeForFile(file) {
    var _a, _b;
    for (const noteType of this.plugin.settings.noteTypes) {
      const hasContent = ((_b = (_a = noteType.previewFields) == null ? void 0 : _a.length) != null ? _b : 0) > 0 || noteType.showImageInPreview && noteType.imageKey;
      if (!hasContent)
        continue;
      const files = this.plugin.getNoteTypeFiles(noteType);
      if (files.some((f) => f.path === file.path))
        return noteType;
    }
    return null;
  }
  // ── Public API ────────────────────────────────────────────────────────────────
  hide() {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
    this._currentFile = null;
  }
  destroy() {
    this.hide();
    if (this.hideTimer)
      window.clearTimeout(this.hideTimer);
    if (this.showTimer)
      window.clearTimeout(this.showTimer);
    document.removeEventListener("mouseover", this._onMouseOver, true);
    document.removeEventListener("mouseout", this._onMouseOut, true);
  }
};

// src/api.ts
var import_obsidian27 = require("obsidian");
var NOTE_TYPES_API_VERSION = 1;
function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function createApi(plugin) {
  return {
    version: NOTE_TYPES_API_VERSION,
    getNoteTypes: () => plugin.settings.noteTypes,
    getNoteTypeForFile: (file) => plugin.getNoteTypeForFile(file),
    getNoteTypeFiles: (type) => plugin.getNoteTypeFiles(type),
    createNote: (type, title, fieldValues, description) => plugin.createNote(type, title, fieldValues, description),
    openNewNoteModal: (initialTitle = "") => new Promise((resolve) => {
      plugin.openNewNoteModal(async (type, title, fv, desc) => {
        try {
          resolve(await plugin.createNote(type, title, fv, desc));
        } catch (err) {
          new import_obsidian27.Notice(`Could not create note: ${err.message}`);
          resolve(null);
        }
      }, sanitizeNoteTitle(initialTitle), "", null, () => resolve(null));
    }),
    getRelationTypes: () => plugin.settings.relationTypes,
    resolveRelation: (rt) => resolvedRelation(rt),
    addRelationType: async (name, reverseName = "") => {
      const types = plugin.settings.relationTypes;
      const taken = new Set(types.flatMap((rt2) => [rt2.id, rt2.frontmatterKey, rt2.reverseKey]));
      const base = slugify(name) || "relation";
      let key = base;
      for (let i = 2; taken.has(key); i++)
        key = `${base}_${i}`;
      const rt = {
        id: `rel-${key}`,
        name: name.trim(),
        frontmatterKey: key,
        reverseName: reverseName.trim(),
        reverseKey: ""
      };
      types.push(rt);
      await plugin.saveSettings();
      return rt;
    },
    restoreRelationType: async (rt) => {
      if (plugin.settings.relationTypes.some((r) => r.id === rt.id))
        return;
      plugin.settings.relationTypes.push(rt);
      await plugin.saveSettings();
    },
    removeRelationType: async (id) => {
      const types = plugin.settings.relationTypes;
      if (!types.some((r) => r.id === id && !r.builtin))
        return;
      plugin.settings.relationTypes = types.filter((r) => r.id !== id);
      await plugin.saveSettings();
    },
    listRelationsForFile: (file) => plugin.listRelationsForFile(file),
    hasRelationLink: (file, key, target) => plugin.hasRelationLink(file, key, target),
    addRelation: (source, target, rt) => plugin.addRelation(source, target, rt),
    writeRelationSides: (source, target, rt, sides) => plugin.writeRelationSides(source, target, rt, sides),
    removeRelationSides: (source, target, rt, sides) => plugin.removeRelationSides(source, target, rt, sides)
  };
}

// src/commands/cli.ts
var import_obsidian28 = require("obsidian");
var PREFIX = "filtered-file-commands";
var CliError = class extends Error {
};
function fail(message) {
  throw new CliError(message);
}
function reply(value) {
  return JSON.stringify(value, null, 2);
}
function safe(run) {
  return async (params) => {
    try {
      return reply(await run(params));
    } catch (err) {
      return reply({ error: err instanceof CliError ? err.message : `Unexpected error: ${err.message}` });
    }
  };
}
function required(params, name) {
  const v = params[name];
  if (typeof v !== "string" || !v.trim() || v === "true")
    fail(`Missing ${name}=<value>.`);
  return v.trim();
}
function same(a, b) {
  return !!a && a.trim().toLowerCase() === b.toLowerCase();
}
function pick(items, query, tiers, kind, label) {
  for (const tier of tiers) {
    const hits = items.filter((item) => tier(item).some((v) => same(v, query)));
    if (hits.length === 1)
      return hits[0];
    if (hits.length > 1)
      fail(`"${query}" matches several ${kind}s (${hits.map((h) => h.id).join(", ")}). Use an id.`);
  }
  return fail(`No ${kind} "${query}". Available: ${items.map(label).join(", ") || "(none)"}.`);
}
function findNoteType(plugin, query) {
  return pick(
    plugin.api.getNoteTypes(),
    query,
    [(t) => [t.id], (t) => [t.name], (t) => [t.commandSlug]],
    "note type",
    (t) => t.name
  );
}
function findRelationType(plugin, query) {
  const r = (rt) => plugin.api.resolveRelation(rt);
  return pick(plugin.api.getRelationTypes(), query, [
    (rt) => [rt.id],
    (rt) => [r(rt).forwardName, r(rt).reverseName],
    (rt) => [r(rt).forwardKey, r(rt).reverseKey]
  ], "relation type", (rt) => r(rt).forwardName);
}
function findFile(plugin, query) {
  var _a;
  const { vault, metadataCache } = plugin.app;
  const direct = (_a = vault.getAbstractFileByPath(query)) != null ? _a : vault.getAbstractFileByPath(`${query}.md`);
  if (direct instanceof import_obsidian28.TFile)
    return direct;
  const linked = metadataCache.getFirstLinkpathDest(query.replace(/^\[\[|\]\]$/g, ""), "");
  if (linked)
    return linked;
  return fail(`No note found for "${query}".`);
}
function describeType(t) {
  var _a, _b;
  return {
    id: t.id,
    name: t.name,
    description: (_a = t.description) != null ? _a : "",
    saveFolder: t.saveFolder,
    fields: ((_b = t.fields) != null ? _b : []).filter((f) => {
      var _a2;
      return (_a2 = f.key) == null ? void 0 : _a2.trim();
    }).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      note: f.type === "list" ? "comma-separated values" : void 0
    }))
  };
}
function fieldValueText(key, value) {
  const scalar = (v) => {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      return String(v);
    return fail(`Field "${key}" must be text, a number, a boolean, or a list of those.`);
  };
  return Array.isArray(value) ? value.map(scalar).join(", ") : scalar(value);
}
function parseFields(raw, type) {
  var _a;
  if (!raw || raw === "true")
    return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return fail(`fields must be a JSON object, e.g. fields='{"status":"open"}'.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    fail("fields must be a JSON object.");
  const known = new Set(((_a = type.fields) != null ? _a : []).map((f) => f.key));
  const out = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!known.has(key))
      fail(`"${key}" is not a field of ${type.name}. Fields: ${[...known].join(", ") || "(none)"}.`);
    out[key] = fieldValueText(key, value);
  }
  return out;
}
function vaultFolder(raw) {
  if (!raw)
    return "";
  const folder = (0, import_obsidian28.normalizePath)(raw).replace(/^\/+|\/+$/g, "");
  if (folder.split("/").some((seg) => seg === "..") || /^[a-z]:/i.test(folder)) {
    fail(`folder must be inside the vault: ${raw}.`);
  }
  return folder === "." ? "" : folder;
}
function parseFieldDefs(raw) {
  if (!raw || raw === "true")
    return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return fail(`fields must be a JSON array, e.g. fields='["status",{"key":"tags","type":"list"}]'.`);
  }
  if (!Array.isArray(parsed))
    fail("fields must be a JSON array.");
  const seen = /* @__PURE__ */ new Set();
  return parsed.map((item) => {
    var _a, _b;
    const def = typeof item === "string" ? { key: item } : item;
    const key = typeof (def == null ? void 0 : def.key) === "string" ? def.key.trim() : "";
    if (!key)
      fail('Every field needs a "key".');
    if (seen.has(key))
      fail(`Duplicate field key "${key}".`);
    seen.add(key);
    if ((def == null ? void 0 : def.type) !== void 0 && def.type !== "text" && def.type !== "list")
      fail(`Field "${key}": type must be "text" or "list".`);
    return { key, label: ((_a = def == null ? void 0 : def.label) == null ? void 0 : _a.trim()) || key, type: (_b = def == null ? void 0 : def.type) != null ? _b : "text" };
  });
}
function registerCliHandlers(plugin) {
  const add = (action, description, flags, run) => {
    try {
      plugin.registerCliHandler(`${PREFIX}:${action}`, description, flags, safe(run));
    } catch (err) {
      console.warn(`Note Types: could not register CLI command ${action}:`, err);
    }
  };
  add("types", "List note types with their creation fields", null, () => plugin.api.getNoteTypes().map(describeType));
  add("create-type", "Create a note type (also adds its New note command)", {
    name: { value: "<name>", description: "Note type name", required: true },
    description: { value: "<text>", description: "What the type is for" },
    template: { value: "<path>", description: "Vault path of a template note, e.g. Templates/Meeting.md" },
    folder: { value: "<folder>", description: "Save new notes in this folder (default: vault root)" },
    fields: { value: "<json>", description: "Creation fields: JSON array of keys or {key,label,type} objects; type is text or list" }
  }, async (p) => {
    const name = required(p, "name");
    if (plugin.api.getNoteTypes().some((t) => same(t.name, name)))
      fail(`A note type named "${name}" already exists.`);
    const str = (k) => typeof p[k] === "string" && p[k] !== "true" ? p[k].trim() : "";
    const template = str("template");
    if (template && !(plugin.app.vault.getAbstractFileByPath(template) instanceof import_obsidian28.TFile))
      fail(`Template not found: ${template}.`);
    const folder = vaultFolder(str("folder"));
    const fields = parseFieldDefs(p.fields);
    const noteType = await plugin.createNoteType(name, {
      description: str("description") || void 0,
      templatePath: template,
      saveFolder: folder,
      saveLocation: folder ? "folder" : "vault",
      fields
    });
    return describeType(noteType);
  });
  add("notes", "List the notes that match a note type", {
    type: { value: "<name>", description: "Note type name, id or command slug", required: true }
  }, (p) => {
    const type = findNoteType(plugin, required(p, "type"));
    return plugin.api.getNoteTypeFiles(type).map((f) => f.path);
  });
  add("create", "Create a note of a note type from its template", {
    type: { value: "<name>", description: "Note type name, id or command slug", required: true },
    title: { value: "<title>", description: "Note title (becomes the file name)", required: true },
    fields: { value: "<json>", description: "Field values as a JSON object keyed by field key; see the types command" },
    description: { value: "<text>", description: "Text appended to the note body" }
  }, async (p) => {
    const type = findNoteType(plugin, required(p, "type"));
    const title = sanitizeNoteTitle(required(p, "title"));
    if (!title)
      fail("title has no usable characters.");
    const desc = typeof p.description === "string" && p.description !== "true" ? p.description : "";
    const fields = parseFields(p.fields, type);
    if (type.templatePath && !(plugin.app.vault.getAbstractFileByPath(type.templatePath) instanceof import_obsidian28.TFile)) {
      fail(`The template for ${type.name} is missing: ${type.templatePath}.`);
    }
    const folder = plugin.resolveSaveFolder(type);
    const path = `${folder ? `${folder}/` : ""}${title}.md`;
    if (plugin.app.vault.getAbstractFileByPath(path))
      fail(`A note already exists at ${path}.`);
    const file = await plugin.api.createNote(type, title, fields, desc);
    if (!file)
      fail(`Could not create ${path}.`);
    return { path: file.path, type: type.name };
  });
  add("relation-types", "List relation types and their frontmatter keys", null, () => plugin.api.getRelationTypes().map((rt) => {
    const r = plugin.api.resolveRelation(rt);
    return { id: rt.id, name: r.forwardName, key: r.forwardKey, reverseName: r.reverseName, reverseKey: r.reverseKey };
  }));
  add("relations", "List a note's relations to other notes", {
    file: { value: "<path>", description: "Note path or link name", required: true }
  }, (p) => {
    const file = findFile(plugin, required(p, "file"));
    return plugin.api.listRelationsForFile(file).map((r) => {
      var _a, _b;
      return {
        relation: r.label,
        direction: r.direction,
        key: r.ownKey,
        target: (_b = (_a = r.targetFile) == null ? void 0 : _a.path) != null ? _b : null,
        linktext: r.linktext
      };
    });
  });
  add("relate", "Link two notes with a relation type (written on both notes)", {
    source: { value: "<path>", description: "Source note path or link name", required: true },
    target: { value: "<path>", description: "Target note path or link name", required: true },
    relation: { value: "<name>", description: "Relation type name, id or frontmatter key", required: true }
  }, async (p) => {
    const source = findFile(plugin, required(p, "source"));
    const target = findFile(plugin, required(p, "target"));
    const rt = findRelationType(plugin, required(p, "relation"));
    if (source.path === target.path)
      fail("Source and target are the same note.");
    const resolved = plugin.api.resolveRelation(rt);
    if (!resolved.forwardKey)
      fail(`The relation type "${resolved.forwardName}" has no frontmatter key set.`);
    const sides = await plugin.api.addRelation(source, target, rt);
    return {
      source: source.path,
      target: target.path,
      relation: resolved.forwardName,
      written: sides,
      alreadyRelated: !sides.forward && !sides.reverse
    };
  });
}

// src/views/filtered-files-widget.ts
var import_obsidian30 = require("obsidian");

// src/views/ffw-section-edit-modal.ts
var import_obsidian29 = require("obsidian");
var FfwSectionEditModal = class extends import_obsidian29.Modal {
  constructor(app, section, onSave) {
    super(app);
    this.filtersContainer = null;
    this.frontmatterKeyContainer = null;
    this.isNew = section === null;
    this.working = section ? JSON.parse(JSON.stringify(section)) : { id: ffwNewSectionId(), title: "", filters: [ffwDefaultFilter("tag")], sort: ffwDefaultSort(), collapsed: false, maxResults: 0 };
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl, titleEl } = this;
    contentEl.addClass("ffw-modal");
    titleEl.setText(this.isNew ? "Add filter section" : "Edit filter section");
    new import_obsidian29.Setting(contentEl).setName("Title").setDesc("Shown as the section header in the widget.").addText(
      (text) => text.setPlaceholder("Active projects").setValue(this.working.title).onChange((v) => {
        this.working.title = v;
      })
    );
    contentEl.createEl("h3", { text: "Filters" });
    contentEl.createEl("p", { cls: "setting-item-description", text: "All filters must match. Add as many rows as you need." });
    this.filtersContainer = contentEl.createDiv({ cls: "ffw-filter-rows" });
    this.renderFilterRows();
    const addRow = contentEl.createDiv({ cls: "ffw-add-filter-row" });
    for (const type of ["tag", "frontmatter", "path", "name"]) {
      new import_obsidian29.ButtonComponent(addRow).setButtonText(`+ ${FFW_FILTER_TYPE_LABELS[type]}`).onClick(() => {
        this.working.filters.push(ffwDefaultFilter(type));
        this.renderFilterRows();
      });
    }
    contentEl.createEl("h3", { text: "Sort" });
    new import_obsidian29.Setting(contentEl).setName("Sort by").addDropdown((dd) => {
      for (const opt of FFW_SORT_OPTIONS)
        dd.addOption(opt.value, opt.label);
      dd.setValue(this.working.sort.field).onChange((v) => {
        this.working.sort.field = v;
        this.updateFrontmatterKeyVisibility();
      });
    });
    this.frontmatterKeyContainer = contentEl.createDiv();
    new import_obsidian29.Setting(this.frontmatterKeyContainer).setName("Frontmatter sort key").setDesc("Required when sorting by a frontmatter field.").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("Due").setValue((_a = this.working.sort.frontmatterKey) != null ? _a : "").onChange((v) => {
          this.working.sort.frontmatterKey = v.trim() || void 0;
        });
      }
    );
    this.updateFrontmatterKeyVisibility();
    new import_obsidian29.Setting(contentEl).setName("Result limit").setDesc("Maximum number of files to show, or 0 for no limit.").addText(
      (text) => text.setPlaceholder("0").setValue(String(this.working.maxResults)).onChange((v) => {
        const n = parseInt(v, 10);
        this.working.maxResults = Number.isFinite(n) && n > 0 ? n : 0;
      })
    );
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    new import_obsidian29.ButtonComponent(btnRow).setButtonText("Cancel").onClick(() => this.close());
    new import_obsidian29.ButtonComponent(btnRow).setButtonText(this.isNew ? "Add section" : "Save").setCta().onClick(() => this.handleSave());
  }
  onClose() {
    this.contentEl.empty();
  }
  updateFrontmatterKeyVisibility() {
    if (!this.frontmatterKeyContainer)
      return;
    const show = this.working.sort.field === "frontmatter-asc" || this.working.sort.field === "frontmatter-desc";
    this.frontmatterKeyContainer.style.display = show ? "" : "none";
  }
  renderFilterRows() {
    if (!this.filtersContainer)
      return;
    this.filtersContainer.empty();
    if (this.working.filters.length === 0) {
      this.filtersContainer.createEl("p", { cls: "setting-item-description ffw-empty", text: "No filters yet \u2014 add one below." });
      return;
    }
    this.working.filters.forEach((filter, idx) => {
      const row = this.filtersContainer.createDiv({ cls: "ffw-filter-row" });
      const typeSelect = row.createEl("select", { cls: "dropdown ffw-type-select" });
      for (const [val, label] of Object.entries(FFW_FILTER_TYPE_LABELS)) {
        const opt = typeSelect.createEl("option", { value: val, text: label });
        if (val === filter.type)
          opt.selected = true;
      }
      typeSelect.addEventListener("change", () => {
        if (typeSelect.value !== filter.type) {
          this.working.filters[idx] = ffwDefaultFilter(typeSelect.value);
          this.renderFilterRows();
        }
      });
      const inputsEl = row.createDiv({ cls: "ffw-filter-inputs" });
      this.renderFilterInputs(inputsEl, filter, idx);
      const removeBtn = row.createEl("button", { text: "\u2715", cls: "ffw-filter-remove" });
      removeBtn.setAttribute("aria-label", "Remove filter");
      removeBtn.addEventListener("click", () => {
        this.working.filters.splice(idx, 1);
        this.renderFilterRows();
      });
    });
  }
  renderFilterInputs(el, filter, idx) {
    switch (filter.type) {
      case "tag":
        this.renderTagInputs(el, filter, idx);
        break;
      case "frontmatter":
        this.renderFrontmatterInputs(el, filter, idx);
        break;
      case "path":
        this.renderPathInputs(el, filter, idx);
        break;
      case "name":
        this.renderNameInputs(el, filter, idx);
        break;
    }
  }
  renderTagInputs(el, filter, idx) {
    const modeSelect = el.createEl("select", { cls: "dropdown" });
    const inclOpt = modeSelect.createEl("option", { value: "include", text: "Has tag" });
    const exclOpt = modeSelect.createEl("option", { value: "exclude", text: "Does not have tag" });
    (filter.include ? inclOpt : exclOpt).selected = true;
    modeSelect.addEventListener("change", () => {
      this.working.filters[idx].include = modeSelect.value === "include";
    });
    const tagInput = el.createEl("input", { type: "text", placeholder: "e.g. project", value: filter.tag, cls: "ffw-text-input" });
    tagInput.addEventListener("input", () => {
      this.working.filters[idx].tag = tagInput.value;
    });
  }
  renderFrontmatterInputs(el, filter, idx) {
    const keyInput = el.createEl("input", { type: "text", placeholder: "key", value: filter.key, cls: "ffw-text-input" });
    keyInput.addEventListener("input", () => {
      this.working.filters[idx].key = keyInput.value;
    });
    const compSelect = el.createEl("select", { cls: "dropdown" });
    for (const { v, label } of [{ v: "equals", label: "=" }, { v: "not-equals", label: "\u2260" }, { v: "contains", label: "contains" }, { v: "exists", label: "exists" }]) {
      const opt = compSelect.createEl("option", { value: v, text: label });
      if (v === filter.comparison)
        opt.selected = true;
    }
    const valInput = el.createEl("input", { type: "text", placeholder: "value", value: filter.value, cls: "ffw-text-input" });
    valInput.disabled = filter.comparison === "exists";
    valInput.addEventListener("input", () => {
      this.working.filters[idx].value = valInput.value;
    });
    compSelect.addEventListener("change", () => {
      const comp = compSelect.value;
      this.working.filters[idx].comparison = comp;
      valInput.disabled = comp === "exists";
    });
  }
  renderPathInputs(el, filter, idx) {
    const negateSelect = el.createEl("select", { cls: "dropdown" });
    negateSelect.createEl("option", { value: "is", text: "Is" }).selected = !filter.negate;
    negateSelect.createEl("option", { value: "is-not", text: "Is not" }).selected = filter.negate;
    negateSelect.addEventListener("change", () => {
      this.working.filters[idx].negate = negateSelect.value === "is-not";
    });
    const modeSelect = el.createEl("select", { cls: "dropdown" });
    for (const { v, label } of [{ v: "starts-with", label: "starts with" }, { v: "contains", label: "contains" }, { v: "equals", label: "equals" }, { v: "ends-with", label: "ends with" }]) {
      const opt = modeSelect.createEl("option", { value: v, text: label });
      if (v === filter.matchMode)
        opt.selected = true;
    }
    modeSelect.addEventListener("change", () => {
      this.working.filters[idx].matchMode = modeSelect.value;
    });
    const patInput = el.createEl("input", { type: "text", placeholder: "e.g. Work/", value: filter.pattern, cls: "ffw-text-input" });
    patInput.addEventListener("input", () => {
      this.working.filters[idx].pattern = patInput.value;
    });
  }
  renderNameInputs(el, filter, idx) {
    const negateSelect = el.createEl("select", { cls: "dropdown" });
    negateSelect.createEl("option", { value: "is", text: "Is" }).selected = !filter.negate;
    negateSelect.createEl("option", { value: "is-not", text: "Is not" }).selected = filter.negate;
    negateSelect.addEventListener("change", () => {
      this.working.filters[idx].negate = negateSelect.value === "is-not";
    });
    const modeSelect = el.createEl("select", { cls: "dropdown" });
    for (const { v, label } of [{ v: "contains", label: "contains" }, { v: "starts-with", label: "starts with" }, { v: "ends-with", label: "ends with" }, { v: "regex", label: "regex" }]) {
      const opt = modeSelect.createEl("option", { value: v, text: label });
      if (v === filter.matchMode)
        opt.selected = true;
    }
    modeSelect.addEventListener("change", () => {
      this.working.filters[idx].matchMode = modeSelect.value;
    });
    const patInput = el.createEl("input", { type: "text", placeholder: "pattern", value: filter.pattern, cls: "ffw-text-input" });
    patInput.addEventListener("input", () => {
      this.working.filters[idx].pattern = patInput.value;
    });
    const caseLbl = el.createEl("label", { cls: "ffw-checkbox" });
    const caseCheck = caseLbl.createEl("input", { type: "checkbox" });
    caseCheck.checked = filter.caseSensitive;
    caseLbl.appendChild(document.createTextNode(" case sensitive"));
    caseCheck.addEventListener("change", () => {
      this.working.filters[idx].caseSensitive = caseCheck.checked;
    });
  }
  handleSave() {
    const title = this.working.title.trim();
    if (!title) {
      new import_obsidian29.Notice("Please enter a title for the section.");
      return;
    }
    if (this.working.filters.length === 0) {
      new import_obsidian29.Notice("Add at least one filter to the section.");
      return;
    }
    if ((this.working.sort.field === "frontmatter-asc" || this.working.sort.field === "frontmatter-desc") && !this.working.sort.frontmatterKey) {
      new import_obsidian29.Notice("Please specify a frontmatter key to sort by.");
      return;
    }
    this.working.title = title;
    this.onSave(this.working);
    this.close();
  }
};

// src/views/filtered-files-widget.ts
var FilteredFilesWidgetView = class extends import_obsidian30.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.query = "";
    this.rootEl = null;
    this.sectionsEl = null;
    this.dragSourceId = null;
    this.plugin = plugin;
    this.refresh = (0, import_obsidian30.debounce)(() => this.render(), 80, true);
  }
  getViewType() {
    return FFW_VIEW_TYPE;
  }
  getDisplayText() {
    return "Filtered files";
  }
  getIcon() {
    return "file-sliders";
  }
  async onOpen() {
    this.rootEl = this.containerEl.children[1];
    this.rootEl.empty();
    this.rootEl.addClass("ffw-root");
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.refresh()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.refresh()));
    this.registerEvent(this.app.vault.on("create", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("iconic:icon-changed", () => this.refresh()));
    this.render();
  }
  async onClose() {
    this.containerEl.empty();
  }
  render() {
    if (!this.rootEl)
      return;
    this.rootEl.empty();
    this.renderHeader(this.rootEl);
    this.sectionsEl = this.rootEl.createDiv({ cls: "ffw-sections" });
    this.renderSections();
  }
  renderHeader(el) {
    const row = el.createDiv({ cls: "ffw-header" }).createDiv({ cls: "ffw-search-row" });
    const search = new import_obsidian30.SearchComponent(row);
    search.setPlaceholder("Filter...");
    search.setValue(this.query);
    search.onChange((v) => {
      this.query = v;
      this.renderSections();
    });
    const addBtn = row.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Add filter section" } });
    (0, import_obsidian30.setIcon)(addBtn, "plus");
    addBtn.addEventListener("click", () => this.openAddModal());
  }
  renderSections() {
    if (!this.sectionsEl)
      return;
    this.sectionsEl.empty();
    const sections = this.plugin.settings.ffwSections;
    if (sections.length === 0) {
      const empty = this.sectionsEl.createDiv({ cls: "ffw-empty-state" });
      empty.createEl("p", { text: "No filter sections yet." });
      empty.createEl("p", { cls: "setting-item-description", text: "Use the + button above to create your first filter section." });
      return;
    }
    sections.forEach((section) => this.renderSection(section));
  }
  renderSection(section) {
    if (!this.sectionsEl)
      return;
    const sectionEl = this.sectionsEl.createDiv({ cls: "ffw-section" });
    sectionEl.dataset["sectionId"] = section.id;
    if (section.collapsed)
      sectionEl.addClass("is-collapsed");
    sectionEl.setAttr("draggable", "true");
    sectionEl.addEventListener("dragstart", (e) => this.handleDragStart(e, section.id));
    sectionEl.addEventListener("dragover", (e) => this.handleDragOver(e, sectionEl));
    sectionEl.addEventListener("dragleave", () => sectionEl.removeClass("is-drag-over"));
    sectionEl.addEventListener("drop", (e) => void this.handleDrop(e, section.id, sectionEl));
    sectionEl.addEventListener("dragend", () => this.clearDragState());
    const header = sectionEl.createDiv({ cls: "ffw-section-header" });
    const dragHandle = header.createSpan({ cls: "ffw-drag-handle" });
    (0, import_obsidian30.setIcon)(dragHandle, "grip-vertical");
    dragHandle.setAttr("aria-label", "Drag to reorder");
    const collapseToggle = header.createSpan({ cls: "ffw-collapse-toggle" });
    (0, import_obsidian30.setIcon)(collapseToggle, section.collapsed ? "chevron-right" : "chevron-down");
    collapseToggle.setAttr("aria-label", section.collapsed ? "Expand section" : "Collapse section");
    collapseToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.toggleCollapse(section);
    });
    const titleWrap = header.createDiv({ cls: "ffw-section-title-wrap" });
    titleWrap.createDiv({ cls: "ffw-section-title", text: section.title });
    titleWrap.createDiv({
      cls: "ffw-section-meta",
      text: `${section.filters.length} filter${section.filters.length === 1 ? "" : "s"} \xB7 ${ffwSortLabel(section.sort)}`
    });
    titleWrap.addEventListener("click", () => void this.toggleCollapse(section));
    const controls = header.createDiv({ cls: "ffw-section-controls" });
    this.addIconButton(controls, "more-vertical", "More actions", (e) => this.openSectionMenu(section, e));
    const body = sectionEl.createDiv({ cls: "ffw-section-body" });
    if (!section.collapsed) {
      try {
        const files = ffwGetSectionFiles(this.app, section);
        const filtered = this.query ? files.filter((f) => ffwFuzzyMatch(this.query, f.basename) || ffwFuzzyMatch(this.query, f.path)) : files;
        if (filtered.length === 0) {
          body.createDiv({ cls: "ffw-no-results", text: this.query ? "No files match the search." : "No files match the filters." });
          return;
        }
        const list = body.createDiv({ cls: "ffw-file-list" });
        filtered.forEach((f) => this.renderFileRow(list, f));
        if (files.length > filtered.length) {
          body.createDiv({ cls: "ffw-truncated", text: `${files.length - filtered.length} hidden by search` });
        }
      } catch (err) {
        body.createDiv({ cls: "ffw-error", text: `Error rendering section: ${err.message}` });
      }
    }
  }
  renderFileRow(el, file) {
    var _a, _b;
    const row = el.createDiv({ cls: "ffw-file-row" });
    const iconEl = row.createSpan({ cls: "ffw-file-icon" });
    const iconicIcon = ffwGetIconicIcon(this.app, file);
    if (iconicIcon == null ? void 0 : iconicIcon.icon) {
      ffwSetIconEl(iconEl, iconicIcon.icon, iconicIcon.color);
    } else {
      (0, import_obsidian30.setIcon)(iconEl, "file-text");
    }
    const labelEl = row.createDiv({ cls: "ffw-file-label" });
    const key = this.plugin.settings.ffwDisplayNameKey;
    const fmCache = key ? (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter : null;
    const displayName = key && (fmCache == null ? void 0 : fmCache[key]) != null ? String(fmCache[key]) : file.basename;
    labelEl.createDiv({ cls: "ffw-file-name", text: displayName });
    const folder = ((_b = file.parent) == null ? void 0 : _b.path) && file.parent.path !== "/" ? file.parent.path : "";
    if (folder)
      labelEl.createDiv({ cls: "ffw-file-path", text: folder });
    row.addEventListener("click", (e) => {
      void this.app.workspace.openLinkText(file.path, "", e.ctrlKey || e.metaKey);
    });
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new import_obsidian30.Menu();
      menu.addItem((item) => item.setTitle("Open").setIcon("file-text").onClick(() => this.app.workspace.openLinkText(file.path, "", false)));
      menu.addItem((item) => item.setTitle("Open in new tab").setIcon("file-plus").onClick(() => this.app.workspace.openLinkText(file.path, "", true)));
      menu.addItem((item) => item.setTitle("Reveal in file explorer").setIcon("folder").onClick(() => {
        var _a2, _b2, _c;
        const inst = (_c = (_b2 = (_a2 = corePlugins(this.app)) == null ? void 0 : _a2.getPluginById) == null ? void 0 : _b2.call(_a2, "file-explorer")) == null ? void 0 : _c.instance;
        if (inst == null ? void 0 : inst.revealInFolder) {
          try {
            inst.revealInFolder(file);
            return;
          } catch (e2) {
          }
        }
        new import_obsidian30.Notice("Could not reveal file in the file explorer.");
      }));
      menu.showAtMouseEvent(e);
    });
  }
  addIconButton(el, icon, label, onClick) {
    const btn = el.createEl("button", { cls: "clickable-icon" });
    (0, import_obsidian30.setIcon)(btn, icon);
    btn.setAttr("aria-label", label);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(e);
    });
  }
  openSectionMenu(section, e) {
    const menu = new import_obsidian30.Menu();
    menu.addItem((item) => item.setTitle("Edit").setIcon("pencil").onClick(() => this.openEditModal(section)));
    menu.addItem((item) => item.setTitle("Duplicate").setIcon("copy").onClick(() => this.duplicateSection(section)));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Delete section").setIcon("trash").onClick(() => this.deleteSection(section.id)));
    menu.showAtMouseEvent(e);
  }
  openAddModal() {
    new FfwSectionEditModal(this.app, null, (section) => {
      this.plugin.settings.ffwSections.push(section);
      void this.persistAndRender();
    }).open();
  }
  openEditModal(section) {
    new FfwSectionEditModal(this.app, section, (updated) => {
      const idx = this.plugin.settings.ffwSections.findIndex((s) => s.id === section.id);
      if (idx >= 0) {
        this.plugin.settings.ffwSections[idx] = updated;
        void this.persistAndRender();
      }
    }).open();
  }
  async persistAndRender() {
    await this.plugin.saveSettings();
    this.renderSections();
  }
  async toggleCollapse(section) {
    section.collapsed = !section.collapsed;
    await this.plugin.saveSettings();
    this.renderSections();
  }
  async duplicateSection(section) {
    const copy = JSON.parse(JSON.stringify(section));
    copy.id = ffwNewSectionId();
    copy.title = `${section.title} (copy)`;
    const idx = this.plugin.settings.ffwSections.findIndex((s) => s.id === section.id);
    this.plugin.settings.ffwSections.splice(idx + 1, 0, copy);
    await this.plugin.saveSettings();
    this.renderSections();
  }
  async deleteSection(id) {
    const sections = this.plugin.settings.ffwSections;
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0)
      return;
    const [removed] = sections.splice(idx, 1);
    await this.plugin.saveSettings();
    this.renderSections();
    if (removed)
      new import_obsidian30.Notice(`Removed "${removed.title}"`);
  }
  // ── Drag-and-drop reorder ─────────────────────────────────────────────────────
  handleDragStart(e, id) {
    this.dragSourceId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    }
  }
  handleDragOver(e, el) {
    if (!this.dragSourceId)
      return;
    e.preventDefault();
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = "move";
    el.addClass("is-drag-over");
  }
  async handleDrop(e, targetId, el) {
    e.preventDefault();
    el.removeClass("is-drag-over");
    const sourceId = this.dragSourceId;
    this.dragSourceId = null;
    if (!sourceId || sourceId === targetId)
      return;
    const sections = this.plugin.settings.ffwSections;
    const fromIdx = sections.findIndex((s) => s.id === sourceId);
    const toIdx = sections.findIndex((s) => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0)
      return;
    const [moved] = sections.splice(fromIdx, 1);
    if (!moved)
      return;
    const newIdx = sections.findIndex((s) => s.id === targetId);
    sections.splice(newIdx < 0 ? sections.length : newIdx, 0, moved);
    await this.plugin.saveSettings();
    this.renderSections();
  }
  clearDragState() {
    this.dragSourceId = null;
    this.containerEl.querySelectorAll(".ffw-section.is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
  }
};

// src/views/inline-typed-note.ts
var import_view3 = require("@codemirror/view");
var import_state3 = require("@codemirror/state");
var import_obsidian31 = require("obsidian");

// src/views/inline-note-state.ts
var import_state2 = require("@codemirror/state");
var startInlineNote = import_state2.StateEffect.define();
var pickInlineType = import_state2.StateEffect.define();
var moveInlineIndex = import_state2.StateEffect.define();
var cancelInlineNote = import_state2.StateEffect.define();
var inlineNoteField = import_state2.StateField.define({
  create: () => null,
  update(value, tr) {
    let next = value;
    if (next && tr.docChanged) {
      next = {
        ...next,
        anchor: tr.changes.mapPos(next.anchor, -1),
        end: tr.changes.mapPos(next.end, 1),
        index: next.typeId ? next.index : 0
      };
    }
    for (const e of tr.effects) {
      if (e.is(startInlineNote))
        next = { anchor: e.value, end: e.value, typeId: null, index: 0 };
      else if (!next)
        continue;
      else if (e.is(cancelInlineNote))
        return null;
      else if (e.is(pickInlineType))
        next = { ...next, typeId: e.value, index: 0 };
      else if (e.is(moveInlineIndex))
        next = { ...next, index: next.index + e.value };
      else if (e.is(refreshNoteLinkStylesEffect))
        next = { ...next };
    }
    if (!next)
      return null;
    const head = tr.state.selection.main.head;
    if (head < next.anchor || head > next.end)
      return null;
    return next;
  }
});
function inlineQuery(state, s) {
  return state.doc.sliceString(s.anchor, state.selection.main.head);
}
function matchingNoteTypes(types, query) {
  const q = query.trim().toLowerCase();
  return q ? types.filter((t) => t.name.toLowerCase().includes(q)) : types;
}
function wrapIndex(index, length) {
  return length === 0 ? 0 : (index % length + length) % length;
}

// src/views/inline-typed-note.ts
function iconOf(noteType) {
  var _a, _b;
  return (_b = (_a = noteType.linkIcon) == null ? void 0 : _a.trim()) != null ? _b : "";
}
function pillStyle(noteType) {
  return noteLinkStyleParts(noteType.linkColor, iconOf(noteType)).join("; ");
}
var TypePillWidget = class extends import_view3.WidgetType {
  constructor(name, style) {
    super();
    this.name = name;
    this.style = style;
  }
  eq(other) {
    return other.name === this.name && other.style === this.style;
  }
  toDOM() {
    const el = createSpan({ cls: "ffc-note-link ffc-inline-pill", attr: { "aria-label": this.name } });
    if (this.style)
      el.setAttribute("style", this.style);
    if (!this.style.includes("--ffc-note-link-icon"))
      el.setText(this.name);
    return el;
  }
  ignoreEvent() {
    return true;
  }
};
function startInlineTypedNote(plugin, editor) {
  const view = editor.cm;
  if (!view) {
    new import_obsidian31.Notice("Create typed note inline needs an editor to be open.");
    return;
  }
  if (plugin.settings.noteTypes.length === 0) {
    new import_obsidian31.Notice("Create a note type first.");
    return;
  }
  view.dispatch({ effects: startInlineNote.of(view.state.selection.main.head) });
  view.focus();
}
function buildInlineTypedNote(plugin) {
  const noteTypeFor = (id) => id ? plugin.settings.noteTypes.find((t) => t.id === id) : void 0;
  const filtered = (view, s) => matchingNoteTypes(plugin.settings.noteTypes, inlineQuery(view.state, s));
  const commitPick = (view, s, typeId) => {
    view.dispatch({
      changes: { from: s.anchor, to: view.state.selection.main.head },
      selection: { anchor: s.anchor },
      effects: pickInlineType.of(typeId)
    });
  };
  const linkFor = (view, file) => {
    var _a, _b, _c;
    return plugin.app.fileManager.generateMarkdownLink(file, (_c = (_b = (_a = view.state.field(import_obsidian31.editorInfoField, false)) == null ? void 0 : _a.file) == null ? void 0 : _b.path) != null ? _c : "");
  };
  const replaceIfUnchanged = (view, from, to, original, insert) => {
    const doc = view.state.doc;
    if (to > doc.length || doc.sliceString(from, to) !== original)
      return;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      effects: cancelInlineNote.of(null)
    });
  };
  const hasFields = (noteType) => {
    var _a;
    return ((_a = noteType.fields) != null ? _a : []).some((f) => {
      var _a2;
      return (_a2 = f.key) == null ? void 0 : _a2.trim();
    });
  };
  const creating = /* @__PURE__ */ new WeakSet();
  const finish = async (view, s, noteType) => {
    const original = view.state.doc.sliceString(s.anchor, s.end);
    const title = sanitizeNoteTitle(original);
    if (!title) {
      new import_obsidian31.Notice("Please enter a title.");
      return;
    }
    if (hasFields(noteType)) {
      const { anchor: from, end: to } = s;
      view.dispatch({ effects: cancelInlineNote.of(null) });
      new NewNoteModal(plugin.app, noteType, async (finalTitle, fieldValues, description) => {
        const file = await plugin.createNote(noteType, finalTitle, fieldValues, description);
        if (file)
          replaceIfUnchanged(view, from, to, original, linkFor(view, file));
      }, title).open();
      return;
    }
    if (creating.has(view))
      return;
    creating.add(view);
    try {
      const file = await plugin.createNote(noteType, title);
      if (!file)
        return;
      const current = view.state.field(inlineNoteField, false);
      if (current && current.typeId === s.typeId) {
        const link = linkFor(view, file);
        view.dispatch({
          changes: { from: current.anchor, to: current.end, insert: link },
          selection: { anchor: current.anchor + link.length },
          effects: cancelInlineNote.of(null)
        });
      }
    } finally {
      creating.delete(view);
    }
  };
  const move = (delta) => (view) => {
    const s = view.state.field(inlineNoteField);
    if (!s || s.typeId)
      return false;
    view.dispatch({ effects: moveInlineIndex.of(delta) });
    return true;
  };
  const keys = import_state3.Prec.highest(import_view3.keymap.of([
    { key: "ArrowDown", run: move(1) },
    { key: "ArrowUp", run: move(-1) },
    {
      key: "Enter",
      run: (view) => {
        const s = view.state.field(inlineNoteField);
        if (!s || view.composing)
          return false;
        if (!s.typeId) {
          const items = filtered(view, s);
          const picked = items[wrapIndex(s.index, items.length)];
          if (picked)
            commitPick(view, s, picked.id);
          return true;
        }
        const noteType = noteTypeFor(s.typeId);
        if (!noteType) {
          view.dispatch({ effects: cancelInlineNote.of(null) });
          return false;
        }
        void finish(view, s, noteType);
        return true;
      }
    },
    {
      key: "Escape",
      run: (view) => {
        if (!view.state.field(inlineNoteField))
          return false;
        view.dispatch({ effects: cancelInlineNote.of(null) });
        return true;
      }
    },
    {
      // Backspace with nothing left to delete removes the pill (or closes the picker).
      key: "Backspace",
      run: (view) => {
        const s = view.state.field(inlineNoteField);
        const sel = view.state.selection.main;
        if (!s || !sel.empty || sel.head !== s.anchor)
          return false;
        view.dispatch({ effects: cancelInlineNote.of(null) });
        return true;
      }
    }
  ]));
  const blur = import_view3.EditorView.domEventHandlers({
    blur: (_e, view) => {
      if (view.state.field(inlineNoteField, false))
        view.dispatch({ effects: cancelInlineNote.of(null) });
      return false;
    }
  });
  const decorations = import_view3.EditorView.decorations.compute([inlineNoteField], (state) => {
    const s = state.field(inlineNoteField);
    if (!s)
      return import_view3.Decoration.none;
    if (!s.typeId) {
      const head = state.selection.main.head;
      return head > s.anchor ? import_view3.Decoration.set([import_view3.Decoration.mark({ class: "ffc-inline-query" }).range(s.anchor, head)]) : import_view3.Decoration.none;
    }
    const noteType = noteTypeFor(s.typeId);
    if (!noteType)
      return import_view3.Decoration.none;
    const style = pillStyle(noteType);
    if (s.end === s.anchor) {
      const pill = new TypePillWidget(noteType.name, style);
      return import_view3.Decoration.set([import_view3.Decoration.widget({ widget: pill, side: -1 }).range(s.anchor)]);
    }
    const attributes = { "data-ffc-type-name": noteType.name };
    if (style)
      attributes.style = style;
    const mark = import_view3.Decoration.mark({ class: "ffc-note-link ffc-inline-pill", attributes });
    return import_view3.Decoration.set([mark.range(s.anchor, s.end)]);
  });
  const popup = import_view3.ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.el = null;
      this.list = null;
      this.contentKey = "";
    }
    update(update) {
      const s = update.state.field(inlineNoteField);
      if (!s) {
        this.close();
        return;
      }
      if (s.typeId) {
        this.close();
        if (!noteTypeFor(s.typeId)) {
          queueMicrotask(() => {
            if (this.view.state.field(inlineNoteField, false))
              this.view.dispatch({ effects: cancelInlineNote.of(null) });
          });
        }
        return;
      }
      const items = filtered(update.view, s);
      const selected = wrapIndex(s.index, items.length);
      const key = `${selected}|${items.map((t) => `${t.id}:${t.name}:${iconOf(t)}`).join(",")}`;
      let moved = false;
      if (!this.el) {
        this.el = update.view.dom.ownerDocument.body.createDiv({
          cls: "suggestion-container ffc-inline-popup ffc-inline-popup-hidden"
        });
        this.list = this.el.createDiv({ cls: "suggestion" });
        moved = true;
      }
      if (key !== this.contentKey) {
        this.contentKey = key;
        this.fill(items, selected);
        moved = true;
      }
      if (moved || update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged) {
        this.position();
      }
    }
    fill(items, selected) {
      var _a;
      const list = this.list;
      if (!list)
        return;
      list.empty();
      if (items.length === 0) {
        list.createDiv({ cls: "suggestion-item ffc-inline-popup-empty", text: "No note types found" });
      }
      items.forEach((noteType, i) => {
        const row = list.createDiv({ cls: "suggestion-item ffc-inline-popup-item" });
        if (i === selected)
          row.addClass("is-selected");
        const svg = iconOf(noteType) ? (0, import_obsidian31.getIcon)(iconOf(noteType)) : null;
        if (svg)
          row.createSpan({ cls: "ffc-inline-popup-icon" }).appendChild(svg);
        row.createSpan({ text: noteType.name });
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const current = this.view.state.field(inlineNoteField);
          if (current && !current.typeId)
            commitPick(this.view, current, noteType.id);
        });
      });
      (_a = list.querySelector(".is-selected")) == null ? void 0 : _a.scrollIntoView({ block: "nearest" });
    }
    /** Below the caret, flipped above it near the window's bottom, kept inside the window. */
    position() {
      const el = this.el;
      if (!el)
        return;
      this.view.requestMeasure({
        key: this,
        read: (v) => {
          var _a, _b;
          const win = v.dom.ownerDocument.defaultView;
          return {
            coords: v.coordsAtPos(v.state.selection.main.head),
            size: el.getBoundingClientRect(),
            winW: (_a = win == null ? void 0 : win.innerWidth) != null ? _a : 0,
            winH: (_b = win == null ? void 0 : win.innerHeight) != null ? _b : 0
          };
        },
        write: ({ coords, size, winW, winH }) => {
          if (this.el !== el)
            return;
          if (coords) {
            const gap = 4;
            const below = coords.bottom + gap;
            const top = below + size.height > winH && coords.top - gap - size.height >= 0 ? coords.top - gap - size.height : below;
            const left = Math.max(8, Math.min(coords.left, winW - size.width - 8));
            el.setCssProps({ left: `${left}px`, top: `${top}px` });
          }
          el.removeClass("ffc-inline-popup-hidden");
        }
      });
    }
    close() {
      var _a;
      (_a = this.el) == null ? void 0 : _a.remove();
      this.el = null;
      this.list = null;
      this.contentKey = "";
    }
    destroy() {
      this.close();
    }
  });
  return [inlineNoteField, keys, blur, decorations, popup];
}

// src/main.ts
var FilteredFileCommandsPlugin = class extends import_obsidian32.Plugin {
  constructor() {
    super(...arguments);
    this.commandRefs = {};
    this.registeredCommandIds = /* @__PURE__ */ new Set();
    this.styledNoteBasenames = /* @__PURE__ */ new Set();
    this.styledNotePaths = /* @__PURE__ */ new Set();
    /** file path → link colour, for styled types that set `linkColor`. */
    this.styledNoteColors = /* @__PURE__ */ new Map();
    /** file path → link icon id, for styled types with `showLinkIcon` on. */
    this.styledNoteIcons = /* @__PURE__ */ new Map();
    this.previewNoteBasenames = /* @__PURE__ */ new Set();
    this.previewNotePaths = /* @__PURE__ */ new Set();
    this.statusNoteMap = /* @__PURE__ */ new Map();
    /** Read by other plugins (such as Canvas Plus); see api.ts. */
    this.api = createApi(this);
    // ── Trigger provider registry ─────────────────────────────────────────────────
    /**
     * External plugins can contribute items to the @ trigger menu by calling
     * registerTriggerProvider(). They should call unregisterTriggerProvider()
     * in their own onunload() to avoid holding a dead reference.
     */
    this.triggerProviders = /* @__PURE__ */ new Map();
    // ── Filtered Files Widget helpers ─────────────────────────────────────────────
    this.widgetRibbonEl = null;
  }
  registerTriggerProvider(provider) {
    this.triggerProviders.set(provider.id, provider);
  }
  unregisterTriggerProvider(id) {
    this.triggerProviders.delete(id);
  }
  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MyPluginSettingTab(this.app, this));
    this.registerView(FFW_VIEW_TYPE, (leaf) => new FilteredFilesWidgetView(leaf, this));
    if (this.settings.filteredWidgetEnabled) {
      this.refreshWidgetRibbonIcon();
      this.addCommand({
        id: "ffc-open-filtered-files-widget",
        name: "Open filtered files widget",
        callback: () => this.activateWidgetView()
      });
    }
    if (this.settings.filteredCommandsEnabled) {
      for (const cmd of this.settings.commands)
        this.registerFilterCommand(cmd);
    }
    for (const noteType of this.settings.noteTypes) {
      this.registerNoteTypeCommand(noteType);
      if (noteType.enableFindCommand)
        this.registerFindCommand(noteType);
    }
    this.registerNewNoteCommand();
    registerCliHandlers(this);
    this.registerEditorSuggest(new NoteTypeSuggest(this.app, this));
    this.buildStyledNoteSet();
    this.previewPopup = new NotePreviewPopup(this);
    this.register(() => this.previewPopup.destroy());
    this.registerMarkdownPostProcessor((el, ctx) => {
      el.querySelectorAll("a.internal-link[data-href]").forEach((link) => {
        var _a, _b, _c;
        const href = ((_a = link.getAttribute("data-href")) != null ? _a : "").split("#")[0].trim();
        const basename = href.includes("/") ? (_b = href.split("/").pop()) != null ? _b : href : href;
        const isStyled = this.styledNoteBasenames.has(href) || this.styledNoteBasenames.has(basename);
        if (isStyled)
          link.classList.add("ffc-note-link");
        if (this.previewNoteBasenames.has(href) || this.previewNoteBasenames.has(basename)) {
          link.classList.add("ffc-note-preview-link");
        }
        const { color, icon } = isStyled ? this.noteLinkStyle(href, ctx.sourcePath) : {};
        if (color)
          link.style.setProperty("--ffc-note-link-color", color);
        else
          link.style.removeProperty("--ffc-note-link-color");
        if (icon) {
          const svg = (0, import_obsidian32.getIcon)(icon);
          if (svg)
            prependIconSpan(link, svg, "ffc-link-icon");
        }
        const status = (_c = this.statusNoteMap.get(basename)) != null ? _c : this.statusNoteMap.get(href);
        if (status) {
          const svg = statusSvg(status);
          if (svg)
            prependIconSpan(link, svg);
        }
      });
    });
    this.registerEditorExtension(buildNoteLinkViewPlugin(this));
    this.registerEditorExtension(buildInlineTypedNote(this));
    this.registerEditorExtension(buildNoteTagViewPlugin(this));
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.buildStyledNoteSet();
        this.refreshNoteLinkStyles();
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        var _a;
        const selection = (_a = editor.getSelection()) == null ? void 0 : _a.trim();
        if (!selection)
          return;
        const types = this.settings.noteTypes;
        if (types.length === 0)
          return;
        const from = editor.getCursor("from");
        const to = editor.getCursor("to");
        menu.addItem((item) => {
          item.setTitle("Note from selection").setIcon("box-select");
          const submenu = submenuOf(item);
          for (const noteType of types) {
            submenu.addItem((subItem) => {
              subItem.setTitle(noteType.name).onClick(() => {
                const current = this.settings.noteTypes.find((o) => o.id === noteType.id);
                if (!current) {
                  new import_obsidian32.Notice("Note type not found. Try reloading.");
                  return;
                }
                const selIsUrl = isUrl(selection);
                const routeToField = selIsUrl && !!current.urlFieldKey;
                const titlePromise = selIsUrl && this.settings.fetchUrlTitles ? fetchPageTitle(selection) : null;
                new NewNoteModal(
                  this.app,
                  current,
                  async (title, fv, desc) => {
                    editor.replaceRange(`[[${title}]]`, from, to);
                    await this.createNote(current, title, fv, desc);
                  },
                  routeToField ? "" : selection,
                  routeToField ? selection : "",
                  titlePromise
                ).open();
              });
            });
          }
        });
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        var _a;
        if (!(file instanceof import_obsidian32.TFile) || file.extension !== "md")
          return;
        if (!this.getNoteTypeForFile(file))
          return;
        const relTypes = (_a = this.settings.relationTypes) != null ? _a : [];
        if (relTypes.length === 0)
          return;
        const noteTypes = this.settings.noteTypes;
        const existing = this.listRelationsForFile(file);
        menu.addItem((item) => {
          item.setTitle("Mark as\u2026").setIcon("link");
          const relMenu = submenuOf(item);
          for (const rt of relTypes) {
            relMenu.addItem((relItem) => {
              relItem.setTitle(rt.name || "Untitled relation");
              const typeMenu = submenuOf(relItem);
              typeMenu.addItem((i) => {
                i.setTitle("Any note\u2026").onClick(() => this.pickRelationTarget(file, rt, this.app.vault.getMarkdownFiles()));
              });
              if (noteTypes.length > 0)
                typeMenu.addSeparator();
              for (const nt of noteTypes) {
                typeMenu.addItem((i) => {
                  i.setTitle(nt.name || "Untitled note type").onClick(() => this.pickRelationTarget(file, rt, this.getNoteTypeFiles(nt)));
                });
              }
            });
          }
        });
        if (existing.length > 0) {
          menu.addItem((item) => {
            item.setTitle("Unmark\u2026").setIcon("unlink");
            const unmarkMenu = submenuOf(item);
            for (const rel of existing) {
              unmarkMenu.addItem((i) => {
                i.setTitle(`${rel.label}: ${rel.targetFile ? rel.targetFile.basename : rel.linktext}`).onClick(() => {
                  void this.removeRelation(file, rel);
                });
              });
            }
          });
        }
      })
    );
  }
  /** Add or remove the widget ribbon icon to match the current settings. */
  refreshWidgetRibbonIcon() {
    const shouldShow = this.settings.filteredWidgetEnabled && this.settings.filteredWidgetRibbon;
    if (shouldShow && !this.widgetRibbonEl) {
      this.widgetRibbonEl = this.addRibbonIcon(
        "file-sliders",
        "Open filtered files widget",
        () => this.activateWidgetView()
      );
    } else if (!shouldShow && this.widgetRibbonEl) {
      this.widgetRibbonEl.remove();
      this.widgetRibbonEl = null;
    }
  }
  async activateWidgetView() {
    var _a;
    const { workspace } = this.app;
    let leaf = (_a = workspace.getLeavesOfType(FFW_VIEW_TYPE)[0]) != null ? _a : null;
    if (!leaf) {
      const newLeaf = workspace.getLeftLeaf(false);
      if (newLeaf) {
        await newLeaf.setViewState({ type: FFW_VIEW_TYPE, active: true });
        leaf = newLeaf;
      }
    }
    if (leaf)
      await workspace.revealLeaf(leaf);
  }
  refreshWidgetViews() {
    this.app.workspace.getLeavesOfType(FFW_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof FilteredFilesWidgetView)
        leaf.view.render();
    });
  }
  // ── Filtered file commands ────────────────────────────────────────────────────
  registerFilterCommand(cmd) {
    if (this.registeredCommandIds.has(cmd.id))
      return;
    const registered = this.addCommand({
      id: cmd.id,
      name: cmd.name,
      callback: () => {
        const current = this.settings.commands.find((c) => c.id === cmd.id);
        if (!current) {
          new import_obsidian32.Notice("Note types: command not found. Try reloading.");
          return;
        }
        const files = this.getFilteredFiles(current);
        if (files.length === 0) {
          new import_obsidian32.Notice("Note types: no files match the current filters.");
          return;
        }
        new FilteredFileModal(this.app, files).open();
      }
    });
    this.commandRefs[cmd.id] = registered;
    this.registeredCommandIds.add(cmd.id);
  }
  getFilteredFiles(cmd) {
    const fileTypes = (cmd.fileTypes || "").split(",").map((e) => e.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
    const allFiles = fileTypes.length > 0 ? this.app.vault.getFiles().filter((f) => fileTypes.includes(f.extension.toLowerCase())) : this.app.vault.getMarkdownFiles();
    if (!cmd.filters || cmd.filters.length === 0)
      return allFiles;
    return allFiles.filter((file) => {
      var _a, _b;
      const fm = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) != null ? _b : {};
      const results = cmd.filters.map((f) => this.evaluateFilter(fm, f, file));
      return cmd.matchMode === "all" ? results.every(Boolean) : results.some(Boolean);
    });
  }
  /** True when `file` is an instance of `noteType` (detection filters, else save folder). */
  fileMatchesNoteType(file, noteType) {
    var _a, _b, _c, _d, _e;
    const filters = (_a = noteType.matchFilters) != null ? _a : [];
    const matchMode = (_b = noteType.matchMode) != null ? _b : "all";
    if (filters.length > 0) {
      const fm = (_d = (_c = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _c.frontmatter) != null ? _d : {};
      const results = filters.map((f) => this.evaluateFilter(fm, f, file));
      return matchMode === "all" ? results.every(Boolean) : results.some(Boolean);
    }
    if (((_e = noteType.saveFolder) == null ? void 0 : _e.trim()) && effectiveSaveLocation(noteType) === "folder") {
      const prefix = noteType.saveFolder.trim().replace(/\/$/, "") + "/";
      return file.path.startsWith(prefix);
    }
    return false;
  }
  getNoteTypeFiles(noteType) {
    return this.app.vault.getMarkdownFiles().filter((file) => this.fileMatchesNoteType(file, noteType));
  }
  /** The first note type whose detection rules match `file`, or undefined. */
  getNoteTypeForFile(file) {
    return this.settings.noteTypes.find((nt) => this.fileMatchesNoteType(file, nt));
  }
  evaluateFilter(fm, filter, file) {
    const { key, operator, value } = filter;
    if (operator === "in_folder" || operator === "not_in_folder") {
      if (!file)
        return true;
      const folder = value.trim().replace(/\/$/, "");
      const inFolder = file.path.startsWith(folder + "/") || file.path === folder;
      return operator === "in_folder" ? inFolder : !inFolder;
    }
    if (!(key == null ? void 0 : key.trim()))
      return true;
    const raw = fm[key];
    switch (operator) {
      case "exists":
        return raw !== void 0 && raw !== null && raw !== "";
      case "equals":
        return Array.isArray(raw) ? raw.map(stringifyFrontmatterValue2).includes(value) : stringifyFrontmatterValue2(raw) === value;
      case "not_equals":
        return Array.isArray(raw) ? !raw.map(stringifyFrontmatterValue2).includes(value) : stringifyFrontmatterValue2(raw) !== value;
      case "contains":
        return Array.isArray(raw) ? raw.some((v) => stringifyFrontmatterValue2(v).toLowerCase().includes(value.toLowerCase())) : stringifyFrontmatterValue2(raw).toLowerCase().includes(value.toLowerCase());
      default:
        return true;
    }
  }
  // ── Relations ─────────────────────────────────────────────────────────────────
  /** Open the note picker for a relation, then write the relation on both notes. */
  pickRelationTarget(source, rt, candidates) {
    const files = candidates.filter((f) => f.path !== source.path);
    if (files.length === 0) {
      new import_obsidian32.Notice("No notes available to relate to.");
      return;
    }
    const { forwardName } = resolvedRelation(rt);
    new RelationTargetModal(this.app, files, forwardName, (target) => {
      void this.addRelation(source, target, rt);
    }).open();
  }
  /** Add a link to `target` under `key` in `file`'s frontmatter. Returns true if written. */
  async writeRelationLink(file, key, target) {
    let added = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const entries = toEntryArray(fm[key]);
      if (entries.some((e) => linkResolvesTo(this.app, e, file.path, target)))
        return;
      entries.push(relationLinkText(this.app, target, file.path));
      fm[key] = collapseEntries(entries);
      added = true;
    });
    return added;
  }
  /** Write the relation on both notes. Reports which sides it actually wrote, so a caller can undo exactly that. */
  async addRelation(source, target, rt) {
    const { forwardKey, reverseKey } = resolvedRelation(rt);
    if (!forwardKey) {
      new import_obsidian32.Notice("This relation type has no frontmatter key set.");
      return { forward: false, reverse: false };
    }
    const forward = await this.writeRelationLink(source, forwardKey, target);
    const reverse = await this.writeRelationLink(target, reverseKey, source);
    new import_obsidian32.Notice(
      forward || reverse ? `Related: ${source.basename} \u2192 ${target.basename}` : "Already related."
    );
    return { forward, reverse };
  }
  /** Remove `target` from `key` in `file`'s frontmatter. Returns true if a link was removed. */
  async removeRelationLink(file, key, target) {
    let removed = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (!(key in fm))
        return;
      const entries = toEntryArray(fm[key]);
      const kept = entries.filter((e) => !linkResolvesTo(this.app, e, file.path, target));
      if (kept.length === entries.length)
        return;
      removed = true;
      const collapsed = collapseEntries(kept);
      if (collapsed === void 0)
        delete fm[key];
      else
        fm[key] = collapsed;
    });
    return removed;
  }
  /** Whether `file`'s frontmatter holds a link to `target` under `key`. */
  hasRelationLink(file, key, target) {
    var _a;
    const fm = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    return toEntryArray(fm == null ? void 0 : fm[key]).some((e) => linkResolvesTo(this.app, e, file.path, target));
  }
  /** Write just the given sides of a relation (used to redo, or to undo a removal). */
  async writeRelationSides(source, target, rt, sides) {
    const { forwardKey, reverseKey } = resolvedRelation(rt);
    if (sides.forward)
      await this.writeRelationLink(source, forwardKey, target);
    if (sides.reverse)
      await this.writeRelationLink(target, reverseKey, source);
  }
  /** Remove just the given sides of a relation, leaving any other link between the notes alone. */
  async removeRelationSides(source, target, rt, sides) {
    const { forwardKey, reverseKey } = resolvedRelation(rt);
    if (sides.forward)
      await this.removeRelationLink(source, forwardKey, target);
    if (sides.reverse)
      await this.removeRelationLink(target, reverseKey, source);
  }
  /** Every relation entry in `file`'s frontmatter, across all relation types. */
  listRelationsForFile(file) {
    var _a, _b;
    const fm = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    if (!fm)
      return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const scan = (ownKey, otherKey, label, direction) => {
      if (!ownKey)
        return;
      for (const raw of toEntryArray(fm[ownKey])) {
        const linktext = stripLinktext(raw);
        if (!linktext)
          continue;
        const targetFile = resolveLinktext(this.app, raw, file.path);
        const dedupe = `${ownKey}::${targetFile ? targetFile.path : linktext.toLowerCase()}`;
        if (seen.has(dedupe))
          continue;
        seen.add(dedupe);
        out.push({ ownKey, otherKey, label, direction, linktext, targetFile });
      }
    };
    for (const rt of (_b = this.settings.relationTypes) != null ? _b : []) {
      const { forwardKey, reverseKey, forwardName, reverseName, symmetric } = resolvedRelation(rt);
      scan(forwardKey, reverseKey, forwardName, "forward");
      if (!symmetric)
        scan(reverseKey, forwardKey, reverseName, "reverse");
    }
    return out;
  }
  async removeRelation(file, rel) {
    const removeFrom = async (f, key, matchTarget, literal) => {
      await this.app.fileManager.processFrontMatter(f, (fm) => {
        if (!(key in fm))
          return;
        const kept = toEntryArray(fm[key]).filter(
          (e) => matchTarget ? !linkResolvesTo(this.app, e, f.path, matchTarget) : stripLinktext(e).toLowerCase() !== literal.toLowerCase()
        );
        const collapsed = collapseEntries(kept);
        if (collapsed === void 0)
          delete fm[key];
        else
          fm[key] = collapsed;
      });
    };
    await removeFrom(file, rel.ownKey, rel.targetFile, rel.linktext);
    if (rel.targetFile)
      await removeFrom(rel.targetFile, rel.otherKey, file, file.basename);
    new import_obsidian32.Notice("Relation removed.");
  }
  // ── Note type commands ────────────────────────────────────────────────────────
  registerNoteTypeCommand(noteType) {
    const cmdId = `ffc-notetype-${noteType.commandSlug}`;
    if (this.registeredCommandIds.has(cmdId))
      return;
    const registered = this.addCommand({
      id: cmdId,
      name: `Create new ${noteType.name}`,
      callback: () => {
        const current = this.settings.noteTypes.find((o) => o.id === noteType.id);
        if (!current) {
          new import_obsidian32.Notice("Note type not found. Try reloading.");
          return;
        }
        new NewNoteModal(
          this.app,
          current,
          async (title, fieldValues, description) => {
            await this.createNote(current, title, fieldValues, description);
          }
        ).open();
      }
    });
    this.commandRefs[cmdId] = registered;
    this.registeredCommandIds.add(cmdId);
  }
  registerFindCommand(noteType) {
    const cmdId = `ffc-notetype-${noteType.commandSlug}-find`;
    if (this.registeredCommandIds.has(cmdId))
      return;
    const registered = this.addCommand({
      id: cmdId,
      name: `Find ${noteType.name}`,
      callback: () => {
        const current = this.settings.noteTypes.find((o) => o.id === noteType.id);
        if (!current) {
          new import_obsidian32.Notice("Note types: note type not found. Try reloading.");
          return;
        }
        const files = this.getNoteTypeFiles(current);
        if (files.length === 0) {
          new import_obsidian32.Notice("Note types: no files match this note type.");
          return;
        }
        new FilteredFileModal(this.app, files, current.name).open();
      }
    });
    this.commandRefs[cmdId] = registered;
    this.registeredCommandIds.add(cmdId);
  }
  /**
   * Carry a note type's user-bound hotkeys over to its new command IDs when its
   * slug is healed on load. Obsidian keys custom hotkeys by command ID, which is
   * fixed once a command is registered, so without this the bindings would point
   * at an ID that no longer exists. Called before the commands are registered, so
   * there is nothing to unregister — only the stored hotkey map to update.
   */
  migrateCommandHotkeys(oldSlug, newSlug) {
    var _a;
    try {
      const hkm = hotkeyManager(this.app);
      const custom = hkm == null ? void 0 : hkm.customKeys;
      if (!custom)
        return;
      let changed = false;
      for (const suffix of ["", "-find"]) {
        const oldId = `ffc-notetype-${oldSlug}${suffix}`;
        const newId = `ffc-notetype-${newSlug}${suffix}`;
        const keys = custom[oldId];
        if (keys && keys.length && !custom[newId]) {
          custom[newId] = keys;
          delete custom[oldId];
          changed = true;
        }
      }
      if (changed)
        (_a = hkm.save) == null ? void 0 : _a.call(hkm);
    } catch (e) {
    }
  }
  registerNewNoteCommand() {
    this.addCommand({
      id: "ffc-new-note",
      name: "New note",
      callback: () => this.openNewNoteModal(async (noteType, title, fv, desc) => {
        await this.createNote(noteType, title, fv, desc);
      })
    });
    this.addCommand({
      id: "ffc-create-note-type",
      name: "Create note type",
      callback: () => this.openCreateNoteTypeModal()
    });
    this.addCommand({
      id: "ffc-create-typed-note-inline",
      name: "Create typed note inline",
      editorCallback: (editor) => {
        startInlineTypedNote(this, editor);
      }
    });
    this.addCommand({
      id: "ffc-new-note-from-selection",
      name: "New note from selection",
      editorCallback: (editor) => {
        var _a, _b, _c;
        const selection = (_b = (_a = editor.getSelection()) == null ? void 0 : _a.trim()) != null ? _b : "";
        const selectionIsUrl = selection !== "" && isUrl(selection);
        const from = editor.getCursor("from");
        const to = editor.getCursor("to");
        const replaceWithLink = async (title) => {
          editor.replaceRange(`[[${title}]]`, from, to);
        };
        const routeToField = selectionIsUrl && !!((_c = this.settings.noteTypes[0]) == null ? void 0 : _c.urlFieldKey);
        const initialTitle = routeToField ? "" : selection;
        const urlSelection = selectionIsUrl ? selection : "";
        const titlePromise = selectionIsUrl && this.settings.fetchUrlTitles ? fetchPageTitle(selection) : null;
        this.openNewNoteModal(async (noteType, title, fv, desc) => {
          await replaceWithLink(title);
          await this.createNote(noteType, title, fv, desc);
        }, initialTitle, urlSelection, titlePromise);
      }
    });
  }
  // ── File creation ─────────────────────────────────────────────────────────────
  /** Open the Create note type dialog; `done` receives the new type, or null if dismissed. */
  openCreateNoteTypeModal(done) {
    let created = null;
    const modal = new CreateNoteTypeModal(this.app, this, async (values) => {
      const noteType = await this.createNoteType(values.name, {
        ...values,
        description: values.description || void 0
      });
      created = noteType;
      new import_obsidian32.Notice(`Created note type "${noteType.name}".`);
    });
    modal.onClosed = () => done == null ? void 0 : done(created);
    modal.open();
  }
  /**
   * Open the New note dialog with an add-type button. With no note types yet,
   * it first asks the user to create one.
   */
  openNewNoteModal(onSubmit, initialTitle = "", urlSelection = "", titlePromise = null, onDismiss, initialType) {
    const types = this.settings.noteTypes;
    if (types.length === 0) {
      this.openCreateNoteTypeModal((created) => {
        if (created)
          this.openNewNoteModal(onSubmit, initialTitle, urlSelection, titlePromise, onDismiss, initialType);
        else
          onDismiss == null ? void 0 : onDismiss();
      });
      return;
    }
    const modal = new CombinedNewNoteModal(this.app, types, onSubmit, initialTitle, urlSelection, titlePromise, initialType);
    modal.onAddType = (done) => this.openCreateNoteTypeModal(done);
    if (onDismiss)
      modal.onDismiss = onDismiss;
    modal.open();
  }
  /** Build a note type with defaults, persist it and register its command. */
  async createNoteType(name, overrides = {}) {
    const noteType = buildNoteType(name, this.settings.noteTypes, overrides);
    await this.addNoteType(noteType);
    return noteType;
  }
  /** Persist a new note type and register its command; rolls back if saving fails. */
  async addNoteType(noteType) {
    this.settings.noteTypes.push(noteType);
    try {
      await this.saveSettings();
    } catch (err) {
      this.settings.noteTypes.pop();
      throw err;
    }
    this.registerNoteTypeCommand(noteType);
  }
  /** Folder a new note of this type goes in, following the type's save location. */
  resolveSaveFolder(noteType) {
    var _a, _b, _c;
    const folder = (_b = (_a = noteType.saveFolder) == null ? void 0 : _a.trim().replace(/\/$/, "")) != null ? _b : "";
    const location = effectiveSaveLocation(noteType);
    if (location === "current") {
      const parent = (_c = this.app.workspace.getActiveFile()) == null ? void 0 : _c.parent;
      return parent && !parent.isRoot() ? parent.path : "";
    }
    return location === "folder" ? folder : "";
  }
  async createNote(noteType, title, fieldValues = {}, description = "") {
    const saveFolder = this.resolveSaveFolder(noteType);
    const filePath = saveFolder ? `${saveFolder}/${title}.md` : `${title}.md`;
    if (this.app.vault.getAbstractFileByPath(filePath)) {
      new import_obsidian32.Notice(`A file named "${title}" already exists at that location.`);
      return null;
    }
    let content = "";
    if (noteType.templatePath) {
      const tplFile = this.app.vault.getAbstractFileByPath(noteType.templatePath);
      if (tplFile instanceof import_obsidian32.TFile) {
        content = await this.app.vault.read(tplFile);
      } else {
        new import_obsidian32.Notice(`Template not found: ${noteType.templatePath}`);
      }
    }
    const now = new Date();
    content = content.replace(/\{\{title\}\}/gi, title).replace(/\{\{date\}\}/gi, now.toISOString().split("T")[0]).replace(/\{\{time\}\}/gi, now.toTimeString().split(" ")[0]);
    content = this.injectFieldsIntoContent(content, noteType, fieldValues);
    if (description.trim()) {
      content = this.appendDescriptionToContent(content, description.trim());
    }
    if (saveFolder && !this.app.vault.getAbstractFileByPath(saveFolder)) {
      try {
        await this.app.vault.createFolder(saveFolder);
      } catch (e) {
      }
    }
    try {
      const newFile = await this.app.vault.create(filePath, content);
      const notice = new import_obsidian32.Notice("", 6e3);
      const frag = notice.messageEl.createSpan();
      frag.appendText("Created: ");
      const link = frag.createEl("a", { text: title, href: "#", cls: "ffc-notice-link" });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        void this.app.workspace.getLeaf(false).openFile(newFile);
        notice.hide();
      });
      return newFile;
    } catch (err) {
      new import_obsidian32.Notice(`Failed to create file: ${err.message}`);
      return null;
    }
  }
  injectFieldsIntoContent(content, noteType, fieldValues) {
    var _a, _b;
    const fields = ((_a = noteType.fields) != null ? _a : []).filter((f) => {
      var _a2;
      return (_a2 = f.key) == null ? void 0 : _a2.trim();
    });
    if (fields.length === 0)
      return content;
    for (const field of fields) {
      const raw = ((_b = fieldValues[field.key]) != null ? _b : "").trim();
      if (!raw)
        continue;
      if (field.type === "list") {
        const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
        content = this.upsertListInFrontmatter(content, field.key, items);
      } else {
        content = this.upsertTextInFrontmatter(content, field.key, raw);
      }
    }
    return content;
  }
  appendDescriptionToContent(content, description) {
    const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/);
    if (fmMatch) {
      const fmEnd = fmMatch.index + fmMatch[0].length;
      const body = content.slice(fmEnd);
      if (body.trim()) {
        return content.trimEnd() + "\n\n" + description + "\n";
      } else {
        return content.slice(0, fmEnd) + "\n" + description + "\n";
      }
    } else {
      return content.trim() ? content.trimEnd() + "\n\n" + description + "\n" : description + "\n";
    }
  }
  keyBlockRegex(esc) {
    return new RegExp(`^${esc}:[^\\n]*((?:\\r?\\n  - [^\\r\\n]*)*)`, "m");
  }
  upsertListInFrontmatter(content, key, newItems) {
    if (!newItems.length)
      return content;
    content = this.ensureFrontmatter(content);
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const yamlItem = (i) => /^\[\[.*\]\]$/.test(i) ? `"${i}"` : i;
    const inlineRe = new RegExp(`(^${esc}:\\s*\\[)([^\\]]*)(\\])`, "m");
    if (inlineRe.test(content)) {
      return content.replace(inlineRe, (_, open, body, close) => {
        const existing = body.split(",").map((s) => s.trim()).filter(Boolean);
        const merged = [.../* @__PURE__ */ new Set([...existing, ...newItems])];
        return `${open}${merged.map(yamlItem).join(", ")}${close}`;
      });
    }
    const blockRe = this.keyBlockRegex(esc);
    const m = content.match(blockRe);
    if (m) {
      const blockPart = m[1];
      let existing = [];
      if (blockPart.trim()) {
        existing = [...blockPart.matchAll(/- ([^\r\n]+)/g)].map((x) => x[1].trim());
      } else {
        const scalarVal = m[0].replace(new RegExp(`^${esc}:\\s*`), "").trim();
        if (scalarVal)
          existing = [scalarVal];
      }
      const merged = [.../* @__PURE__ */ new Set([...existing, ...newItems])];
      const replacement = `${key}:
` + merged.map((i) => `  - ${yamlItem(i)}`).join("\n");
      return content.replace(blockRe, replacement);
    }
    return content.replace(/^(---\r?\n)/, `$1${key}: [${newItems.map(yamlItem).join(", ")}]
`);
  }
  upsertTextInFrontmatter(content, key, value) {
    content = this.ensureFrontmatter(content);
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const yamlValue = /^\[\[.*\]\]$/.test(value) ? `"${value}"` : value;
    const blockRe = this.keyBlockRegex(esc);
    if (blockRe.test(content)) {
      return content.replace(blockRe, `${key}: ${yamlValue}`);
    }
    return content.replace(/^(---\r?\n)/, `$1${key}: ${yamlValue}
`);
  }
  ensureFrontmatter(content) {
    if (/^---\r?\n/.test(content))
      return content;
    return `---
---

${content}`;
  }
  // ── Template helpers ──────────────────────────────────────────────────────────
  /**
   * Where Obsidian reads templates from: this plugin's override, else the core
   * Templates plugin's folder, else Templater's. Empty when none is configured;
   * "/" means the vault root.
   */
  getTemplatesFolder() {
    var _a, _b, _c, _d, _e;
    if (this.settings.templatesFolder)
      return this.settings.templatesFolder;
    try {
      const core = (_b = (_a = corePlugins(this.app)) == null ? void 0 : _a.plugins) == null ? void 0 : _b["templates"];
      if (core == null ? void 0 : core.enabled) {
        const options = (_c = core.instance) == null ? void 0 : _c.options;
        return (_d = options == null ? void 0 : options.folder) != null ? _d : "";
      }
    } catch (e) {
    }
    const templater = (_e = communityPluginSettings(this.app, "templater-obsidian")) == null ? void 0 : _e.templates_folder;
    return typeof templater === "string" ? templater : "";
  }
  /** Folder new templates go in, without surrounding slashes. '' is the vault root; defaults to "Templates" when none is configured. */
  getNewTemplateFolder() {
    const configured = this.getTemplatesFolder();
    return configured ? configured.replace(/^\/+|\/+$/g, "") : "Templates";
  }
  /** Creates an empty template note in the templates folder (making the folder if needed). */
  async createTemplateFile(rawName) {
    const name = rawName.trim().replace(/\.md$/i, "");
    if (!name)
      throw new Error("Enter a name for the template.");
    if (/[\\/:*?"<>|]/.test(name))
      throw new Error('Template names cannot contain \\ / : * ? " < > |');
    if (name.startsWith(".") || name.endsWith("."))
      throw new Error("Template names cannot start or end with a dot.");
    const folder = this.getNewTemplateFolder();
    if (folder && !this.app.vault.getFolderByPath(folder))
      await this.app.vault.createFolder(folder);
    const path = folder ? `${folder}/${name}.md` : `${name}.md`;
    if (this.app.vault.getAbstractFileByPath(path))
      throw new Error(`"${path}" already exists.`);
    return this.app.vault.create(path, "");
  }
  getTemplateFiles() {
    const folder = this.getTemplatesFolder().replace(/^\/+|\/+$/g, "");
    const allMd = this.app.vault.getMarkdownFiles();
    if (!folder)
      return allMd;
    return allMd.filter((f) => f.path.startsWith(folder + "/"));
  }
  // ── Persistence ───────────────────────────────────────────────────────────────
  async loadSettings() {
    var _a;
    const raw = (_a = await this.loadData()) != null ? _a : {};
    if (raw.noteTypes === void 0 && Array.isArray(raw.objectTypes)) {
      raw.noteTypes = raw.objectTypes;
    }
    delete raw.objectTypes;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    if (this.settings.relationTypes === DEFAULT_SETTINGS.relationTypes)
      this.settings.relationTypes = [];
    if (!this.settings.noteTypes)
      this.settings.noteTypes = [];
    if (this.settings.templatesFolder === void 0)
      this.settings.templatesFolder = "";
    if (this.settings.triggerKey === void 0)
      this.settings.triggerKey = "";
    if (!Array.isArray(this.settings.ffwSections))
      this.settings.ffwSections = [];
    if (this.settings.ffwDisplayNameKey === void 0)
      this.settings.ffwDisplayNameKey = "";
    this.settings.ffwSections = this.settings.ffwSections.filter(
      (s) => s && typeof s === "object" && typeof s.id === "string" && typeof s.title === "string" && Array.isArray(s.filters) && !!s.sort
    );
    const takenSlugs = new Set(
      this.settings.noteTypes.filter((o) => o.commandSlug).map((o) => o.commandSlug)
    );
    let needsSave = false;
    for (const obj of this.settings.noteTypes) {
      if (!obj.fields) {
        obj.fields = [];
        needsSave = true;
      }
      if (!obj.matchFilters) {
        obj.matchFilters = [];
        needsSave = true;
      }
      if (!obj.matchMode) {
        obj.matchMode = "all";
        needsSave = true;
      }
      if (obj.enableFindCommand === void 0) {
        obj.enableFindCommand = false;
        needsSave = true;
      }
      if (obj.showInTriggerMenu === void 0) {
        obj.showInTriggerMenu = false;
        needsSave = true;
      }
      if (obj.styledLinks === void 0) {
        obj.styledLinks = false;
        needsSave = true;
      }
      if (obj.showLinkIcon === void 0) {
        obj.showLinkIcon = false;
        needsSave = true;
      }
      if (!obj.previewFields) {
        obj.previewFields = [];
        needsSave = true;
      }
      if (!obj.canvasFields) {
        obj.canvasFields = [];
        needsSave = true;
      }
      if (!obj.imageKey) {
        obj.imageKey = "";
        needsSave = true;
      }
      if (obj.showImageInPreview === void 0) {
        obj.showImageInPreview = false;
        needsSave = true;
      }
      if (!obj.commandSlug) {
        obj.commandSlug = uniqueCommandSlug(obj.name, takenSlugs);
        takenSlugs.add(obj.commandSlug);
        needsSave = true;
      } else if (obj.commandSlug !== nameToCommandSlug(obj.name)) {
        takenSlugs.delete(obj.commandSlug);
        const slug = uniqueCommandSlug(obj.name, takenSlugs);
        if (slug !== obj.commandSlug) {
          this.migrateCommandHotkeys(obj.commandSlug, slug);
          obj.commandSlug = slug;
          needsSave = true;
        }
        takenSlugs.add(obj.commandSlug);
      }
    }
    if (ensureRelationTypes(this.settings))
      needsSave = true;
    if (needsSave)
      await this.saveSettings();
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  // ── Note link styling ─────────────────────────────────────────────────────────
  buildStyledNoteSet() {
    var _a, _b, _c, _d, _e;
    this.styledNoteBasenames = /* @__PURE__ */ new Set();
    this.styledNotePaths = /* @__PURE__ */ new Set();
    this.styledNoteColors = /* @__PURE__ */ new Map();
    this.styledNoteIcons = /* @__PURE__ */ new Map();
    this.previewNoteBasenames = /* @__PURE__ */ new Set();
    this.previewNotePaths = /* @__PURE__ */ new Set();
    this.statusNoteMap = /* @__PURE__ */ new Map();
    for (const noteType of this.settings.noteTypes) {
      const hasPreview = ((_a = noteType.previewFields) != null ? _a : []).length > 0;
      if (!noteType.styledLinks && !hasPreview && !noteType.showStatusInLinks)
        continue;
      for (const file of this.getNoteTypeFiles(noteType)) {
        if (noteType.styledLinks) {
          this.styledNoteBasenames.add(file.basename);
          this.styledNotePaths.add(file.path);
          const color = (_b = noteType.linkColor) == null ? void 0 : _b.trim();
          if (color)
            this.styledNoteColors.set(file.path, color);
          const icon = noteType.showLinkIcon ? (_c = noteType.linkIcon) == null ? void 0 : _c.trim() : "";
          if (icon)
            this.styledNoteIcons.set(file.path, icon);
        }
        if (hasPreview) {
          this.previewNoteBasenames.add(file.basename);
          this.previewNotePaths.add(file.path);
        }
        if (noteType.showStatusInLinks) {
          const raw = (_e = (_d = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _d.frontmatter) == null ? void 0 : _e["status"];
          if (typeof raw === "string" && VALID_STATUSES.has(raw)) {
            this.statusNoteMap.set(file.basename, raw);
          }
        }
      }
    }
  }
  /**
     * Link colour and icon for a wikilink, resolved against its *actual*
     * target file (once, shared between both) so a basename shared with
     * another note can't borrow this type's styling. Empty when the target
     * isn't a styled note.
     */
  noteLinkStyle(linkpath, sourcePath = "") {
    if (!linkpath || this.styledNoteColors.size === 0 && this.styledNoteIcons.size === 0)
      return {};
    const dest = this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    if (!dest)
      return {};
    return { color: this.styledNoteColors.get(dest.path), icon: this.styledNoteIcons.get(dest.path) };
  }
  /** Convenience wrapper around `noteLinkStyle()` for color-only call sites. */
  noteLinkColor(linkpath, sourcePath = "") {
    return this.noteLinkStyle(linkpath, sourcePath).color;
  }
  /** Convenience wrapper around `noteLinkStyle()` for icon-only call sites. */
  noteLinkIcon(linkpath, sourcePath = "") {
    return this.noteLinkStyle(linkpath, sourcePath).icon;
  }
  refreshNoteLinkStyles() {
    document.querySelectorAll("a.internal-link[data-href]").forEach((link) => {
      var _a, _b;
      const href = ((_a = link.getAttribute("data-href")) != null ? _a : "").split("#")[0].trim();
      const basename = href.includes("/") ? (_b = href.split("/").pop()) != null ? _b : href : href;
      const isStyled = this.styledNoteBasenames.has(href) || this.styledNoteBasenames.has(basename);
      const isPreview = this.previewNoteBasenames.has(href) || this.previewNoteBasenames.has(basename);
      link.classList.toggle("ffc-note-link", isStyled);
      link.classList.toggle("ffc-note-preview-link", isPreview);
      const color = isStyled ? this.noteLinkColor(href) : void 0;
      if (color)
        link.style.setProperty("--ffc-note-link-color", color);
      else
        link.style.removeProperty("--ffc-note-link-color");
    });
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a;
      const cm = (_a = leaf.view.editor) == null ? void 0 : _a.cm;
      cm == null ? void 0 : cm.dispatch({ effects: refreshNoteLinkStylesEffect.of(null) });
    });
  }
};
var main_default = FilteredFileCommandsPlugin;
