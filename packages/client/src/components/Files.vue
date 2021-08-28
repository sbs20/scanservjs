<template>
  <v-data-table
      :headers="headers"
      :items="files"
      v-model="selectedFiles"
      item-key="name"
      :footer-props="{
        'items-per-page-text': $t('files.items-per-page'),
        'items-per-page-all-text': $t('files.items-per-page-all')
      }"
      show-select>
    <template v-slot:top>
      <v-toolbar flat>
      <v-spacer></v-spacer>
      <v-btn @click="multipleDelete" color="primary">{{ $t('files.button:delete-selected') }}</v-btn>
      <v-dialog v-model="dialogEdit" max-width="500px">
        <v-card>
          <v-card-title class="text-h5">{{ $t('files.dialog:rename') }}</v-card-title>
          <v-card-text>
            <v-container>
              <v-text-field v-model="editedItem.newName" :label="$t('files.filename')">
              </v-text-field>
            </v-container>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn small @click="closeRename">
              {{ $t('files.dialog:rename-cancel') }}
            </v-btn>
            <v-btn small @click="renameFileConfirm" color="primary">
              {{ $t('files.dialog:rename-save') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      </v-toolbar>
    </template>
    <template v-slot:[`item.lastModified`]="{ item }">
      {{ $d(new Date(item.lastModified), 'long', $i18n.locale) }}
    </template>
    <template v-slot:[`item.actions`]="{ item }">
      <v-icon @click="open(item)" class="mr-2">
        mdi-download
      </v-icon>
      <v-icon @click="fileRename(item)" class="mr-2">
        mdi-pencil
      </v-icon>
      <v-icon @click="fileRemove(item)" class="mr-2">
        mdi-delete
      </v-icon>
    </template>
    <template v-slot:[`footer.page-text`]="items">
      {{ items.pageStart }} - {{ items.pageStop }} / {{ items.itemsLength }}
    </template>
  </v-data-table>
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
      dialogDelete: false,
      dialogEdit: false,
      headers: [
        {
          text: this.$t('files.filename'),
          align: 'start',
          sortable: true,
          value: 'name',
        }, {
          text: this.$t('files.date'),
          align: 'start',
          sortable: true,
          value: 'lastModified',
        }, {
          text: this.$t('files.size'),
          align: 'start',
          sortable: true,
          value: 'sizeString',
        },
        {text: this.$t('files.actions'), value: 'actions', sortable: false},
      ],
      files: [],
      editedItem: {
        name: '',
        newName: ''
      },
      defaultItem: {
        name: '',
        newName: ''
      },
      selectedFiles: []
    };
  },

  watch: {
    dialogEdit(val) {
      val || this.closeRename();
    },
  },

  methods: {
    fileList() {
      this.$emit('mask', 1);
      Common.fetch('files').then(files => {
        this.files = files;
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', {type: 'e', message: error});
        this.$emit('mask', -1);
      });
    },

    fileRemove(file) {
      this.$emit('mask', 1);
      Common.fetch(`files/${file.name}`, {
        method: 'DELETE'
      }).then(data => {
        this.$emit('notify', {type: 'i', message: `${this.$t('files.message:deleted', [data.name])}`});
        this.fileList();
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', {type: 'e', message: error});
        this.$emit('mask', -1);
      });
    },

    fileRename(file) {
      this.editedIndex = this.files.indexOf(file);
      this.editedItem = Object.assign({}, file);
      this.editedItem.newName = this.editedItem.name;
      this.dialogEdit = true;
    },

    renameFileConfirm() {
      this.$emit('mask', 1);
      Common.fetch(`files/${this.editedItem.name}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({newName: this.editedItem.newName})
      }).then(() => {
        this.$emit('notify', {type: 'i', message: `${this.$t('files.message:renamed')}`});
        this.fileList();
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', {type: 'e', message: error});
        this.$emit('mask', -1);
      }).finally(() => {
        this.closeRename();
      });
    },

    closeRename() {
      this.dialogEdit = false;
      this.$nextTick(() => {
        this.editedItem = Object.assign({}, this.defaultItem);
        this.editedIndex = -1;
      });
    },

    async multipleDelete() {
      let refresh = false;
      while (this.selectedFiles.length > 0) {
        refresh = true;
        const name = this.selectedFiles[0].name;
        try {
          await Common.fetch(`files/${name}`, {method: 'DELETE'});
          this.$emit('notify', {type: 'i', message: `${this.$t('files.message:deleted', [name])}`});
        } catch (error) {
          this.$emit('notify', {type: 'e', message: error});
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
