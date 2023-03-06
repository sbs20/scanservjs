# Integration

It's not uncommon to want to integrate scanservjs with other software - you may
wish to upload scans to Dropbox, paperless-ng or some other location. The
possibilities are endless but deep integration into the UI would add cruft for
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

## insaned

Use your scanner's hardware 'Scan' button to initiate a new scan via
`scanservjs`. Requires a scanner that exposes buttons as sensors and `curl`.

* Repo: https://gitlab.com/xeijin-dev/insaned

## Recipe for Scan2Cloud 

This recipe covers all major cloud providers such as Amazon, Dropbox, Google
(Drive/Photos), Microsoft (Azure Blob Storage, OneDrive), Nextcloud (via
WebDav), a network share of your choice (S/FTP) and many
[more](https://rclone.org/overview/) by using [Rclone](https://rclone.org/).

1. Install [Rclone](https://rclone.org/) as described
   [here](https://rclone.org/install/)
2. Configure your [Cloud Provider or Remote](https://rclone.org/overview/)
   accordingly, for example [Nextcloud via Webdav](https://rclone.org/webdav/)
   or [Google Drive](https://rclone.org/drive/)

Now you have a choice. If you want the update to occur on the scan itself then
you need to integrate into the pipeline. Alternatively, sync the output
directory itself and use either inotify or cron. If you want to embed into the
pipeline then something like the following may help:

```javascript
  /**
   * @param {FileInfo} fileInfo 
   * @returns {Promise.<Buffer>}
   */
  async afterScan(fileInfo) {
    // Copy the scan to my home directory
    return await Process.spawn(`rclone copy '${fileInfo.fullname}' YOUR_PROVIDER:/path/to/folder`);
  }
```

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
const Process = require('../server/classes/process');

module.exports = {
  afterConfig(config) {
    config.pipelines.push({
      extension: 'pdf',
      description: 'ocrmypdf',
      get commands() {
        return [
          'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
          'convert @- pdf:-',
          `ocrmypdf -l ${config.ocrLanguage} --deskew --rotate-pages --force-ocr - "scan_0.pdf"`,
          'ls scan_*.*'
        ];
      }
    });
  },

  /**
   * @param {FileInfo} fileInfo 
   * @returns {Promise.<Buffer>}
   */
  async afterScan(fileInfo) {
    return await Process.spawn(`mpack -s "Document from Scanner@Office" "${fileInfo.fullname}" email@address.tld`);
  }
};
```

## Other recipes?

If you have other recipes then please share them.
