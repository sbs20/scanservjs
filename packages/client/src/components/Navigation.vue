<template>
  <div>
    <v-app-bar class="elevation-0" :color="appColor" app>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title class="unselectable">{{ $t('global.application-name') }}</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items class="d-none d-md-block">
        <v-btn class="transparent" elevation="0" @click="go('/scan')"><v-icon class="mr-2">mdi-camera</v-icon>{{ $t('navigation.scan') }}</v-btn>
        <v-btn class="transparent" elevation="0" @click="go('/files')"><v-icon class="mr-2">mdi-file-document-multiple</v-icon>{{ $t('navigation.files') }}</v-btn>
        <v-btn class="transparent" elevation="0" @click="go('/settings')"><v-icon class="mr-2">mdi-cog</v-icon>{{ $t('navigation.settings') }}</v-btn>
        <v-btn class="transparent" elevation="0" @click="go('/about')"><v-icon class="mr-2">mdi-information</v-icon>{{ $t('navigation.about') }}</v-btn>
      </v-toolbar-items>
    </v-app-bar>

    <v-navigation-drawer class="elevation-0" v-model="drawer" app temporary>
      <v-app-bar :color="appColor" class="elevation-0">
        <v-toolbar-title class="unselectable">{{ $t('global.application-name') }}</v-toolbar-title>
      </v-app-bar>

      <v-list nav>
        <v-list-item @click="go('/scan')">
          <v-list-item-icon><v-icon>mdi-camera</v-icon></v-list-item-icon>
          <v-list-item-title>{{ $t('navigation.scan') }}</v-list-item-title>
        </v-list-item>

        <v-list-item @click="go('/files')">
          <v-list-item-icon><v-icon>mdi-file-document-multiple</v-icon></v-list-item-icon>
          <v-list-item-title>{{ $t('navigation.files') }}</v-list-item-title>
        </v-list-item>

        <v-list-item @click="go('/settings')">
          <v-list-item-icon><v-icon>mdi-cog</v-icon></v-list-item-icon>
          <v-list-item-title>{{ $t('navigation.settings') }}</v-list-item-title>
        </v-list-item>

        <v-list-item @click="go('/about')">
          <v-list-item-icon><v-icon>mdi-information</v-icon></v-list-item-icon>
          <v-list-item-title>{{ $t('navigation.about') }}</v-list-item-title>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-icon><v-icon>mdi-tools</v-icon></v-list-item-icon>
          <v-list-item-title class="unselectable">{{ $t('navigation.version') }} {{version}}</v-list-item-title>
        </v-list-item>
      </v-list>

      <template v-slot:append>
        <div class="d-flex flex-row pa-4 text-caption">
          <div class="ml-auto">
            &copy; 2016 - {{ new Date().getFullYear() }} Sam Strachan
          </div>
        </div>
      </template>

    </v-navigation-drawer>
  </div>
</template>

<script>
import Constants from '../classes/constants';

export default {
  name: 'Navigation',

  props: {
    appColor: {
      type: String,
      default: 'accent-4'
    }
  },

  data() {
    return {
      drawer: false,
      version: Constants.Version
    };
  },

  methods: {
    go(location) {
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
