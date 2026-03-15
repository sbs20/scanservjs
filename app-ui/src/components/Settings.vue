<template>
  <div>
    <div class="text-h5 mb-4">{{ $t('settings.title') }}</div>

    <!-- UI Behavior Section -->
    <settings-section>
      <template #title>{{ $t('settings.behaviour-ui') }}</template>
      <template #items>
        <settings-item>
          <template #description>{{ $t('settings.theme:description') }}</template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-select v-model="settings.theme" :label="$t('settings.theme')" :items="themes" item-title="text" @update:model-value="reload" />
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template #description>{{ $t('settings.color:description') }}</template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-menu offset-y>
                <template #activator="{ props }">
                  <v-btn v-bind="props">{{ $t('settings.color') }}</v-btn>
                </template>
                <v-list>
                  <v-list-item v-for="item in colors" :key="item.value" :class="`bg-${item.value}`"
                    min-height="36px" :title="item.text" @click="settings.appColor = item.value; reload()" />
                </v-list>
              </v-menu>
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template #description>{{ $t('settings.locale:description') }}</template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-select v-model="settings.locale" :label="$t('settings.locale')" :items="locales" item-title="text" item-value="value" @update:model-value="reload" />
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template #description>{{ $t('settings.show-files-after-scan:description') }}</template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-switch v-model="settings.showFilesAfterScan" />
            </div>
          </template>
        </settings-item>
      </template>
    </settings-section>

    <!-- General Maintenance Section -->
    <settings-section>
      <template #title>{{ $t('settings.devices') }}</template>
      <template #items>
        <settings-item>
          <template #description>{{ $t('settings.reset:description') }}</template>
          <template #action>
            <v-btn color="warning" class="ml-1 mb-1" @click="reset">{{ $t('settings.reset') }} <v-icon class="ml-2" :icon="mdiRefresh" /></v-btn>
          </template>
        </settings-item>
        <settings-item>
          <template #description>{{ $t('settings.clear-storage:description') }}</template>
          <template #action>
            <v-btn color="warning" class="ml-1 mb-1" @click="clearStorage">{{ $t('settings.clear-storage') }} <v-icon class="ml-2" :icon="mdiDelete" /></v-btn>
          </template>
        </settings-item>
      </template>
    </settings-section>

    <!-- PWA Installation Section -->
    <settings-section>
      <template #title>{{ isPwa ? $t('settings.pwa.section-title-installed') : $t('settings.pwa.section-title') }}</template>
      <template #items>
        <settings-item>
          <template #description>
            {{ isPwa ? $t('settings.pwa.description-installed') : $t('settings.pwa.description') }}
          </template>
          <template #action>
            <v-btn color="primary" @click="openPwaDialog">{{ isPwa ? $t('settings.pwa.btn-reconfigure') : $t('settings.pwa.btn-install') }}</v-btn>
          </template>
        </settings-item>
      </template>
    </settings-section>

    <!-- PWA Installation Wizard Dialog -->
    <v-dialog v-model="pwaDialog" max-width="800px" scrollable>
      <v-card>
        <v-card-title class="pa-4 bg-primary text-white d-flex align-center">
          <v-icon :icon="mdiCellphoneArrowDown" class="mr-2" />
          {{ isPwa ? $t('settings.pwa.dialog-title-reconfigure') : $t('settings.pwa.dialog-title') }}
          <v-spacer />
          <v-btn icon :icon="mdiClose" variant="text" @click="pwaDialog = false" />
        </v-card-title>

        <v-card-text class="pa-4">
          <v-alert v-if="isPwa" type="info" variant="tonal" class="mb-4">
            {{ $t('settings.pwa.reinstall-note') }}
          </v-alert>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="pwaConfig.name" :label="$t('settings.pwa.label-name')" placeholder="e.g. My Scanner" :disabled="pwa.lockName" :hint="$t('settings.pwa.hint-name')" persistent-hint />
            </v-col>
            <v-col cols="12" md="6">
              <v-select v-model="pwaConfig.scannerId" :items="devices" item-title="name" item-value="id" :label="$t('settings.pwa.label-scanner')" clearable :disabled="pwa.lockDevice" :hint="$t('settings.pwa.hint-scanner')" persistent-hint />
            </v-col>
          </v-row>

          <div class="mt-4">
            <v-btn variant="text" @click="showAdvanced = !showAdvanced" class="px-0">
              <v-icon :icon="showAdvanced ? mdiChevronUp : mdiChevronDown" class="mr-1" />
              {{ $t('settings.pwa.advanced-title') }}
            </v-btn>

            <v-expand-transition>
              <div v-if="showAdvanced" class="mt-4 border pa-4 rounded">
                <p class="text-body-2 mb-4">{{ $t('settings.pwa.advanced-description') }}</p>

                <div v-for="group in visibleParamGroups" :key="group.key" class="mb-6">
                  <div class="text-subtitle-2 mb-2 text-primary">{{ $t(group.titleKey) }}</div>
                  <v-table density="compact">
                    <thead>
                      <tr>
                        <th class="text-left" style="width: 30%;">{{ $t('settings.pwa.col-parameter') }}</th>
                        <th class="text-left">{{ $t('settings.pwa.col-behavior') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="param in group.params" :key="param">
                        <td>{{ $t(paramLabelKey(param)) }}</td>
                        <td>
                          <v-radio-group v-model="pwaConfig.kiosk[param].mode" inline density="compact" hide-details>
                            <v-radio :label="$t('settings.pwa.mode-persist')" value="persist" density="compact" />
                            <v-radio :label="$t('settings.pwa.mode-default')" value="default" density="compact" />
                            <v-radio :label="$t('settings.pwa.mode-preset')" value="preset" density="compact" />
                          </v-radio-group>
                          <div v-if="pwaConfig.kiosk[param].mode === 'preset'" class="mt-2">
                            <v-select v-if="presetItems(param).length > 0" v-model="pwaConfig.kiosk[param].value" :items="presetItems(param)" item-title="text" item-value="value" density="compact" hide-details flat />
                            <v-text-field v-else v-model="pwaConfig.kiosk[param].value" density="compact" hide-details flat />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </div>
            </v-expand-transition>
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 border-t">
          <v-spacer />
          <v-btn variant="text" @click="pwaDialog = false">{{ $t('batch-dialog.btn-cancel') }}</v-btn>
          <v-btn color="primary" @click="savePwaConfig">
            {{ isPwa ? $t('settings.pwa.btn-save-pending') : $t('settings.pwa.btn-apply') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import {
  mdiDelete, mdiRefresh, mdiClose, mdiChevronDown, mdiChevronUp,
  mdiCellphoneArrowDown
} from '@mdi/js';
import { useI18n } from 'vue-i18n';
import Common from '../classes/common';
import Constants from '../classes/constants';
import Storage from '../classes/storage';

import SettingsSection from './SettingsSection.vue';
import SettingsItem from './SettingsItem.vue';

const storage = Storage.instance();

function sanitiseLocaleKey(s) {
  return s.toLowerCase().replace(/\[/g, '(').replace(/\]/g, ')');
}

export default {
  name: 'Settings',

  components: {
    SettingsSection,
    SettingsItem
  },

  emits: ['mask', 'notify'],

  setup() {
    const { te } = useI18n();
    return {
      mdiDelete,
      mdiRefresh,
      mdiClose,
      mdiChevronDown,
      mdiChevronUp,
      mdiCellphoneArrowDown,
      te
    };
  },

  data() {
    return {
      settings: storage.settings,
      pwaDialog: false,
      pwaConfig: {},
      devices: [],
      context: {},
      pwa: {},
      showAdvanced: false,
      paramGroups: [
        { key: 'scan-area',     titleKey: 'settings.pwa.group-scan-area',     params: ['paperSize'] },
        { key: 'image-quality', titleKey: 'settings.pwa.group-image-quality',  params: ['resolution', 'mode', 'brightness', 'contrast'] },
        { key: 'source',        titleKey: 'settings.pwa.group-source',         params: ['source', 'batchMode'] },
        { key: 'output',        titleKey: 'settings.pwa.group-output',         params: ['pipeline'] }
      ]
    };
  },

  computed: {
    isPwa() {
      return window.matchMedia('(display-mode: standalone)').matches;
    },

    colors() {
      return Constants.Colors.map(c => ({ text: this.$t(`colors.${c}`), value: c }));
    },

    locales() {
      return Constants.Locales.map(l => ({ text: this.$t(`locales.${l}`), value: l }));
    },

    themes() {
      return Object.keys(Constants.Themes).map(t => ({
        text: this.$t(`settings.theme:${Constants.Themes[t]}`),
        value: Constants.Themes[t]
      }));
    },

    // The device object matching the scanner chosen in the PWA config dialog.
    selectedDevice() {
      if (!this.pwaConfig || !this.pwaConfig.scannerId) return null;
      return this.devices.find(d => d.id === this.pwaConfig.scannerId) || null;
    },

    // A human-readable name to pre-populate the app name field.
    suggestedAppName() {
      const dev = this.devices[0];
      if (dev && dev.name && dev.name !== 'No data available') {
        return dev.name;
      }
      return this.$t('settings.pwa.default-name');
    },

    // paramGroups filtered to only the params the selected device actually supports.
    // When no device is selected, all params are shown.
    visibleParamGroups() {
      const dev = this.selectedDevice;
      const hasFeature = (f) => !dev || f in dev.features;
      const hasGeometry = !dev || ['-x', '-y', '-l', '-t'].every(f => f in dev.features);
      return this.paramGroups
        .map(group => ({
          ...group,
          params: group.params.filter(param => {
            switch (param) {
              case 'paperSize':  return hasGeometry;
              case 'mode':       return hasFeature('--mode');
              case 'brightness': return hasFeature('--brightness');
              case 'contrast':   return hasFeature('--contrast');
              case 'source':     return hasFeature('--source');
              default:           return true;
            }
          })
        }))
        .filter(group => group.params.length > 0);
    }
  },

  watch: {
    settings: {
      handler(settings) {
        storage.settings = settings;
      },
      deep: true
    }
  },

  mounted() {
    Common.fetch('api/v1/context').then(context => {
      this.context = context;
      this.devices = context.devices || [];
      this.pwa = context.pwa || {};
      this.initPwaConfig();
    });
  },

  methods: {
    initPwaConfig() {
      const saved = storage.pwaConfig;
      const config = {
        name: saved.name || this.pwa.name || this.suggestedAppName,
        scannerId: saved.scannerId !== undefined ? saved.scannerId : (this.devices[0] ? this.devices[0].id : null),
        kiosk: (saved.kiosk && typeof saved.kiosk === 'object') ? saved.kiosk : {}
      };

      // Ensure all parameters have an entry (including ones not visible for the
      // current device, so values are preserved if the user switches scanners).
      this.paramGroups.forEach(group => {
        group.params.forEach(param => {
          if (!config.kiosk[param]) {
            config.kiosk[param] = { mode: 'persist', value: '' };
          }
        });
      });

      this.pwaConfig = config;
    },

    openPwaDialog() {
      this.initPwaConfig();
      this.pwaDialog = true;
    },

    clearStorage() {
      storage.request = null;
      this.$emit('notify', { type: 'i', message: this.$t('settings.clear-storage:notification') });
    },

    reload() {
      // Preserve existing URL parameters (e.g. PWA deviceId/kiosk launch params).
      const url = new URL(window.location);
      url.searchParams.set('anticache', Date.now());
      location.replace(url.pathname + url.search + url.hash);
    },

    reset() {
      this.$emit('mask', 1);
      Common.fetch('api/v1/context', { method: 'DELETE' }).then(() => {
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', { type: 'e', message: error });
        this.$emit('mask', -1);
      });
    },

    paramLabelKey(param) {
      const map = {
        paperSize: 'settings.pwa.param-paper-size',
        resolution: 'settings.pwa.param-resolution',
        mode: 'settings.pwa.param-mode',
        brightness: 'settings.pwa.param-brightness',
        contrast: 'settings.pwa.param-contrast',
        source: 'settings.pwa.param-source',
        batchMode: 'settings.pwa.param-batch-mode',
        pipeline: 'settings.pwa.param-pipeline'
      };
      return map[param] || param;
    },

    // Resolve @:key references in a string (used for paper size and pipeline names).
    resolveName(name) {
      return (name.match(/@:[a-z-.]+/ig) || []).reduce((n, ref) => {
        return n.replaceAll(ref, this.$t(ref.substr(2)));
      }, name);
    },

    // Returns select items for the preset value dropdown of the given param,
    // or an empty array when a free-text field should be shown instead.
    presetItems(param) {
      const dev = this.selectedDevice;
      switch (param) {
        case 'paperSize': {
          let sizes = this.context.paperSizes || [];
          if (dev && ['-x', '-y'].every(f => f in dev.features)) {
            sizes = sizes.filter(p =>
              p.dimensions.x <= dev.features['-x'].limits[1] &&
              p.dimensions.y <= dev.features['-y'].limits[1]
            );
          }
          return sizes.map(p => ({ text: this.resolveName(p.name), value: p.name }));
        }
        case 'resolution': {
          const opts = dev && dev.features['--resolution'] ? dev.features['--resolution'].options : [];
          return opts.map(r => ({ text: String(r), value: r }));
        }
        case 'mode': {
          // Fall back to a sensible generic set when no device is selected.
          const opts = dev && dev.features['--mode']
            ? dev.features['--mode'].options
            : ['Color', 'Gray', 'Lineart'];
          return opts.map(m => {
            const key = `mode.${sanitiseLocaleKey(m)}`;
            return { text: this.te(key) ? this.$t(key) : m, value: m };
          });
        }
        case 'source': {
          const opts = dev && dev.features['--source'] ? dev.features['--source'].options : [];
          return opts.map(s => {
            const key = `source.${sanitiseLocaleKey(s)}`;
            return { text: this.te(key) ? this.$t(key) : s, value: s };
          });
        }
        case 'pipeline': {
          const opts = dev && dev.settings && dev.settings.pipeline
            ? dev.settings.pipeline.options : [];
          return opts.map(p => ({ text: this.resolveName(p), value: p }));
        }
        case 'batchMode': {
          const opts = dev && dev.settings && dev.settings.batchMode
            ? dev.settings.batchMode.options : [];
          return opts.map(m => {
            const key = `batch-mode.${sanitiseLocaleKey(m)}`;
            return { text: this.te(key) ? this.$t(key) : m, value: m };
          });
        }
        default:
          return [];
      }
    },

    savePwaConfig() {
      storage.pwaConfig = this.pwaConfig;
      this.pwaDialog = false;
      this.$emit('notify', { type: 'i', message: this.isPwa ? this.$t('settings.pwa.saved-reinstall') : this.$t('settings.pwa.saved') });
      this.reload();
    }
  }
};
</script>

<style scoped>
.border { border: 1px solid rgba(0,0,0,0.12); }
.border-t { border-top: 1px solid rgba(0,0,0,0.12); }
</style>
