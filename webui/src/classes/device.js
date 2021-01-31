export default {
  default() {
    return {
      id: 'Unspecified',
      features: {
        '--mode': {
          options: [],
        },
        '--resolution': {
          options: [],
        },
        '-l': {
          limits: [0, 215],
        },
        '-t': {
          limits: [0, 297],
        },
        '-x': {
          limits: [0, 215],
        },
        '-y': {
          limits: [0, 297],
        },
        '--brightness': {
          limits: [-100, 100],
        },
        '--contrast': {
          limits: [-100, 100],
        },
        '--disable-dynamic-lineart': {}
      }
    };
  }
};