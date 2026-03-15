<template>
  <v-dialog v-model="visible" width="95vw" persistent>
    <v-card height="95vh" class="docdlg-card">
      <v-toolbar flat color="grey-darken-4" theme="dark" density="comfortable">
        <template v-if="canEdit">
          <v-btn size="small" class="ml-2"
            :variant="mode === 'view' ? 'flat' : 'text'"
            :color="mode === 'view' ? 'primary' : 'white'"
            @click="switchMode('view')">
            <v-icon :icon="mdiEye" class="mr-1" />
            {{ $t('document-dialog.view') }}
          </v-btn>
          <v-btn size="small"
            :variant="mode === 'edit' ? 'flat' : 'text'"
            :color="mode === 'edit' ? 'primary' : 'white'"
            @click="switchMode('edit')">
            <v-icon :icon="mdiPencil" class="mr-1" />
            {{ $t('document-dialog.edit') }}
          </v-btn>
        </template>
        <inline-edit v-if="files.length === 1"
          :model-value="fileName" :suffix="fileSuffix" :dark="true"
          class="ml-4 text-subtitle-1"
          @rename="onRenameFile" />
        <v-toolbar-title v-else class="text-truncate text-subtitle-1 ml-4">{{ fileName }}</v-toolbar-title>
        <v-spacer />
        <v-tooltip v-if="showSave" location="bottom" :text="$t('editor.save')">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon variant="text" class="mr-1"
              :color="editorDirty ? 'primary' : 'white'"
              :disabled="mode === 'edit' && !editorDirty"
              @click="saveFromToolbar">
              <v-icon :icon="mdiContentSave" />
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip location="bottom" :text="$t('files.download')">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon color="white" variant="text" class="mr-1" @click="download">
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
      <div v-show="mode === 'view'" class="docdlg-content docdlg-view">
        <v-progress-circular v-if="assemblingPreview" indeterminate color="white" size="48" />

        <div v-else-if="previewError" class="text-h6 text-white text-center">
          <v-icon size="48" :icon="mdiAlertCircle" class="mb-2" color="error" />
          <div>{{ $t('document-dialog.preview-failed') }}</div>
          <v-btn class="mt-4" variant="tonal" color="white" size="small"
            @click="switchMode('edit')">
            {{ $t('document-dialog.back-to-editor') }}
          </v-btn>
        </div>

        <iframe v-else-if="viewSrc && isPdf"
          :src="viewSrc"
          width="100%" height="100%" frameborder="0"></iframe>

        <v-img v-else-if="viewSrc && isImage"
          :src="viewSrc"
          max-width="100%" max-height="100%" />

        <pre v-else-if="textContent"
          class="text-white text-left ma-0 pa-4"
          style="white-space: pre-wrap; font-family: monospace; width: 100%; height: 100%; overflow: auto;">{{ textContent }}</pre>

        <div v-else class="text-h6 text-white text-center">
          <v-icon size="48" :icon="mdiEyeOff" class="mb-2" />
          <div>{{ $t('files.no-preview') }}</div>
        </div>
      </div>

      <!-- Edit mode content -->
      <div v-show="mode === 'edit'" class="docdlg-content">
        <editor
          ref="editor"
          :files="files"
          :session-id="sessionId"
          :file-list="fileList"
          @mask="$emit('mask', $event)"
          @notify="$emit('notify', $event)"
          @saved="onSaved"
          @dirty="editorDirty = $event" />
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import Common from '../classes/common';
import Editor from './Editor.vue';
import InlineEdit from './InlineEdit.vue';
import { mdiAlertCircle, mdiClose, mdiContentSave, mdiDownload, mdiEye, mdiEyeOff, mdiPencil } from '@mdi/js';

