import { useState } from "react";
import { Link } from "react-router-dom";
import { Art, PublicFooter, PublicNav } from "../components/Public";
import { Ic } from "../ws/icons";
import { Bar } from "../admin/ui";
import { useAuth, homeFor } from "../context/AuthContext";

const Card = ({ t, d, m, b }) => (
  <div className="pl-card"><Ic n="book" /><h3>{t}</h3><p>{d}</p>{m && <em>{m}</em>}<a className="ad-btn o s" href={b[1]}>{b[0]}</a></div>
);

export default function Landing() {
  const { user } = useAuth();
  const [mail, setMail] = useState({ email: "", msg: "I would like to learn more about GrowHigh." });
  const send = (e) => { e.preventDefault(); window.location.href = `mailto:growhigh.hub@gmail.com?subject=GrowHigh enquiry&body=${encodeURIComponent(`${mail.msg}\n\nReply to: ${mail.email}`)}`; };
  const start = user ? homeFor(user.role) : "/register";
  return (
    <div className="ad pb">
      <PublicNav />
      <section className="pl-hero">
        <div><span className="nf-tag">SMART DIPLOMA · ECET · CAREER</span><h1>Build Your Future with GrowHigh</h1><h3>Your Career. Our Priority.</h3>
          <p>Prepare for ECET, build job-ready skills and explore career opportunities and internships — all in one focused space.</p>
          <div className="pl-btns"><Link className="ad-btn c" to={start}>{user ? "Go to dashboard" : "Get Started"}</Link><a className="ad-btn o" href="#features">See features</a></div><small>Learn. Prepare. Grow.</small></div>
        <Art />
      </section>

      <section id="features" className="pl-sec">
        <div className="pl-box"><h3>One journey. Three powerful possibilities.</h3><p>From your diploma classroom to your first opportunity, GrowHigh connects the steps that matter.</p>
          <div className="pl-grid">
            <Card t="Learn" d="Build strong subject foundations with topic practice and helpful explanations." m="Common + branch subjects" b={["Discover", "#learn"]} />
            <Card t="Prepare" d="Train for ECET, aptitude, coding and real interview conversations." m="Focused practice routines" b={["Discover", "#learn"]} />
            <Card t="Grow" d="Turn skills into projects, roadmaps and applications you can track." m="Your next career step" b={["Discover", "#skills"]} />
          </div></div>
        <div className="pl-grid two" style={{ marginBottom: 24 }}>
          <div className="pl-dark"><div className="ad-eyebrow" style={{ color: "#22d3ee" }}>PREPARE WITH PURPOSE</div><h3>A clearer path to ECET readiness</h3><p>Understand the syllabus, practise the right topics and review what needs attention. No guesswork, just a next step.</p>
            <span className="l">Subjects → Topics → Practice → Results</span><Link className="ad-btn c" to={start}>Explore ECET</Link></div>
          <div className="pl-box" style={{ margin: 0 }}><div className="ad-eyebrow">ILLUSTRATIVE STUDENT PREVIEW</div><h3 style={{ margin: "8px 0 18px" }}>Progress you can understand</h3>
            {[["Mathematics", 75], ["Physics", 60], ["Chemistry", 55]].map(([l, v]) => <Bar key={l} label={l} pct={v} />)}</div>
        </div>
      </section>

      <section id="learn" className="pl-sec"><h2>A daily rhythm that builds confidence.</h2>
        <div className="pl-grid">
          <Card t="Start small" d="Choose a topic and spend 20 focused minutes learning." m="01 · Learn" b={["See how it works", "#skills"]} />
          <Card t="Test your understanding" d="Complete your assigned daily or weekly assessment." m="02 · Prepare" b={["See how it works", "#skills"]} />
          <Card t="Use the feedback" d="Review weak areas, track progress and celebrate consistency." m="03 · Grow" b={["See how it works", "#skills"]} />
        </div></section>

      <section id="skills" className="pl-sec w"><h2>Skills that travel beyond the classroom.</h2>
        <div className="pl-grid" style={{ marginBottom: 30 }}>
          <Card t="Job-ready foundations" d="Aptitude, reasoning, coding and technical preparation in one place." m="Build your readiness" b={["Explore learning", start]} />
          <Card t="Communication that connects" d="Speak clearly, write professionally and present your ideas confidently." m="Practise your voice" b={["Explore learning", start]} />
          <Card t="Projects with direction" d="Move from concepts to portfolio work with a structured technology roadmap." m="Show what you can do" b={["Explore learning", start]} />
        </div>
        <div className="pl-grid two">
          <div className="pl-box" style={{ margin: 0 }}><h3>Make your next opportunity intentional</h3><p>Find jobs and internships, understand requirements and keep every application organised.</p>
            <div className="ad-stream"><div><small>Discover</small><b>Explore relevant roles</b><span>Search by role, company and location</span></div><div><small>Prepare</small><b>Make your profile count</b><span>Show skills, projects and a focused résumé</span></div><div><small>Track</small><b>Know your next step</b><span>Follow your applications and prepare for conversations</span></div></div>
            <Link className="ad-btn c" style={{ marginTop: 18 }} to={start}>Explore opportunities</Link></div>
          <div className="pl-dark"><div className="ad-eyebrow" style={{ color: "#22d3ee" }}>FACULTY &amp; ADMIN WORKSPACES</div><h3>For the people guiding your journey</h3><p>Create quality questions, schedule purposeful tests and see who needs support. Manage branch content, people and opportunities with clarity.</p>
            <span className="l">Better context. Better guidance.</span><Link className="ad-btn c" to="/register-faculty">Explore the platform</Link></div>
        </div>
      </section>

      <section id="about" className="pl-sec"><div className="pl-box"><h3>Built around diploma students</h3><p style={{ color: "#0f2238", fontSize: 19, marginBottom: 12 }}>Your learning journey is more than a score. GrowHigh brings preparation, confidence and career direction together — with your progress at the centre.</p>
        <p style={{ marginBottom: 0 }}>Designed for students, supported by faculty, organised by institutions.</p></div></section>

      <section className="pl-sec w"><h2>Your questions, answered.</h2>
        <div className="pl-grid">
          <Card t="Who is GrowHigh for?" d="Diploma students exploring ECET, practical skills and early-career opportunities." m="Student-first learning" b={["Learn more", "#about"]} />
          <Card t="How do assessments work?" d="Assigned tests allow one attempt. Separate practice sessions help you improve after feedback." m="Clear exam rules" b={["Learn more", "#about"]} />
          <Card t="Can faculty guide students?" d="Yes. Faculty can create questions, assign tests and review topic-wise class performance." m="Connected guidance" b={["Learn more", "#about"]} />
        </div></section>

      <section id="contact" className="pl-sec">
        <form className="pl-box pl-form" onSubmit={send}><h3>Let’s talk about your next step</h3><p>Have a question about the platform? Contact the GrowHigh support team.</p>
          <label>Your email</label><input className="ad-in" type="email" required placeholder="you@example.com" value={mail.email} onChange={(e) => setMail({ ...mail, email: e.target.value })} />
          <label>Message</label><textarea className="ad-in" rows={3} required value={mail.msg} onChange={(e) => setMail({ ...mail, msg: e.target.value })} />
          <button className="ad-btn c" style={{ marginTop: 18 }}>Send message</button></form>
        <div className="pl-cta"><div><h3>Your future deserves a plan.</h3><p>Learn. Prepare. Grow. Start with one step today.</p></div><Link className="ad-btn c" to={start}>Get Started</Link></div>
      </section>
      <PublicFooter />
    </div>
  );
}
