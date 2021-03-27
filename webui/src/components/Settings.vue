<template>
  <div>
    <div class="text-h2 mb-4">{{ $t('settings.title') }}</div>
    <settings-section>
      <template v-slot:title>{{ $t('settings.behaviour-ui') }}</template>
      <template v-slot:items>
        <settings-item>
          <template v-slot:description>
            {{ $t('settings.theme:description') }}
          </template>
          <template v-slot:action>
            <div style="max-width: 9rem;">
              <v-select :label="$t('settings.theme')" :items="themes" v-model="settings.theme" @change="reload"></v-select>
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template v-slot:description>
            {{ $t('settings.locale:description') }}
          </template>
          <template v-slot:action>
            <div style="max-width: 9rem;">
              <v-select :label="$t('settings.locale')" :items="locales" v-model="settings.locale" @change="reload"></v-select>
            </div>
          </template>
        </settings-item>

      </template>
    </settings-section>
  </div>
</template>

<script>
import Constants from '../classes/constants';
import Storage from '../classes/storage';

import SettingsSection from './SettingsSection';
import SettingsItem from './SettingsItem';

const storage = Storage.instance();

export default {
  name: 'Settings',
  components: {
    SettingsSection,
    SettingsItem
  },

  data() {
    return {
      settings: storage.settings,
      locales: Constants.Locales,
      themes: [
        {
          text: this.$t('settings.theme:system'),
          value: Constants.Themes.System
        },
        {
          text: this.$t('settings.theme:light'),
          value: Constants.Themes.Light
        },
        {
          text: this.$t('settings.theme:dark'),
          value: Constants.Themes.Dark
        }
      ]
    };
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
    reload() {
      location.href = `/?anticache=${Date.now()}${location.hash}`;
    }
  }
};
</script>

<style>

</style>