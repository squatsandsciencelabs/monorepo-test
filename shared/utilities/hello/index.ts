import * as math from 'mathjs';
import DeviceInfo from 'react-native-device-info';

export default function hello(x: number) {
    return `${DeviceInfo.getUniqueId()}: ${math.evaluate('x*x', {x:x})}`;
}
