<template>
  <div class="editor-root d-flex flex-column" style="height: 100%;">
    <v-toolbar density="compact" flat>
      <template v-if="touchSelectMode">
        <v-chip size="small" color="primary" class="ml-2 mr-1" label>
          {{ $t('editor.selection-mode') }}
        </v-chip>
        <v-spacer />
        <v-btn :disabled="selected.length === 0" :icon="mdiRotateLeft" size="small"
          :title="$t('editor.rotate-ccw')" @click="rotateSelected(-90)" />
        <v-btn :disabled="selected.length === 0" :icon="mdiRotateRight" size="small"
          :title="$t('editor.rotate-cw')" @click="rotateSelected(90)" />
        <v-btn :disabled="selected.length === 0" :icon="mdiDelete" size="small"
          :title="$t('editor.delete')" @click="deleteSelected" />
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" :icon="mdiShuffleVariant" size="small"
              :title="$t('editor.page-order')" :disabled="pages.length < 2" />
          </template>
          <v-list density="compact" nav>
            <v-list-subheader>{{ duplexScopeLabel }}</v-list-subheader>
            <v-list-item :title="$t('editor.op-reverse')"
              :disabled="!canDuplexOp" @click="opReverse" />
            <v-list-item :title="$t('editor.op-interleave-reverse')"
              :subtitle="$t('editor.op-interleave-reverse-hint')"
              :disabled="!canDuplexOp || duplexWorkingLength < 4"
              @click="opInterleaveReverse" />
            <v-list-item :title="$t('editor.op-interleave')"
              :disabled="!canDuplexOp || duplexWorkingLength < 4"
              @click="opInterleave" />
            <v-list-item :title="$t('editor.op-swap-pairs')"
              :disabled="!canDuplexOp" @click="opSwapPairs" />
            <v-list-item :title="$t('editor.op-deinterleave')"
              :disabled="!canDuplexOp || duplexWorkingLength < 4"
              @click="opDeinterleave" />
          </v-list>
        </v-menu>
        <v-divider vertical class="mx-2" />
        <v-btn size="small" variant="tonal" @click="exitTouchSelectMode">
          {{ $t('editor.done') }}
        </v-btn>
      </template>
      <template v-else>
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
        <v-divider vertical class="mx-2" />
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" :icon="mdiShuffleVariant" size="small"
              :title="$t('editor.page-order')" :disabled="pages.length < 2" />
          </template>
          <v-list density="compact" nav>
            <v-list-subheader>{{ duplexScopeLabel }}</v-list-subheader>
            <v-list-item :title="$t('editor.op-reverse')"
              :disabled="!canDuplexOp" @click="opReverse" />
            <v-list-item :title="$t('editor.op-interleave-reverse')"
              :subtitle="$t('editor.op-interleave-reverse-hint')"
              :disabled="!canDuplexOp || duplexWorkingLength < 4"
              @click="opInterleaveReverse" />
            <v-list-item :title="$t('editor.op-interleave')"
              :disabled="!canDuplexOp || duplexWorkingLength < 4"
              @click="opInterleave" />
            <v-list-item :title="$t('editor.op-swap-pairs')"
              :disabled="!canDuplexOp" @click="opSwapPairs" />
            <v-list-item :title="$t('editor.op-deinterleave')"
              :disabled="!canDuplexOp || duplexWorkingLength < 4"
              @click="opDeinterleave" />
          </v-list>
        </v-menu>
        <v-spacer />
      </template>
    </v-toolbar>

    <div ref="scrollArea"
      :class="['pa-4', 'overflow-y-auto', 'flex-grow-1', 'editor-scroll',
               { 'editor-touch-select-active': touchSelectMode }]"
      tabindex="0" @keydown="onKeydown" @click.self="onBackgroundClick"
      @mousedown="onScrollAreaMousedown">

      <!-- Positioning context for the source-divider overlay -->
      <div class="editor-content-wrapper">
        <draggable
          v-model="pages"
          item-key="id"
          class="editor-grid"
          ghost-class="editor-ghost"
          :delay="150"
          :delay-on-touch-only="true"
          @start="onDragStart"
          @end="onDragEnd"
          @click.self="onBackgroundClick">
          <template #item="{ element, index }">
            <!-- Page card is the direct sortable item — no wrapper div so
                 SortableJS can correctly compute its position and build a ghost. -->
            <div
              class="editor-page"
              :class="[pageClasses(element, index),
                       { 'editor-page-source-break': showDividers && sourceBreaks.has(index) }]"
              :data-orig-idx="element.originalIndex"
              @click.exact="selectOne(element.id, index)"
              @click.ctrl.exact="toggleSelect(element.id)"
              @click.meta.exact="toggleSelect(element.id)"
              @click.shift.exact="selectRange(element.id, index)"
              @contextmenu.prevent="openContextMenu(element, index, $event)"
              @touchstart="onPageTouchStart(element, index, $event)"
              @touchmove="onPageTouchMove"
              @touchend="onPageTouchEnd">
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
              <!-- Source badge: only shown for multi-source docs after reordering,
                   when section dividers are no longer present. -->
              <div v-if="showSourceBadge && !element.isBlank"
                class="editor-source-badge text-caption text-truncate"
                :title="element.source">
                {{ element.source }}
              </div>
            </div>
          </template>
        </draggable>

        <!-- Source section dividers rendered as an absolutely-positioned overlay so
             they don't interfere with SortableJS's DOM-based item tracking. -->
        <div v-if="showDividers && dividerPositions.length"
          class="source-dividers-overlay" aria-hidden="true">
          <div v-for="d in dividerPositions" :key="d.source"
            class="source-divider d-flex align-center"
            :style="{ top: d.top + 'px' }">
            <v-divider />
            <v-chip class="mx-2" size="x-small" label>{{ d.source }}</v-chip>
            <v-divider />
          </div>
        </div>
      </div>
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
          :placeholder="`1–${pages.length}`"
          style="width: 64px; flex-shrink: 0;"
          @keyup.enter="doJumpToPage" />
        <v-btn :icon="mdiArrowRightCircle" size="x-small" variant="text"
          :title="$t('editor.jump-to')" @click="doJumpToPage" />
      </template>
    </div>

    <!-- Rubber-band selection rect — teleported to <body> so that position:fixed is
         relative to the viewport, not to any CSS-transformed ancestor (v-dialog). -->
    <teleport to="body">
      <div v-if="rubberBand" class="rubber-band-rect" :style="rubberBandStyle" />
    </teleport>

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
        <template v-if="canDuplexOp">
          <v-divider class="my-1" />
          <v-list-item :title="$t('editor.op-reverse')" @click="opReverse" />
          <v-list-item v-if="duplexWorkingLength >= 4"
            :title="$t('editor.op-interleave-reverse')"
            @click="opInterleaveReverse" />
        </template>
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
  mdiDelete, mdiFilePlus, mdiFileDocumentPlus, mdiArrowRightCircle,
  mdiShuffleVariant
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
      mdiDelete, mdiFilePlus, mdiFileDocumentPlus, mdiArrowRightCircle,
      mdiShuffleVariant
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
      hasReordered: false,

      // Source divider overlay positions (computed after DOM update)
      dividerPositions: [],

      // Touch long-press selection mode
      touchSelectMode: false,

      // Multi-item drag state
      isDragging: false
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

    // Source section dividers: shown only before any reordering on multi-source docs
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

    // Source badge: visible only for multi-source docs after reordering (dividers gone)
    showSourceBadge() {
      return !this.showDividers && this.sourceFiles.length > 1;
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
    },

    // --- Duplex page operations ---

    isContiguousSelection() {
      if (this.selected.length <= 1) return true;
      const indices = this.selected
        .map(id => this.pages.findIndex(p => p.id === id))
        .sort((a, b) => a - b);
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) return false;
      }
      return true;
    },

    duplexWorkingRange() {
      if (this.selected.length >= 2 && this.isContiguousSelection) {
        const indices = this.selected
          .map(id => this.pages.findIndex(p => p.id === id))
          .sort((a, b) => a - b);
        return { start: indices[0], end: indices[indices.length - 1], scope: 'selection' };
      }
      if (this.pages.length >= 2) {
        return { start: 0, end: this.pages.length - 1, scope: 'all' };
      }
      return null;
    },

    duplexWorkingLength() {
      const r = this.duplexWorkingRange;
      return r ? r.end - r.start + 1 : 0;
    },

    canDuplexOp() {
      return this.duplexWorkingLength >= 2 && this.isContiguousSelection;
    },

    duplexScopeLabel() {
      const r = this.duplexWorkingRange;
      if (!r) return '';
      const n = r.end - r.start + 1;
      return r.scope === 'selection'
        ? this.$t('editor.scope-selection', [n])
        : this.$t('editor.scope-all', [n]);
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
      this.$nextTick(() => {
        this.observeCards();
        this.updateDividerPositions();
      });
    },
    showDividers() {
      this.$nextTick(() => this.updateDividerPositions());
    },
    contextMenuVisible(visible) {
      // Vuetify's click-outside directive may not fire from touch events.
      // Manually listen for any touch to dismiss the context menu.
      if (visible) {
        this._dismissContextMenu = () => { this.contextMenuVisible = false; };
        setTimeout(() => {
          document.addEventListener('touchstart', this._dismissContextMenu, { once: true });
        }, 0);
      } else if (this._dismissContextMenu) {
        document.removeEventListener('touchstart', this._dismissContextMenu);
        this._dismissContextMenu = null;
      }
    }
  },

  mounted() {
    this.setupThumbnailObserver();
    this._resizeObserver = new ResizeObserver(() => {
      if (this.showDividers) this.updateDividerPositions();
    });
    if (this.$refs.scrollArea) {
      this._resizeObserver.observe(this.$refs.scrollArea);
      // Register touchstart with { passive: false } so preventDefault() works
      // in touch rubber-band selection mode. Vue's @touchstart always registers
      // as passive, which silently ignores preventDefault().
      this._boundScrollAreaTouchStart = this.onScrollAreaTouchStart.bind(this);
      this.$refs.scrollArea.addEventListener(
        'touchstart', this._boundScrollAreaTouchStart, { passive: false }
      );
    }
  },

  beforeUnmount() {
    this.thumbnailObserver?.disconnect();
    this.thumbnailObserver = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this.$refs.scrollArea && this._boundScrollAreaTouchStart) {
      this.$refs.scrollArea.removeEventListener(
        'touchstart', this._boundScrollAreaTouchStart
      );
      this._boundScrollAreaTouchStart = null;
    }
    this._removeRubberListeners();
    this._cancelLongPress();
    if (this._dismissContextMenu) {
      document.removeEventListener('touchstart', this._dismissContextMenu);
      this._dismissContextMenu = null;
    }
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

    // --- Source divider overlay ---

    updateDividerPositions() {
      if (!this.showDividers) { this.dividerPositions = []; return; }
      const cards = this.$refs.scrollArea?.querySelectorAll('.editor-page');
      if (!cards) { this.dividerPositions = []; return; }
      const positions = [];
      for (const idx of this.sourceBreaks) {
        const card = cards[idx];
        if (card) {
          // offsetTop is relative to .editor-content-wrapper (position: relative).
          // The divider (height: 28px) is centered in the 36px margin-top above the card.
          positions.push({ top: card.offsetTop - 32, source: this.pages[idx].source });
        }
      }
      this.dividerPositions = positions;
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
          this.updateDividerPositions();
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
      this.dividerPositions = [];
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
        'editor-page-pulse': this.pulsePageIndex === index,
        'editor-page-drag-peer': this.isDragging && this.selected.includes(element.id)
      };
    },

    // --- Selection ---

    selectOne(id, index) {
      // Suppress the click that fires immediately after a long-press
      if (this._longPressSuppressClick) {
        this._longPressSuppressClick = false;
        return;
      }
      // In touch select mode, taps toggle rather than select-one
      if (this.touchSelectMode) {
        this.toggleSelect(id);
        return;
      }
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
      if (this.touchSelectMode) {
        this.exitTouchSelectMode();
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

      // Ignore tiny drags (treat as a click/tap)
      if (rRight - rLeft < 4 && rBottom - rTop < 4) {
        // Touch tap on background in selection mode → exit selection mode
        if (this.touchSelectMode) {
          this.exitTouchSelectMode();
        }
        return;
      }

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

    // Touch rubber-band: available in touchSelectMode on background swipes
    onScrollAreaTouchStart(e) {
      if (!this.touchSelectMode) return;
      if (e.target.closest('.editor-page')) return;
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      this.rubberBand = {
        x1: touch.clientX, y1: touch.clientY,
        x2: touch.clientX, y2: touch.clientY,
        additive: false
      };
      this._onRubberTouchMove = (ev) => {
        if (!this.rubberBand || ev.touches.length !== 1) return;
        ev.preventDefault();
        const t = ev.touches[0];
        this.rubberBand = { ...this.rubberBand, x2: t.clientX, y2: t.clientY };
      };
      this._onRubberTouchEnd = () => {
        document.removeEventListener('touchmove', this._onRubberTouchMove);
        document.removeEventListener('touchend', this._onRubberTouchEnd);
        this._onRubberTouchMove = null;
        this._onRubberTouchEnd = null;
        this._endRubberBand({});
      };
      document.addEventListener('touchmove', this._onRubberTouchMove, { passive: false });
      document.addEventListener('touchend', this._onRubberTouchEnd);
    },

    // --- Touch long-press selection mode ---

    _cancelLongPress() {
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
      }
    },

    onPageTouchStart(element, index, e) {
      this._isTouching = true;
      this._cancelLongPress();
      this._longPressId = element.id;
      this._longPressIdx = index;
      this._longPressStartX = e.touches[0]?.clientX ?? 0;
      this._longPressStartY = e.touches[0]?.clientY ?? 0;
      this._longPressTimer = setTimeout(() => {
        this._longPressTimer = null;
        if (!this.touchSelectMode) {
          this.touchSelectMode = true;
          // Select the long-pressed page without waiting for the subsequent click
          this.selected = [element.id];
          this.anchor = element.id;
          this.focusIndex = index;
          this.cursorPosition = index + 1;
          // Suppress the click that fires right after touchend
          this._longPressSuppressClick = true;
        }
      }, 500);
    },

    onPageTouchMove(e) {
      // Cancel long-press only if the finger moved more than ~10px (ignore tremor)
      if (!this._longPressTimer) return;
      const t = e.touches[0];
      if (t) {
        const dx = t.clientX - this._longPressStartX;
        const dy = t.clientY - this._longPressStartY;
        if (dx * dx + dy * dy > 100) this._cancelLongPress();
      } else {
        this._cancelLongPress();
      }
    },

    onPageTouchEnd() {
      this._cancelLongPress();
      // Clear _isTouching after a microtask so the contextmenu event
      // (which fires between touchend and click) still sees it as true.
      setTimeout(() => { this._isTouching = false; }, 0);
    },

    exitTouchSelectMode() {
      this.touchSelectMode = false;
      this.selected = [];
      this.focusIndex = -1;
    },

    // --- Context menu ---

    openContextMenu(element, index, e) {
      // Don't open the context menu from touch — long-press is used for
      // selection mode, and the menu is hard to dismiss on touch devices.
      if (this._isTouching || this.touchSelectMode) return;
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
      const page = this.pages[idx];
      if (!page) return;
      // Select the target page so it is highlighted even if no scrolling occurs.
      this.selectOne(page.id, idx);
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

    // --- Drag-and-drop ---

    onDragStart(evt) {
      // Snapshot the full page array before vuedraggable's single-item splice
      // runs in onDragUpdate. We need this to reconstruct multi-item moves.
      this._dragStartPages = [...this.pages];
      this._dragStartSelected = [...this.selected];
      this.isDragging = true;
    },

    onDragEnd(evt) {
      this.isDragging = false;
      this.hasReordered = true;
      // Suppress the click that fires after a touch drag ends, which would
      // otherwise toggle the dragged item out of the selection.
      this._longPressSuppressClick = true;

      const dragStartPages = this._dragStartPages;
      const dragStartSelected = this._dragStartSelected;
      this._dragStartPages = null;
      this._dragStartSelected = null;

      const selectedIds = new Set(dragStartSelected || []);
      const draggedId = dragStartPages?.[evt.oldIndex]?.id;

      if (draggedId && selectedIds.has(draggedId) && selectedIds.size > 1) {
        // Multi-item drag: vuedraggable already moved the dragged item to
        // evt.newIndex via its single-item splice. The other selected items
        // are still at their original positions. Reconstruct the array by
        // removing all selected items except the dragged one (which is at
        // its new position), then replacing it with the full group in
        // original relative order.
        const pageById = Object.fromEntries(this.pages.map(p => [p.id, p]));
        const group = dragStartPages
          .filter(p => selectedIds.has(p.id))
          .map(p => pageById[p.id])
          .filter(Boolean);

        const withoutOthers = this.pages.filter(
          p => !selectedIds.has(p.id) || p.id === draggedId
        );
        const draggedPos = withoutOthers.findIndex(p => p.id === draggedId);
        withoutOthers.splice(draggedPos, 1, ...group);
        this.pages = withoutOthers;

        const draggedGroupIdx = group.findIndex(p => p.id === draggedId);
        this.focusIndex = draggedPos + draggedGroupIdx;
        this.cursorPosition = this.focusIndex + 1;
      } else {
        // Single-item drag: vuedraggable already handled the splice correctly
        this.focusIndex = evt.newIndex;
        this.cursorPosition = evt.newIndex + 1;
      }

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

    // --- Duplex page-order operations ---

    _applyPageOrderOp(transformFn) {
      const range = this.duplexWorkingRange;
      if (!range) return;
      const { start, end } = range;
      const slice = this.pages.slice(start, end + 1);
      const result = transformFn(slice);
      this.pages.splice(start, slice.length, ...result);
      this.hasReordered = true;
      this.selected = this.pages.slice(start, start + result.length).map(p => p.id);
      this.focusIndex = start;
      this.cursorPosition = start + result.length;
      this.pushState();
    },

    opReverse() {
      this._applyPageOrderOp(s => [...s].reverse());
    },

    opInterleave() {
      this._applyPageOrderOp(s => {
        const mid = Math.ceil(s.length / 2);
        const a = s.slice(0, mid), b = s.slice(mid);
        const r = [];
        for (let i = 0; i < a.length; i++) {
          r.push(a[i]);
          if (i < b.length) r.push(b[i]);
        }
        return r;
      });
    },

    opInterleaveReverse() {
      this._applyPageOrderOp(s => {
        const mid = Math.ceil(s.length / 2);
        const a = s.slice(0, mid), b = s.slice(mid).reverse();
        const r = [];
        for (let i = 0; i < a.length; i++) {
          r.push(a[i]);
          if (i < b.length) r.push(b[i]);
        }
        return r;
      });
    },

    opSwapPairs() {
      this._applyPageOrderOp(s => {
        const r = [...s];
        for (let i = 0; i + 1 < r.length; i += 2) {
          [r[i], r[i + 1]] = [r[i + 1], r[i]];
        }
        return r;
      });
    },

    opDeinterleave() {
      this._applyPageOrderOp(s => [
        ...s.filter((_, i) => i % 2 === 0),
        ...s.filter((_, i) => i % 2 === 1)
      ]);
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

/* Suppress native long-press behaviors (context menu, text selection) on touch
   so our long-press-to-select and rubber-band handlers get full control. */
.editor-scroll {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Positioning context for the source-divider overlay */
.editor-content-wrapper {
  position: relative;
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

/* Extra top margin on the first card of each new source group,
   leaving room for the source-divider overlay to render into. */
.editor-page-source-break {
  margin-top: 36px;
}

/* Source-divider overlay: absolutely positioned relative to
   .editor-content-wrapper; scrolls with the flex grid content. */
.source-dividers-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
  overflow: visible;
}

.source-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
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

/* During multi-item drag: non-ghost selected items show a dashed border to
   signal they will move together with the dragged item. */
.editor-page-drag-peer:not(.editor-ghost) {
  opacity: 0.55;
  border-color: rgb(var(--v-theme-primary));
  border-style: dashed;
}

/* In touch selection mode, disable browser touch gestures on the scroll area
   so our touch handlers get full control (prevents scroll, pinch, long-press
   context menu from interfering with rubber-band selection). */
.editor-touch-select-active {
  touch-action: none;
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
