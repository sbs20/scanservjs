<template>
  <div>
    <div class="text-h5 mb-4">{{ $t('settings.title') }}</div>
    <settings-section>
      <template #title>{{ $t('settings.behaviour-ui') }}</template>
      <template #items>
        <settings-item>
          <template #description>
            {{ $t('settings.theme:description') }}
          </template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-select v-model="settings.theme" :label="$t('settings.theme')" :items="themes" item-title="text" @update:model-value="reload" />
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template #description>
            {{ $t('settings.color:description') }}
          </template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-menu offset-y>
                <template #activator="{ props }">
                  <v-btn v-bind="props">{{ $t('settings.color') }}</v-btn>
                </template>
                <v-list>
                  <v-list-item v-for="item in colors" :key="item.value" :class="`bg-${item.value}`"
                    min-height="36px"
                    :title="item.text"
                    @click="settings.appColor = item.value; reload()" />
                </v-list>
              </v-menu>
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template #description>
            {{ $t('settings.locale:description') }}
          </template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-select v-model="settings.locale" :label="$t('settings.locale')"
                :items="locales" item-title="text"
                item-value="value" @update:model-value="reload" />
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template #description>
            {{ $t('settings.show-files-after-scan:description') }}
          </template>
          <template #action>
            <div style="max-width: 10rem;">
              <v-switch v-model="settings.showFilesAfterScan" />
            </div>
          </template>
        </settings-item>
      </template>
    </settings-section>

    <settings-section>
      <template #title>{{ $t('settings.devices') }}</template>
      <template #items>
        <settings-item>
          <template #description>
            {{ $t('settings.reset:description') }}
          </template>
          <template #action>
            <v-btn color="warning" class="ml-1 mb-1" @click="reset">{{ $t('settings.reset') }} <v-icon class="ml-2" :icon="mdiRefresh" /></v-btn>
          </template>
        </settings-item>

        <settings-item>
          <template #description>
            {{ $t('settings.clear-storage:description') }}
          </template>
          <template #action>
            <v-btn color="warning" class="ml-1 mb-1" @click="reset">{{ $t('settings.clear-storage') }} <v-icon class="ml-2" :icon="mdiDelete" /></v-btn>
          </template>
        </settings-item>
      </template>
    </settings-section>
  </div>
</template>

<script>
import { mdiDelete, mdiRefresh } from '@mdi/js';
import Common from '../classes/common';
import Constants from '../classes/constants';
import Storage from '../classes/storage';

import SettingsSection from './SettingsSection.vue';
import SettingsItem from './SettingsItem.vue';

const storage = Storage.instance();

export default {
  name: 'Settings',

  components: {
    SettingsSection,
    SettingsItem
  },

  emits: ['mask', 'notify'],

  setup() {
    return {
      mdiDelete,
      mdiRefresh,
    };
  },

  data() {
    return {
      settings: storage.settings
    };
  },

  computed: {
    colors() {
      return Constants.Colors.map(c => {
        return {
          text: this.$t(`colors.${c}`),
          value: c
        };
      });
    },

    locales() {
      return Constants.Locales.map(l => {
        return {
          text: this.$t(`locales.${l}`),
          value: l
        };
      });
    },

    themes() {
      return Object.keys(Constants.Themes).map(t => {
        return {
          text: this.$t(`settings.theme:${Constants.Themes[t]}`),
          value: Constants.Themes[t]
        };
      });
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

  methods: {
    clearStorage() {
      storage.request = null;
    },

    reload() {
      location.href = `?anticache=${Date.now()}${location.hash}`;
    },

    reset() {
      this.$emit('mask', 1);
      Common.fetch('api/v1/context', {
        method: 'DELETE'
      }).then(() => {
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
