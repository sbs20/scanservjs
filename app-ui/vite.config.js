import { defineConfig } from "vite";
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import path from "path";
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import packageJson from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/api-docs': 'http://localhost:8080',
    }
  },
  plugins: [
    vue(),
    vuetify(),
    VueI18nPlugin({
      include: [path.resolve(__dirname, './src/locales/**')],
      compositionOnly: false
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true
      },
    }
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version)
  },
});
