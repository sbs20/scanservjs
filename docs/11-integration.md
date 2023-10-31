# Integration

It's not uncommon to want to integrate scanservjs with other software - you may
wish to upload scans to Dropbox, paperless-ng or some other location. The
possibilities are endless but deep integration into the UI would add cruft for
the vast majority of users.

Thankfully, the files just end up in a location on your filesystem so you are
free to integrate however you want.

There are two recommended approaches:

* Create a script or program which scans the output
directory for files and then does something with them.
* Create an [action](./10-configuration.md#actions)

## paperless-ng

[This discussion](https://github.com/sbs20/scanservjs/issues/351#issuecomment-913858423)
about paperless-ng resulted in
[scantopl](https://github.com/Celedhrim/scantopl)

## Dropbox

You could integrate with Dropbox using
[Dropbox-Uploader](https://github.com/andreafabrizi/Dropbox-Uploader)

## insaned

Use your scanner's hardware 'Scan' button to initiate a new scan via
`scanservjs`. Requires a scanner that exposes buttons as sensors and `curl`.

* Repo: https://gitlab.com/xeijin-dev/insaned
