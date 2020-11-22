/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const path = require('path');
const blacklist = require('metro-config/src/defaults/blacklist');

// from https://blog.g2i.co/how-to-set-up-a-monorepo-with-react-native-you-i-and-yarn-workspaces-3e83c3f08cf1
// ignoring the blacklist as I don't have a web folder with a build directory here
const watchFolders = [
  path.resolve(__dirname, '../../node_modules'),
  path.resolve(__dirname, '../../shared'),
  // path.resolve(__dirname, '../../shared/node_modules'), // not sure this has any effect, random attempt
];

// from https://medium.com/@dushyant_db/how-to-import-files-from-outside-of-root-directory-with-react-native-metro-bundler-18207a348427
// this was having issues however, so ended up using the above watch folders instead
// const extraNodeModules = {
//   'shared': path.resolve(__dirname + '/../../'),
// };
// const watchFolders = [
//   path.resolve(__dirname + '/../../shared')
// ];

// from https://medium.com/@huntie/a-concise-guide-to-configuring-react-native-with-yarn-workspaces-d7efa71b6906
// and https://gist.github.com/huntie/85ea491763b444bfa1bdc8e997fc2765
const extraNodeModules = {
  // Resolve all react-native module imports to the locally-installed version
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
    blacklistRE: blacklist([
      // /^((?!shared).)+[\/\\]node_modules[/\\]react-native[/\\].*/,
      // /shared[\/\\]node_modules[/\\]react-native-device-info[/\\].*/,
    ]),
    extraNodeModules
  },
  watchFolders,
};
