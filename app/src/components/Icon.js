// Stroke icons from @voidation/shared/iconPaths, drawn with react-native-svg.
import Svg, { Path } from "react-native-svg";
import { ICON_PATHS } from "@voidation/shared/iconPaths";

export default function Icon({ name, size = 18, color = "#888", fill = false, strokeWidth = 1.8, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} fill={fill ? color : "none"}
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={ICON_PATHS[name] || ""} />
    </Svg>
  );
}
