# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.0]

### Changed

- **Canvas features moved to Canvas Plus.** The canvas tools, note cards,
  relations on edges, key images, ink and layers panel are now a separate
  plugin, Canvas Plus. Install it to keep them; your canvas files are unchanged.
  The **Canvas card fields** and **Image on canvas cards** settings stay here.

### Added

- **API for other plugins** (`plugin.api`, see `src/api.ts`): note types, the
  note type of a file, note creation, relation types and relation reads and
  writes.

## [1.11.0]

### Added

- **Canvas tools in the bottom menu.** Obsidian's own bottom card menu becomes one
  bordered bar: Select, then Obsidian's draggable Card, Note and
  Media buttons and a draggable Add note button, then Text, Group, Marker, Highlighter and
  Eraser (`V`, `T`, `C`, `G`, `M`, `⇧M`, `E`, `N`; `Esc` cancels). The tools are controls
  (like the ones on the right) with rounded hover states; the draggable buttons use
  Obsidian's own lift animation, grab cursor and drag-to-place. Click Text or Group, then
  click or drag on the canvas to place one. Free text has no card chrome and removes itself
  if left empty. Everything is stored as standard JSON Canvas, with extra fields kept
  alongside, so stock Obsidian still opens the files. The tools also work in a canvas
  popped out into its own window.
- **Note picker (`N`).** Add a typed note to the canvas, or create a new note
  of a type and its card in one step. A note already on the canvas is selected
  and zoomed to instead of being added twice.
- **Note cards.** A canvas file node for a typed note shows as a card with an
  optional key image and the title, tinted and outlined in the note type's
  link color when its links are styled. A button in the selection toolbar
  (or the **Cycle selected canvas note cards between card, embed and styled link**
  command) switches between the card, Obsidian's full embed and a styled link.
- **Relations on edges.** Connecting two note cards opens a menu of your
  relation types in both directions, ordered by how often each is already used
  between those note types. The relation is written to both notes' frontmatter.
  Relation edges are styled and their labels locked, and the edge pop-up menu
  gains **Make relation** and **Remove relation**.
- **Context panel.** Select a note card to see its relations, grouped by
  relation and direction. **+** brings a related note onto the canvas with a
  labelled edge; **−** takes it off.
- **Key image.** Add, replace or remove a note's key image from the selection
  menu, or drop an image on its card. It is stored in the note type's image
  property when one is set, otherwise at the top of the note.
- **Ink.** Marker (`M`) and highlighter (`⇧M`) draw freehand strokes with
  `perfect-freehand`, with a pen color row (none plus the six canvas presets).
  Each stroke is one text node holding its stroke data in an extra field and an inline SVG
  fallback, so it scales when resized and still shows in stock Obsidian. The
  eraser (`E`) removes whole strokes; one swipe is one undo step. Touch and the
  middle mouse button still pan.
- **Layers panel.** A floating panel on the left lists groups and what they
  contain. Click to select and zoom, Shift-click to add to the selection, hover
  to outline, double-click a group to rename it. A search box (Enter jumps to
  the first result, Esc clears) and a filter by kind of layer or note type narrow
  the list, keeping the groups around each result. When collapsed it becomes a
  core canvas control on the left.

### Changed

