export default function TierBadge({ tier, large }) {
  if (!tier) return null;
  return (
    <span className={`tier${large ? " lg" : ""}`} style={{ color: tier.color, borderColor: tier.color }}>
      {tier.label}
    </span>
  );
}
