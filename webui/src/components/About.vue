<template>
  <div>
    <div class="text-h5">{{ $t('global.application-name') }}</div>
    <div class="text-h6">v{{ version }}</div>
    <div class="caption mb-4">&copy; 2016 - {{ new Date().getFullYear() }} Sam Strachan</div>
    <div class="body-1 mb-4">
      {{ $t('about.main') }}
    </div>
    <div class="body-1 mb-4">
      {{ $t('about.issue') }}
      <a target="_blank" href="https://github.com/sbs20/scanservjs">https://github.com/sbs20/scanservjs</a>
    </div>
  </div>
</template>

<script>
import Constants from '../classes/constants';

export default {
  name: 'About',

  data() {
    return {
      version: Constants.Version
    };
  }
};
</script>

<style>

</style>