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
      tabindex="0" @keydown="onKeydown" @click.self="onBackgroundClick"
      @mousedown="onScrollAreaMousedown">
      <draggable
        v-model="pages"
        item-key="id"
        class="editor-grid"
        ghost-class="editor-ghost"
        handle=".editor-page"
        filter=".source-divider"
        @end="onDragEnd"
        @click.self="onBackgroundClick">
        <template #item="{ element, index }">
          <div style="display: contents">
            <!-- Source section divider before first page of each new source group -->
            <div v-if="showDividers && sourceBreaks.has(index)"
              class="source-divider d-flex align-center my-1">
              <v-divider />
              <v-chip class="mx-2" size="x-small" label>{{ element.source }}</v-chip>
              <v-divider />
            </div>

            <!-- Page card -->
            <div
              class="editor-page"
              :class="pageClasses(element, index)"
              :data-orig-idx="element.originalIndex"
              @click.exact="selectOne(element.id, index)"
              @click.ctrl.exact="toggleSelect(element.id)"
              @click.meta.exact="toggleSelect(element.id)"
              @click.shift.exact="selectRange(element.id, index)"
              @contextmenu.prevent="openContextMenu(element, index, $event)">
              <div class="editor-thumb-wrap">
                <v-img
                  v-if="sessionId && !element.isBlank && loadedThumbs[element.originalIndex]"
                  :src="`api/v1/editor/sessions/${sessionId}/pages/${element.originalIndex}/thumbnail`"
                  :class="thumbRotationClass(element.rotation)"
                  width="160"
                  height="160"
                  cover />
                <v-skeleton-loader
                  v-else-if="sessionId && !element.isBlank"
                  type="image"
                  width="160"
                  height="160" />
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
          </div>
        </template>
      </draggable>
    </div>

    <!-- Status bar -->
    <div class="px-4 py-2 text-caption d-flex align-center" style="gap: 4px; flex-wrap: wrap;">
      <span>{{ $t('editor.status', [pages.length]) }}</span>
      <template v-if="sourceFiles.length">
        <span>· {{ $t('editor.sources', [sourceFiles.join(', ')]) }}</span>
      </template>
      <v-spacer />
      <template v-if="pages.length > 0">
        <span class="text-medium-emphasis">{{ $t('editor.jump-to') }}</span>
        <v-text-field
          v-model.number="jumpToPage"
          type="number"
          density="compact"
          hide-details
          variant="underlined"
          min="1"
          :max="pages.length"
          style="width: 56px; flex-shrink: 0;"
          @keyup.enter="doJumpToPage" />
        <v-btn :icon="mdiArrowRightCircle" size="x-small" variant="text"
          :title="$t('editor.jump-to')" @click="doJumpToPage" />
      </template>
    </div>

    <!-- Rubber-band selection overlay -->
    <div v-if="rubberBand" class="rubber-band-rect" :style="rubberBandStyle" />

    <!-- Context menu -->
    <v-menu v-model="contextMenuVisible" :target="[contextMenuX, contextMenuY]">
      <v-list density="compact" nav>
        <v-list-item :prepend-icon="mdiRotateRight" :title="$t('editor.rotate-cw')"
          :disabled="selected.length === 0"
          @click="rotateSelected(90)" />
        <v-list-item :prepend-icon="mdiRotateLeft" :title="$t('editor.rotate-ccw')"
          :disabled="selected.length === 0"
          @click="rotateSelected(-90)" />
        <v-list-item :prepend-icon="mdiDelete" :title="$t('editor.delete')"
          :disabled="selected.length === 0"
          @click="deleteSelected" />
        <v-divider class="my-1" />
        <v-list-item :prepend-icon="mdiFileDocumentPlus"
          :title="$t('editor.insert-blank-before')"
          @click="addBlankAtPosition(contextTargetIndex)" />
        <v-list-item :prepend-icon="mdiFileDocumentPlus"
          :title="$t('editor.insert-blank-after')"
          @click="addBlankAtPosition(contextTargetIndex + 1)" />
        <v-divider class="my-1" />
        <v-list-item :title="$t('editor.select-all')"
          :disabled="selected.length === pages.length && pages.length > 0"
          @click="selectAll" />
        <v-list-item :title="$t('editor.deselect-all')"
          :disabled="selected.length === 0"
          @click="deselectAll" />
      </v-list>
    </v-menu>

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
  mdiDelete, mdiFilePlus, mdiFileDocumentPlus, mdiArrowRightCircle
} from '@mdi/js';

