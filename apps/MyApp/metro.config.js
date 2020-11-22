/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const path = require('path');

const watchFolders = [
  path.resolve(__dirname, '../../node_modules'), // hoisted node modules
  path.resolve(__dirname, '../../shared'), // shared source code
];

// native modules
const extraNodeModules = {
  'react-native': path.resolve(__dirname, 'node_modules', 'react-native'),
  'react-native-device-info': path.resolve(__dirname, 'node_modules', 'react-native-device-info'),
};

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    extraNodeModules
  },
  watchFolders,
};
