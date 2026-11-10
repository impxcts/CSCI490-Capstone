// The little colored label: Avoid, Caution, Safe, or Not checked.
// The colors come from styles.css (.badge.avoid, .badge.safe, etc).

export const VERDICT_NAMES = {
  avoid: "Avoid",
  caution: "Caution",
  safe: "Safe",
  unchecked: "Not checked",
};

export default function VerdictBadge({ verdict }) {
  return <span className={`badge ${verdict}`}>{VERDICT_NAMES[verdict]}</span>;
}
