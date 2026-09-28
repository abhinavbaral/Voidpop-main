import logo from "../assets/logo.png";

export default function Brand({ size = 18 }) {
  return (
    <span className="brand" style={{ fontSize: size }}>
      <img src={logo} alt="" width={size * 1.5} height={size * 1.5} />
      <span>VOID<b>ATION</b></span>
    </span>
  );
}
