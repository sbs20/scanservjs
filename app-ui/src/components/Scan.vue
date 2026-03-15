<template>
  <div>
    <v-row>
      <v-spacer />

      <v-col cols="12" md="3" class="mb-10 mb-md-0">
        <div class="d-flex">
          <v-select v-if="context.devices.length > 0"
            v-model="device"
            style="min-width: 0px;"
            :label="$t('scan.device')"
            @update:model-value="clear"
            :items="context.devices" return-object item-title="name" />
          <v-btn small class="ml-2 mt-4 pl-1 pr-1" min-width="32" @click="deviceRefresh"><v-icon :icon="mdiRefresh" /></v-btn>
        </div>

        <v-select v-if="'--source' in device.features"
          v-model="request.params.source"
          :no-data-text="$t('global.no-data-text')" :label="$t('scan.source')"
          :items="sources" item-value="value" item-title="text" />

        <v-select v-if="'--adf-mode' in device.features"
          v-model="request.params.adfMode"
          :no-data-text="$t('global.no-data-text')" :label="$t('scan.adf-mode')"
          :items="adfModes" item-value="value" item-title="text" />

        <v-select
          v-model="request.params.resolution"
          :no-data-text="$t('global.no-data-text')" :label="$t('scan.resolution')"
          :items="device.features['--resolution']['options']" />

        <v-select v-if="'--mode' in device.features"
          v-model="request.params.mode"
          :no-data-text="$t('global.no-data-text')" :label="$t('scan.mode')"
          :items="modes" item-value="value" item-title="text" />

        <v-select v-if="'--disable-dynamic-lineart' in device.features"
          v-model="request.params.mode"
          :label="$t('scan.dynamic-lineart')"
          :items="[
            { value: false, text: $t('scan.dynamic-lineart:disabled') },
            { value: true, text: $t('scan.dynamic-lineart:enabled') }]"
          item-value="value" item-title="text" />

        <v-select v-model="request.batch" :label="$t('scan.batch')"
          :no-data-text="$t('global.no-data-text')"
          :items="batchModes" item-value="value" item-title="text" />

        <v-select
          v-model="request.filters"
          :no-data-text="$t('global.no-data-text')"
          :items="filters"
          item-title="text"
          item-value="value"
          :label="$t('scan.filters')"
          multiple
          @update:model-value="readPreview" />

        <v-select
          v-model="request.pipeline"
          :no-data-text="$t('global.no-data-text')"
          :label="$t('scan.format')"
          :items="pipelines"
          item-title="text"
          item-value="value" />

        <div class="d-flex flex-row-reverse flex-wrap">
          <v-btn color="blue" class="ml-1 mb-1" @click="scan(1)">{{ $t('scan.btn-scan') }} <v-icon class="ml-2" :icon="mdiCamera" /></v-btn>
          <v-btn v-if="geometry" color="green" class="ml-1 mb-1" @click="createPreview">{{ $t('scan.btn-preview') }} <v-icon class="ml-2" :icon="mdiMagnify" /></v-btn>
          <v-btn color="amber" class="ml-1 mb-1" @click="deletePreview">{{ $t('scan.btn-clear') }} <v-icon class="ml-2" :icon="mdiDelete" /></v-btn>
        </div>
      </v-col>

      <v-col cols="12" md="auto" class="mb-10 mb-md-0" :style="{width: `${preview.width}px`, overflow: 'hidden'}">
        <div class="d-flex justify-center mb-2">
          <v-btn-group density="comfortable" variant="outlined">
            <v-btn :disabled="!img || isBatchOrAdf" :title="$t('scan.magic-wand')" :color="transformations.magic ? 'primary' : undefined" @click="autoCrop"><v-icon :icon="mdiAutoFix" /></v-btn>
            <v-btn :disabled="!img" :title="$t('scan.rotate-ccw')" @click="rotateCounterClockwise"><v-icon :icon="mdiRotateLeft" /></v-btn>
            <v-btn :disabled="!img" :title="$t('scan.rotate-cw')" @click="rotateClockwise"><v-icon :icon="mdiRotateRight" /></v-btn>
            <v-btn :disabled="!img" :title="$t('scan.flip-h')" :color="transformations.flipH ? 'primary' : undefined" @click="toggleFlipHorizontal"><v-icon :icon="mdiFlipHorizontal" /></v-btn>
            <v-btn :disabled="!img" :title="$t('scan.flip-v')" :color="transformations.flipV ? 'primary' : undefined" @click="toggleFlipVertical"><v-icon :icon="mdiFlipVertical" /></v-btn>
          </v-btn-group>
        </div>
        <cropper v-if="geometry" ref="cropper" :key="preview.key" class="cropper" :transition-time="10" :wheel-resize="false"
            :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
            :src="img" :style="previewStyle" :stencil-props="cropperStencilProps" @change="onCropperChange" />
        <v-img v-if="!geometry" :src="img" :style="previewStyle" />
      </v-col>

      <v-col cols="12" md="3" class="mb-10 mb-md-0">
        <template v-if="geometry">
          <v-row no-gutters class="mb-2">
            <v-col cols="7">
              <v-text-field :model-value="request.params.top" :label="$t('scan.top')" type="text"
                 @input="onDimensionInput($event, 'top')" @blur="commitDimension('top', $event)" @keyup.enter="$event.target.blur()"
                 prefix="mm" hide-details="auto" />
            </v-col>
            <v-col cols="5" class="d-flex align-center justify-center pl-2">
              <v-text-field :model-value="toPixels(request.params.top, 'y')" label="px" type="text"
                 @input="onPixelInput($event, 'top')" @blur="commitPixel('top', $event)" @keyup.enter="$event.target.blur()"
                 hide-details="auto" class="centered-input" density="compact" />
            </v-col>
          </v-row>
          <v-row no-gutters class="mb-2">
            <v-col cols="7">
              <v-text-field :model-value="request.params.left" :label="$t('scan.left')" type="text"
                 @input="onDimensionInput($event, 'left')" @blur="commitDimension('left', $event)" @keyup.enter="$event.target.blur()"
                 prefix="mm" hide-details="auto" />
            </v-col>
            <v-col cols="5" class="d-flex align-center justify-center pl-2">
              <v-text-field :model-value="toPixels(request.params.left, 'x')" label="px" type="text"
                 @input="onPixelInput($event, 'left')" @blur="commitPixel('left', $event)" @keyup.enter="$event.target.blur()"
                 hide-details="auto" class="centered-input" density="compact" />
            </v-col>
          </v-row>
          <v-row no-gutters class="mb-2">
            <v-col cols="7">
              <v-text-field :model-value="request.params.width" :label="$t('scan.width')" type="text"
                 @input="onDimensionInput($event, 'width')" @blur="commitDimension('width', $event)" @keyup.enter="$event.target.blur()"
                 prefix="mm" hide-details="auto" />
            </v-col>
            <v-col cols="5" class="d-flex align-center justify-center pl-2">
              <v-text-field :model-value="toPixels(request.params.width, 'x')" label="px" type="text"
                 @input="onPixelInput($event, 'width')" @blur="commitPixel('width', $event)" @keyup.enter="$event.target.blur()"
                 hide-details="auto" class="centered-input" density="compact" />
            </v-col>
          </v-row>
          <v-row no-gutters class="mb-2">
            <v-col cols="7">
              <v-text-field :model-value="request.params.height" :label="$t('scan.height')" type="text"
                 @input="onDimensionInput($event, 'height')" @blur="commitDimension('height', $event)" @keyup.enter="$event.target.blur()"
                 prefix="mm" hide-details="auto" />
            </v-col>
            <v-col cols="5" class="d-flex align-center justify-center pl-2">
              <v-text-field :model-value="toPixels(request.params.height, 'y')" label="px" type="text"
                 @input="onPixelInput($event, 'height')" @blur="commitPixel('height', $event)" @keyup.enter="$event.target.blur()"
                 hide-details="auto" class="centered-input" density="compact" />
            </v-col>
          </v-row>

          <v-row no-gutters class="mb-4">
            <v-col cols="7">
              <v-menu offset-y>
                <template #activator="{ props }">
                  <v-btn color="primary" block v-bind="props">{{ $t('scan.paperSize') }}</v-btn>
                </template>
                <v-list dense>
                  <v-list-item
                    v-for="(item, index) in paperSizes"
                    :key="index"
                    @click="updatePaperSize(item)">
                    <v-list-item-title>{{ item.name }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-col>
            <v-col cols="5" class="d-flex align-center justify-center pl-2">
              <v-btn
                :icon="aspectRatioLocked ? mdiLock : mdiLockOpenOutline"
                variant="text"
                density="comfortable"
                :color="aspectRatioLocked ? 'primary' : undefined"
                @click="toggleAspectRatioLock"
              />
            </v-col>
          </v-row>
        </template>

        <template v-if="'--brightness' in device.features">
          <v-slider v-model="request.params.brightness" class="align-center ml-0"
            :step="device.features['--brightness']['interval']"
            :min="device.features['--brightness']['limits'][0]"
            :max="device.features['--brightness']['limits'][1]">
            <template #prepend>
              <v-text-field v-model="request.params.brightness"
                :label="$t('scan.brightness')" style="width: 60px" type="number" />
            </template>
          </v-slider>
        </template>

        <div v-if="'--contrast' in device.features">
          <v-slider v-model="request.params.contrast" class="align-center ml-0"
            :step="device.features['--contrast']['interval']"
            :min="device.features['--contrast']['limits'][0]"
            :max="device.features['--contrast']['limits'][1]">
            <template #prepend>
              <v-text-field v-model="request.params.contrast"
                :label="$t('scan.contrast')" style="width: 60px" type="number" />
            </template>
          </v-slider>
        </div>
      </v-col>

      <v-spacer />
    </v-row>

    <batch-dialog ref="batchDialog" />
  </div>
</template>

<script>
import {
  mdiAutoFix,
  mdiCamera,
  mdiDelete,
  mdiFlipHorizontal,
  mdiFlipVertical,
  mdiLock,
  mdiLockOpenOutline,
  mdiMagnify,
  mdiRefresh,
  mdiRotateLeft,
  mdiRotateRight
} from '@mdi/js';
import { Cropper } from 'vue-advanced-cropper';
import { useI18n } from 'vue-i18n';
import BatchDialog from './BatchDialog.vue';

import Common from '../classes/common';
import Device from '../classes/device';
import Request from '../classes/request';
import Storage from '../classes/storage';

import 'vue-advanced-cropper/dist/style.css';

const storage = Storage.instance();

function round(n, dp) {
  const f = Math.pow(10, dp || 0);
  return Math.round(n * f) / f;
}

function sanitiseLocaleKey(s) {
  return s.toLowerCase().replace(/\[/g, '(').replace(/\]/g, ')');
}

export default {

  name: 'Scan',

  components: {
    Cropper,
    BatchDialog
  },

  emits: ['mask', 'notify'],

  setup() {
    const { te } = useI18n();
    return {
      mdiAutoFix,
      mdiCamera,
      mdiDelete,
      mdiFlipHorizontal,
      mdiFlipVertical,
      mdiLock,
      mdiLockOpenOutline,
      mdiMagnify,
      mdiRefresh,
      mdiRotateLeft,
      mdiRotateRight,
      te
    };
  },

  data() {
    const device = Device.default();
    device.name = this.$t('global.no-data-text');
    const request = Request.create(null, device);

    return {
      context: {
        devices: [
          device
        ],
        paperSizes: [],
        version: '0'
      },
      device: device,
      img: null,
      request: request,
      preview: {
        timer: 0,
        width: 400,
        key: 0
      },
      transformations: storage.transformations || {
        rotation: 0,
        flipH: false,
        flipV: false,
        magic: ''
      },
      aspectRatioLocked: storage.aspectRatioLocked || false,
      lockedAspectRatio: storage.lockedAspectRatio || null,
      baselineBrightness: 0,
      baselineContrast: 0,
      originalParams: null
    };
  },

  computed: {
    geometry() {
      return ['-x', '-y', '-l', '-t'].every(s => s in this.device.features);
    },

    deviceSize() {
      return !this.geometry ? undefined : {
        width: this.device.features['-x'].limits[1],
        height: this.device.features['-y'].limits[1]
      };
    },

    batchModes() {
      return this.device.settings.batchMode.options.map(mode => {
        const key = `batch-mode.${sanitiseLocaleKey(mode)}`;
        let translation = this.$t(key);
        return {
          text: translation === key ? mode : translation,
          value: mode
        };
      });
    },

    filters() {
      return this.device.settings.filters.options.map(f => {
        return {
          text: this.$t(f),
          value: f
        };
      });
    },

    modes() {
      return '--mode' in this.device.features
        ? this.device.features['--mode'].options.map(mode => {
          const key = `mode.${sanitiseLocaleKey(mode)}`;
          return {
            text: this.te(key) ? this.$t(key) : mode,
            value: mode
          };
        })
        : undefined;
    },

    adfModes() {
      return '--adf-mode' in this.device.features
        ? this.device.features['--adf-mode'].options.map(adfMode => {
          const key = `adf-mode.${sanitiseLocaleKey(adfMode)}`;
          return {
            text: this.te(key) ? this.$t(key) : adfMode,
            value: adfMode
          };
        })
        : undefined;
    },

    paperSizes() {
      if (!this.geometry) {
        return undefined;
      }

      const deviceSize = {
        x: this.device.features['-x'].limits[1],
        y: this.device.features['-y'].limits[1]
      };

      // Tolerance of 2.0mm to account for minute rounding discrepancies 
      // between standard paper sizes and scanner hardware reported limits.
      const tolerance = 2.0;
      return this.context.paperSizes
        .filter(paper => paper.dimensions.x <= deviceSize.x + tolerance && paper.dimensions.y <= deviceSize.y + tolerance)
        .map(paper => {
          const variables = (paper.name.match(/@:[a-z-.]+/ig) || []).map(s => s.substr(2));
          variables.forEach(v => {
            paper.name = paper.name.replaceAll(`@:${v}`, this.$t(v));
          });
          return paper;
        });
    },

    pipelines() {
      return this.device.settings.pipeline.options.map(p => {
        const variables = (p.match(/@:[a-z-.]+/ig) || []).map(s => s.substr(2));
        let text = p;
        variables.forEach(v => {
          text = text.replaceAll(`@:${v}`, this.$t(v));
        });

        return {
          text: text,
          value: p
        };
      });
    },

    sources() {
      return '--source' in this.device.features
        ? this.device.features['--source'].options.map(source => {
          const key = `source.${sanitiseLocaleKey(source)}`;
          const x =  {
            text: this.te(key) ? this.$t(key) : source,
            value: source
          };
          return x;
        })
        : undefined;
    },

    previewStyle() {
      if (!this.img) {
        return {};
      }

      const calcFilter = (val, baseline, feature) => {
        if (!feature) return 100;
        const limits = feature.limits;
        const min = limits[0];
        const max = limits[1];
        const normal = min < 0 ? 0 : (min + max) / 2;
        const range = max - normal;
        if (range === 0) return 100;
        return 100 * (1 + (val - baseline) / range);
      };

      const brightness = calcFilter(this.request.params.brightness || 0, this.baselineBrightness, this.device.features['--brightness']);
      const contrast = calcFilter(this.request.params.contrast || 0, this.baselineContrast, this.device.features['--contrast']);

      return {
        filter: `brightness(${brightness}%) contrast(${contrast}%)`
      };
    },

    cropperStencilProps() {
      if (this.aspectRatioLocked && this.lockedAspectRatio) {
        return { aspectRatio: this.lockedAspectRatio };
      }
      return {};
    },

    isBatchOrAdf() {
      const batch = this.request && this.request.batch;
      const isBatch = batch && batch !== 'none' && batch !== 'false' && batch !== false;
      const source = this.request && this.request.params ? this.request.params.source : '';
      const isAdf = source && typeof source === 'string' && source.toLowerCase().includes('adf');
      return isBatch || isAdf;
    }
  },

  watch: {
    request: {
      handler(request) {
        storage.request = request;
      },
      deep: true
    },
    transformations: {
      handler(transformations) {
        storage.transformations = transformations;
      },
      deep: true
    },
    aspectRatioLocked(val) {
      storage.aspectRatioLocked = val;
    },
    lockedAspectRatio(val) {
      storage.lockedAspectRatio = val;
    }
  },

  mounted() {
    this._resizePreview();
    this.readContext().then(() => {
      this.readPreview();
    });
    window.addEventListener('resize', this._onResize);
    window.addEventListener('scan-trigger', this._onScanTrigger);
  },

  beforeUnmount() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scan-trigger', this._onScanTrigger);
  },

  methods: {
    _onResize() {
      clearTimeout(this.preview.timer);
      this.preview.timer = setTimeout(this._resizePreview, 100);
    },

    _onScanTrigger() {
      this.scan(1);
    },

    _resizePreview() {
      const paperRatio = this.geometry
        ? this.deviceSize.width / this.deviceSize.height
        : 210 / 297;

      const mdBreakpoint = 960;
      if (window.innerWidth >= mdBreakpoint) {
        const appbarHeight = 80;
        const availableWidth = window.innerWidth - 30;
        const availableHeight = window.innerHeight - appbarHeight;
        const desiredWidth = availableHeight * paperRatio;
        this.preview.width = Math.min(availableWidth * 0.4, desiredWidth);
        this.preview.key += 1;
      }
    },

    _fetch(url, options) {
      this.mask(1);
      return Common.fetch(url, options)
        .then(data => {
          this.mask(-1);
          return data;
        })
        .catch(error => {
          this.notify({ type: 'e', message: error });
          this.mask(-1);
          return error;
        });
    },

    createPreview() {
      this.mask(1);
      this.transformations.magic = '';
      this.originalParams = null;
      const timer = window.setInterval(this.readPreview, 1000);
      let data = Common.clone(this.request);
      
      // Force full-bed scan for previews by removing crop parameters.
      // This allows the Magic Wand to see the background and prevents 'bites'.
      delete data.params.left;
      delete data.params.top;
      delete data.params.width;
      delete data.params.height;

      this._fetch('api/v1/preview', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(() => {
        window.clearInterval(timer);
        window.setTimeout(this.readPreview, 1000);
        this.mask(-1);
      }).catch(() => {
        this.mask(-1);
      });
    },

    deletePreview() {
      this.mask(1);
      Common.fetch('api/v1/preview', {
        method: 'DELETE'
      }).then(() => {
        this.notify({ type: 'i', message: this.$t('scan.message:deleted-preview') });
        this.readPreview();
        this.mask(-1);
      }).catch(error => {
        this.notify({ type: 'e', message: error });
        this.mask(-1);
      });
    },

    pixelsPerMm() {
      const scanner = this.deviceSize;
      const image = this.$refs.cropper.imageSize;
      return {
        x: image.width / scanner.width,
        y: image.height / scanner.height
      };
    },

    scaleCoordinates(coordinates, xScale, yScale) {
      return {
        width: round(coordinates.width * xScale, 1),
        height: round(coordinates.height * yScale, 1),
        left: round(coordinates.left * xScale, 1),
        top: round(coordinates.top * yScale, 1)
      };
    },

    cropperDefaultPosition() {
      const adjusted = this.scaleCoordinates(
        this.request.params,
        this.pixelsPerMm().x,
        this.pixelsPerMm().y);

      return {
        left: adjusted.left,
        top: adjusted.top
      };
    },

    cropperDefaultSize() {
      const adjusted = this.scaleCoordinates(
        this.request.params,
        this.pixelsPerMm().x,
        this.pixelsPerMm().y);

      return {
        width: adjusted.width,
        height: adjusted.height
      };
    },

    mask(add) {
      this.$emit('mask', add);
    },

    notify(notification) {
      this.$emit('notify', notification);
    },

    onCoordinatesChange() {
      if (!this.$refs.cropper) return;
      const adjusted = this.scaleCoordinates(
        this.request.params,
        this.pixelsPerMm().x,
        this.pixelsPerMm().y);

      this.$refs.cropper.setCoordinates(adjusted);
    },

    onCropperChange({ coordinates }) {
      const adjusted = this.scaleCoordinates(
        coordinates,
        1 / this.pixelsPerMm().x,
        1 / this.pixelsPerMm().y);

      const scanner = this.deviceSize;
      const params = this.request.params;
      const threshold = 0.4;
      const boundAndRound = (n, min, max) => round(Math.min(Math.max(min, n), max), 1);
      const bestValue = (current, crop, min, max) => Math.abs(current - crop) < threshold
        ? boundAndRound(current, min, max)
        : boundAndRound(crop, min, max);

      params.width = bestValue(params.width, adjusted.width, 0, scanner.width);
      params.height = bestValue(params.height, adjusted.height, 0, scanner.height);
      params.left = bestValue(params.left, adjusted.left, 0, scanner.width);
      params.top = bestValue(params.top, adjusted.top, 0, scanner.height);

      if (this.transformations.magic) {
        this.transformations.left = params.left;
        this.transformations.top = params.top;
        this.transformations.width = params.width;
        this.transformations.height = params.height;
      }

      if (this.aspectRatioLocked) {
        this.lockedAspectRatio = params.width / params.height;
      }
    },

    readContext() {
      const timer = window.setTimeout(() => {
        this.notify({ type: 'i', message: this.$t('scan.message:loading-devices') });
      }, 250);

      return this._fetch('api/v1/context').then(context => {
        window.clearTimeout(timer);
        if (context.devices && context.devices.length > 0) {
          this.context = context;
          this.device = context.devices[0];
          this.request = this.buildRequest();
          for (let test of context.diagnostics) {
            if (!test.success) {
              this.notify({ type: 'e', message: test.message });
            }
          }
        } else {
          this.notify({ type: 'e', message: this.$t('scan.message:no-devices') });
        }
      });
    },

    deviceRefresh() {
      this._fetch('api/v1/context', {
        method: 'DELETE'
      }).then(() => {
        this.readContext();
      });
    },

    readPreview() {
      const params = new URLSearchParams(this.request.filters.map(e => ['filter', e]));
      params.append('rotation', this.transformations.rotation);
      params.append('flipH', this.transformations.flipH);
      params.append('flipV', this.transformations.flipV);
      params.append('magic', this.transformations.magic);
      
      // If magic is NOT active, we pass current crop to the preview server.
      // If it IS active, we omit them to get the full bed background.
      if (!this.transformations.magic) {
        params.append('left', this.request.params.left);
        params.append('top', this.request.params.top);
        params.append('width', this.request.params.width);
        params.append('height', this.request.params.height);
      }

      const uri = 'api/v1/preview?' + params.toString();

      return this._fetch(uri, {
        cache: 'no-store',
        method: 'GET'
      }).then(data => {
        this.img = 'data:image/jpeg;base64,' + data.content;
        this.baselineBrightness = this.request.params.brightness || 0;
        this.baselineContrast = this.request.params.contrast || 0;
        this._resizePreview();
      });
    },

    buildRequest() {
      let request = storage.request;
      if (request && request.params) {
        this.device = this.context.devices.filter(d => d.id === request.params.deviceId)[0]
          || this.context.devices[0];
      }
      request = Request.create(request, this.device);
      return request;
    },

    clear() {
      storage.request = null;
      this.request = this.buildRequest();
    },

    scan(index) {
      if (index !== undefined) {
        this.request.index = index;
      }
      const data = Common.clone(this.request);
      data.transformations = Common.clone(this.transformations);
      
      // Precise AABB Strategy: If magic is active, calculate the exact 
      // Axis-Aligned Bounding Box needed on the bed to cover the rotated region.
      if (data.transformations.magic && this.deviceSize && this.transformations.angle !== undefined) {
        const a = (this.transformations.angle || 0) * Math.PI / 180;
        const cx = this.transformations.doc_c_x;
        const cy = this.transformations.doc_c_y;
        
        // Corners of the crop box in 'straightened' space
        const corners = [
          [data.params.left, data.params.top],
          [data.params.left + data.params.width, data.params.top],
          [data.params.left, data.params.top + data.params.height],
          [data.params.left + data.params.width, data.params.top + data.params.height]
        ];
        
        // Map corners back to bed space
        const bedCorners = corners.map(([x, y]) => {
          const dx = x - cx;
          const dy = y - cy;
          // Reverse rotation: x' = dx*cos(a) - dy*sin(a) + cx, y' = dx*sin(a) + dy*cos(a) + cy
          return [
            dx * Math.cos(a) - dy * Math.sin(a) + cx,
            dx * Math.sin(a) + dy * Math.cos(a) + cy
          ];
        });
        
        const minX = Math.min(...bedCorners.map(c => c[0]));
        const maxX = Math.max(...bedCorners.map(c => c[0]));
        const minY = Math.min(...bedCorners.map(c => c[1]));
        const maxY = Math.max(...bedCorners.map(c => c[1]));
        
        // Buffer for rounding errors (1mm)
        const buffer = 1.0;
        const l = Math.max(0, minX - buffer);
        const t = Math.max(0, minY - buffer);
        const r = Math.min(this.deviceSize.width, maxX + buffer);
        const b = Math.min(this.deviceSize.height, maxY + buffer);
        
        // Final crop size for the ImageMagick -extent filter
        data.transformations.width = data.params.width;
        data.transformations.height = data.params.height;
        
        data.params.left = l;
        data.params.top = t;
        data.params.width = r - l;
        data.params.height = b - t;
      }

      this._fetch('api/v1/scan', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        if (response && 'index' in response) {
          const options = {
            message: this.$t('scan.message:turn-documents'),
            onFinish: () => {},
            onNext: () => {
              this.request.index = response.index + 1;
              this.scan();
            }
          };
          if (response.image) {
            options.message = `${this.$t('scan.message:preview-of-page')} ${response.index}`;
            options.image = response.image;
            options.onFinish = () => {
              this.request.index = -1;
              this.scan();
            };
            options.onRescan = () => {
              this.request.index = response.index;
              this.scan();
            };
          }
          this.$refs.batchDialog.open(options);
        } else {
          if (storage.settings.showFilesAfterScan) {
            this.$router.push('/files');
          } else {
            this.readPreview();
          }
        }
      });
    },

    updatePaperSize(value) {
      if (value.dimensions && this.deviceSize) {
        // Clamp dimensions to the actual device limits to avoid scanner errors,
        // even if the selected paper size was slightly larger due to tolerance.
        this.request.params.width = Math.min(value.dimensions.x, this.deviceSize.width);
        this.request.params.height = Math.min(value.dimensions.y, this.deviceSize.height);
        this.onCoordinatesChange();
      }
    },

    autoCrop() {
      if (this.transformations.magic) {
        this.transformations.magic = '';
        if (this.originalParams) {
          const old = this.originalParams;
          this.request.params.left = old.left;
          this.request.params.top = old.top;
          this.request.params.width = old.width;
          this.request.params.height = old.height;
          this.originalParams = null;
          this.onCoordinatesChange();
        }
        this.readPreview();
        return;
      }

      this.mask(1);
      this.originalParams = Common.clone(this.request.params);
      
      // We send full bed dimensions to ensure the script doesn't try to scale-to-fit
      const params = Common.clone(this.request.params);
      params.left = 0;
      params.top = 0;
      params.width = this.deviceSize.width;
      params.height = this.deviceSize.height;

      Common.fetch('api/v1/autocrop', {
        method: 'POST',
        body: JSON.stringify(params),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(data => {
        if (data.magic) {
          this.transformations.magic = data.magic;
          this.transformations.angle = data.angle;
          this.transformations.doc_c_x = data.doc_c_x;
          this.transformations.doc_c_y = data.doc_c_y;
          this.transformations.doc_w = data.doc_w;
          this.transformations.doc_h = data.doc_h;
          this.transformations.width = data.doc_w;
          this.transformations.height = data.doc_h;

          if (data.doc_w && data.doc_h) {
            this.request.params.left = round(data.doc_c_x - (data.doc_w / 2), 1);
            this.request.params.top = round(data.doc_c_y - (data.doc_h / 2), 1);
            this.request.params.width = round(data.doc_w, 1);
            this.request.params.height = round(data.doc_h, 1);
            this.onCoordinatesChange();
          }
          this.readPreview();
        } else {
          this.notify({ type: 'i', message: 'No document detected' });
        }
        this.mask(-1);
      }).catch(error => {
        this.notify({ type: 'e', message: error });
        this.mask(-1);
      });
    },

    toggleFlipHorizontal() {
      this.transformations.flipH = !this.transformations.flipH;
      this.readPreview();
    },

    toggleFlipVertical() {
      this.transformations.flipV = !this.transformations.flipV;
      this.readPreview();
    },

    rotateCounterClockwise() {
      this.transformations.rotation = (this.transformations.rotation + 270) % 360;
      this.readPreview();
    },

    rotateClockwise() {
      this.transformations.rotation = (this.transformations.rotation + 90) % 360;
      this.readPreview();
    },

    toggleAspectRatioLock() {
      this.aspectRatioLocked = !this.aspectRatioLocked;
      if (this.aspectRatioLocked) {
        this.lockedAspectRatio = this.request.params.width / this.request.params.height;
      }
    },

    toPixels(mm, axis) {
      if (!this.$refs.cropper) return 0;
      const scale = this.pixelsPerMm()[axis];
      return Math.round(mm * scale);
    },

    onDimensionInput(event, field) {
      const val = event.target.value;
      this.request.params[field] = val;
    },

    commitDimension(field, event) {
      let val = parseFloat(event.target.value);
      if (isNaN(val)) val = 0;
      const scanner = this.deviceSize;
      const max = (field === 'left' || field === 'width') ? scanner.width : scanner.height;
      val = round(Math.min(Math.max(0, val), max), 1);
      this.request.params[field] = val;
      this.onCoordinatesChange();
    },

    onPixelInput() {},

    commitPixel(field, event) {
      let val = parseInt(event.target.value);
      if (isNaN(val)) val = 0;
      const axis = (field === 'left' || field === 'width') ? 'x' : 'y';
      const mm = round(val / this.pixelsPerMm()[axis], 1);
      const scanner = this.deviceSize;
      const max = (field === 'left' || field === 'width') ? scanner.width : scanner.height;
      this.request.params[field] = Math.min(Math.max(0, mm), max);
      this.onCoordinatesChange();
    }
  }
};
</script>

<style scoped>
.centered-input :deep(input) {
  text-align: center;
}
.cropper {
  max-width: 100%;
}
</style>
