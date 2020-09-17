<template>
  <div>
    <div v-if="maskRef" id="mask"></div>
    <toastr ref="toastr"></toastr>

    <b-navbar type="dark" variant="dark">
      <b-navbar-brand>scanserv-js (v{{ context.version }})</b-navbar-brand>
      <b-navbar-nav class="ml-auto">
        <b-nav-text>Scanner: {{ device.id }}</b-nav-text>
      </b-navbar-nav>
    </b-navbar>

    <b-container>
      <b-row cols="1" cols-md="2">
        <!-- Fields and buttons -->
        <b-col>
          <b-row>
            <b-col>
              <b-form-group label="Top">
                <b-form-input type="number" v-model="request.params.top" @change="onCoordinatesChange" />
              </b-form-group>
              <b-form-group label="Left">
                <b-form-input type="number" v-model="request.params.left" @change="onCoordinatesChange" />
              </b-form-group>
              <b-form-group label="Width">
                <b-form-input type="number" v-model="request.params.width" @change="onCoordinatesChange" />
              </b-form-group>
              <b-form-group label="Height">
                <b-form-input type="number" v-model="request.params.height" @change="onCoordinatesChange" />
              </b-form-group>
            </b-col>

            <b-col>
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

              <b-form-group label="Format">
                <b-form-select class="form-control" v-model="request.pipeline">
                  <b-form-select-option v-for="item in context.pipelines" v-bind:key="item.description" v-bind:value="item.description">{{ item.description }}</b-form-select-option>
                </b-form-select>
              </b-form-group>
            </b-col>
          </b-row>

          <!-- Buttons -->
          <b-row>
            <b-col class="text-right">
              <b-button-group>
                <b-button variant="light" size="lg" v-on:click="reinitialize">reinitialize <img src="../assets/refresh-24px.svg"></b-button>
                <b-button variant="light" size="lg" v-on:click="clear">clear <img src="../assets/autorenew-24px.svg"></b-button>
              </b-button-group>
              &nbsp;
              <b-button-group>
                <b-button variant="light" size="lg" v-on:click="preview">preview <img src="../assets/search-24px.svg"></b-button>
                <b-button variant="light" size="lg" v-on:click="scan">scan <img src="../assets/photo_camera-24px.svg"></b-button>
              </b-button-group>
            </b-col>
          </b-row>

        </b-col>

        <!-- Preview pane -->
        <b-col>
          <div style="max-width: 420px;">
            <cropper ref="cropper" class="cropper" :transitionTime="1" :wheelResize="false" :maxWidth="200"
                :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
                :src="img" @change="onCrop"></cropper>
          </div>
        </b-col>
      </b-row>

      <b-row class="mt-5">
        <b-col></b-col>
      </b-row>

      <b-row>
        <!-- Padding for larger screens -->
        <b-col>
          <table class="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Date</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in files" v-bind:key="file.name">
                <td><a :href="'files/' + file.fullname">{{ file.name }}</a></td>
                <td>{{ file.lastModified }}</td>
                <td>{{ file.sizeString }}</td>
                <td><button class="btn btn-sm" v-on:click="fileRemove(file)"><img src="../assets/delete-24px.svg"></button></td>
              </tr>
            </tbody>
          </table>
        </b-col>
      </b-row>
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
      name: 'Unspecified',
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
      pipeline: ''
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
      request: request
    };
  },

  mounted() {
    this.readContext();
    this.convert();
    this.fileList();

    this.$refs.toastr.defaultPosition = 'toast-bottom-right';
    this.$refs.toastr.defaultTimeout = 5000;
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

    convert() {
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

    cropperDefaultPosition() {
      const adjust = (n) => Math.round(n * this.pixelsPerMm());
      return {
        left: adjust(this.request.params.left),
        top: adjust(this.request.params.top)
      };
    },

    cropperDefaultSize() {
      const adjust = (n) => Math.floor(n * this.pixelsPerMm());
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

    preview() {
      this.mask(1);

      // Keep reloading the preview image
      const timer = window.setInterval(this.convert, 1000);

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
        this.mask(-1);
      });
    },

    readContext(force) {
      this.mask(1);
      const url = 'context' + (force ? '/force' : '');
      this._fetch(url).then(context => {
        this.context = context;
        this.device = context.devices[0];
        this.request = this.readRequest();
        for (let test of context.diagnostics) {
          const toast = test.success ? this.$refs.toastr.s : this.$refs.toastr.e;
          toast(test.message);
          if (force) {
            this.clear();
          }
        }
        this.mask(-1);
      });
    },

    readRequest() {
      const device = this.device;
      let request = null;
      if (localStorage.request) {
        request = JSON.parse(localStorage.request);
        if (request.version !== this.context.version) {
          request = null;
        }
        console.log('load', request);
      }
      
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
            mode: device.features['--mode'].default,
            brightness: 0,
            contrast: 0,
            dynamicLineart: true
          },
          pipeline: this.context.pipelines[0].description
        };
      }

      if ('--brightness' in device.features === false) {
        delete request.params.brightness;
      }
      if ('--contrast' in device.features === false) {
        delete request.params.contrast;
      }
      if ('--disable-dynamic-lineart' in device.features === false) {
        delete request.params.dynamicLineart;
      }

      return request;
    },

    reinitialize() {
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
      }).then(() => {
        this.fileList();
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
    background: rgba(0,0,0,.3);
    top: 0;
    left: 0;
    /* display: none; */
    z-index: 10;
}
</style>