import { useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import { Image } from "expo-image";

const H = 76;
const PAD = 6;
const KNOB_W = 112;
const KNOB_H = H - PAD * 2;

export default function SwipeButton({ label, knobSource, onComplete }) {
  const [trackW, setTrackW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(trackW - KNOB_W - PAD * 2, 1);

  // PanResponder is created once, so read the latest values through refs
  const maxRef = useRef(max);
  maxRef.current = max;
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(g.dx, 0), maxRef.current)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > maxRef.current * 0.75) {
          Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: true }).start(() => {
            doneRef.current();
            setTimeout(() => x.setValue(0), 400);
          });
        } else back();
      },
      onPanResponderTerminate: back,
    }),
  ).current;

  const labelOpacity = x.interpolate({ inputRange: [0, max * 0.6], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <View
      style={s.track}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={() => doneRef.current()}
    >
      <Animated.Text style={[s.label, { opacity: labelOpacity }]}>{label}</Animated.Text>
      <Animated.View style={[s.knob, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <Image source={knobSource} contentFit="contain" style={{ width: KNOB_W, height: KNOB_H }} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: H, borderRadius: H / 2, backgroundColor: "#fff", justifyContent: "center", alignSelf: "stretch" },
  label: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    paddingLeft: KNOB_W / 2,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#0d1117",
    textTransform: "uppercase",
  },
  knob: { position: "absolute", left: PAD, top: PAD },
});
