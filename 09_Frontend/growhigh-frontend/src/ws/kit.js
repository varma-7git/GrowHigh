import { Link, useLocation } from "react-router-dom";
import { Bar, Stat } from "../admin/ui";
import { Ic } from "./icons";
import WsShell from "./Shell";

export const Btn = ({ b, kind = "o", s }) => {
  if (!b) return null;
  const [label, to, fn] = b;
  const cls = `ad-btn ${kind}${s ? " s" : ""}`;
  return to ? <Link to={to} className={cls}>{label}</Link> : <button className={cls} onClick={fn}>{label}</button>;
};

export function Tabs({ items }) {
  const { pathname } = useLocation();
  return <div className="ad-tabs">{items.map(([l, to]) => <Link key={to} to={to} className={pathname.replace(/\/$/, "") === to ? "on" : ""}>{l}</Link>)}</div>;
}
export function StateTabs({ items, value, onChange }) {
  return <div className="ad-tabs">{items.map(([k, l]) => <button key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

export const Hero = ({ h, p, btn }) => (
  <div className="ad-hero" style={btn ? { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" } : null}>
    <div><h2>{h}</h2><p>{p}</p></div>{btn && <Btn b={btn} kind="c" />}
  </div>
);
export const Stats = ({ items }) => (
  <div className={`ad-grid g${items.length === 2 ? 2 : 3}`}>{items.map(([l, v, n]) => <Stat key={l} label={l} value={v} note={n} />)}</div>
);
export const Tiles = ({ items, cols = 3 }) => (
  <div className="ws-tiles" style={{ "--c": cols }}>
    {items.map((t) => (
      <div className="ad-card ws-tile" key={t.t}>
        <Ic n="book" /><h3>{t.t}</h3>{t.d && <p>{t.d}</p>}{t.m && <em>{t.m}</em>}
        {t.pct !== undefined && <><div className="ad-pr"><span>Practice progress</span><span>{t.pct}%</span></div><div className="ws-pbar"><i style={{ width: `${t.pct}%` }} /></div></>}
        <Btn b={t.b} />
      </div>
    ))}
  </div>
);

/** A card with an optional eyebrow, headline, text, progress bars, a step list and a button. */
export function Panel({ eyebrow, h, big, p, bars, list, btn, btn2, foot, dark, children }) {
  return (
    <div className={`ad-card ${dark ? "ad-dark" : ""}`}>
      {eyebrow && <div className="ad-eyebrow">{eyebrow}</div>}
      {h && <h2>{h}</h2>}
      {big && <div className="ws-h3">{big}</div>}
      {p && <p className="ws-p">{p}</p>}
      {bars && bars.map(([l, v]) => <Bar key={l} label={l} pct={v} />)}
      {list && <div className="ad-stream">{list.map(([s, t, d]) => <div key={t}><small>{s}</small><b>{t}</b><span>{d}</span></div>)}</div>}
      {children}
      {(btn || btn2) && <div className="ws-btns"><Btn b={btn} kind="c" /><Btn b={btn2} /></div>}
      {foot && <div className="ws-foot">{foot}</div>}
    </div>
  );
}

/** Renders a list of sections described as plain data. */
export function Sections({ items }) {
  return items.map((s, i) => {
    if (s.k === "hero") return <Hero key={i} {...s} />;
    if (s.k === "stats") return <Stats key={i} items={s.items} />;
    if (s.k === "tiles") return <Tiles key={i} items={s.items} cols={s.cols} />;
    if (s.k === "note") return <p key={i} className="ws-note">{s.text}</p>;
    if (s.k === "pair") return <div key={i} className="ad-grid g2"><Panel {...s.a} /><Panel {...s.b} /></div>;
    if (s.k === "panel") return <div key={i} style={{ marginBottom: 24 }}><Panel {...s} /></div>;
    return null;
  });
}

/** One page of the workspace described as data. */
export function Page({ role, crumb, title, subtitle, action, tabs, sections }) {
  return (
    <WsShell role={role} crumb={crumb} title={title} subtitle={subtitle} action={action}>
      {tabs && <Tabs items={tabs} />}
      <Sections items={sections} />
    </WsShell>
  );
}
