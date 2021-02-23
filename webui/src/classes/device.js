export default {
  default() {
    return {
      id: 'Unspecified',
      features: {
        '--mode': {
          default: '',
          options: [],
        },
        '--resolution': {
          default: 0,
          options: [],
        },
        '-l': {
          default: 0,
          limits: [0, 215],
        },
        '-t': {
          default: 297,
          limits: [0, 297],
        },
        '-x': {
          default: 0,
          limits: [0, 215],
        },
        '-y': {
          default: 297,
          limits: [0, 297],
        },
        '--brightness': {
          default: 0,
          limits: [-100, 100],
        },
        '--contrast': {
          default: 0,
          limits: [-100, 100],
        },
        '--disable-dynamic-lineart': {}
      }
    };
  }
};