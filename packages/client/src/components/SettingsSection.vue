<template>
  <v-card elevation="2" class="mb-4" rounded="0">
    <v-card-title><slot name="title" /></v-card-title>
    <v-card-text>
      <slot name="items" />
    </v-card-text>
  </v-card>
</template>
