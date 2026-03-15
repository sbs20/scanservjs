<template>
  <div>
    <div class="text-h5"><a target="_blank" href="https://sbs20.github.io/scanservjs/">{{ $t('global.application-name') }}</a></div>
    <div class="text-caption">v{{ version }} (Community Fork)</div>
    <div class="text-caption mb-4">&copy; 2016 - {{ new Date().getFullYear() }} Sam Strachan</div>
    <div class="text-body-1 mb-4">
      {{ $t('about.main') }}
    </div>

    <div class="text-body-1 mb-4">
      {{ $t('about.fork') }}
    </div>

    <div class="text-body-1 mb-4">
      {{ $t('about.fork-upstream') }}
      <a target="_blank" href="https://github.com/sbs20/scanservjs">sbs20/scanservjs</a>
    </div>

    <div class="text-body-1 mb-4">
      {{ $t('about.fork-issue') }}
      <a target="_blank" href="https://github.com/gutschke/scanservjs">gutschke/scanservjs</a>
    </div>

    <div class="text-body-1 mb-4">
      {{ $t('about.api') }}
      <a target="_blank" href="api-docs">/api-docs</a>
    </div>

    <v-btn class="mr-2" @click="showSystemInfo">{{ $t('about.system-info') }}</v-btn>
    <v-btn @click="showLogs">{{ $t('about.logs') }}</v-btn>

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

    <v-dialog v-model="logsDialog" max-width="720" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          {{ $t('about.logs') }}
          <v-spacer />
          <v-btn variant="text" size="small" @click="copyLogs">
            {{ $t('about.logs-copy') }}
          </v-btn>
          <v-btn variant="text" size="small" @click="refreshLogs">
            {{ $t('about.logs-refresh') }}
          </v-btn>
        </v-card-title>
        <v-card-text style="max-height: 60vh;">
          <pre v-if="logEntries.length" class="text-caption log-entries">{{ formattedLogs }}</pre>
          <div v-else class="text-body-2 text--secondary">{{ $t('about.logs-empty') }}</div>
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
      systemInfoDialog: false,
      logsDialog: false,
      logEntries: []
    };
  },

  computed: {
    formattedLogs() {
      return this.logEntries.map(e => {
        const ts = e.timestamp.replace('T', ' ').replace(/\.\d+Z$/, '');
        const lvl = e.level.toUpperCase().padEnd(5);
        const src = e.logger ? `[${e.logger}]` : '';
        return `${ts} ${lvl} ${src} ${e.message}`;
      }).join('\n');
    }
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
    },

    showLogs() {
      this.refreshLogs();
      this.logsDialog = true;
    },

    refreshLogs() {
      Common.fetch('api/v1/logs').then(entries => {
        this.logEntries = entries;
      }).catch(error => {
        this.$emit('notify', { type: 'e', message: error });
      });
    },

    copyLogs() {
      navigator.clipboard.writeText(this.formattedLogs).then(() => {
        this.$emit('notify', { type: 'i', message: this.$t('about.logs-copied') });
      });
    }
  }
};
</script>

<style scoped>
.log-entries {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
}
</style>