const EAGER_LOAD_THRESHOLD = 50;
const THUMB_OBSERVER_MARGIN = '200px';

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
      mdiDelete, mdiFilePlus, mdiFileDocumentPlus, mdiArrowRightCircle
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
      initialHash: null,

      // Virtualized thumbnails
      loadedThumbs: {},
      thumbnailObserver: null,

      // Context menu
      contextMenuVisible: false,
      contextMenuX: 0,
      contextMenuY: 0,
      contextTargetIndex: -1,

      // Rubber-band selection
      rubberBand: null,

      // Jump-to-page
      jumpToPage: '',
      pulsePageIndex: -1,

      // Source tracking
      hasReordered: false
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
    },

    // Source section dividers
    showDividers() {
      return !this.hasReordered && this.sourceFiles.length > 1;
    },
    sourceBreaks() {
      const breaks = new Set();
      if (!this.showDividers) return breaks;
      for (let i = 1; i < this.pages.length; i++) {
        if (this.pages[i].source !== this.pages[i - 1].source) {
          breaks.add(i);
        }
      }
      return breaks;
    },

    // Rubber-band overlay style (viewport coordinates)
    rubberBandStyle() {
      if (!this.rubberBand) return {};
      const { x1, y1, x2, y2 } = this.rubberBand;
      return {
        left: Math.min(x1, x2) + 'px',
        top: Math.min(y1, y2) + 'px',
        width: Math.abs(x2 - x1) + 'px',
        height: Math.abs(y2 - y1) + 'px'
      };
    }
  },

  watch: {
    sessionId(val) {
      if (val) this.loadSession();
    },
    isDirty(val) {
      this.$emit('dirty', val);
    },
    pages() {
      if (this.thumbnailObserver) {
        this.$nextTick(this.observeCards);
      }
    }
  },

  mounted() {
    this.setupThumbnailObserver();
  },

  beforeUnmount() {
    this.thumbnailObserver?.disconnect();
    this.thumbnailObserver = null;
    this._removeRubberListeners();
  },

  methods: {
    // --- Thumbnail virtualization ---

    setupThumbnailObserver() {
      this.thumbnailObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.origIdx);
            if (!isNaN(idx) && !this.loadedThumbs[idx]) {
              this.loadedThumbs[idx] = true;
            }
          }
        }
      }, { root: this.$refs.scrollArea, rootMargin: THUMB_OBSERVER_MARGIN });
    },

    observeCards() {
      if (!this.thumbnailObserver) return;
      this.thumbnailObserver.disconnect();
      const cards = this.$refs.scrollArea?.querySelectorAll('.editor-page[data-orig-idx]');
      cards?.forEach(card => this.thumbnailObserver.observe(card));
    },

    eagerLoadThumbs() {
      for (const page of this.pages) {
        if (!page.isBlank) {
          this.loadedThumbs[page.originalIndex] = true;
        }
      }
    },

    // --- Session ---

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

        this.loadedThumbs = {};
        this.hasReordered = false;

        if (this.pages.length < EAGER_LOAD_THRESHOLD) {
          this.eagerLoadThumbs();
        }

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
          if (this.pages.length >= EAGER_LOAD_THRESHOLD) {
            this.observeCards();
          }
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
      this.loadedThumbs = {};
      this.hasReordered = false;
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

    scrollToPage(index, block = 'nearest') {
      if (index < 0 || index >= this.pages.length) return;
      this.$nextTick(() => {
        const cards = this.$refs.scrollArea?.querySelectorAll('.editor-page');
        if (cards && cards[index]) {
          cards[index].scrollIntoView({ behavior: 'smooth', block });
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
          && index === this.pages.length - 1,
        'editor-page-pulse': this.pulsePageIndex === index
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
      if (this._suppressNextClick) {
        this._suppressNextClick = false;
        return;
      }
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

    // --- Rubber-band selection ---

    onScrollAreaMousedown(e) {
      // Only left button, only on background (not on a page card)
      if (e.button !== 0 || e.target.closest('.editor-page')) return;
      e.preventDefault();
      this.rubberBand = {
        x1: e.clientX, y1: e.clientY,
        x2: e.clientX, y2: e.clientY,
        additive: e.ctrlKey || e.metaKey
      };
      this._onRubberMove = this._updateRubberBand.bind(this);
      this._onRubberUp = this._endRubberBand.bind(this);
      document.addEventListener('mousemove', this._onRubberMove);
      document.addEventListener('mouseup', this._onRubberUp);
    },

    _updateRubberBand(e) {
      if (!this.rubberBand) return;
      this.rubberBand = { ...this.rubberBand, x2: e.clientX, y2: e.clientY };
    },

    _endRubberBand(e) {
      const band = this.rubberBand;
      this.rubberBand = null;
      this._removeRubberListeners();
      if (!band) return;

      const { x1, y1, x2, y2, additive } = band;
      const rLeft = Math.min(x1, x2), rRight = Math.max(x1, x2);
      const rTop = Math.min(y1, y2), rBottom = Math.max(y1, y2);

      // Ignore tiny drags (treat as a click)
      if (rRight - rLeft < 4 && rBottom - rTop < 4) return;

      this._suppressNextClick = true;

      const cards = this.$refs.scrollArea?.querySelectorAll('.editor-page');
      const ids = [];
      if (cards) {
        for (let i = 0; i < cards.length; i++) {
          const rect = cards[i].getBoundingClientRect();
          if (rect.left < rRight && rect.right > rLeft &&
              rect.top < rBottom && rect.bottom > rTop) {
            const page = this.pages[i];
            if (page) ids.push(page.id);
          }
        }
      }

      if (additive) {
        this.selected = [...new Set([...this.selected, ...ids])];
      } else {
        this.selected = ids;
      }

      if (ids.length > 0) {
        const firstId = ids[0];
        const firstIdx = this.pages.findIndex(p => p.id === firstId);
        this.anchor = firstId;
        this.focusIndex = firstIdx;
        this.cursorPosition = firstIdx + 1;
      }

      this.$refs.scrollArea?.focus({ preventScroll: true });
    },

    _removeRubberListeners() {
      if (this._onRubberMove) {
        document.removeEventListener('mousemove', this._onRubberMove);
        this._onRubberMove = null;
      }
      if (this._onRubberUp) {
        document.removeEventListener('mouseup', this._onRubberUp);
        this._onRubberUp = null;
      }
    },

    // --- Context menu ---

    openContextMenu(element, index, e) {
      // Right-click on an unselected page selects it first
      if (!this.selected.includes(element.id)) {
        this.selectOne(element.id, index);
      }
      this.contextTargetIndex = index;
      this.contextMenuX = e.clientX;
      this.contextMenuY = e.clientY;
      this.contextMenuVisible = true;
    },

    // --- Jump-to-page ---

    doJumpToPage() {
      const n = parseInt(this.jumpToPage);
      if (isNaN(n)) return;
      const idx = Math.max(0, Math.min(n - 1, this.pages.length - 1));
      this.scrollToPage(idx, 'center');
      this.pulsePageIndex = idx;
      setTimeout(() => { this.pulsePageIndex = -1; }, 700);
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
      this.hasReordered = true;
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
      this.addBlankAtPosition(this.cursorPosition);
    },

    addBlankAtPosition(pos) {
      const insertAt = Math.max(0, Math.min(pos, this.pages.length));
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
      this.pages.splice(insertAt, 0, blank);
      this.cursorPosition = insertAt + 1;
      this.focusIndex = insertAt;
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
        // Eager-load thumbnails for newly added pages
        for (const p of newPages) {
          this.loadedThumbs[p.originalIndex] = true;
        }
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

@keyframes editorPulse {
  0%   { box-shadow: 0 0 0 0   rgba(var(--v-theme-primary), 0.5); }
  50%  { box-shadow: 0 0 0 8px rgba(var(--v-theme-primary), 0.2); }
  100% { box-shadow: 0 0 0 0   rgba(var(--v-theme-primary), 0); }
}

.editor-page-pulse {
  animation: editorPulse 0.7s ease-out;
}

.source-divider {
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.rubber-band-rect {
  position: fixed;
  border: 1px solid rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  pointer-events: none;
  z-index: 9999;
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
