<template>
  <v-dialog v-model="show" aria-role="dialog" max-width="480" v-on:keydown.stop="_onKeys" persistent aria-modal>
    <v-card>
      <v-card-title>
        {{ message }}
      </v-card-title>
      <v-card-text>
        <v-spacer></v-spacer>
        <v-btn text @click.prevent="show = false">{{ $t('batch-dialog.btn-cancel') }}</v-btn>
        <v-btn v-if="onFinish" color="green" text @click.prevent="finish">{{ $t('batch-dialog.btn-finish') }}</v-btn>
        <v-btn v-if="onRescan" color="warning" text @click.prevent="rescan">{{ $t('batch-dialog.btn-rescan') }}</v-btn>
        <v-btn color="primary" text @click.prevent="next">{{ $t('batch-dialog.btn-next') }}</v-btn>
        <v-img v-if="image" :src="'data:image/jpeg;base64,' + image" contain />
      </v-card-text>
      <v-card-actions>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import Constants from '../classes/constants';

export default {
  name: 'BatchDialog',
  data() {
    return {
      message: null,
      image: null,
      show: false,
      onFinish: null,
      onNext: null,
      onRescan: null,
    };
  },

  methods: {
    _onKeys(event) {
      if (event.keyCode === Constants.Keys.enter) {
        this.ok();
      }
    },

    finish() {
      this.show = false;
      if (this.onFinish) {
        this.onFinish();
      }
    },

    rescan() {
      this.show = false;
      if (this.onRescan) {
        this.onRescan();
      }
    },

    next() {
      this.show = false;
      if (this.onNext) {
        this.onNext();
      }
    },

    open(options) {
      this.message = options.message;
      this.image = options.image;
      this.onFinish = options.onFinish;
      this.onRescan = options.onRescan;
      this.onNext = options.onNext;
      this.show = true;
    }
  }
};
</script>
