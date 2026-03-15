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

    <div ref="scrollArea" class="pa-4 overflow-y-auto flex-grow-1 editor-scroll"
      tabindex="0" @keydown="onKeydown" @click.self="onBackgroundClick">
      <draggable
        v-model="pages"
        item-key="id"
        class="editor-grid"
        ghost-class="editor-ghost"
        @end="onDragEnd"
        @click.self="onBackgroundClick">
        <template #item="{ element, index }">
          <div
            class="editor-page"
            :class="pageClasses(element, index)"
            @click.exact="selectOne(element.id, index)"
            @click.ctrl.exact="toggleSelect(element.id)"
            @click.meta.exact="toggleSelect(element.id)"
            @click.shift.exact="selectRange(element.id, index)">
            <div class="editor-thumb-wrap">
              <v-img
                v-if="sessionId && !element.isBlank"
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
  emits: ['mask', 'notify', 'saved', 'dirty', 'close'],

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
      anchor: null,
      focusIndex: -1,
      cursorPosition: 0,
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
        const fileList = await Common.fetch('api/v1/files');
        this.availableFiles = fileList;

        const result = await Common.fetch(`api/v1/editor/sessions/${this.sessionId}`);

        this.pages = assignIds(result.pages.map((p, i) => ({
          ...p,
          _originalIndex: i
        })));

        this.undoStack.clear();
        this.undoStack.push(this.pages);
        if (this.pages.length > 0) {
          this.selected = [this.pages[0].id];
          this.anchor = this.pages[0].id;
          this.focusIndex = 0;
          this.cursorPosition = 1;
        } else {
          this.selected = [];
          this.anchor = null;
          this.focusIndex = -1;
          this.cursorPosition = 0;
        }
        this.initialHash = JSON.stringify(this.pages);

        if (this.files.length === 1) {
          const name = this.files[0].name || this.files[0];
          this.saveFilename = name.replace(/\.[^.]+$/, '') + '.pdf';
        } else {
          this.saveFilename = 'merged.pdf';
        }

        this.$nextTick(() => {
          this.$refs.scrollArea?.focus({ preventScroll: true });
        });
      } catch (error) {
        this.$emit('notify', { type: 'e', message: String(error) });
      } finally {
        this.$emit('mask', -1);
      }
    },

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

    getEditListHash() {
      return JSON.stringify(this.pages);
    },

    reset() {
      this.pages = [];
      this.undoStack.clear();
      this.selected = [];
      this.anchor = null;
      this.focusIndex = -1;
      this.cursorPosition = 0;
      this.initialHash = null;
    },

    updateSource(oldName, newName) {
      for (const page of this.pages) {
        if (page.source === oldName) {
          page.source = newName;
        }
      }
    },

    // --- Grid layout helpers ---

    getColumnsPerRow() {
      const el = this.$refs.scrollArea;
      if (!el) return 1;
      const available = el.clientWidth - 32;
      return Math.max(1, Math.floor((available + 12) / 188));
    },

    scrollToPage(index) {
      if (index < 0 || index >= this.pages.length) return;
      this.$nextTick(() => {
        const cards = this.$refs.scrollArea?.querySelectorAll('.editor-page');
        if (cards && cards[index]) {
          cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    },

    // --- Page classes ---

    pageClasses(element, index) {
      return {
        'editor-page-selected': this.selected.includes(element.id),
        'editor-page-anchor': this.selected.length > 1 && element.id === this.anchor,
        'editor-cursor-before': this.cursorPosition === index
          && this.cursorPosition < this.pages.length,
        'editor-cursor-after': this.cursorPosition === this.pages.length
          && index === this.pages.length - 1
      };
    },

    // --- Selection ---

    selectOne(id, index) {
      this.selected = [id];
      this.anchor = id;
      this.focusIndex = index;
      this.cursorPosition = index + 1;
      this.$refs.scrollArea?.focus({ preventScroll: true });
    },

    toggleSelect(id) {
      const idx = this.selected.indexOf(id);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
      } else {
        this.selected.push(id);
      }
      this.$refs.scrollArea?.focus({ preventScroll: true });
    },

    selectRange(id, index) {
      if (!this.anchor) {
        this.selectOne(id, index);
        return;
      }
      const anchorIdx = this.pages.findIndex(p => p.id === this.anchor);
      if (anchorIdx < 0) {
        this.selectOne(id, index);
        return;
      }
      const [start, end] = anchorIdx < index
        ? [anchorIdx, index] : [index, anchorIdx];
      this.selected = this.pages.slice(start, end + 1).map(p => p.id);
      this.focusIndex = index;
      this.cursorPosition = index + 1;
      this.$refs.scrollArea?.focus({ preventScroll: true });
    },

    selectAll() {
      this.selected = this.pages.map(p => p.id);
    },

    deselectAll() {
      this.selected = [];
      this.focusIndex = -1;
    },

    // --- Keyboard navigation ---

    onKeydown(e) {
      if (this.showSaveAs || this.showAddPages) return;

      const { key, ctrlKey, metaKey, shiftKey } = e;
      const mod = ctrlKey || metaKey;

      switch (key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          this.navigateArrow(key, shiftKey);
          break;

        case 'Home':
          if (mod) {
            e.preventDefault();
            this.navigateTo(0, shiftKey);
          }
          break;

        case 'End':
          if (mod) {
            e.preventDefault();
            this.navigateTo(this.pages.length - 1, shiftKey);
          }
          break;

        case 'PageUp':
          e.preventDefault();
          this.$refs.scrollArea?.scrollBy({
            top: -this.$refs.scrollArea.clientHeight,
            behavior: 'smooth'
          });
          break;

        case 'PageDown':
          e.preventDefault();
          this.$refs.scrollArea?.scrollBy({
            top: this.$refs.scrollArea.clientHeight,
            behavior: 'smooth'
          });
          break;

        case 'a':
          if (mod) {
            e.preventDefault();
            this.selectAll();
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (this.selected.length > 0) {
            this.deselectAll();
          } else {
            this.$emit('close');
          }
          break;

        case 'Delete':
        case 'Backspace':
          if (this.selected.length > 0) {
            e.preventDefault();
            this.deleteSelected();
          }
          break;

        case 'z':
          if (mod && !shiftKey) {
            e.preventDefault();
            this.undo();
          } else if (mod && shiftKey) {
            e.preventDefault();
            this.redo();
          }
          break;

        case 'Z':
          if (mod) {
            e.preventDefault();
            this.redo();
          }
          break;

        case 'y':
          if (mod) {
            e.preventDefault();
            this.redo();
          }
          break;
      }
    },

    navigateArrow(key, extend) {
      if (this.pages.length === 0) return;

      const cols = this.getColumnsPerRow();
      const current = this.focusIndex >= 0 ? this.focusIndex : -1;

      // When no page is focused, start from the nearest edge based on direction.
      if (current < 0) {
        const start = (key === 'ArrowLeft' || key === 'ArrowUp')
          ? this.pages.length - 1 : 0;
        this.navigateTo(start, extend);
        return;
      }

      let next;
      switch (key) {
        case 'ArrowRight':
          if (current === 0 && this.cursorPosition === 0) {
            // Move cursor from before first page to after first page.
            this.cursorPosition = 1;
            return;
          }
          next = current < this.pages.length - 1 ? current + 1 : current;
          break;
        case 'ArrowLeft':
          if (current === 0) {
            // Move insertion cursor before the first page without changing selection.
            this.cursorPosition = 0;
            return;
          }
          next = current - 1;
          break;
        case 'ArrowDown':
          next = current + cols;
          if (next >= this.pages.length) next = this.pages.length - 1;
          break;
        case 'ArrowUp':
          next = current >= cols ? current - cols : 0;
          break;
        default:
          return;
      }

      this.navigateTo(next, extend);
    },

    navigateTo(index, extend) {
      if (index < 0 || index >= this.pages.length) return;

      this.focusIndex = index;
      this.cursorPosition = index + 1;

      const page = this.pages[index];
      if (extend && this.anchor) {
        const anchorIdx = this.pages.findIndex(p => p.id === this.anchor);
        if (anchorIdx >= 0) {
          const [start, end] = anchorIdx < index
            ? [anchorIdx, index] : [index, anchorIdx];
          this.selected = this.pages.slice(start, end + 1).map(p => p.id);
        }
      } else {
        this.selected = [page.id];
        this.anchor = page.id;
      }

      this.scrollToPage(index);
    },

    // --- Background click ---

    onBackgroundClick(e) {
      this.selected = [];
      this.focusIndex = -1;

      const cards = this.$refs.scrollArea?.querySelectorAll('.editor-page');
      if (!cards || !cards.length) {
        this.cursorPosition = 0;
        return;
      }

      const x = e.clientX;
      const y = e.clientY;
      let closestIdx = 0;
      let closestDist = Infinity;

      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      const rect = cards[closestIdx].getBoundingClientRect();
      this.cursorPosition = x < rect.left + rect.width / 2
        ? closestIdx : closestIdx + 1;

      this.$refs.scrollArea?.focus({ preventScroll: true });
    },

    // --- Operations ---

    pushState() {
      this.undoStack.push(this.pages);
    },

    undo() {
      const state = this.undoStack.undo();
      if (state) {
        this.pages = state;
        this.selected = [];
        this.clampCursor();
      }
    },

    redo() {
      const state = this.undoStack.redo();
      if (state) {
        this.pages = state;
        this.selected = [];
        this.clampCursor();
      }
    },

    clampCursor() {
      if (this.cursorPosition > this.pages.length) {
        this.cursorPosition = this.pages.length;
      }
      if (this.focusIndex >= this.pages.length) {
        this.focusIndex = this.pages.length - 1;
      }
    },

    onDragEnd(evt) {
      this.focusIndex = evt.newIndex;
      this.cursorPosition = evt.newIndex + 1;
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
      if (this.selected.length === 0) return;
      const firstDeletedIdx = this.pages.findIndex(p => this.selected.includes(p.id));
      this.pages = this.pages.filter(p => !this.selected.includes(p.id));
      this.selected = [];
      this.cursorPosition = Math.min(firstDeletedIdx, this.pages.length);
      this.focusIndex = this.cursorPosition > 0
        ? this.cursorPosition - 1
        : (this.pages.length > 0 ? 0 : -1);
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
      this.pages.splice(this.cursorPosition, 0, blank);
      this.cursorPosition++;
      this.focusIndex = this.cursorPosition - 1;
      this.selected = [blank.id];
      this.anchor = blank.id;
      this.pushState();
      this.scrollToPage(this.focusIndex);
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
        this.pages.splice(this.cursorPosition, 0, ...newPages);
        this.cursorPosition += newPages.length;
        this.focusIndex = this.cursorPosition - 1;
        this.pushState();
        this.addPagesFile = null;
        this.scrollToPage(this.focusIndex);
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
      while (filename.toLowerCase().endsWith('.pdf')) {
        filename = filename.slice(0, -4);
      }
      filename += '.pdf';

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
.editor-scroll:focus {
  outline: none;
}

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

.editor-page-anchor::after {
  content: '';
  position: absolute;
  top: 8px;
  left: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  opacity: 0.7;
  pointer-events: none;
}

.editor-cursor-before::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: rgb(var(--v-theme-primary));
  border-radius: 1px;
  pointer-events: none;
}

.editor-cursor-after::before {
  content: '';
  position: absolute;
  right: -8px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: rgb(var(--v-theme-primary));
  border-radius: 1px;
  pointer-events: none;
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
