import { defineConfig } from "vite";
import vue from '@vitejs/plugin-vue'
import path from "path";
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import packageJson from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api-docs': 'http://localhost:8080',
      '/context': 'http://localhost:8080',
      '/files': 'http://localhost:8080',
      '/preview': 'http://localhost:8080',
      '/scan': 'http://localhost:8080',
      '/system': 'http://localhost:8080',
    }
  },
  plugins: [
    vue(),
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
