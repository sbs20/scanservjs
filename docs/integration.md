# Integration

It's not uncommon to want to integrate scanservjs with other software - you may
wish to upload scans to Dropbox, paperless-ng or some other location. The
possibilities are endless and deep integration into the UI would add cruft for
the vast majority of users.

Thankfully, the files just end up in a location on your filesystem so you are
free to integrate however you want.

The recommended way is to create a script or program which scans the output
directory for files and then does something with them.

## paperless-ng

[This discussion](https://github.com/sbs20/scanservjs/issues/351#issuecomment-913858423)
about paperless-ng resulted in
[scantopl](https://github.com/Celedhrim/scantopl)

## Dropbox

You could integrate with Dropbox using
[Dropbox-Uploader](https://github.com/andreafabrizi/Dropbox-Uploader)

## Scan2Mail

1. Setup and configure [msmtp](https://wiki.debian.org/msmtp) and msmtp-mta as
   described
   [here](https://decatec.de/linux/linux-einfach-e-mails-versenden-mit-msmtp/)
2. Install the MIME packer [mpack](https://linux.die.net/man/1/mpack) with
   `sudo apt install mpack` to send the scanned files
3. Setup [OCRmyPDF](https://github.com/jbarlow83/OCRmyPDF) as described
   [here](https://ocrmypdf.readthedocs.io/en/latest/installation.html)

Now create the following pipeline in your `config/config.local.js`

```javascript
config.pipelines.push({
  extension: 'pdf',
  description: 'ocrmypdf (Scan2Mail email@address.tld)',
  get commands() {
    return [
      'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
      'convert @- pdf:-',
      `file="scan_$(date +"%d_%m_%Y-%H_%M").pdf" && ocrmypdf -l ${config.ocrLanguage} --deskew --rotate-pages --force-ocr - "$file" && mpack -s "Document from Scanner@Office" "$file" email@address.tld`,
      'ls scan_*.*'
    ];
  }
});
```

The important `Scan2Mail` line is:

```
file="scan_$(date +"%d_%m_%Y-%H_%M").pdf" && ocrmypdf -l ${config.ocrLanguage} --deskew --rotate-pages --force-ocr - "$file" && mpack -s "Document from Scanner@Office" "$file" email@address.tld
```

This sets a time-based filename, then OCRs and finally sends to
email@address.tld

## Other recipes?

If you have other recipes then please share them.
