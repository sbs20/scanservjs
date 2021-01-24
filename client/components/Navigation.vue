<template>
  <div>
    <v-app-bar color="accent-4 elevation-0" app>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title class="unselectable">scanservjs</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items class="d-none d-md-block">
        <v-btn @click="$router.push('/scan')"><v-icon class="mr-2">mdi-camera</v-icon>Scan</v-btn>
        <v-btn @click="$router.push('/files')"><v-icon class="mr-2">mdi-file-document-multiple</v-icon>Files</v-btn>
        <v-btn @click="$router.push('/settings')"><v-icon class="mr-2">mdi-cog</v-icon>Settings</v-btn>
        <v-btn @click="$router.push('/about')"><v-icon class="mr-2">mdi-information</v-icon>About</v-btn>
      </v-toolbar-items>
    </v-app-bar>

    <v-navigation-drawer class="elevation-0" v-model="drawer" app temporary>
      <v-app-bar color="accent-4 elevation-0">
        <v-toolbar-title class="unselectable">scanservjs</v-toolbar-title>
      </v-app-bar>

      <v-list nav>
        <v-list-item @click="$router.push('/scan')">
          <v-list-item-icon><v-icon>mdi-camera</v-icon></v-list-item-icon>
          <v-list-item-title>Scan</v-list-item-title>
        </v-list-item>
    
        <v-list-item @click="$router.push('/files')">
          <v-list-item-icon><v-icon>mdi-file-document-multiple</v-icon></v-list-item-icon>
          <v-list-item-title>Files</v-list-item-title>
        </v-list-item>

        <v-list-item @click="$router.push('/settings')">
          <v-list-item-icon><v-icon>mdi-cog</v-icon></v-list-item-icon>
          <v-list-item-title>Settings</v-list-item-title>
        </v-list-item>

        <v-list-item @click="$router.push('/about')">
          <v-list-item-icon><v-icon>mdi-information</v-icon></v-list-item-icon>
          <v-list-item-title>About</v-list-item-title>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-icon><v-icon>mdi-tools</v-icon></v-list-item-icon>
          <v-list-item-title class="unselectable">Version {{version}}</v-list-item-title>
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
export default {
  name: 'Navigation',

  data() {
    return {
      drawer: false,
      version: process.env.VUE_APP_VERSION
    };
  },
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