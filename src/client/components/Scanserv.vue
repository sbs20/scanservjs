<template>
  <div>
    <div id="mask"></div>

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
                  <option v-for="item in device.features['--resolution']['_options']" v-bind:key="item">{{ item }}</option>
                </select>    
              </div>

              <div class="form-group">
                <label>Mode</label>
                <select class="form-control" v-model="request.mode">
                  <option v-for="item in device.features['--mode']['_options']" v-bind:key="item">{{ item }}</option>
                </select>    
              </div>

              <div class="form-group" v-if="'--disable-dynamic-lineart' in device.features">
                <label for="mode">Dynamic lineart</label>
                <!-- <div class="form-check">
                  <input type="checkbox" class="form-check-input-lg" v-model="request.dynamicLineart">
                  <label class="form-check-label">Enabled</label>
                </div> -->
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
                <button id="reset" type="button" class="btn btn-lg" v-on:click="reset">reset <span class="material-icons" aria-hidden="true">autorenew</span></button>
                <button id="preview" type="button" class="btn btn-lg" v-on:click="preview">preview <span class="material-icons" aria-hidden="true">search</span></button>
                <button id="scan" type="button" class="btn btn-lg" v-on:click="scan">scan <span class="material-icons" aria-hidden="true">photo_camera</span></button>
              </div>
            </div>
          </div>

        </div>
        <!-- Preview pane -->
        <div class="col-lg-6 col-md-5 col-sm-12">
          <cropper ref="cropper" class="cropper"
              :default-position="defaultPosition" :default-size="defaultSize"
              :src="img" @change="onCrop"></cropper>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Slider from "vue-slider-component";
import { Cropper } from "vue-advanced-cropper";
import "vue-slider-component/theme/antd.css";

export default {
  name: "Scanserv",
  components: {
    Slider,
    Cropper,
  },

  data() {
    return {
      device: this.defaultDevice(),
      request: this.defaultRequest(this.defaultDevice()),
      img: require('../assets/default.jpg')
    };
  },

  watch: {
    request: {
      handler(request) {
        // TODO : save the request to local storage
        const requestJson = JSON.stringify(request);
        console.log(requestJson);
      },
      deep: true
    }
  },

  methods: {
    defaultDevice() {
      return {
        name: "Unspecified",
        version: "0",
        features: {
          "--mode": {
            default: "24bit Color",
            options:
              "Black & White|Gray[Error Diffusion]|True Gray|24bit Color",
            _options: [
              "Black & White",
              "Gray[Error Diffusion]",
              "True Gray",
              "24bit Color",
            ],
          },
          "--resolution": {
            default: "50",
            options: "50..1200dpi",
            _options: ["50", "75", "100", "150", "200", "300", "600", "1200"],
          },
          "-l": {
            default: "0",
            options: "0..215mm",
            limits: [0, 215],
          },
          "-t": {
            default: "0",
            options: "0..297mm",
            limits: [0, 297],
          },
          "-x": {
            default: "103",
            options: "0..215mm",
            limits: [0, 215],
          },
          "-y": {
            default: "76.21",
            options: "0..297mm",
            limits: [0, 297],
          },
          "--brightness": {
            default: "0",
            options: "-100..100% (in steps of 1)",
            limits: [-100, 100],
          },
          "--contrast": {
            default: "0",
            options: "-100..100% (in steps of 1)",
            limits: [-100, 100],
          },
          "--disable-dynamic-lineart": {}
        }
      };
    },

    defaultRequest(device) {
      let request = {
        top: 0,
        left: 0,
        width: device.features['-x'].limits[1],
        height: device.features['-y'].limits[1],
        resolution: device.features['--resolution'].default,
        mode: device.features['--mode'].default,
        convertFormat: "tif"
      };

      if ('--brightness' in device.features) {
        request.brightness = 0;
      }
      if ('--contrast' in device.features) {
        request.contrast = 0;
      }
      if ('--disable-dynamic-lineart' in device.features) {
        request.dynamicLineart = true;
      }

      return request;
    },

    defaultPosition() {
      return {
        left: 0,
        top: 0
      };
    },

    defaultSize() {
      return {
        width: 3000,
        height: 4000,
      };
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
      window.alert("Preview");
    },

    reset() {
      window.alert("Reset");
    },

    scan() {
      window.alert("Scan");
    },

  }
};
</script>