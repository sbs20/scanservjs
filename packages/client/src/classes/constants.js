const Constants = {
  Version: process.env.VUE_APP_VERSION,
  
  DateTimeFormat: {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }
  },
  
  Locales: [
    'cs',
    'de',
    'en',
    'es',
    'fr',
    'it',
    'pl',
    'pt-BR',
    'ru',
    'zh',
    'test'
  ],

  Keys: {
    enter: 13,
    escape: 27
  },
  
  Themes: {
    Dark: 'dark',
    Light: 'light',
    System: 'system'
  },

  Colors: [
    'accent-4',
    'red',
    'pink',
    'purple',
    'deep-purple',
    'indigo',
    'blue',
    'light-blue',
    'cyan',
    'teal',
    'green',
    'light-green',
    'lime',
    'yellow',
    'amber',
    'orange',
    'deep-orange',
    'brown',
    'blue-grey',
    'grey'
  ]
};

export default Constants;