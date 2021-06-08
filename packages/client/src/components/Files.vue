<template>
  <v-simple-table>
    <thead>
      <tr>
        <th><v-checkbox @change="selectToggle" /></th>
        <th>{{ $t('files.filename') }}</th>
        <th class="file-date">{{ $t('files.date') }}</th>
        <th>{{ $t('files.size') }}</th>
        <th><v-btn v-if="selectedFiles.length > 0" color="red" v-on:click="multipleDelete()" icon><v-icon>mdi-delete</v-icon></v-btn></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="file in files" v-bind:key="file.name">
        <td><v-checkbox v-model="selectedFiles" :value="file.name" /></td>
        <td><a @click="open(file)">{{ file.name }}</a></td>
        <td class="file-date">{{ $d(new Date(file.lastModified), 'long', $i18n.locale) }}</td>
        <td>{{ file.sizeString }}</td>
        <td><v-btn color="secondary" v-on:click="fileRemove(file)" icon><v-icon>mdi-delete</v-icon></v-btn></td>
      </tr>
    </tbody>
  </v-simple-table> 
</template>

<script>
import Common from '../classes/common';

export default {
  name: 'Files',

  mounted() {
    this.fileList();
  },

  data() {
    return {
      files: [],
      selectedFiles: []
    };
  },

  methods: {
    fileList() {
      this.$emit('mask', 1);
      Common.fetch('files').then(files => {
        this.files = files;
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', { type: 'e', message: error });
        this.$emit('mask', -1);
      });
    },

    fileRemove(file) {
      this.$emit('mask', 1);
      Common.fetch(`files/${file.name}`, {
        method: 'DELETE'
      }).then(data => {
        this.$emit('notify', { type: 'i', message: `${this.$t('files.message:deleted')} ${data.name}` });
        this.fileList();
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', { type: 'e', message: error });
        this.$emit('mask', -1);
      });
    },

    async multipleDelete() {
      let refresh = false;
      while (this.selectedFiles.length > 0) {
        refresh = true;
        const name = this.selectedFiles[0];
        try {
          await Common.fetch(`files/${name}`, { method: 'DELETE' });
          this.$emit('notify', { type: 'i', message: `${this.$t('files.message:deleted')} ${name}` });
        } catch (error) {
          this.$emit('notify', { type: 'e', message: error });
        }
        this.selectedFiles.splice(0, 1);
      }

      if (refresh) {
        this.fileList();
      }
    },

    open(file) {
      window.location.href = `files/${file.name}`;
    },

    selectToggle(value) {
      this.selectedFiles = value ? this.files.map(f => f.name) : [];
    }
  }
};
</script>

<style>

</style>