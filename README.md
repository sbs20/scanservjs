# scanservjs — PDF Editor (`feature/editor`)

> **This is a feature branch** of [Markus Gutschke's community fork](https://github.com/gutschke/scanservjs)
> of [sbs20/scanservjs](https://github.com/sbs20/scanservjs).
>
> For the full feature set and a pre-built Debian/Ubuntu package, see the
> [`production` branch](https://github.com/gutschke/scanservjs/tree/production) or the
> [`binary` branch](https://github.com/gutschke/scanservjs/tree/binary).

## PDF Editor

Adds a document editor accessible from the Files tab, letting users perform common
post-scan page-level operations without leaving the browser:

- **Rearrange and merge**: Drag-and-drop page reordering (including multi-page drag);
  merge multiple documents or uploaded files into one; add blank pages; full undo/redo.
- **Rotate and delete**: Per-page rotation via OCR-safe content-stream CTM (not the
  `/Rotate` display hint); delete pages with a guard preventing an empty document.
- **Paper size and fit**: Set or change page size per-page or at save time.
  `set-size` is fully OCR-safe (adjusts MediaBox only, aligns content top-left).
  `fit` and `fill` modes scale content via CTM (UI shows an OCR warning).
- **Duplex page-order operations**: Interleave, deinterleave, reverse, swap-pairs —
  scoped to the current selection or the whole document.
- **Ephemeral uploads**: Upload PDFs or images from local disk; pages are inserted at
  the cursor position and the uploaded file is cleaned up with the session.

All transforms use pikepdf (preferred) or pdftk-java (fallback). Streaming uploads
and lazy thumbnail extraction keep peak memory low on 1 GB ARM devices.

## Branch dependency

This branch depends on `feature/file-preview`, which is merged in as a git ancestor.
Anyone who picks up `feature/editor` automatically gets `feature/file-preview`.
When merging into a clean `master`, merge `feature/file-preview` first.

## Internationalisation

All user-visible strings are translated into the 18 locales supported upstream:
`ar`, `cs`, `de`, `en-US`, `es`, `fr`, `hu`, `it`, `nl`, `pl`, `pt`, `pt-BR`,
`ru`, `sk`, `tr`, `uk`, `zh`.

## Design document

See [`DESIGN.md`](DESIGN.md) for architecture, API endpoints, file inventory,
and implementation notes.
