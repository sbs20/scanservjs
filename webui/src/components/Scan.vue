<template>
  <div>
    <v-row>
      <v-spacer/>

      <v-col cols="12" md="3" class="mb-10 mb-md-0">
        <v-select v-if="context.devices.length > 0"
          :label="$t('scan.device')" v-model="device"
          :items="context.devices" return-object item-text="id" @change="clear"></v-select>

        <v-select v-if="'--source' in device.features"
          :label="$t('scan.source')" v-model="request.params.source"
          :items="device.features['--source']['options']"></v-select>

        <v-select
          :label="$t('scan.resolution')" v-model="request.params.resolution"
          :items="device.features['--resolution']['options']"></v-select>

        <v-select
          :label="$t('scan.mode')" v-model="request.params.mode"
          :items="device.features['--mode']['options']"></v-select>

        <v-select v-if="'--disable-dynamic-lineart' in device.features"
          :label="$t('scan.dynamic-lineart')" v-model="request.params.mode"
          :items="[
            { key: false, value: $t('scan.dynamic-lineart:disabled') },
            { key: true, value: $t('scan.dynamic-lineart:enabled') }]"
          item-value="key" item-text="value"></v-select>

        <v-select :label="$t('scan.batch')" v-model="request.batch"
          :items="[
            { key: 'none', value: $t('scan.batch:none') },
            { key: 'manual', value: $t('scan.batch:manual') },
            { key: 'auto', value: $t('scan.batch:auto') },
            { key: 'auto-collate-standard', value: $t('scan.batch:auto-collate-standard') },
            { key: 'auto-collate-reverse', value: $t('scan.batch:auto-collate-reverse') }
          ]"
          item-value="key" item-text="value"></v-select>

        <v-select
          v-model="request.filters"
          :items="context.filters"
          item-text="text"
          item-value="value"
          :label="$t('scan.filters')"
          @change="readPreview"
          multiple />

        <v-select
          :label="$t('scan.format')"
          v-model="request.pipeline"
          :items="context.pipelines"
          item-text="text"
          item-value="value"></v-select>

        <div class="d-flex flex-row-reverse flex-wrap">
          <v-btn color="green" @click="createPreview" class="ml-1 mb-1">{{ $t('scan.btn-preview') }} <v-icon class="ml-2">mdi-magnify</v-icon></v-btn>
          <v-btn color="amber" @click="deletePreview" class="ml-1 mb-1">{{ $t('scan.btn-clear') }} <v-icon class="ml-2">mdi-delete</v-icon></v-btn>
          <v-btn color="primary" @click="scan(1)" class="ml-1 mb-1">{{ $t('scan.btn-scan') }} <v-icon class="ml-2">mdi-camera</v-icon></v-btn>
          <v-btn color="secondary" @click="reset" class="ml-1 mb-1">{{ $t('scan.btn-reset') }} <v-icon class="ml-2">mdi-refresh</v-icon></v-btn>
        </div>
      </v-col>

      <v-col cols="12" md="auto" class="mb-10 mb-md-0" :style="{width: `${preview.width}px`}">
        <cropper ref="cropper" class="cropper" :key="preview.key" :transitionTime="10" :wheelResize="false"
            :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
            :src="img" @change="onCrop"></cropper>
      </v-col>

      <v-col cols="12" md="3" class="mb-10 mb-md-0">
        <v-text-field :label="$t('scan.top')" type="number" v-model="request.params.top"  @change="onCoordinatesChange" />
        <v-text-field :label="$t('scan.left')" type="number" v-model="request.params.left"  @change="onCoordinatesChange" />
        <v-text-field :label="$t('scan.width')" type="number" v-model="request.params.width"  @change="onCoordinatesChange" />
        <v-text-field :label="$t('scan.height')" type="number" v-model="request.params.height"  @change="onCoordinatesChange" />

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

/**
 * @param {number} n 
 * @returns {number}
 */
function round(n) {
  return Math.round(n);
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
        filters: [],
        pipelines: [],
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

  watch: {
    request: {
      handler(request) {
        storage.request = request;
        this.onCoordinatesChange();
      },
      deep: true
    }
  },

  methods: {
    _resizePreview() {
      const paperRatio = this.device.features['-x'].limits[1] / 
        this.device.features['-y'].limits[1];

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

    cropperDefaultPosition() {
      const adjust = (n) => round(n * this.pixelsPerMm());
      return {
        left: adjust(this.request.params.left),
        top: adjust(this.request.params.top)
      };
    },

    cropperDefaultSize() {
      const adjust = (n) => round(n * this.pixelsPerMm());
      return {
        width: adjust(this.request.params.width),
        height: adjust(this.request.params.height)
      };
    },

    mask(add) {
      this.$emit('mask', add);
    },

    notify(notification) {
      this.$emit('notify', notification);
    },

    onCoordinatesChange() {
      const adjust = (n) => round(n * this.pixelsPerMm());
      const params = this.request.params;
      const adjusted = {
        width: adjust(params.width),
        height: adjust(params.height),
        left: adjust(params.left),
        top: adjust(params.top)
      };
      this.$refs.cropper.setCoordinates(adjusted);
    },

    onCrop({coordinates}) {
      const adjust = (n) => round(n / this.pixelsPerMm());
      const params = this.request.params;
      params.width = adjust(coordinates.width);
      params.height = adjust(coordinates.height);
      params.left = adjust(coordinates.left);
      params.top = adjust(coordinates.top);
    },

    pixelsPerMm() {
      const scanner = {
        width: this.device.features['-x'].limits[1],
        height: this.device.features['-y'].limits[1]
      };

      const image = this.$refs.cropper.imageSize;
      return image.height / scanner.height;
    },

    readContext(force) {
      const url = 'context' + (force ? '/force' : '');

      // Only show notification if things are slow (first time / force)
      const timer = window.setTimeout(() => {
        this.notify({ type: 'i', message: this.$t('scan.message:loading-devices') });
      }, 250);

      return this._fetch(url).then(context => {
        window.clearTimeout(timer);
        context.filters = context.filters.map(f => {
          return {
            text: this.$t(`scan.${f}`),
            value: f
          };
        });

        context.pipelines = context.pipelines.map(p => {
          const variables = (p.match(/\$\$[a-z-]+/ig) || []).map(s => s.substr(2));
          let text = p;
          variables.forEach(v => {
            text = text.replaceAll(`$$${v}`, this.$t(`pipeline.${v}`));
          });

          return {
            text: text,
            value: p
          };
        });

        this.context = context;

        if (context.devices.length > 0) {
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

        if (force) {
          this.readPreview();
        }
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
      });
    },

    buildRequest() {
      let request = storage.request;
      if (request !== null) {
        this.device = this.context.devices.filter(d => d.id === request.params.deviceId)[0]
          || this.context.devices[0];
      }

      request = Request.create(request, this.device, this.context.pipelines[0]);
      return request;
    },

    reset() {
      this.clear();
      this.readContext(true);
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
