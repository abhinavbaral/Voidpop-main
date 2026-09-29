// Tiny inline icon set (stroke icons, currentColor) — no icon font needed.
import { ICON_PATHS as PATHS } from "@voidation/shared/iconPaths";
export default function Icon({ name, size = 18, fill = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
