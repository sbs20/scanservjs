<template>
  <div>
    <v-row>
      <v-spacer/>

      <v-col cols="12" md="3" class="mb-10 mb-md-0">
        <div class="d-flex">
          <v-select style="min-width: 0px;"
            v-if="context.devices.length > 0"
            :label="$t('scan.device')" v-model="device"
            :items="context.devices" return-object item-text="name" @change="clear"></v-select>
          <v-btn small class="ml-2 mt-5 pl-1 pr-1" min-width="32" @click="deviceRefresh"><v-icon>mdi-refresh</v-icon></v-btn>
        </div>

        <v-select v-if="'--source' in device.features"
          :label="$t('scan.source')" v-model="request.params.source"
          :items="sources" item-value="value" item-text="text"></v-select>

        <v-select
          :label="$t('scan.resolution')" v-model="request.params.resolution"
          :items="device.features['--resolution']['options']"></v-select>

        <v-select v-if="'--mode' in device.features"
          :label="$t('scan.mode')" v-model="request.params.mode"
          :items="modes" item-value="value" item-text="text"></v-select>

        <v-select v-if="'--disable-dynamic-lineart' in device.features"
          :label="$t('scan.dynamic-lineart')" v-model="request.params.mode"
          :items="[
            { value: false, text: $t('scan.dynamic-lineart:disabled') },
            { value: true, text: $t('scan.dynamic-lineart:enabled') }]"
          item-value="value" item-text="text"></v-select>

        <v-select :label="$t('scan.batch')" v-model="request.batch"
          :items="batchModes" item-value="value" item-text="text"></v-select>

        <v-select
          v-model="request.filters"
          :items="filters"
          item-text="text"
          item-value="value"
          :label="$t('scan.filters')"
          @change="readPreview"
          multiple />

        <v-select
          :label="$t('scan.format')"
          v-model="request.pipeline"
          :items="pipelines"
          item-text="text"
          item-value="value"></v-select>

        <div class="d-flex flex-row-reverse flex-wrap">
          <v-btn color="primary" @click="scan(1)" class="ml-1 mb-1">{{ $t('scan.btn-scan') }} <v-icon class="ml-2">mdi-camera</v-icon></v-btn>
          <v-btn color="green" @click="createPreview" class="ml-1 mb-1">{{ $t('scan.btn-preview') }} <v-icon class="ml-2">mdi-magnify</v-icon></v-btn>
          <v-btn color="amber" @click="deletePreview" class="ml-1 mb-1">{{ $t('scan.btn-clear') }} <v-icon class="ml-2">mdi-delete</v-icon></v-btn>
        </div>
      </v-col>

      <v-col cols="12" md="auto" class="mb-10 mb-md-0" :style="{width: `${preview.width}px`}">
        <cropper ref="cropper" class="cropper" :key="preview.key" :transitionTime="10" :wheelResize="false"
            :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
            :src="img" @change="onCropperChange"></cropper>
      </v-col>

      <v-col cols="12" md="3" class="mb-10 mb-md-0">
        <v-text-field :label="$t('scan.top')" type="number" step="any" v-model="request.params.top" @blur="onCoordinatesChange" />
        <v-text-field :label="$t('scan.left')" type="number" step="any" v-model="request.params.left" @blur="onCoordinatesChange" />
        <v-text-field :label="$t('scan.width')" type="number" step="any" v-model="request.params.width" @blur="onCoordinatesChange" />
        <v-text-field :label="$t('scan.height')" type="number" step="any" v-model="request.params.height" @blur="onCoordinatesChange" />

        <v-menu offset-y>
          <template v-slot:activator="{ on, attrs }">
            <v-btn color="primary" v-bind="attrs" v-on="on">{{ $t('scan.paperSize') }}</v-btn>
          </template>
          <v-list dense>
            <v-list-item
              v-for="(item, index) in paperSizes"
              @click="updatePaperSize(item)"
              :key="index">
              <v-list-item-title>{{ item.name }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <div v-if="'--brightness' in device.features">
          <v-slider class="align-center" v-model="request.params.brightness"
            :step="device.features['--brightness']['interval']"
            :min="device.features['--brightness']['limits'][0]"
            :max="device.features['--brightness']['limits'][1]">
            <template v-slot:prepend>
              <v-text-field :label="$t('scan.brightness')" 
                style="width: 60px" type="number" v-model="request.params.brightness" />
            </template>
          </v-slider>
        </div>

        <div v-if="'--contrast' in device.features">
          <v-slider class="align-center" v-model="request.params.contrast"
            :step="device.features['--contrast']['interval']"
            :min="device.features['--contrast']['limits'][0]"
            :max="device.features['--contrast']['limits'][1]">
            <template v-slot:prepend>
              <v-text-field :label="$t('scan.contrast')" 
                style="width: 60px" type="number" v-model="request.params.contrast" />
            </template>
          </v-slider>
        </div>
      </v-col>
      
      <v-spacer/>
    </v-row>

    <batch-dialog ref="batchDialog" />
  </div>
</template>

<script>
import { Cropper } from 'vue-advanced-cropper';
import BatchDialog from './BatchDialog';

import Common from '../classes/common';
import Device from '../classes/device';
import Request from '../classes/request';
import Storage from '../classes/storage';

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

  data() {
    const device = Device.default();
    const request = Request.create(null, device, '');

    return {
      context: {
        devices: [
          device
        ],
        batchModes: [],
        filters: [],
        pipelines: [],
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
      }
    };
  },

  mounted() {
    this._resizePreview();
    this.readContext().then(() => {
      this.readPreview();
    });
    window.addEventListener('resize', () => {
      clearTimeout(this.preview.timer);
      this.preview.timer = setTimeout(this._resizePreview, 100);
    });
  },

  computed: {
    deviceSize() {
      return {
        width: this.device.features['-x'].limits[1],
        height: this.device.features['-y'].limits[1]
      };
    },

    batchModes() {
      return this.context.batchModes.map(mode => {
        const key = `batch-mode.${sanitiseLocaleKey(mode)}`;
        let translation = this.$t(key);
        return {
          text: translation === key ? mode : translation,
          value: mode
        };
      });
    },

    filters() {
      return this.context.filters.map(f => {
        return {
          text: this.$te(f) ? this.$t(f) : f,
          value: f
        };
      });
    },

    modes() {
      return this.device.features['--mode'].options.map(mode => {
        const key = `mode.${sanitiseLocaleKey(mode)}`;
        return {
          text: this.$te(key) ? this.$t(key) : mode,
          value: mode
        };
      });
    },

    paperSizes() {
      const deviceSize = {
        x: this.device.features['-x'].limits[1],
        y: this.device.features['-y'].limits[1]
      };

      return this.context.paperSizes
        .filter(paper => paper.dimensions.x <= deviceSize.x && paper.dimensions.y <= deviceSize.y)
        .map(paper => {
          const variables = (paper.name.match(/@:[a-z-.]+/ig) || []).map(s => s.substr(2));
          variables.forEach(v => {
            paper.name = paper.name.replaceAll(`@:${v}`, this.$t(v));
          });
          return paper;
        });
    },

    pipelines() {
      return this.context.pipelines.map(p => {
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
      return this.device.features['--source'].options.map(source => {
        const key = `source.${sanitiseLocaleKey(source)}`;
        const x =  {
          text: this.$te(key) ? this.$t(key) : source,
          value: source
        };
        return x;
      });
    }
  },

  watch: {
    request: {
      handler(request) {
        storage.request = request;
      },
      deep: true
    }
  },

  methods: {
    _resizePreview() {
      const paperRatio = this.deviceSize.width / this.deviceSize.height;

      // This only makes a difference when the col-width="auto" - so md+
      const mdBreakpoint = 960;
      if (window.innerWidth >= mdBreakpoint) {
        const appbarHeight = 80;
        const availableWidth = window.innerWidth - 30;
        const availableHeight = window.innerHeight - appbarHeight;
        const desiredWidth = availableHeight * paperRatio;
        this.preview.width = Math.min(availableWidth / 2, desiredWidth);
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

      // Keep reloading the preview image
      const timer = window.setInterval(this.readPreview, 1000);

      let data = Common.clone(this.request);

      this._fetch('scanner/preview', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(() => {
        window.clearInterval(timer);

        // Some scanners don't create the preview until after the scan has finished.
        // Run preview one last time
        window.setTimeout(this.readPreview, 1000);
        this.mask(-1);
      }).catch(() => {
        this.mask(-1);
      });
    },

    deletePreview() {
      this.mask(1);
      Common.fetch('preview', {
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

      // The preview image may not have perfectly scaled dimensions
      // because pixel counts are integers. So we report a horizontal
      // and vertical resolution
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
      const adjusted = this.scaleCoordinates(
        this.request.params,
        this.pixelsPerMm().x,
        this.pixelsPerMm().y);

      this.$refs.cropper.setCoordinates(adjusted);
    },

    onCropperChange({coordinates}) {
      const adjusted = this.scaleCoordinates(
        coordinates,
        1 / this.pixelsPerMm().x,
        1 / this.pixelsPerMm().y);

      // The cropper changes even when coordinates are set manually. This will
      // result in manually set values being overwritten because of rounding.
      // If someone is taking the trouble to set values manually then they
      // should be preserved. We should only update the values if they breach
      // a threshold or the scanner dimensions
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
    },

    readContext() {
      // Only show notification if things are slow (first time / force)
      const timer = window.setTimeout(() => {
        this.notify({ type: 'i', message: this.$t('scan.message:loading-devices') });
      }, 250);

      return this._fetch('context').then(context => {
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
      this._fetch('context', {
        method: 'DELETE'
      }).then(() => {
        this.readContext();
      });
    },

    readPreview() {
      // Gets the preview image as a base64 encoded jpg and updates the UI
      this._fetch('preview', {
        cache: 'no-store',
        method: 'POST',
        body: JSON.stringify(this.request.filters),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(data => {
        this.img = 'data:image/jpeg;base64,' + data.content;
        this._resizePreview();
      });
    },

    buildRequest() {
      let request = storage.request;
      if (request && request.params) {
        this.device = this.context.devices.filter(d => d.id === request.params.deviceId)[0]
          || this.context.devices[0];
      }

      request = Request.create(request, this.device, this.context.pipelines[0]);
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
      this._fetch('scanner/scan', {
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
            onFinish: () => {
            },
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
          // Finish
          this.$router.push('/files');
        }
      });
    },

    updatePaperSize(value) {
      if (value.dimensions) {
        this.request.params.width = value.dimensions.x;
        this.request.params.height = value.dimensions.y;
        this.onCoordinatesChange();
      }
    }
  }
};
</script>

<style scoped>
#mask {
  position: fixed;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,.4);
  top: 0;
  left: 0;
  z-index: 10;
}
</style>
