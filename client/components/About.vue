<template>
  <div>
    <h1>scanservjs v{{ version }}</h1>
    <div>
      
    </div>
  </div>
</template>

<script>
export default {
  name: 'About',

  data() {
    return {
      version: process.env.VUE_APP_VERSION
    };
  }
};
</script>

<style>

</style>