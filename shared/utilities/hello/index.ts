import * as math from 'mathjs';
import DeviceInfo from 'react-native-device-info';

export default function hello(x: number) {
    return `${DeviceInfo.getApplicationName()}: ${math.evaluate('x*x', {x:x})}`;
}
