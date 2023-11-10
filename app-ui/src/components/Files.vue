<template>
  <v-data-table
      v-model="selectedFiles"
      :headers="headers"
      :items="files"
      :items-per-page-text="$t('files.items-per-page')"
      return-object
      show-select>
    <template #top>
      <v-toolbar flat>
        <v-checkbox v-model="thumbnails.show"
          class="mt-6" :label="$t('files.thumbnail-show')" />
        <v-slider v-if="thumbnails.show" v-model="thumbnails.size" class="mt-6 ml-8" min="32" max="128"
          step="16" :inverse-label="true"
          :label="`${$t('files.thumbnail-size')} (${thumbnails.size})`" />
        <v-spacer />
        <v-btn v-if="!smAndDown" :disabled="selectedFiles.length === 0" color="warning" @click="multipleDelete">
          {{ $t('files.button:delete-selected') }}
        </v-btn>
        <v-menu v-if="actions.length > 0" bottom :offset-y="true">
          <template #activator="{ props }">
            <v-btn
                :disabled="selectedFiles.length === 0"
                color="primary"
                v-bind="props">
              <v-icon v-if="smAndDown" :icon="mdiDotsVertical" />
              <span v-if="!smAndDown">{{ $t('files.button:action-selected') }}</span>
            </v-btn>
          </template>
          <v-list>
            <v-list-item v-if="smAndDown" :title="$t('files.button:delete-selected')" @click="multipleDelete" />
            <v-list-item v-for="(action, index) in actions" :key="index" :title="action" @click="multipleAction(action)" />
          </v-list>
        </v-menu>
        <v-dialog v-model="dialogEdit" max-width="500px">
          <v-card>
            <v-card-title class="text-h5">{{ $t('files.dialog:rename') }}</v-card-title>
            <v-card-text>
              <v-container>
                <v-text-field v-model="editedItem.newName" :label="$t('files.filename')" />
              </v-container>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn small @click="closeRename">
                {{ $t('files.dialog:rename-cancel') }}
              </v-btn>
              <v-btn small color="primary" @click="renameFileConfirm">
                {{ $t('files.dialog:rename-save') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-toolbar>
    </template>

    <template v-if="thumbnails.show" #[`item.thumb`]="{ item }">
      <v-img :src="`api/v1/files/${item.name}/thumbnail`"
        width="128"
        :max-height="thumbnails.size" :max-width="thumbnails.size"
        :contain="true" />
    </template>
    <template #[`item.lastModified`]="{ item }">
      {{ $d(new Date(item.lastModified), 'long') }}
    </template>
    <template #[`item.actions`]="{ item }">
      <v-icon class="mr-2" :icon="mdiDownload" @click="open(item)" />
      <v-icon class="mr-2" :icon="mdiPencil" @click="fileRename(item)" />
      <v-icon class="mr-2" :icon="mdiDelete" @click="fileRemove(item)" />
    </template>
    <template #[`footer.page-text`]="items">
      {{ items.pageStart }} - {{ items.pageStop }} / {{ items.itemsLength }}
    </template>
  </v-data-table>
</template>

<script>
import Common from '../classes/common';
import Storage from '../classes/storage';
import { mdiDelete, mdiDotsVertical, mdiDownload, mdiPencil } from '@mdi/js';
import { useDisplay } from 'vuetify';
const storage = Storage.instance();

export default {
  name: 'Files',

  emits: ['mask', 'notify'],

  setup() {
    const { smAndDown } = useDisplay();
    return {
      mdiDelete,
      mdiDotsVertical,
      mdiDownload,
      mdiPencil,
      smAndDown
    };
  },
  
  data() {
    return {
      dialogDelete: false,
      dialogEdit: false,
      files: [],
      editedItem: {
        name: '',
        newName: ''
      },
      defaultItem: {
        name: '',
        newName: ''
      },
      selectedFiles: [],
      thumbnails: {
        show: storage.settings.thumbnails.show,
        size: storage.settings.thumbnails.size
      },
      actions: []
    };
  },

  computed: {
    headers() {
      const headers = [
        {
          align: 'start',
          sortable: false,
          value: 'thumb',
          key: 'thumb',
        },
        {
          title: this.$t('files.filename'),
          align: 'start',
          sortable: true,
          key: 'name',
        },
        {
          title: this.$t('files.date'),
          align: 'start',
          sortable: true,
          key: 'lastModified',
        },
        {
          title: this.$t('files.size'),
          align: 'start',
          sortable: true,
          key: 'sizeString',
        },
        {
          title: this.$t('files.actions'),
          value: 'actions',
          sortable: false,
          key: 'actions',
        },
      ];

      if (this.smAndDown) {
        headers.splice(2, 2);
      }
      return headers;
    }
  },

  watch: {
    dialogEdit(val) {
      val || this.closeRename();
    },
    thumbnails: {
      handler(thumbnails) {
        const settings = storage.settings;
        settings.thumbnails = thumbnails;
        storage.settings = settings;
      },
      deep: true
    }
  },

  mounted() {
    this.fileList();
    this.actionList();
  },

  methods: {
    actionList() {
      this.$emit('mask', 1);
      Common.fetch('api/v1/context').then(context => {
        this.actions = context.actions;
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', {type: 'e', message: error});
        this.$emit('mask', -1);
      });
    },

    fileList() {
      this.$emit('mask', 1);
      Common.fetch('api/v1/files').then(files => {
        this.files = files;
        this.$emit('mask', -1);
      }).catch(error => {
        this.$emit('notify', {type: 'e', message: error});
        this.$emit('mask', -1);
      });
    },

    fileRemove(file) {
      this.$emit('mask', 1);
      Common.fetch(`api/v1/files/${file.name}`, {
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
      Common.fetch(`api/v1/files/${this.editedItem.name}`, {
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
          await Common.fetch(`api/v1/files/${name}`, {method: 'DELETE'});
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

    async multipleAction(actionName) {
      let refresh = false;
      while (this.selectedFiles.length > 0) {
        refresh = true;
        const filename = this.selectedFiles[0].name;
        try {
          await Common.fetch(`api/v1/files/${filename}/actions/${actionName}`, {method: 'POST'});
          this.$emit('notify', {type: 'i', message: `${this.$t('files.message:action', [actionName, filename])}`});
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
      window.location.href = `api/v1/files/${file.name}`;
    },

    selectToggle(value) {
      this.selectedFiles = value ? this.files.map(f => f.name) : [];
    }
  }
};
</script>

<style>
tbody > tr > td {
  padding-top: 1rem !important;
  padding-bottom: 1rem !important;
}
div.v-input.v-input__slider {
  max-width: 250px;
}
</style>
