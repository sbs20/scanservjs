<template>
  <div class="editor-root d-flex flex-column" style="height: 100%;">
    <v-toolbar density="compact" flat>
      <v-btn :disabled="!undoStack.canUndo" :icon="mdiUndo" size="small"
        :title="$t('editor.undo')" @click="undo" />
      <v-btn :disabled="!undoStack.canRedo" :icon="mdiRedo" size="small"
        :title="$t('editor.redo')" @click="redo" />
      <v-divider vertical class="mx-2" />
      <v-btn :icon="mdiFilePlus" size="small"
        :title="$t('editor.add-pages')" @click="showAddPages = true" />
      <v-btn :icon="mdiFileDocumentPlus" size="small"
        :title="$t('editor.add-blank')" @click="addBlank" />
      <v-divider vertical class="mx-2" />
      <v-btn :disabled="selected.length === 0" :icon="mdiRotateLeft" size="small"
        :title="$t('editor.rotate-ccw')" @click="rotateSelected(-90)" />
      <v-btn :disabled="selected.length === 0" :icon="mdiRotateRight" size="small"
        :title="$t('editor.rotate-cw')" @click="rotateSelected(90)" />
      <v-btn :disabled="selected.length === 0" :icon="mdiDelete" size="small"
        :title="$t('editor.delete')" @click="deleteSelected" />
      <v-spacer />
    </v-toolbar>

    <div class="pa-4 overflow-y-auto flex-grow-1">
      <draggable
        v-model="pages"
        item-key="id"
        class="editor-grid"
        ghost-class="editor-ghost"
        @end="onDragEnd">
        <template #item="{ element, index }">
          <div
            class="editor-page"
            :class="{ 'editor-page-selected': isSelected(element.id) }"
            @click.exact="selectOne(element.id)"
            @click.ctrl.exact="toggleSelect(element.id)"
            @click.meta.exact="toggleSelect(element.id)"
            @click.shift.exact="selectRange(element.id)">
            <div class="editor-thumb-wrap">
              <v-img
                v-if="sessionId"
                :src="`api/v1/editor/sessions/${sessionId}/pages/${element.originalIndex}/thumbnail`"
                :class="thumbRotationClass(element.rotation)"
                width="160"
                height="160"
                cover />
              <div v-else class="editor-thumb-placeholder" />
            </div>
            <div class="editor-page-num text-caption text-center">
              {{ index + 1 }}
            </div>
            <div v-if="element.rotation" class="editor-rotation-badge text-caption">
              {{ element.rotation }}°
            </div>
            <div class="editor-source-badge text-caption text-truncate"
              :title="element.source">
              {{ element.source }}
            </div>
          </div>
        </template>
      </draggable>
    </div>

    <div class="px-4 py-2 text-caption">
      {{ $t('editor.status', [pages.length]) }}
      <template v-if="sourceFiles.length">
        · {{ $t('editor.sources', [sourceFiles.join(', ')]) }}
      </template>
    </div>

    <!-- Save-As dialog -->
    <v-dialog v-model="showSaveAs" max-width="400">
      <v-card>
        <v-card-title>{{ $t('editor.save-as') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="saveFilename" :label="$t('files.filename')"
            autofocus @keyup.enter="confirmSaveAs" />
          <v-alert v-if="saveAsWillOverwrite" type="warning" density="compact" class="mt-2">
            {{ $t('editor.overwrite-warning', [saveAsTargetName]) }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSaveAs = false">{{ $t('editor.cancel') }}</v-btn>
          <v-btn color="primary" @click="confirmSaveAs">{{ $t('editor.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add pages file picker -->
    <v-dialog v-model="showAddPages" max-width="500">
      <v-card>
        <v-card-title>{{ $t('editor.add-pages') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="addPagesFile"
            :items="availableFiles"
            :label="$t('editor.select-file')"
            item-title="name"
            item-value="name" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showAddPages = false">{{ $t('editor.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="!addPagesFile" @click="confirmAddPages">
            {{ $t('editor.add') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
import Common from '../classes/common';
import UndoStack from '../classes/undo-stack';
import {
  mdiUndo, mdiRedo, mdiRotateLeft, mdiRotateRight,
  mdiDelete, mdiFilePlus, mdiFileDocumentPlus
} from '@mdi/js';

let nextId = 1;
function assignIds(pages) {
  return pages.map(p => ({
    ...p,
    id: `page-${nextId++}`,
    rotation: p.rotation || 0,
    originalIndex: p._originalIndex != null ? p._originalIndex : p.originalIndex
  }));
}

export default {
  name: 'Editor',
  components: { draggable },
  emits: ['mask', 'notify', 'saved', 'dirty'],

  setup() {
    return {
      mdiUndo, mdiRedo, mdiRotateLeft, mdiRotateRight,
      mdiDelete, mdiFilePlus, mdiFileDocumentPlus
    };
  },

  props: {
    files: { type: Array, default: () => [] },
    sessionId: { type: String, default: null },
    fileList: { type: Array, default: () => [] }
  },

  data() {
    return {
      pages: [],
      selected: [],
      lastSelected: null,
      undoStack: new UndoStack(),
      showSaveAs: false,
      showAddPages: false,
      saveFilename: '',
      addPagesFile: null,
      availableFiles: [],
      initialHash: null
    };
  },

  computed: {
    sourceFiles() {
      const sources = new Set(this.pages.map(p => p.source).filter(s => s !== 'blank'));
      return [...sources];
    },
    isDirty() {
      return this.initialHash !== null && this.initialHash !== JSON.stringify(this.pages);
    },
    saveAsTargetName() {
      let name = (this.saveFilename || '').trim();
      if (!name) return name;
      while (name.toLowerCase().endsWith('.pdf')) name = name.slice(0, -4);
      return name + '.pdf';
    },
    saveAsWillOverwrite() {
      if (!this.saveAsTargetName) return false;
      const originalName = this.files.length === 1
        ? (this.files[0].name || this.files[0]).replace(/\.[^.]+$/, '') + '.pdf'
        : null;
      return this.saveAsTargetName !== originalName
        && this.fileList.some(f => (f.name || f) === this.saveAsTargetName);
    }
  },

  watch: {
    sessionId(val) {
      if (val) this.loadSession();
    },
    isDirty(val) {
      this.$emit('dirty', val);
    }
  },

  methods: {
    async loadSession() {
      if (!this.sessionId) return;
      this.$emit('mask', 1);
      try {
        // Fetch file list for "Add Pages" dialog
        const fileList = await Common.fetch('api/v1/files');
        this.availableFiles = fileList;

        // Get session data
        const result = await Common.fetch(`api/v1/editor/sessions/${this.sessionId}`);

        // Build page list with stable IDs
        this.pages = assignIds(result.pages.map((p, i) => ({
          ...p,
          _originalIndex: i
        })));

        this.undoStack.clear();
        this.undoStack.push(this.pages);
        this.selected = [];
        this.lastSelected = null;
        this.initialHash = JSON.stringify(this.pages);

        // Default save filename
        if (this.files.length === 1) {
          const name = this.files[0].name || this.files[0];
          this.saveFilename = name.replace(/\.[^.]+$/, '') + '.pdf';
        } else {
          this.saveFilename = 'merged.pdf';
        }
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.$emit('mask', -1);
      }
    },

    /**
     * Get the current edit list for preview assembly.
     * @returns {Array}
     */
    getEditList() {
      return this.pages.map(p => ({
        source: p.source,
        sourceType: p.sourceType,
        pageNum: p.pageNum,
        rotation: p.rotation,
        isBlank: p.isBlank || false,
        width: p.width,
        height: p.height
      }));
    },

    /**
     * Get a hash of the current edit list for change detection.
     * @returns {string}
     */
    getEditListHash() {
      return JSON.stringify(this.pages);
    },

    reset() {
      this.pages = [];
      this.undoStack.clear();
      this.selected = [];
      this.initialHash = null;
    },

    updateSource(oldName, newName) {
      for (const page of this.pages) {
        if (page.source === oldName) {
          page.source = newName;
        }
      }
    },

    // Selection
    isSelected(id) {
      return this.selected.includes(id);
    },

    selectOne(id) {
      this.selected = [id];
      this.lastSelected = id;
    },

    toggleSelect(id) {
      const idx = this.selected.indexOf(id);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
      } else {
        this.selected.push(id);
      }
      this.lastSelected = id;
    },

    selectRange(id) {
      if (!this.lastSelected) {
        this.selectOne(id);
        return;
      }
      const ids = this.pages.map(p => p.id);
      const from = ids.indexOf(this.lastSelected);
      const to = ids.indexOf(id);
      const [start, end] = from < to ? [from, to] : [to, from];
      this.selected = ids.slice(start, end + 1);
    },

    // Operations
    pushState() {
      this.undoStack.push(this.pages);
    },

    undo() {
      const state = this.undoStack.undo();
      if (state) {
        this.pages = state;
        this.selected = [];
      }
    },

    redo() {
      const state = this.undoStack.redo();
      if (state) {
        this.pages = state;
        this.selected = [];
      }
    },

    onDragEnd() {
      this.pushState();
    },

    rotateSelected(degrees) {
      for (const page of this.pages) {
        if (this.selected.includes(page.id)) {
          page.rotation = ((page.rotation || 0) + degrees + 360) % 360;
        }
      }
      this.pushState();
    },

    deleteSelected() {
      this.pages = this.pages.filter(p => !this.selected.includes(p.id));
      this.selected = [];
      this.pushState();
    },

    addBlank() {
      const blank = {
        id: `page-${nextId++}`,
        source: 'blank',
        sourceType: 'blank',
        pageNum: 1,
        width: 595,
        height: 842,
        rotation: 0,
        isBlank: true,
        originalIndex: -1
      };
      this.pages.push(blank);
      this.pushState();
    },

    async confirmAddPages() {
      if (!this.addPagesFile) return;
      this.showAddPages = false;
      this.$emit('mask', 1);
      try {
        const result = await Common.fetch(
          `api/v1/editor/sessions/${this.sessionId}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: this.addPagesFile })
          });
        const newPages = assignIds(result.added.map((p, i) => ({
          ...p,
          _originalIndex: result.pages.length - result.added.length + i
        })));
        this.pages.push(...newPages);
        this.pushState();
        this.addPagesFile = null;
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.$emit('mask', -1);
      }
    },

    save() {
      if (this.files.length === 1) {
        const name = this.files[0].name || this.files[0];
        this._doSave(name.replace(/\.[^.]+$/, '') + '.pdf');
      } else {
        this.saveAs();
      }
    },

    saveAs() {
      this.showSaveAs = true;
    },

    async confirmSaveAs() {
      let filename = this.saveFilename.trim();
      if (!filename) return;
      // Strip any .pdf the user typed (handles double-ext and wrong case), then re-append
      while (filename.toLowerCase().endsWith('.pdf')) {
        filename = filename.slice(0, -4);
      }
      filename += '.pdf';

      // Check for overwrite — warn if file exists and isn't the original
      const originalName = this.files.length === 1
        ? (this.files[0].name || this.files[0]).replace(/\.[^.]+$/, '') + '.pdf'
        : null;
      if (filename !== originalName && this._fileExists(filename)) {
        if (!confirm(this.$t('editor.confirm-overwrite', [filename]))) return;
      }

      this.showSaveAs = false;
      await this._doSave(filename);
    },

    _fileExists(filename) {
      return this.fileList.some(f => (f.name || f) === filename);
    },

    async _doSave(filename) {
      this.$emit('mask', 1);
      try {
        const editList = this.getEditList();
        await Common.fetch(
          `api/v1/editor/sessions/${this.sessionId}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: editList, filename })
          });

        this.initialHash = JSON.stringify(this.pages);
        this.$emit('notify', { type: 's', message: `Saved: ${filename}` });
        this.$emit('saved');
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.$emit('mask', -1);
      }
    },

    thumbRotationClass(rotation) {
      const r = ((rotation || 0) + 360) % 360;
      if (r === 90) return 'editor-thumb-r90';
      if (r === 180) return 'editor-thumb-r180';
      if (r === 270) return 'editor-thumb-r270';
      return '';
    }
  }
};
</script>

<style scoped>
.editor-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.editor-page {
  position: relative;
  width: 176px;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  padding: 4px;
  transition: border-color 0.15s;
}

.editor-page:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
}

.editor-page-selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}

.editor-ghost {
  opacity: 0.4;
}

.editor-thumb-wrap {
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f5f5f5;
  border-radius: 2px;
}

.editor-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: #e0e0e0;
}

.editor-thumb-r90 {
  transform: rotate(90deg);
}
.editor-thumb-r180 {
  transform: rotate(180deg);
}
.editor-thumb-r270 {
  transform: rotate(270deg);
}

.editor-page-num {
  margin-top: 2px;
}

.editor-rotation-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 0 4px;
  border-radius: 2px;
  font-size: 10px;
}

.editor-source-badge {
  max-width: 168px;
  font-size: 10px;
  opacity: 0.6;
  text-align: center;
}
</style>
