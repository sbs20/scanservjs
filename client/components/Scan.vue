<template>
  <div>
    <toastr ref="toastr"></toastr>

    <v-row>
      <v-col cols="12" md="3" lg="auto" class="mb-10">
        <v-select v-if="context.devices.length > 0"
          label="Device" v-model="device"
          :items="context.devices" item-text="id" @change="clear"></v-select>

        <v-select v-if="'--source' in device.features"
          label="Source" v-model="request.params.source"
          :items="device.features['--source']['options']"></v-select>

        <v-select
          label="Resolution" v-model="request.params.resolution"
          :items="device.features['--resolution']['options']"></v-select>

        <v-select
          label="Mode" v-model="request.params.mode"
          :items="device.features['--mode']['options']"></v-select>

        <v-select v-if="'--disable-dynamic-lineart' in device.features"
          label="Dynamic Lineart" v-model="request.params.mode"
          :items="[
            { key: false, value: 'Disabled' },
            { key: true, value: 'Enabled' }]"
          item-value="key" item-text="value"></v-select>

        <v-select label="Batch" v-model="request.batch"
          :items="[
            { key: 'none', value: 'None' },
            { key: 'manual', value: 'Manual (with prompt)' },
            { key: 'auto', value: 'Automatic (use ADF)' }
          ]"
          item-value="key" item-text="value"></v-select>

        <v-select
          label="Format" v-model="request.pipeline"
          :items="context.pipelines"
          item-text="description"></v-select>

        <div class="d-flex flex-row-reverse flex-wrap">
          <v-btn color="green" @click="createPreview">preview <v-icon class="ml-2">mdi-magnify</v-icon></v-btn>
          <v-btn color="primary" @click="scan">scan <v-icon class="ml-2">mdi-camera</v-icon></v-btn>
          <v-btn color="secondary" @click="reset">reset <v-icon class="ml-2">mdi-refresh</v-icon></v-btn>
        </div>
      </v-col>

      <v-col cols="12" md="6" lg="auto" class="mb-10" :style="{width: `${preview.width}px`}">
        <cropper ref="cropper" class="cropper" :key="preview.key" :transitionTime="10" :wheelResize="false"
            :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
            :src="img" @change="onCrop"></cropper>
      </v-col>

      <v-col cols="12" md="3" lg="auto" class="mb-10">
        <v-text-field label="Top" type="number" v-model="request.params.top"  @change="onCoordinatesChange" />
        <v-text-field label="Left" type="number" v-model="request.params.left"  @change="onCoordinatesChange" />
        <v-text-field label="Width" type="number" v-model="request.params.width"  @change="onCoordinatesChange" />
        <v-text-field label="Height" type="number" v-model="request.params.height"  @change="onCoordinatesChange" />

        <div v-if="'--brightness' in device.features">
          <v-slider class="align-center" v-model="request.params.brightness"
            :step="device.features['--brightness']['interval']"
            :min="device.features['--brightness']['limits'][0]"
            :max="device.features['--brightness']['limits'][1]">
            <template v-slot:prepend>
              <v-text-field label="Brightness" 
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
              <v-text-field label="Contrast" 
                style="width: 60px" type="number" v-model="request.params.contrast" />
            </template>
          </v-slider>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import { Cropper } from 'vue-advanced-cropper';
import Toastr from 'vue-toastr';
import Common from '../classes/common';

