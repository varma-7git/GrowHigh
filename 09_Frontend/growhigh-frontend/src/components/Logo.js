import { Link } from "react-router-dom";

export default function Logo({ dark = false }) {
  return (
    <Link to="/" className={`gh-logo ${dark ? "gh-logo-dark" : ""}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#22D3EE" />
        <path d="M8 21l6-6 4 4 6-8" fill="none" stroke="#0B1F3F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Grow<b>High</b></span>
    </Link>
  );
}
