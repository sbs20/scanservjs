<template>
  <div>
    <div v-if="maskRef" id="mask"></div>
    <Toastr ref="toastr"></Toastr>

    <nav class="navbar navbar-expand-lg navbar-inverse navbar-fixed-top">
      <div class="navbar-header"></div>
      <div id="navbar" class="navbar-collapse collapse">
        <div class="navbar-nav ml-auto" href="#">scanserv-js (v{{ context.version }}) | Scanner: {{ device.name }}</div>
      </div>
    </nav>

    <div class="container theme-showcase" role="main">
      <div class="row">
        <!-- Fields and buttons -->
        <div class="col-lg-6 col-md-6 col-sm-12">
          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Top</label>
                <input class="form-control" type="number" v-model="request.params.top" @change="onCoordinatesChange">
              </div>
              <div class="form-group">
                <label>Left</label>
                <input class="form-control" type="number" v-model="request.params.left" @change="onCoordinatesChange">
              </div>
              <div class="form-group">
                <label>Width</label>
                <input class="form-control" type="number" v-model="request.params.width" @change="onCoordinatesChange">
              </div>
              <div class="form-group">
                <label>Height</label>
                <input class="form-control" type="number" v-model="request.params.height" @change="onCoordinatesChange">
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>Resolution</label>
                <select class="form-control" v-model="request.params.resolution">
                  <option v-for="item in device.features['--resolution']['options']" v-bind:key="item">{{ item }}</option>
                </select>    
              </div>

              <div class="form-group">
                <label>Mode</label>
                <select class="form-control" v-model="request.params.mode">
                  <option v-for="item in device.features['--mode']['options']" v-bind:key="item">{{ item }}</option>
                </select>    
              </div>

              <div class="form-group" v-if="'--disable-dynamic-lineart' in device.features">
                <label for="mode">Dynamic lineart</label>
                <select id="dynamicLineart" class="form-control" v-model="request.params.dynamicLineart">
                  <option v-bind:value="false">Disabled</option>
                  <option v-bind:value="true">Enabled</option>
                </select>
              </div>

              <div class="form-group" v-if="'--brightness' in device.features">
                <label>Brightness</label>
                <input class="form-control" type="number" v-model="request.params.brightness">
                <Slider v-model="request.params.brightness"
                  :min="device.features['--brightness']['limits'][0]"
                  :max="device.features['--brightness']['limits'][1]"></Slider>
              </div>

              <div class="form-group" v-if="'--contrast' in device.features">
                <label>Contrast</label>
                <input class="form-control" type="number" v-model="request.params.contrast">
                <Slider v-model="request.params.contrast"
                  :min="device.features['--contrast']['limits'][0]"
                  :max="device.features['--contrast']['limits'][1]"></Slider>
              </div>

              <div class="form-group">
                <label>Format</label>
                <select class="form-control" v-model="request.pipeline">
                  <option v-for="item in context.pipelines" v-bind:key="item.description">{{ item.description }}</option>
                </select>
              </div>

            </div>
          </div>

          <!-- Buttons -->
          <div class="row">
            <div class="col text-right">
              <div class="btn-group" role="group" aria-label="...">
                <button type="button" class="btn btn-lg btn-light" v-on:click="reinitialize">reinitialize <img src="../assets/refresh-24px.svg"></button>
                <button type="button" class="btn btn-lg btn-light" v-on:click="reset">reset <img src="../assets/autorenew-black-18dp.svg"></button>
                <button type="button" class="btn btn-lg btn-light" v-on:click="preview">preview <img src="../assets/search-24px.svg"></button>
                <button type="button" class="btn btn-lg btn-light" v-on:click="scan">scan <img src="../assets/photo_camera-24px.svg"></button>
              </div>
            </div>
          </div>

        </div>
        <!-- Preview pane -->
        <div class="col-lg-1"></div>
        <div class="col-lg-4 col-md-6 col-sm-12">
          <cropper ref="cropper" class="cropper"
              :default-position="cropperDefaultPosition" :default-size="cropperDefaultSize"
              :src="img" @change="onCrop"></cropper>
        </div>
        <div class="col-lg-1"></div>
      </div>

      <div class="row mt-5">
        <div class="col">
        </div>
      </div>

      <div class="row">
        <!-- Padding for larger screens -->
        <div class="col">
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
                <td>{{ file.size }}</td>
                <td><button class="btn btn-sm" v-on:click="fileRemove(file)"><img src="../assets/delete-24px.svg"></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
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
        deviceId: device.name,
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
        this.mask(-1);
      });
    },

    readDiagnostics() {
      this.mask(1);
      this._fetch('diagnostics').then(data => {
        for (let test of data) {
          if (test.success === true) {
            this.$refs.toastr.s(test.message);
          } else {
            this.$refs.toastr.e(test.message);
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
            deviceId: device.name,
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

    reset() {
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