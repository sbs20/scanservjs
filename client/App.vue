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

<style>
body {
    padding-bottom: 20px;
    font-family: 'Segoe UI';
    font-size: large;
    text-transform: lowercase;
    background-color: white;
}

.theme-dropdown .dropdown-menu {
    position: static;
    display: block;
    margin-bottom: 20px;
}

.theme-showcase > p > .btn {
    margin: 5px 0;
}

.theme-showcase .navbar .container {
    width: auto;
}

#navbar > div {
    color: white;
    font-size: xx-large;
}

.container {
    margin-top: 1em;
}

.navbar-inverse {
    background-color: #101030;
    background-image: none;
    border-color: black;
}

.form-control {
    border-radius: 0;
    border: 1px solid #f0f0f0;
    background-color: #f0f0f0;
}

#image {
    background-color: #d0d0e0;
    background-repeat: no-repeat;
    background-position: center;
    border: 1px solid black;
}

.credits {
    width: 100%;
    text-align: center;
    margin: auto;
    font-size: small;
}

.col-form-label, label, th {
    font-size: x-large;
    font-weight: 300;
    color: #0E5EA0;
}

.form-check-label {
    font-size: smaller;
}

h1 {
    font-size: 4em;
    font-weight: 100;
    color: #0E5EA0;
}

.toast-success {
    background-color: green
}

.toast-error {
    background-color: red
}

.form-group {
  height: 5em;
}

input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}

input[type=number] {
    -moz-appearance:textfield; /* Firefox */
}

/* center the icons vertically */
.material-icons {
    vertical-align: middle;
}

</style>
