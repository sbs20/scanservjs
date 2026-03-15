<template>
  <span v-if="!editing" class="inline-edit-label" :class="{ dark }" @click="startEdit">
    {{ modelValue }}
  </span>
  <v-text-field v-else
    ref="field"
    v-model="editValue"
    variant="underlined"
    density="compact"
    hide-details
    single-line
    :class="{ 'inline-edit-dark': dark }"
    class="inline-edit-field"
    @keyup.enter="commit"
    @keyup.escape="cancel"
    @blur="commit" />
</template>

<script>
export default {
  name: 'InlineEdit',
  emits: ['rename'],
  props: {
    modelValue: { type: String, default: '' },
    suffix: { type: String, default: '' },
    dark: { type: Boolean, default: false }
  },
  data() {
    return {
      editing: false,
      editValue: ''
    };
  },
  methods: {
    startEdit() {
      let val = this.modelValue;
      if (this.suffix && val.toLowerCase().endsWith(this.suffix.toLowerCase())) {
        val = val.slice(0, -this.suffix.length);
      }
      this.editValue = val;
      this.editing = true;
      this.$nextTick(() => {
        const field = this.$refs.field;
        if (field) {
          const input = field.$el.querySelector('input');
          if (input) {
            input.focus();
            input.select();
          }
        }
      });
    },
    commit() {
      if (!this.editing) return;
      this.editing = false;
      let newName = this.editValue.trim();
      if (!newName) return; // empty — revert silently
      if (this.suffix && !newName.toLowerCase().endsWith(this.suffix.toLowerCase())) {
        newName += this.suffix;
      }
      if (newName === this.modelValue) return; // unchanged
      this.$emit('rename', { oldName: this.modelValue, newName });
    },
    cancel() {
      this.editing = false;
    }
  }
};
</script>

<style scoped>
.inline-edit-label {
  cursor: pointer;
  border-bottom: 1px dotted transparent;
  transition: border-color 0.15s;
}
.inline-edit-label:hover {
  border-bottom-color: currentColor;
}
.inline-edit-label.dark {
  color: white;
}
.inline-edit-field {
  max-width: 400px;
  min-width: 200px;
}
.inline-edit-dark :deep(input) {
  color: white;
}
</style>
