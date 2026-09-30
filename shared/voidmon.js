// Voidmon, Voidation's mascot (an original character by Abhinav Baral).
// The pictures are app/assets/voidmon/voidmon-<pose>.png (made from the .svg
// drawings next to them by app/scripts/voidmon-art.mjs). This file holds what
// the app and website both need to know about each pose.
//   ratio: height / width of the picture
export const VOIDMON_POSES = {
  welcome: { ratio: 1, label: "Voidmon waving" },
  theme: { ratio: 1, label: "Voidmon choosing light or dark" },
  import: { ratio: 1, label: "Voidmon carrying your list" },
  alerts: { ratio: 1, label: "Voidmon ringing a bell" },
  loading: { ratio: 1, label: "Voidmon loading" },
  peeking: { ratio: 0.25, label: "Voidmon peeking" },
  sleeping: { ratio: 0.575, label: "Voidmon sleeping" },
  celebrating: { ratio: 1, label: "Voidmon celebrating" },
};
