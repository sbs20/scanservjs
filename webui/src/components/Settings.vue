<template>
  <div>
    <div class="text-h5 mb-4">{{ $t('settings.title') }}</div>
    <settings-section>
      <template v-slot:title>{{ $t('settings.behaviour-ui') }}</template>
      <template v-slot:items>
        <settings-item>
          <template v-slot:description>
            {{ $t('settings.theme:description') }}
          </template>
          <template v-slot:action>
            <div style="max-width: 10rem;">
              <v-select :label="$t('settings.theme')" :items="themes" v-model="settings.theme" @change="reload"></v-select>
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template v-slot:description>
            {{ $t('settings.color:description') }}
          </template>
          <template v-slot:action>
            <div style="max-width: 10rem;">
              <v-menu offset-y>
                <template v-slot:activator="{ on, attrs }">
                  <v-btn v-bind="attrs" v-on="on">{{ $t('settings.color') }}</v-btn>
                </template>
                <v-list>
                  <v-list-item v-for="item in colors" :key="item.value"
                    style="min-height: 36px;"
                    @click="settings.appColor = item.value; reload()">
                    <v-list-item-content class="pl-2 pt-1 pb-1 pr-2" :class="item.value">
                      {{ item.text }}
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </template>
        </settings-item>
        <settings-item>
          <template v-slot:description>
            {{ $t('settings.locale:description') }}
          </template>
          <template v-slot:action>
            <div style="max-width: 10rem;">
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
      locales: Constants.Locales
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
    reload() {
      location.href = `/?anticache=${Date.now()}${location.hash}`;
    }
  }
};
</script>

<style>

</style>