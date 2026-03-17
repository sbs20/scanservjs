# scanservjs — White-background thumbnails (`feature/thumbnail`)

> **This is a feature branch** of [Markus Gutschke's community fork](https://github.com/gutschke/scanservjs)
> of [sbs20/scanservjs](https://github.com/sbs20/scanservjs).
>
> For the full feature set and a pre-built Debian/Ubuntu package, see the
> [`production` branch](https://github.com/gutschke/scanservjs/tree/production) or the
> [`binary` branch](https://github.com/gutschke/scanservjs/tree/binary).

## White-background thumbnails

Fixes thumbnail generation for PDFs that have a transparent page background
(such as PDFs produced by WeasyPrint).

ImageMagick fills transparent areas with black by default, producing dark,
unreadable thumbnail icons for such files. This change adds `-background white
-flatten` to the thumbnail command so that transparent pixels are composited
over white before the image is resized, matching the appearance of the document
in a typical PDF viewer.

Existing cached thumbnails in the thumbnails directory must be deleted manually
to trigger regeneration with the corrected command.
