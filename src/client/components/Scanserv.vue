<template>
  <div>
    <div v-if="maskRef" id="mask"></div>
    <Toastr ref="toastr"></Toastr>

    <nav class="navbar navbar-expand-lg navbar-inverse navbar-fixed-top">
      <div class="navbar-header"></div>
      <div id="navbar" class="navbar-collapse collapse">
        <div class="navbar-nav ml-auto" href="#">scanserv-js (v{{ device.version }}) | Scanner: {{ device.name }}</div>
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
                <input class="form-control" type="number" v-model="request.top" @change="onCoordinatesChange">
              </div>
              <div class="form-group">
                <label>Left</label>
                <input class="form-control" type="number" v-model="request.left" @change="onCoordinatesChange">
              </div>
              <div class="form-group">
                <label>Width</label>
                <input class="form-control" type="number" v-model="request.width" @change="onCoordinatesChange">
              </div>
              <div class="form-group">
                <label>Height</label>
                <input class="form-control" type="number" v-model="request.height" @change="onCoordinatesChange">
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>Resolution</label>
                <select class="form-control" v-model="request.resolution">
                  <option v-for="item in device.features['--resolution']['options']" v-bind:key="item">{{ item }}</option>
                </select>    
              </div>

              <div class="form-group">
                <label>Mode</label>
                <select class="form-control" v-model="request.mode">
                  <option v-for="item in device.features['--mode']['options']" v-bind:key="item">{{ item }}</option>
                </select>    
              </div>

              <div class="form-group" v-if="'--disable-dynamic-lineart' in device.features">
                <label for="mode">Dynamic lineart</label>
                <select id="dynamicLineart" class="form-control" v-model="request.dynamicLineart">
                  <option v-bind:value="false">Disabled</option>
                  <option v-bind:value="true">Enabled</option>
                </select>
              </div>

              <div class="form-group" v-if="'--brightness' in device.features">
                <label>Brightness</label>
                <input class="form-control" type="number" v-model="request.brightness">
                <Slider v-model="request.brightness"
                  :min="device.features['--brightness']['limits'][0]"
                  :max="device.features['--brightness']['limits'][1]"></Slider>
              </div>

              <div class="form-group" v-if="'--contrast' in device.features">
                <label>Contrast</label>
                <input class="form-control" type="number" v-model="request.contrast">
                <Slider v-model="request.contrast"
                  :min="device.features['--contrast']['limits'][0]"
                  :max="device.features['--contrast']['limits'][1]"></Slider>
              </div>

              <div class="form-group">
                <label for="convertFormat">Format</label>
                <select id="convertFormat" class="form-control" v-model="request.convertFormat">
                  <option>tif</option>
                  <option>jpg</option>
                  <option>pdf</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Buttons -->
          <div class="row">
            <div class="col text-right">
              <div class="btn-group" role="group" aria-label="...">
                <button id="reset" type="button" class="btn btn-lg" v-on:click="reset">reset <img src="../assets/autorenew-black-18dp.svg"></button>
                <button id="preview" type="button" class="btn btn-lg" v-on:click="preview">preview <img src="../assets/search-24px.svg"></button>
                <button id="scan" type="button" class="btn btn-lg" v-on:click="scan">scan <img src="../assets/photo_camera-24px.svg"></button>
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
                <td><button type="button" class="btn btn-lg" v-on:click="fileRemove(file)">X</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import Slider from "vue-slider-component";
import { Cropper } from "vue-advanced-cropper";
import "vue-slider-component/theme/antd.css";
import Toastr from "vue-toastr";

