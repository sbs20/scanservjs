<template>
  <v-dialog v-model="visible" width="95vw" max-width="1400" scrollable persistent>
    <v-card height="92vh" class="d-flex flex-column overflow-hidden">
      <v-toolbar flat color="grey-darken-4" theme="dark" density="comfortable">
        <v-btn-toggle v-if="canEdit" v-model="mode" mandatory density="compact" class="ml-2">
          <v-btn value="view" size="small">
            <v-icon :icon="mdiEye" class="mr-1" />
            {{ $t('document-dialog.view') }}
          </v-btn>
          <v-btn value="edit" size="small">
            <v-icon :icon="mdiPencil" class="mr-1" />
            {{ $t('document-dialog.edit') }}
          </v-btn>
        </v-btn-toggle>
        <v-toolbar-title class="text-truncate text-subtitle-1 ml-4">{{ fileName }}</v-toolbar-title>
        <v-spacer />
        <v-tooltip location="bottom" :text="$t('files.download')">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon color="white" variant="text" class="mr-2" @click="$emit('download')">
              <v-icon :icon="mdiDownload" />
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip location="bottom" :text="$t('files.close')">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon color="white" variant="text" @click="requestClose">
              <v-icon :icon="mdiClose" />
            </v-btn>
          </template>
        </v-tooltip>
      </v-toolbar>

      <!-- View mode content -->
      <v-card-text v-show="mode === 'view'"
        class="pa-0 flex-grow-1 overflow-hidden d-flex justify-center align-center bg-grey-darken-3">
        <v-progress-circular v-if="assemblingPreview" indeterminate color="white" size="48" />

        <iframe v-else-if="viewSrc && isPdf"
          :src="viewSrc"
          width="100%" height="100%" frameborder="0"></iframe>

        <v-img v-else-if="viewSrc && isImage"
          :src="viewSrc"
          max-width="100%" max-height="100%" />

        <pre v-else-if="textContent"
          class="text-white text-left ma-0 pa-4 flex-grow-1 w-100 h-100 overflow-auto"
          style="white-space: pre-wrap; font-family: monospace;">{{ textContent }}</pre>

        <div v-else class="text-h6 text-white text-center">
          <v-icon size="48" :icon="mdiEyeOff" class="mb-2" />
          <div>{{ $t('files.no-preview') }}</div>
        </div>
      </v-card-text>

      <!-- Edit mode content -->
      <editor v-show="mode === 'edit'"
        ref="editor"
        :files="files"
        :session-id="sessionId"
        class="flex-grow-1 overflow-hidden"
        @mask="$emit('mask', $event)"
        @notify="$emit('notify', $event)"
        @saved="onSaved"
        @dirty="editorDirty = $event" />
    </v-card>
  </v-dialog>
</template>

<script>
import Common from '../classes/common';
import Editor from './Editor.vue';
import { mdiClose, mdiDownload, mdiEye, mdiEyeOff, mdiPencil } from '@mdi/js';

