<template>
  <div>
    <div class="text-h2">scanservjs v{{ version }}</div>
    <div class="caption mb-4">&copy; 2016 - {{ new Date().getFullYear() }} Sam Strachan</div>
    <div class="body-1 mb-4">
      scanservjs is a simple web-based UI for your scanner. It allows you to
      share one or more scanners (using SANE) on a network without the need for
      drivers or complicated installation. It can save to TIF, JPG, PNG, PDF and
      TXT (with Tesseract OCR) with varying compression settings, all of which 
      can be configured. It supports multipage scanning and all SANE compatible
      devices.
    </div>
    <div class="body-1 mb-4">
      File an issue or view the source code:
      <a target="_blank" href="https://github.com/sbs20/scanservjs">https://github.com/sbs20/scanservjs</a>
    </div>
  </div>
</template>

<script>
import Common from '../classes/common';

export default {
  name: 'About',

  data() {
    return {
      version: Common.version()
    };
  }
};
</script>

<style>

</style>