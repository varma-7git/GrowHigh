import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { homeFor, useAuth } from "../context/AuthContext";
import "../admin/admin.css";
import "./pub.css";

export const Art = ({ className = "" }) => (
  <div className={`nf-art ${className}`}><span className="nf-chip" style={{ top: 28, left: 22 }}>✓ Skills unlocked</span><div className="nf-card">YOUR<br />FUTURE</div><span className="nf-chip pk" style={{ bottom: 28, right: 22 }}>↗ Ready for tomorrow</span></div>
);

export function PublicNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const out = async () => { await logout(); nav("/", { replace: true }); };
  return (
    <header className="nf-nav pb-nav"><Logo dark />
      <button className="pb-burger" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
      <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
        <Link to="/">Home</Link><a href="/#features">Features</a><a href="/#about">About</a><a href="/#contact">Contact</a>
        {user ? (<><Link to={homeFor(user.role)}>Dashboard</Link><button className="ad-btn c s" onClick={out}>Logout</button></>)
          : (<><Link to="/login">Login</Link><Link className="ad-btn c s" to="/register">Register</Link></>)}
      </nav>
    </header>
  );
}

export const PublicFooter = () => (
  <footer className="nf-foot"><Logo dark /><p>Learn. Prepare. Grow.</p><p>A focused space for diploma learning, ECET preparation and your next career step.</p>
    <div>{[["About", "/#about"], ["Contact", "/#contact"], ["Privacy", "/"], ["Terms", "/"]].map(([x, h]) => <a key={x} href={h}>{x}</a>)}</div>
    <p style={{ fontSize: 13 }}>© 2026 GROWHIGH. All rights reserved.</p></footer>
);

/** Page frame for login, register and password pages: nav, intro with art on the left, form card on the right, footer. */
export function AuthFrame({ eyebrow, h, sub, children }) {
  return (
    <div className="ad pb">
      <PublicNav />
      <section className="pb-auth">
        <div className="pb-left"><span className="nf-tag">YOUR CAREER. OUR PRIORITY.</span><h1>Learn. Prepare. Grow.</h1>
          <p>A stronger foundation. A clearer path. Take your next step with GrowHigh.</p><Art className="pb-art" /><small>Smart Diploma Student Career, ECET &amp; Job Management System</small></div>
        <div className="pb-card">{eyebrow && <div className="ad-eyebrow">{eyebrow}</div>}<h2>{h}</h2>{sub && <p className="pb-sub">{sub}</p>}{children}</div>
      </section>
      <PublicFooter />
    </div>
  );
}