export default {
  name: "Scanserv",
  components: {
    Slider,
    Cropper,
    Toastr
  },

  data() {
    return {
      device: this.defaultDevice(),
      files: [],
      img: null,
      maskRef: 0,
      request: this.readRequest(this.defaultDevice())
    };
  },

  mounted() {
    this.readDiagnostics();
    this.readDevice();
    this.convert();
    this.fileList();

    this.$refs.toastr.defaultPosition = "toast-bottom-right";
    this.$refs.toastr.defaultTimeout = 5000;
  },

  watch: {
    request: {
      handler(request) {
        localStorage.request = JSON.stringify(request);
        console.log("save:", localStorage.request);
        this.onCoordinatesChange();
      },
      deep: true
    }
  },

  methods: {
    _clone(o) {
      return JSON.parse(JSON.stringify(o));
    },

    convert() {
      // Gets the preview image as a base64 encoded jpg and updates the UI
      fetch('convert', {
        method: 'POST',
        body: JSON.stringify(this.request),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(response => {
        response.json().then(fileInfo => {
          if (fileInfo.content) {
            this.img = 'data:image/jpeg;base64,' + fileInfo.content;
          }
        });
      });
    },

    cropperDefaultPosition() {
      const adjust = (n) => Math.round(n * this.pixelsPerMm());
      return {
        left: adjust(this.request.left),
        top: adjust(this.request.top)
      };
    },

    cropperDefaultSize() {
      const adjust = (n) => Math.floor(n * this.pixelsPerMm());
      return {
        width: adjust(this.request.width),
        height: adjust(this.request.height)
      };
    },

    defaultDevice() {
      return {
        name: "Unspecified",
        version: "0",
        features: {
          "--mode": {
            options: [],
          },
          "--resolution": {
            options: [],
          },
          "-l": {
            limits: [0, 215],
          },
          "-t": {
            limits: [0, 297],
          },
          "-x": {
            limits: [0, 215],
          },
          "-y": {
            limits: [0, 297],
          },
          "--brightness": {
            limits: [-100, 100],
          },
          "--contrast": {
            limits: [-100, 100],
          },
          "--disable-dynamic-lineart": {}
        }
      };
    },

    fileList() {
      this.mask(1);
      fetch('files').then((response) => {
        response.json().then(files => {
          this.files = files;
          this.mask(-1);
        });
      });
    },

    fileRemove(file) {
      this.mask(1);
      fetch('files/' + file.fullname, {
        method: 'DELETE'
      }).then((response) => {
        response.json().then(data => {
          console.log("fileRemove", data);
          this.fileList();
          this.mask(-1);
        });
      });
    },

    mask(add) {
      this.maskRef += add;
    },

    onCoordinatesChange() {
      const adjust = (n) => Math.round(n * this.pixelsPerMm());
      this.$refs.cropper.setCoordinates({
        width: adjust(this.request.width),
        height: adjust(this.request.height),
        left: adjust(this.request.left),
        top: adjust(this.request.top)
      });
    },

    onCrop({coordinates}) {
      const adjust = (n) => Math.round(n / this.pixelsPerMm());
      this.request.width = adjust(coordinates.width);
      this.request.height = adjust(coordinates.height);
      this.request.left = adjust(coordinates.left);
      this.request.top = adjust(coordinates.top);
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
      data.device = this._clone(this.device);

      fetch('preview', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(response => {
        response.json().then(() => {
          window.clearInterval(timer);
          this.mask(-1);
        })
      });
    },

    readDevice() {
      this.mask(1);
      fetch('device').then((response) => {
        response.json().then(device => {
          if ('features' in device) {
            this.device = device;
            this.request = this.readRequest(device);
            this.mask(-1);
          }
        });
      });
    },

    readDiagnostics() {
      this.mask(1);
      fetch('diagnostics').then((response) => {
        response.json().then(data => {
          for (let test of data) {
            if (test.success === true) {
              this.$refs.toastr.s(test.message);
            } else {
              this.$refs.toastr.e(test.message);
            }
          }
          this.mask(-1);
        });
      });
    },

    readRequest(device) {
      let request = null;
      if (localStorage.request) {
        request = JSON.parse(localStorage.request);
        console.log("load", request);
      } else {
        request = {
          top: 0,
          left: 0,
          width: device.features['-x'].limits[1],
          height: device.features['-y'].limits[1],
          resolution: device.features['--resolution'].default,
          mode: device.features['--mode'].default,
          convertFormat: "tif",
          brightness: 0,
          contrast: 0,
          dynamicLineart: true
        };
      }

      if ('--brightness' in device.features === false) {
        delete request.brightness;
      }
      if ('--contrast' in device.features === false) {
        delete request.contrast;
      }
      if ('--disable-dynamic-lineart' in device.features === false) {
        delete request.dynamicLineart;
      }

      return request;
    },

    reset() {
      localStorage.removeItem("request");
      this.request = this.readRequest(this.device);
    },

    scan() {
      this.mask(1);

      let data = this._clone(this.request);
      data.device = this._clone(this.device);
      
      fetch('scan', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(response => {
        response.json().then(() => {
          this.fileList();
          this.mask(-1);
        })
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