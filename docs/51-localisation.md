# Localisation

The application uses `vue-i18n` for internationalisation (i18n, making an app
ready for localisation) and localisation (l10n, implementing specific locales).

* Localisation files are stored in
  [`/app-ui/src/locales/`](../app-ui/src/locales/)
* The list of locales is defined in
  [`/app-ui/src/classes/constants.js`](../app-ui/src/classes/constants.js)

## Adding a new locale

* Copy an existing locale, name it according to the iso 639 and sub region; see
  [w3c](https://www.w3.org/International/articles/language-tags/)
* Update the translations
* If possible, test it works (see [development](./50-development.md))
* Raise a PR or attach it to a new issue or #154
* Add the locale name to the fallback locale
  [en](../app-ui/src/locales/en.json) under the "locales" key.
* If you can't translate a key, delete it - this will make it show up in
  `missing translations`

## Updating an existing locale

Either an existing translation could be improved or is missing altogether.

* Make the change and raise a PR
* Note that I am unable to adjudicate changes so please be thoughtful when
  changing existing translations. And be collaborative - you are likely changing
  something that someone else has put care into

## Finding missing translations

* Configure [development](./50-development.md)
* Run `npm run util:missing-translations`
* This will output JSON with all the missing keys
