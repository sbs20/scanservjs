# scanservjs — Smart Autocrop (`feature/autocrop`)

> **This is a feature branch** of [Markus Gutschke's community fork](https://github.com/gutschke/scanservjs)
> of [sbs20/scanservjs](https://github.com/sbs20/scanservjs).
>
> For the full feature set and a pre-built Debian/Ubuntu package, see the
> [`production` branch](https://github.com/gutschke/scanservjs/tree/production) or the
> [`binary` branch](https://github.com/gutschke/scanservjs/tree/binary).

## Smart Autocrop

Adds automatic document boundary detection, deskew, and crop for flatbed scans.
When enabled, the scan pipeline identifies document edges in the scanned image,
corrects any skew, and crops to the document boundary — removing the flatbed
background without requiring manual selection.
