<template>
  <div>
    <div class="text-h5"><a target="_blank" href="https://sbs20.github.io/scanservjs/">{{ $t('global.application-name') }}</a></div>
    <div class="text-caption">v{{ version }}</div>
    <div class="text-caption mb-4">&copy; 2016 - {{ new Date().getFullYear() }} Sam Strachan</div>
    <div class="text-body-1 mb-4">
      {{ $t('about.main') }}
    </div>

    <div class="text-body-1 mb-4">
      {{ $t('about.issue') }}
      <a target="_blank" href="https://github.com/sbs20/scanservjs">https://github.com/sbs20/scanservjs</a>
    </div>

    <div class="text-body-1 mb-4">
      {{ $t('about.api') }}
      <a target="_blank" href="api-docs">/api-docs</a>
    </div>

    <v-btn @click="showSystemInfo">{{ $t('about.system-info') }}</v-btn>

    <v-dialog v-model="systemInfoDialog" aria-role="dialog" max-width="480" aria-modal @keydown.stop="_onKeys">
      <v-card>
        <v-card-title>
          {{ $t('about.system-info') }}
        </v-card-title>
        <v-card-text>
          <pre class="text-caption text--secondary">{{ systemInfo }}</pre>
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

  emits: ['mask', 'notify'],

  data() {
    return {
      version: Constants.Version,
      systemInfo: null,
      systemInfoDialog: false
    };
  },

  methods: {
    _onKeys(event) {
      if (event.keyCode === Constants.Keys.enter) {
        this.ok();
      }
    },

    showSystemInfo() {
      this.$emit('mask', 1);
      Common.fetch('api/v1/system').then(data => {
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
