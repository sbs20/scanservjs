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

    <v-btn @click="showSystemInfo">{{ $t('about.system-info') }}</v-btn>

    <v-dialog v-model="systemInfoDialog" aria-role="dialog" max-width="480" v-on:keydown.stop="_onKeys" aria-modal>
      <v-card>
        <v-card-title>
          {{ $t('about.system-info') }}
        </v-card-title>
        <v-card-text>
          <pre class="caption text--secondary">{{ systemInfo }}</pre>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import Common from '../classes/common';
import Constants from '../classes/constants';

export default {
  name: 'About',

  data() {
    return {
      version: Constants.Version,
      systemInfo: null,
      systemInfoDialog: false
    };
  },

  methods: {
    showSystemInfo() {
      this.$emit('mask', 1);
      Common.fetch('system').then(data => {
        this.systemInfoDialog = true;
        this.systemInfo = data;
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', { type: 'e', message: error });
        this.$emit('mask', -1);
      });
    }
  }
};
</script>

<style>

</style>