<template>
  <v-app>
    <toastr ref="toastr"></toastr>

    <transition name="fade">
      <div v-if="maskRef" id="mask">
        <div style="position: absolute; top: 49%; left: 49%">
          <v-progress-circular indeterminate color="primary" />
        </div>
      </div>
    </transition>

    <navigation :appColor="appColor"></navigation>

    <v-main>
      <v-container fluid>
        <transition name="fade" mode="out-in" :duration="150">
          <router-view @mask="mask" @notify="notify"></router-view>
        </transition>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import Toastr from 'vue-toastr';

import Constants from './classes/constants';
import Storage from './classes/storage';
import Navigation from './components/Navigation';

const storage = Storage.instance();

export default {
  name: 'App',
  components: {
    Navigation,
    Toastr
  },

  data() {
    return {
      maskRef: 0,
      appColor: storage.settings.appColor
    };
  },

  mounted() {
    let theme = storage.settings.theme;
    if (theme === Constants.Themes.System) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? Constants.Themes.Dark
        : Constants.Themes.Light;
    }
    this.$vuetify.theme.dark = theme === Constants.Themes.Dark;

    this.$i18n.locale = storage.settings.locale;

    // Default route if connected
    if (this.$route.matched.length === 0) {
      this.$router.replace('/scan');
    }
  },

  methods: {
    mask(add) {
      this.maskRef += add;
    },

    notify(notification) {
      const types = {
        's': 'success',
        'i': 'info',
        'e': 'error'
      };

      const timeout = notification.type === 'e' ? 10000 : 2000;
      this.$refs.toastr.Add({
        type: types[notification.type],
        position: 'toast-bottom-right',
        msg: notification.message,
        timeout: timeout,
        progressbar: false
      });
    }
  }
};
</script>

<style>

input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}

input[type=number] {
  -moz-appearance:textfield; /* Firefox */
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

#mask {
  position: fixed;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,.4);
  top: 0;
  left: 0;
  z-index: 10;
}
</style>