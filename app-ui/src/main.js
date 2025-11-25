import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createI18n, useI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n';
import messages from '@intlify/unplugin-vue-i18n/messages';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import '@/styles/main.scss';
import { VueToastr } from 'vue-toastr';
import 'vue-toastr/dist/style.css';

import Constants from './classes/constants';
import App from './App.vue';
import Files from './components/Files.vue';
import Scan from './components/Scan.vue';
import Settings from './components/Settings.vue';
import About from './components/About.vue';

const datetimeFormats = {};
for (const locale of Constants.Locales) {
  datetimeFormats[locale] = Constants.DateTimeFormat;
}

const i18n = createI18n({
  legacy: false,
  datetimeFormats,
  locale: import.meta.env.VITE_APP_I18N_LOCALE,
  fallbackLocale: import.meta.env.VITE_APP_I18N_FALLBACK_LOCALE,
  messages: messages,
  missingWarn: false,
  fallbackWarn: false
});

const vuetify = createVuetify({
  defaults: {
    VBtn: {
      variant: 'tonal',
    },
    VSelect: {
      variant: 'plain',
    },
    VTextField: {
      variant: 'plain',
    }
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    }
  },
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n })
  },
  theme: {
    themes: {
      light: {
        colors: {
          primary: 'rgb(25, 118, 210)',
          secondary: 'rgb(66, 66, 66)'
        }
      },
      dark: {
        colors: {
          primary: 'rgb(25, 118, 210)',
          secondary: 'rgb(66, 66, 66)'
        }
      }
    }
  }
});

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/about', component: About },
    { path: '/files', component: Files },
    { path: '/settings', component: Settings },
    { path: '/scan', component: Scan },
    { path: '/', redirect: '/scan' }
  ]
});

createApp(App)
  .use(vuetify)
  .use(router)
  .use(i18n)
  .use(VueToastr)
  .mount('#app');
