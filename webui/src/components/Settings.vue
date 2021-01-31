<template>
  <div>
    <div class="text-h2 mb-4">Settings</div>
    <settings-section>
      <template v-slot:title>Behaviour and UI</template>
      <template v-slot:items>
        <settings-item>
          <template v-slot:description>
            Theme. If you use system theme and change it, you will need to reload the app.
          </template>
          <template v-slot:action>
            <div style="max-width: 9rem;">
              <v-select label="Theme" :items="themes" v-model="settings.theme" @change="reload"></v-select>
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
    const x = storage.settings;
    console.log(x);
    return {
      settings: storage.settings,
      themes: [
        {
          text: 'System',
          value: Constants.Themes.System
        },
        {
          text: 'Light',
          value: Constants.Themes.Light
        },
        {
          text: 'Dark',
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