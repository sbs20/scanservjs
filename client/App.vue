<template>
  <Scanserv></Scanserv>
</template>

<script>
import Vue from 'vue';
import Scanserv from './components/Scanserv.vue';
import { BootstrapVue } from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';

Vue.use(BootstrapVue);

export default {
  name: 'App',
  components: {
    Scanserv,
  },
};
</script>

<style lang="scss">
// Bootstrap
$primary: #007bff;
$secondary: #606060;
$dark: darken($secondary, 20%);
$text: #d0d0d0;
$font-size-base: 1rem;
$body-bg: #404040;
$body-color: $text;
$link-color: lighten($primary, 25%);
$link-hover-color: lighten($link-color, 15%);
$input-bg: $secondary;
$input-color: $text;
$input-border-color: #202020; 
$input-btn-focus-width: .3rem;
$nav-tabs-border-color: $secondary;
$nav-tabs-link-hover-border-color: lighten($nav-tabs-border-color, 5%);
$nav-tabs-link-active-color: #e0e0e0;
$nav-tabs-link-active-border-color: $secondary;
$nav-tabs-border-width: 0;

// Slider
$themeColor: $primary;

@import '~bootstrap/scss/bootstrap.scss';
@import '~bootstrap-vue/src/index.scss';
@import '~vue-slider-component/lib/theme/default.scss';

body {
  padding-bottom: 20px;
  text-transform: lowercase;
}

input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}

input[type=number] {
  -moz-appearance:textfield; /* Firefox */
}

.banner {
  position: absolute;
  width: 100%;
  height: 4.5rem;
  background: $dark;
  top: 0;
  left: 0;
  z-index: -1;
}

.navbar-brand, .navbar-text {
  font-size: xx-large;
}

.col-form-label, label, th {
  font-size: $font-size-base * 1.25;
  font-weight: 400;
}

.container, .container-fluid {
  margin-top: 1em;
}

.form-group {
  height: 4em;
}

.table th, .table td, .table thead th {
  border: 0;
  padding: 0.25rem 2rem 0.25rem 0.5rem;
}

@media only screen and (max-width: map-get($grid-breakpoints, "md")) {
  .file-date {
    display: none;
  }
}

.preview-fields {
  width: 100%;
}

@media only screen and (min-width: map-get($grid-breakpoints, "sm")) {
  .preview-fields {
    width: 150px;
  }
}

</style>