export default {
  name: 'DocumentDialog',
  components: { Editor, InlineEdit },
  emits: ['mask', 'notify', 'close', 'saved', 'download'],

  setup() {
    return { mdiAlertCircle, mdiClose, mdiContentSave, mdiDownload, mdiEye, mdiEyeOff, mdiPencil };
  },

  props: {
    modelValue: { type: Boolean, default: false },
    files: { type: Array, default: () => [] },
    fileList: { type: Array, default: () => [] },
    initialMode: { type: String, default: 'view' }
  },

  data() {
    return {
      mode: this.initialMode,
      sessionId: null,
      editorDirty: false,
      assemblingPreview: false,
      previewError: false,
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
      if (this.files.length === 1) {
        const name = this.files[0].name || this.files[0];
        // When editing, output is always PDF — show the PDF output name
        if (this.canEdit) return name.replace(/\.[^.]+$/, '') + '.pdf';
        return name;
      }
      if (this.files.length > 1) return `${this.files.length} files`;
      return '';
    },
    fileSuffix() {
      if (this.files.length !== 1) return '';
      // When editing, output is always PDF regardless of source format
      if (this.canEdit) return '.pdf';
      const name = this.files[0].name || this.files[0];
      const dot = name.lastIndexOf('.');
      return dot >= 0 ? name.slice(dot) : '';
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
    downloadFilename() {
      // Prefer editor's current saveFilename (tracks toolbar renames for non-PDF sources)
      const editor = this.$refs.editor;
      if (editor && editor.saveFilename) return editor.saveFilename;
      if (this.files.length === 1) {
        const name = this.files[0].name || this.files[0];
        return name.replace(/\.[^.]+$/, '') + '.pdf';
      }
      return 'merged.pdf';
    },
    showSave() {
      // In edit mode: always show (disabled when not dirty)
      // In view mode: only show when there are unsaved edits
      if (!this.canEdit) return false;
      if (this.mode === 'edit') return true;
      return this.editorDirty;
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
    }
  },

  methods: {
    onOpen() {
      this.mode = this.initialMode;
      this.sessionId = null;
      this.editorDirty = false;
      this.assemblingPreview = false;
      this.previewError = false;
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

    async switchMode(newMode) {
      if (newMode === this.mode) return;
      const oldMode = this.mode;
      this.mode = newMode;
      this.previewError = false;
      if (newMode === 'edit' && !this.sessionId) {
        await this.createSession();
      }
      if (newMode === 'view' && oldMode === 'edit' && this.sessionId && this.editorDirty) {
        await this.assemblePreview();
      }
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
      this.previewError = false;
      try {
        const editList = editor.getEditList();
        await Common.fetch(
          `api/v1/editor/sessions/${this.sessionId}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: editList })
          });
        this.lastPreviewHash = hash;
        this.previewUrl = `api/v1/editor/sessions/${this.sessionId}/preview?v=${Date.now()}`;
      } catch (error) {
        this.previewError = true;
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.assemblingPreview = false;
      }
    },

    saveFromToolbar() {
      const editor = this.$refs.editor;
      if (editor) editor.save();
    },

    async download() {
      if (!this.editorDirty || !this.sessionId) {
        // No edits — download original file
        this.$emit('download');
        return;
      }
      // Edits pending — assemble and download the edited version
      this.$emit('mask', 1);
      try {
        const editor = this.$refs.editor;
        const editList = editor.getEditList();
        await Common.fetch(
          `api/v1/editor/sessions/${this.sessionId}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: editList })
          });
        this.lastPreviewHash = editor.getEditListHash();
        // Trigger download of the assembled preview with the proper filename
        const dlName = this.downloadFilename;
        window.location.href = `api/v1/editor/sessions/${this.sessionId}/preview?download=true&filename=${encodeURIComponent(dlName)}`;
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.$emit('mask', -1);
      }
    },

    async onRenameFile({ newName }) {
      // newName is the desired PDF output name (e.g. "invoice.pdf")
      const sourceName = this.files[0].name || this.files[0];
      const sourceIsPdf = sourceName.toLowerCase().endsWith('.pdf');

      if (sourceIsPdf) {
        // Source and output are the same file — rename it on disk
        if (this.fileList.some(f => (f.name || f) === newName)) {
          if (!confirm(this.$t('editor.confirm-overwrite', [newName]))) return;
        }
        this.$emit('mask', 1);
        try {
          await Common.fetch(`api/v1/files/${sourceName}`, {
            method: 'PUT',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName })
          });
          this.files[0].name = newName;
          if (this.$refs.editor) this.$refs.editor.updateSource(sourceName, newName);
          this.$emit('notify', { type: 'i', message: this.$t('files.message:renamed') });
          this.$emit('saved');
        } catch (error) {
          this.$emit('notify', { type: 'e', message: String(error) });
          return;
        } finally {
          this.$emit('mask', -1);
        }
      }

      // For non-PDF sources (e.g. .jpg → .pdf conversion): only update save target,
      // the source file on disk is left untouched
      if (this.$refs.editor) {
        this.$refs.editor.saveFilename = newName;
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

<style scoped>
.docdlg-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.docdlg-content {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.docdlg-view {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #424242;
}
</style>