export default {
  name: 'Scanserv',
  components: {
    Cropper,
    Toastr
  },

  data() {
    const device = {
      id: 'Unspecified',
      features: {
        '--mode': {
          options: [],
        },
        '--resolution': {
          options: [],
        },
        '-l': {
          limits: [0, 215],
        },
        '-t': {
          limits: [0, 297],
        },
        '-x': {
          limits: [0, 215],
        },
        '-y': {
          limits: [0, 297],
        },
        '--brightness': {
          limits: [-100, 100],
        },
        '--contrast': {
          limits: [-100, 100],
        },
        '--disable-dynamic-lineart': {}
      }
    };
    
    const request = {
      params: {
        deviceId: device.id,
        top: 0,
        left: 0,
        width: device.features['-x'].limits[1],
        height: device.features['-y'].limits[1],
        resolution: device.features['--resolution'].default,
        mode: device.features['--mode'].default,
        brightness: 0,
        contrast: 0,
        dynamicLineart: true
      },
      pipeline: '',
      batch: false
    };

    return {
      context: {
        devices: [
          device
        ],
        pipelines: [],
        version: '0'
      },
      device: device,
      files: [],
      img: null,
      maskRef: 0,
      request: request,
      preview: {
        timer: 0,
        width: 400,
        key: 0
      }
    };
  },

  mounted() {
    this.$refs.toastr.defaultPosition = 'toast-bottom-right';
    this.$refs.toastr.defaultTimeout = 5000;
    this._updatePreview();
    this.readContext().then(() => {
      this.readPreview();
    });
    window.addEventListener('resize', () => {
      clearTimeout(this.preview.timer);
      this.preview.timer = setTimeout(this._updatePreview, 100);
    });
  },

  watch: {
    request: {
      handler(request) {
        localStorage.request = JSON.stringify(request);
        console.log('save:', localStorage.request);
        this.onCoordinatesChange();
      },
      deep: true
    }
  },

  methods: {
    _updatePreview() {
      const paperRatio = this.device.features['-x'].limits[1] / 
        this.device.features['-y'].limits[1];

      if (window.innerWidth < 576) {
        this.preview.width = window.innerWidth - (window.scrollbars.visible ? 25 : 0) - 30;
      } else {
        this.preview.width = (window.innerHeight - 120) * paperRatio;
      }
      this.preview.key += 1;
    },

    _fetch(url, options) {
      return Common.fetch(url, options)
        .catch(error => {
          this.$refs.toastr.e(error);
        });
    },

    createPreview() {
      this.mask(1);

      // Keep reloading the preview image
      const timer = window.setInterval(this.readPreview, 1000);

      let data = Common.clone(this.request);

      this._fetch('preview', {
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
      });
    },

    cropperDefaultPosition() {
      const adjust = (n) => Math.round(n * this.pixelsPerMm());
      return {
        left: adjust(this.request.params.left),
        top: adjust(this.request.params.top)
      };
    },

    cropperDefaultSize() {
      const adjust = (n) => Math.round(n * this.pixelsPerMm());
      return {
        width: adjust(this.request.params.width),
        height: adjust(this.request.params.height)
      };
    },

    mask(add) {
      this.$emit('mask', add);
    },

    onCoordinatesChange() {
      const adjust = (n) => Math.round(n * this.pixelsPerMm());
      const params = this.request.params;
      this.$refs.cropper.setCoordinates({
        width: adjust(params.width),
        height: adjust(params.height),
        left: adjust(params.left),
        top: adjust(params.top)
      });
    },

    onCrop({coordinates}) {
      const adjust = (n) => Math.round(n / this.pixelsPerMm());
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
      this.mask(1);
      const url = 'context' + (force ? '/force' : '');
      this.$refs.toastr.i('Finding devices...');

      return this._fetch(url).then(context => {
        this.context = context;

        if (context.devices.length > 0) {
          for (let device of context.devices) {
            this.$refs.toastr.i(`Found device ${device.id}`);
          }
          this.device = context.devices[0];
          this.request = this.readRequest();
          for (let test of context.diagnostics) {
            const toast = test.success ? this.$refs.toastr.s : this.$refs.toastr.e;
            toast(test.message);
          }
        } else {
          this.$refs.toastr.e('Found no devices');
        }

        if (force) {
          this.clear();
          this.readPreview();
        }
        this.mask(-1);
      });
    },

    readPreview() {
      // Gets the preview image as a base64 encoded jpg and updates the UI
      this._fetch('preview', {
        cache: 'no-store',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(data => {
        this.img = 'data:image/jpeg;base64,' + data.content;
      });
    },

    readRequest() {
      let request = null;
      if (localStorage.request) {
        request = JSON.parse(localStorage.request);
        if (request.version !== this.context.version) {
          request = null;
        }
        console.log('load', request);
      }

      if (request !== null) {
        this.device = this.context.devices.filter(d => d.id === request.params.deviceId)[0]
          || this.context.devices[0];
      }
      const device = this.device;

      if (request === null) {
        request = {
          version: this.context.version,
          params: {
            deviceId: device.id,
            top: 0,
            left: 0,
            width: device.features['-x'].limits[1],
            height: device.features['-y'].limits[1],
            resolution: device.features['--resolution'].default,
            mode: device.features['--mode'].default
          },
          pipeline: this.context.pipelines[0].description,
          batch: 'none',
          page: 1
        };
      }

      if ('--source' in device.features) {
        request.params.source = request.params.source || device.features['--source'].default;
      }
      if ('--brightness' in device.features) {
        request.params.brightness = request.params.brightness || 0;
      }
      if ('--contrast' in device.features) {
        request.params.contrast = request.params.contrast || 0;
      }
      if ('--disable-dynamic-lineart' in device.features) {
        request.params.dynamicLineart = request.params.dynamicLineart !== undefined
          ? request.params.dynamicLineart
          : true;
      }

      return request;
    },

    reset() {
      this.readContext(true);
    },

    clear() {
      localStorage.removeItem('request');
      this.request = this.readRequest();
    },

    scan() {
      this.mask(1);

      let data = Common.clone(this.request);
      
      this._fetch('scan', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then((data) => {
        if (data && 'page' in data) {
          if (window.confirm(`Scan page ${data.page}?`)) {
            this.request.page = data.page;
            this.scan();
          } else {
            this.request.page = -1;
            this.scan();
          }
        } else {
          // Finish
          this.request.page = 1;
          this.$router.push('/files');
        }
        this.mask(-1);
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