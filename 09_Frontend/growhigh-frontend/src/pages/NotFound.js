import { Link } from "react-router-dom";
import { Art, PublicFooter, PublicNav } from "../components/Public";

export default function NotFound() {
  return (
    <div className="ad pb">
      <PublicNav />
      <section className="nf-main">
        <div><span className="nf-tag">404 · A SMALL DETOUR</span><h1>Page Not Found</h1>
          <p>The page you’re looking for may have moved or the link may be incorrect. Your journey doesn’t have to stop here.</p>
          <Link className="ad-btn c" style={{ marginTop: 28 }} to="/">Go Back Home</Link>
          <p style={{ fontSize: 15, marginTop: 24 }}>Looking for a test or opportunity? Return to your dashboard and use search.</p></div>
        <Art />
      </section>
      <PublicFooter />
    </div>
  );
}
