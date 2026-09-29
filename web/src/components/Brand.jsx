// The Voidation logo: a countdown ring around a V. Icon only — no wordmark.
// Dark V on the light theme so it never disappears.
import logoDark from "../assets/logo.png";
import logoLight from "../assets/logo-light.png";
import { useTheme } from "../theme.jsx";

export default function Brand({ size = 18 }) {
  const { dark } = useTheme();
  return (
    <span className="brand" style={{ fontSize: size }}>
      <img src={dark ? logoDark : logoLight} alt="Voidation" width={size * 1.7} height={size * 1.7} />
    </span>
  );
}
