import * as math from 'mathjs';
import DeviceInfo from 'react-native-device-info';

export default function hello(x: number) {
    console.log(DeviceInfo.getApplicationName()); // this causees it to fail
    return math.evaluate('x*x', {x:x});
}