- **Undo covers the notes too.** Ctrl/Cmd+Z (and the canvas's undo button) now
  also reverses what a relation, key image or new note did to your notes, and
  redo puts it back. Making a relation takes out the frontmatter links it wrote
  and a relation type created for it; removing one restores them; a key image
  change restores the note's previous text; and undoing the card for a note
  created from the picker moves that note to the trash (redo recreates it). Each
  is only reverted while it is safe: a note edited since the change is left
  alone, and a created note is kept if it has changed or anything else links to
  it, with a notice either way. Saved image files are kept.

### Removed

- **Show cover image on canvas cards.** A card now shows a key image whenever
  the note has one: the type's image property when set, otherwise the first
  image in the note's first paragraph.

## [1.9.0]

### Added

- **Link color for styled note links.** Each note type with *Style note links*
  enabled now has a **Link color** setting. When set, inline `[[wikilinks]]` to
  files of that type render in the chosen color with a translucent tint of it as
  the pill background — in the editor and reading view. Leave it unset (or use
  the reset button) to keep the theme's default tag colors.

## [1.8.0]

### Added

- **Relations.** Right-click a note that belongs to a note type and choose
  **Mark as… → `<relation>` → `<note type>`** (or **Any note…**) to pick another
  note and link the two. The link is written into both notes' frontmatter — under
  the relation's key on the note you marked and under its reverse key on the
  target — so the relation is visible from either side.
- A built-in generic **Related to** relation (symmetric, frontmatter key
  `related_to`) that every note type can use. Its key and labels can be changed
  but it cannot be deleted.
- **Settings → Note Types → Relations** — add, edit, reorder, and delete custom
  relation types. Each has a name, a frontmatter key, and an optional reverse
  label and reverse key for asymmetric relations (e.g. *Blocks* / *Blocked by*).
- **Unmark…** on the same file menu lists a note's existing relations and removes
  the chosen one from both notes' frontmatter.

## [1.7.0]

### Changed

- **Requires Obsidian 1.13.1 or newer.** The settings tab was rebuilt on
  Obsidian's declarative settings API (`getSettingDefinitions()`), which is only
  available from 1.13. The imperative `display()` implementation has been
  removed.
- The settings tab is now assembled from setting definitions rather than
  hand-built DOM. Sections use standard headings, the note types and filtered
  file commands lists use the built-in add / delete / drag-to-reorder
  affordances, and each note type opens as a proper settings sub-page. Settings
  are searchable from the settings-window search box.
- Detection filters and creation / preview / canvas fields on a note type's
  sub-page are now edited in a modal (one entry per row with an edit button)
  instead of inline multi-control rows, per the Obsidian settings style guide.

## [1.6.0]

### Added

- Note types can designate a creation field to receive a highlighted URL. Set
  **Field for highlighted URL** in a note type's **Creation fields** section.
  When you run "Note from selection" / "New note from selection" and the
  selection is a bare `http(s)` URL, the URL is written into that field and the
  title is left blank for you to fill in, instead of the URL becoming the title.
  In the combined (multi-type) dialog the URL re-routes to whichever selected
  type's designated field applies.
- **Fetch page title from URL** setting (off by default). When enabled, creating
  a note from a highlighted URL fetches the linked page and pre-fills the title
  field with its `og:title` / `<title>` (unless you have already typed a title).
  This makes one network request to the linked site; the request times out after
  8 seconds and any failure falls back silently.

### Fixed

- The note type settings sub-page no longer jumps back to the top when adding or
  removing a field, filter, or preview/canvas key. Scroll position is preserved
  across the re-render.

## [1.5.15]

### Fixed

- Removed the direct injection of a "New note from selection" button into the
  Text Formatting Toolbar. That toolbar's external-command list is owned by the
  Commander plugin (which manages it with a full replace), so the injected button
  could not be removed or reordered from any settings UI and was wiped whenever
  Commander re-synced. The `filtered-file-commands:ffc-new-note-from-selection`
  command still exists and can be added to the floating toolbar through
  Commander's "Text Toolbar" tab; the editor context menu also still offers
  "Note from selection".

## [1.5.14]

### Added

- "Show ribbon icon" toggle for the filtered files widget. The ribbon icon is
  now off by default and can be turned on from the widget settings section; it
  adds and removes without reloading the plugin.

### Changed

- The filtered files widget ribbon icon is no longer added automatically when
  the widget feature is enabled — it requires the new toggle.

## [1.5.13]

### Changed

- Note type definitions open in a settings sub-page instead of a modal.

## [1.5.12]

### Changed

- Default filters for filtered file commands are disabled unless explicitly
  enabled.

## [1.5.11]

### Fixed

- Lint fixes and release preparation for Obsidian plugin standards.
