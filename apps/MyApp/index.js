/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import orm from '../../shared/redux/orm';
import Athletes from '../../shared/models/athletes';

// TODO: should be in a cleaner spot than this, just doing a proof of concept here
orm.register(
   Athletes,
);

AppRegistry.registerComponent(appName, () => App);
