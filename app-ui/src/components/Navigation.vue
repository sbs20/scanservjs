<template>
  <div>
    <v-app-bar class="elevation-0" :color="appColor" app>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title class="unselectable">{{ appTitle }}</v-toolbar-title>
      <v-spacer />
      <v-toolbar-items class="d-none d-md-block">
        <v-btn class="transparent" elevation="0" @click="go('/scan')"><v-icon class="mr-2" :icon="mdiCamera" />{{ $t('navigation.scan') }}</v-btn>
        <v-btn class="transparent" elevation="0" @click="go('/files')"><v-icon class="mr-2" :icon="mdiFileDocumentMultiple" />{{ $t('navigation.files') }}</v-btn>
        <v-btn class="transparent" elevation="0" @click="go('/settings')"><v-icon class="mr-2" :icon="mdiCog" />{{ $t('navigation.settings') }}</v-btn>
        <v-btn class="transparent" elevation="0" @click="go('/about')"><v-icon class="mr-2" :icon="mdiInformation" />{{ $t('navigation.about') }}</v-btn>
      </v-toolbar-items>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" class="elevation-0" app temporary>
      <v-list nav>
        <v-list-item :title="$t('navigation.scan')" @click="go('/scan')">
          <template #prepend>
            <v-icon :icon="mdiCamera" />
          </template>
        </v-list-item>

        <v-list-item :title="$t('navigation.files')" @click="go('/files')">
          <template #prepend>
            <v-icon :icon="mdiFileDocumentMultiple" />
          </template>
        </v-list-item>

        <v-list-item :title="$t('navigation.settings')" @click="go('/settings')">
          <template #prepend>
            <v-icon :icon="mdiCog" />
          </template>
        </v-list-item>

        <v-list-item :title="$t('navigation.about')" @click="go('/about')">
          <template #prepend>
            <v-icon :icon="mdiInformation" />
          </template>
        </v-list-item>

        <v-divider />

        <v-list-item>
          <v-list-item-title class="unselectable">{{ $t('navigation.version') }} {{ version }}</v-list-item-title>
          <template #prepend>
            <v-icon :icon="mdiTools" />
          </template>
        </v-list-item>
      </v-list>

      <template #append>
        <div class="d-flex flex-column pa-4 text-caption align-end">
          <div>&copy; 2016 - {{ new Date().getFullYear() }} Sam Strachan</div>
          <div>Community Fork</div>
        </div>
      </template>
    </v-navigation-drawer>
  </div>
</template>

<script>
import { mdiCamera, mdiCog, mdiFileDocumentMultiple, mdiInformation, mdiTools } from '@mdi/js';
import Common from '../classes/common';
import Constants from '../classes/constants';
import Storage from '../classes/storage';
const storage = Storage.instance();
export default {
  name: 'Navigation',

  props: {
    appColor: {
      type: String,
      default: 'accent-4'
    }
  },

  setup() {
    return {
      mdiCamera,
      mdiCog,
      mdiFileDocumentMultiple,
      mdiInformation,
      mdiTools
    };
  },

  data() {
    return {
      drawer: false,
      version: Constants.Version,
      context: {}
    };
  },

  computed: {
    appTitle() {
      const configured = storage.pwaConfig.name;
      return configured || this.$t('global.application-name');
    }
  },

  mounted() {
    Common.fetch('api/v1/context').then(context => {
      this.context = context;
    });
  },

  methods: {
    go(location) {
      if (this.$route.path === location && location === '/scan') {
        const config = this.context.scanOnTabClick;
        let trigger = false;
        
        if (config === Constants.ScanOnTabClick.Always) {
          trigger = true;
        } else if (config === Constants.ScanOnTabClick.User) {
          trigger = storage.settings.scanOnTabClick;
        }
        
        if (trigger) {
          window.dispatchEvent(new CustomEvent('scan-trigger'));
        }
      }
      if (this.$route.path !== location) {
        this.$router.push(location);
      }
    }
  }
};
</script>

<style>
.unselectable {
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>
