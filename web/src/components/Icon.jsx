// Tiny inline icon set (stroke icons, currentColor) — no icon font needed.
const PATHS = {
  explore: "M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z",
  browse: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  schedule: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5l3 2",
  history: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l-3 2",
  more: "M5 11a1 1 0 1 1 0 2a1 1 0 0 1 0-2zM12 11a1 1 0 1 1 0 2a1 1 0 0 1 0-2zM19 11a1 1 0 1 1 0 2a1 1 0 0 1 0-2z",
  stats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  storage: "M4 5h16v4H4zM4 11h16v4H4zM4 17h16v3H4zM7 7h.01M7 13h.01",
  settings: "M12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  help: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01",
  info: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 11v6M12 7.5h.01",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5c0-1.2-1-1.5-1-2.5c0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.2-4-7.5-9-7.5zM7.5 11h.01M9.5 7h.01M14.5 7h.01",
  clock: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5h4",
  badge: "M6 3h12v18l-6-4l-6 4z",
  profile: "M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  search: "M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14zM20 20l-4-4",
  sun: "M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  library: "M5 4h4v16H5zM11 4h4v16h-4zM17 5l3 1-3 14-3-1z",
  back: "M15 5l-7 7l7 7",
  left: "M15 5l-7 7l7 7",
  right: "M9 5l7 7l-7 7",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  comment: "M4 5h16v11H9l-5 4z",
  close: "M6 6l12 12M18 6L6 18",
  share: "M12 3v12M7 8l5-5l5 5M5 14v6h14v-6",
};
export default function Icon({ name, size = 18, fill = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
