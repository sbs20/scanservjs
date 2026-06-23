import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue", "**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        __PACKAGE_VERSION__: "readonly"
      }
    },
    rules: {
      "array-bracket-spacing": 1,
      "brace-style": 1,
      "comma-spacing": 1,
      "eol-last": 1,
      "eqeqeq": 1,
      "indent": [ "error", 2, { "SwitchCase": 1 } ],
      "keyword-spacing": 1,
      "no-mixed-spaces-and-tabs": 1,
      "no-undef": 1,
      "no-unused-vars": 1,
      "no-var": 1,
      "object-shorthand": [ 1, "methods" ],
      "prefer-arrow-callback": 1,
      "quotes": [ "error", "single" ],
      "semi": [ "error", "always" ],
      "space-before-blocks": 1,
      "space-infix-ops": 1,
      "vue/first-attribute-linebreak": 0,
      "vue/html-closing-bracket-newline": 0,
      "vue/html-indent": 0,
      "vue/max-attributes-per-line": 0,
      "vue/multi-word-component-names": 0,
      "vue/singleline-html-element-content-newline": 0
    }
  }
];