export default {
  name: 'DocumentDialog',
  components: { Editor },
  emits: ['mask', 'notify', 'close', 'saved', 'download'],

  setup() {
    return { mdiClose, mdiDownload, mdiEye, mdiEyeOff, mdiPencil };
  },

  props: {
    modelValue: { type: Boolean, default: false },
    files: { type: Array, default: () => [] },
    initialMode: { type: String, default: 'view' }
  },

  data() {
    return {
      mode: this.initialMode,
      sessionId: null,
      editorDirty: false,
      assemblingPreview: false,
      lastPreviewHash: null,
      previewUrl: null,
      textContent: ''
    };
  },

  computed: {
    visible: {
      get() { return this.modelValue; },
      set() { this.requestClose(); }
    },
    fileName() {
      if (this.files.length === 1) return this.files[0].name || this.files[0];
      if (this.files.length > 1) return `${this.files.length} files`;
      return '';
    },
    canEdit() {
      if (this.files.length > 1) return true;
      if (this.files.length === 1) {
        const name = (this.files[0].name || this.files[0]).toLowerCase();
        return name.endsWith('.pdf') || name.endsWith('.tif') || name.endsWith('.tiff')
          || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
      }
      return false;
    },
    isPdf() {
      if (this.previewUrl) return true; // assembled preview is always PDF
      if (this.files.length !== 1) return false;
      const name = (this.files[0].name || this.files[0]).toLowerCase();
      return name.endsWith('.pdf');
    },
    isImage() {
      if (this.previewUrl) return false;
      if (this.files.length !== 1) return false;
      const name = (this.files[0].name || this.files[0]).toLowerCase();
      return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')
        || name.endsWith('.tif') || name.endsWith('.tiff');
    },
    isText() {
      if (this.files.length !== 1) return false;
      const name = (this.files[0].name || this.files[0]).toLowerCase();
      return name.endsWith('.txt');
    },
    viewSrc() {
      if (this.previewUrl) return this.previewUrl;
      if (this.files.length !== 1) return null;
      const name = this.files[0].name || this.files[0];
      if (this.isPdf || this.isImage) {
        return `api/v1/files/${name}?preview=true`;
      }
      return null;
    }
  },

  watch: {
    modelValue(val) {
      if (val) this.onOpen();
      else this.onClose();
    },
    async mode(newMode, oldMode) {
      if (newMode === 'edit' && !this.sessionId) {
        await this.createSession();
      }
      if (newMode === 'view' && oldMode === 'edit' && this.sessionId && this.editorDirty) {
        await this.assemblePreview();
      }
    }
  },

  methods: {
    onOpen() {
      this.mode = this.initialMode;
      this.sessionId = null;
      this.editorDirty = false;
      this.assemblingPreview = false;
      this.lastPreviewHash = null;
      this.previewUrl = null;
      this.textContent = '';

      if (this.isText && this.files.length === 1) {
        const name = this.files[0].name || this.files[0];
        fetch(`api/v1/files/${name}?preview=true`)
          .then(res => res.text())
          .then(text => { this.textContent = text; });
      }

      if (this.mode === 'edit') {
        this.createSession();
      }
    },

    onClose() {
      if (this.sessionId) {
        Common.fetch(`api/v1/editor/sessions/${this.sessionId}`, {
          method: 'DELETE'
        }).catch(() => {});
        this.sessionId = null;
      }
      if (this.$refs.editor) {
        this.$refs.editor.reset();
      }
      this.previewUrl = null;
      this.lastPreviewHash = null;
    },

    requestClose() {
      if (this.editorDirty) {
        if (!confirm(this.$t('document-dialog.discard-changes'))) return;
      }
      this.$emit('close');
    },

    async createSession() {
      this.$emit('mask', 1);
      try {
        const fileNames = this.files.map(f => f.name || f);
        const result = await Common.fetch('api/v1/editor/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: fileNames })
        });
        this.sessionId = result.sessionId;
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.$emit('mask', -1);
      }
    },

    async assemblePreview() {
      const editor = this.$refs.editor;
      if (!editor) return;

      const hash = editor.getEditListHash();
      if (hash === this.lastPreviewHash) return;

      this.assemblingPreview = true;
      try {
        const editList = editor.getEditList();
        await Common.fetch(
          `api/v1/editor/sessions/${this.sessionId}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: editList })
          });
        this.lastPreviewHash = hash;
        this.previewUrl = `api/v1/editor/sessions/${this.sessionId}/preview?v=${encodeURIComponent(hash)}`;
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.assemblingPreview = false;
      }
    },

    onSaved() {
      this.lastPreviewHash = null;
      this.previewUrl = null;
      this.$emit('saved');
    }
  },

  beforeUnmount() {
    if (this.sessionId) {
      Common.fetch(`api/v1/editor/sessions/${this.sessionId}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
  }
};
</script>
