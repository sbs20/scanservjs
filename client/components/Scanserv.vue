<template>
  <div>
    <div v-if="maskRef" id="mask">
      <div style="position: absolute; top: 49%; left: 49%">
        <div class="spinner-border text-primary" style="width: 5rem; height: 5rem;" role="status">
          <span class="sr-only">Loading...</span>
        </div>

      </div>
    </div>
    <toastr ref="toastr"></toastr>

    <div class="banner">
    </div>

    <b-container fluid>
      <!-- Main controls and buttons -->
      <div class="float-left">
        <h1>scanserv-js <span class="d-none d-sm-inline">(v{{ context.version }})</span></h1>

        <b-form-group v-if="context.devices.length > 0" label="Device">
          <b-form-select class="form-control" v-model="device" @change="clear">
            <b-form-select-option v-for="item in context.devices" v-bind:key="item.id" v-bind:value="item">{{ item.id }}</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group v-if="'--source' in device.features" label="Source">
          <b-form-select class="form-control" v-model="request.params.source">
            <b-form-select-option v-for="item in device.features['--source']['options']" v-bind:key="item" v-bind:value="item">{{ item }}</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group label="Resolution">
          <b-form-select class="form-control" v-model="request.params.resolution">
            <b-form-select-option v-for="item in device.features['--resolution']['options']" v-bind:key="item" v-bind:value="item">{{ item }}</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group label="Mode">
          <b-form-select class="form-control" v-model="request.params.mode">
            <b-form-select-option v-for="item in device.features['--mode']['options']" v-bind:key="item" v-bind:value="item">{{ item }}</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group v-if="'--disable-dynamic-lineart' in device.features" label="Dynamic Lineart">
          <b-form-select class="form-control" v-model="request.params.dynamicLineart">
            <b-form-select-option v-bind:value="false">Disabled</b-form-select-option>
            <b-form-select-option v-bind:value="true">Enabled</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group label="Batch">
          <b-form-select class="form-control" v-model="request.batch">
            <b-form-select-option value="none">None</b-form-select-option>
            <b-form-select-option value="manual">Manual (with prompt)</b-form-select-option>
            <b-form-select-option value="auto">Automatic (use ADF)</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group label="Format">
          <b-form-select class="form-control" v-model="request.pipeline">
            <b-form-select-option v-for="item in context.pipelines" v-bind:key="item.description" v-bind:value="item.description">{{ item.description }}</b-form-select-option>
          </b-form-select>
        </b-form-group>

        <b-form-group label="Scanner">
          <div class="text-right">
            <b-button-group>
              <b-button v-on:click="reset">reset <img class="d-none d-sm-inline" src="../assets/refresh-24px.svg"></b-button>
              <b-button v-on:click="createPreview">preview <img class="d-none d-sm-inline" src="../assets/search-24px.svg"></b-button>
              <b-button v-on:click="scan">scan <img src="../assets/photo_camera-24px.svg"></b-button>
            </b-button-group>
          </div>
        </b-form-group>
      </div>

      <!-- Tabs -->
      <b-tabs class="float-left ml-0 ml-lg-5 mt-3">
        <b-tab title="Preview" @click="_updatePreview" active>
          <div class="float-left mt-3" :style="{width: `${preview.width}px`}">
            <cropper ref="cropper" class="cropper" :key="preview.key" :transitionTime="10" :wheelResize="false"
                :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
                :src="img" @change="onCrop"></cropper>
          </div>
          <div class="preview-fields float-left ml-0 ml-md-5">
            <b-row>
              <b-col>
                <b-form-group label="Top">
                  <b-form-input type="number" v-model="request.params.top" @change="onCoordinatesChange" />
                </b-form-group>
                <b-form-group label="Left">
                  <b-form-input type="number" v-model="request.params.left" @change="onCoordinatesChange" />
                </b-form-group>
              </b-col>
              <b-col>
                <b-form-group label="Width">
                  <b-form-input type="number" v-model="request.params.width" @change="onCoordinatesChange" />
                </b-form-group>
                <b-form-group label="Height">
                  <b-form-input type="number" v-model="request.params.height" @change="onCoordinatesChange" />
                </b-form-group>
              </b-col>
            </b-row>
            <b-form-group v-if="'--brightness' in device.features" label="Brightness">
              <b-form-input type="number" v-model="request.params.brightness" />
              <slider v-model="request.params.brightness"
                :interval="device.features['--brightness']['interval']"                  
                :min="device.features['--brightness']['limits'][0]"
                :max="device.features['--brightness']['limits'][1]"></slider>
            </b-form-group>
            <b-form-group v-if="'--contrast' in device.features" label="Contrast">
              <b-form-input type="number" v-model="request.params.contrast" />
              <slider v-model="request.params.contrast"
                :interval="device.features['--contrast']['interval']"                  
                :min="device.features['--contrast']['limits'][0]"
                :max="device.features['--contrast']['limits'][1]"></slider>
            </b-form-group>
          </div>
        </b-tab>
        <b-tab title="Files">
          <table class="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th class="file-date">Date</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in files" v-bind:key="file.name">
                <td><a :href="'files/' + file.fullname">{{ file.name }}</a></td>
                <td class="file-date">{{ file.lastModified }}</td>
                <td>{{ file.sizeString }}</td>
                <td><b-button class="btn btn-sm" v-on:click="fileRemove(file)"><img src="../assets/delete-24px.svg"></b-button></td>
              </tr>
            </tbody>
          </table>
        </b-tab>
      </b-tabs>
    </b-container>
  </div>
</template>

<script>
import Slider from 'vue-slider-component';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-slider-component/theme/antd.css';
import Toastr from 'vue-toastr';

export default {
  name: 'Scanserv',
  components: {
    Slider,
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
    this.fileList();
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
      const isoPaperRatio = 215 / 297;
      if (window.innerWidth < 576) {
        this.preview.width = window.innerWidth - (window.scrollbars.visible ? 25 : 0) - 30;
      } else {
        this.preview.width = (window.innerHeight - 120) * isoPaperRatio;
      }
      this.preview.key += 1;
    },

    _clone(o) {
      return JSON.parse(JSON.stringify(o));
    },

    _fetch(url, options) {
      return fetch(url, options)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          response.json().then(error => {
            this.$refs.toastr.e(error.message);
          }).catch(error => {
            this.$refs.toastr.e(error);
          });
        });
    },

    createPreview() {
      this.mask(1);

      // Keep reloading the preview image
      const timer = window.setInterval(this.readPreview, 1000);

      let data = this._clone(this.request);

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

    fileList() {
      this.mask(1);
      this._fetch('files').then(files => {
        this.files = files;
        this.mask(-1);
      });
    },

    fileRemove(file) {
      this.mask(1);
      this._fetch('files/' + file.fullname, {
        method: 'DELETE'
      }).then(data => {
        console.log('fileRemove', data);
        this.fileList();
        this.mask(-1);
      });
    },

    mask(add) {
      this.maskRef += add;
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
        request.params.source = device.features['--source'].default;
      }
      if ('--brightness' in device.features) {
        request.params.brightness = 0;
      }
      if ('--contrast' in device.features) {
        request.params.contrast = 0;
      }
      if ('--disable-dynamic-lineart' in device.features) {
        request.params.dynamicLineart = true;
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

      let data = this._clone(this.request);
      
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
          this.request.page = 1;
          this.fileList();
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