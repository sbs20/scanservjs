<template>
  <v-data-table
      :headers="headers"
      :items="files">
    <template v-slot:top>
      <v-dialog v-model="dialogDelete" max-width="500px">
        <v-card>
          <v-card-title class="text-h5">Are you sure you want to delete this item?</v-card-title>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" text @click="closeDelete">Cancel</v-btn>
            <v-btn color="blue darken-1" text @click="deleteItemConfirm">OK</v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-dialog v-model="dialogEdit" max-width="500px">
        <v-card>
          <v-card-title class="text-h5">Are you sure you want to delete this item?</v-card-title>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" text @click="closeRename">Cancel</v-btn>
            <v-btn color="blue darken-1" text @click="renameFileConfirm">OK</v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
    <template v-slot:item.lastModified="{ item }">
      {{ $d(new Date(item.lastModified), 'long', $i18n.locale) }}
    </template>
    <template v-slot:item.actions="{ item }">
      <v-icon
          small
          class="mr-2"
          @click="open(item)">
        mdi-download
      </v-icon>
      <v-icon
          small
          class="mr-2"
          @click="fileRename(item)">
        mdi-pencil
      </v-icon>
      <v-icon
          small
          @click="deleteItem(item)">
        mdi-delete
      </v-icon>
    </template>
  </v-data-table>
</template>

<script>
import Common from '../classes/common';

export default {
  name: 'ExtendedFiles',

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
          sortable: false,
          value: 'name',
        },        {
          text: this.$t('files.date'),
          align: 'start',
          sortable: false,
          value: 'lastModified',
        },        {
          text: this.$t('files.size'),
          align: 'start',
          sortable: false,
          value: 'sizeString',
        },
        { text: this.$t('files.actions'), value: 'actions', sortable: false },
      ],
      files: [],
      selectedFiles: []
    };
  },

  watch: {
    dialogDelete (val) {
      val || this.closeDelete();
    },
    dialogEdit (val) {
      val || this.closeDelete();
    },
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

    deleteItem (item) {
      this.editedIndex = this.files.indexOf(item);
      this.editedItem = Object.assign({}, item);
      this.dialogDelete = true;
    },

    deleteItemConfirm () {
      this.fileRemove(this.editedItem);
      this.closeDelete();
    },

    closeDelete () {
      this.dialogDelete = false;
      this.$nextTick(() => {
        this.editedItem = Object.assign({}, this.defaultItem);
        this.editedIndex = -1;
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

    fileRename(file) {
      this.editedIndex = this.files.indexOf(file);
      this.editedItem = Object.assign({}, file);
      this.dialogEdit = true;
    },

    renameFileConfirm() {
      this.dialogEdit = false;
    },

    closeRename () {
      this.dialogEdit = false;
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
