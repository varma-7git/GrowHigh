import { useEffect, useState } from "react";
import "../admin/admin.css";

/** "Preparing your journey" screen shown once after sign-in. */
export default function Preparing({ onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => Math.min(100, v + 4)), 45);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (n >= 100) { const t = setTimeout(onDone, 250); return () => clearTimeout(t); } }, [n, onDone]);
  return (
    <div className="pj">
      <div className="gh-logo gh-logo-dark" style={{ fontSize: 30 }}><span>Grow<b>High</b></span></div>
      <div className="pj-art"><span className="nf-chip" style={{ top: 28, left: 22 }}>✓ Skills unlocked</span><div className="nf-card">YOUR<br />FUTURE</div><span className="nf-chip" style={{ bottom: 28, right: 22 }}>↗ Ready for tomorrow</span></div>
      <h2>Preparing Your Journey…</h2><p>Please wait while we load your dashboard</p>
      <div className="pj-row"><span>Getting your workspace ready</span><b>{n}%</b></div><div className="pj-bar"><i style={{ width: `${n}%` }} /></div>
      <small style={{ color: "#22d3ee" }}>Learn. Prepare. Grow.</small>
    </div>
  );
}
