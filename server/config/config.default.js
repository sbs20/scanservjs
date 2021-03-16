/* eslint-disable no-unused-vars */

/**
 * This file is ignored. If you want to apply overrides, make a copy in this
 * location and name it `config.local.js`. Then make the necessary changes.
 */
module.exports = {
  /**
   * @param {Configuration} config 
   */
  afterConfig(config) {
    /**
     * Override any of the following values
     */
    // config.port = 8080;
    // config.devices = [];
    // config.ocrLanguage = 'eng';
    // config.log.level = 'DEBUG';
    // config.scanimage = '/usr/bin/scanimage';
    // config.convert = '/usr/bin/convert';
    // config.tesseract = '/usr/bin/tesseract';
    // config.previewResolution = 100;

    /* When all scans are complete, the filenames are all piped into stdin of the
    first pipeline command. It would be nicer to pipe the binary output of scanimage
    but that doesn't work with multipage scans so we have no choice but to write to
    the filesystem.

    The stdout of each pipeline feeds into the stdin of the next. Although clumsy in
    some respects (especially where we have to write temporary files and then list
    them) it at least provides a means of user configuration with "just" shell
    scripting.

    The overall output of the pipelines (i.e. the last pipeline output) must be a
    list of the files you want kept. The convention is to output files of the form
    `scan-0000.ext` but it's convention only. You can output whatever you want. If
    multiple files are output then the results will be zipped into a single file.

    Each command is executed with the CWD set to the temporary location so no
    directory traversal is required. Pipeline commands are always read from this
    file (and never from the browser request, even though it is sent). It would be
    possible to subvert these commands for malicious use, but it doesn't give any
    further privilege than the user account running scanservjs and still requires
    access to this file. You obviously should not be running as root.

    Some useful pointers:
    - `convert` can read a list of files from a file with the @ argument. The `-`
      file is stdin. So `convert @- -argument output` performs the conversion on
      each file piped into stdin
    - `tesseract` has a similar feature using `-c stream_filelist=true`
    - `convert` can also output multiple files if you use an output filename with
      `%d` in it. C string style formatting is available so you can do things like
      output to `scan-%04d.jpg`. Formats which do not support multiple pages must
      use this option. Multi-page formats including PDF and TIF do not use this
      option.
    - if you just wanted to take a filename from stdin and have its content read out
      you could `xargs cat` provided there were no spaces or commas in the filename
      (which there won't be)
    */

    /**
     * Create a custom pipeline
     */
    // const myPipelines = [
    //   {
    //     extension: 'jpg',
    //     description: 'JPG | Super quality',
    //     commands: [
    //       'convert @- -quality 96 scan-%04d.jpg',
    //       'ls scan-*.*'
    //     ]
    //   }
    // ];

    /**
     * Replace all existing pipelines
     */
    // config.pipelines = myPipelines;

    /**
     * Append to existing pipelines
     */
    // config.pipelines.push(myPipelines[0]);
  },

  /**
   * This method is called after devices have been read (from the scanner or
   * disk) but before being returned to anything else. You can use this to
   * override default settings from the scanner, or resolution options or
   * anything else for that matter.
   * 
   * Note that the devices parameter is an array. Most systems will likely just
   * have one scanner, but that's not always true. Therefore you will need to
   * identify the scanner by id or index. It's also possible that the list will
   * be empty if there's an upstream error.
   * @param {ScanDevice[]} devices 
   */
  afterDevices(devices) {
    /**
     * Example code below
     */
    // const device = devices.filter(d => d.id.startsWith('plustek'))[0];
    // if (device) {
    //   device.features['--mode'].default = 'Gray';
    //   device.features['--resolution'].default = 150;
    //   device.features['--resolution'].options = [150, 300, 600];
    //   device.features['--brightness'].default = 10;
    //   device.features['--contrast'].default = 20;
    //   device.features['-x'].default = 215;
    //   device.features['-y'].default = 297;
    // }
  }
};
