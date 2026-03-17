# scanservjs — XFA PDF conversion (`feature/xfa`)

> **This is a feature branch** of [Markus Gutschke's community fork](https://github.com/gutschke/scanservjs)
> of [sbs20/scanservjs](https://github.com/sbs20/scanservjs).
>
> For the full feature set and a pre-built Debian/Ubuntu package, see the
> [`production` branch](https://github.com/gutschke/scanservjs/tree/production) or the
> [`binary` branch](https://github.com/gutschke/scanservjs/tree/binary).

## XFA PDF conversion

Automatically converts XFA-based PDF forms to static PDFs when they are
uploaded into the PDF editor's "insert pages from file" dialog.

XFA (XML Forms Architecture) PDFs are a legacy Adobe format that web browsers
and most PDF libraries cannot render. This feature detects XFA PDFs at upload
time and converts them to equivalent static PDFs using a rendering pipeline
before they enter the editor session.

### How it works

1. When a PDF is uploaded via the editor's file-insert feature, the server
   checks for the presence of an `/XFA` marker in the file without loading the
   entire file into memory.
2. If the marker is found, the file is passed to `xfa-convert/convert.py`,
   which uses **pdfjs-dist** (Node.js) to parse the XFA form data and render
   each page to HTML, then **WeasyPrint** (Python) to produce a static PDF.
3. The converted static PDF replaces the original in the upload slot. The
   original XFA file is deleted immediately after conversion; no temporary
   files are left on disk.
4. If the file is not an XFA PDF, or if conversion fails, the original file is
   used as-is and the editor continues normally.

### Branch dependency

This branch is rebased onto `feature/editor` and modifies
`app-server/src/classes/editor-session.js` (the upload handler).  When merging
into a clean `master`, merge the full `feature/editor` dependency chain first:

```
feature/security → feature/file-preview → feature/editor → feature/xfa
```

### Additional system dependencies

The Debian package installs the following additional dependencies:

- **System libraries** (Depends): `libpango-1.0-0`, `libpangoft2-1.0-0`,
  `libpangocairo-1.0-0` — required by WeasyPrint for text layout.
- **Font packages** (Recommends): `fonts-crosextra-carlito`,
  `fonts-crosextra-caladea`, `fonts-liberation` — improve rendering fidelity
  for documents that reference common Microsoft Office typefaces.

A dedicated Python virtual environment is created at
`/usr/lib/scanservjs/xfa-convert/.venv` during `postinst` and is kept
separate from the main editor virtual environment.
