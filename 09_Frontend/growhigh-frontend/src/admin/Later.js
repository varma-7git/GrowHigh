import { Card, Head, Stat, Stats } from "./ui";

const INFO = {
  qbank: { crumb: "Question bank", title: "Question bank oversight", sub: "Maintain clarity, provenance and quality across faculty-authored questions.",
    stats: [["Questions", "Platform bank"], ["Contributors", "Faculty authors"], ["Review queue", "Explanation or mapping checks"]],
    card: "Quality over quantity", text: "Review one correct answer, plausible distractors, clear topic mapping and a useful explanation. Keep authorship visible when editing.",
    dark: "Content stewardship", darkText: "Deleting a question can affect future test assembly. Check references and preserve submitted assessment history." },
  tests: { crumb: "Tests", title: "Test management", sub: "See assessment coverage, schedules and completion across the platform.",
    stats: [["Scheduled", "Upcoming assessments"], ["Active", "Current assessment windows"], ["Completed", "Submitted assessment history"]],
    card: "Schedule insights", text: "Daily, weekly, cumulative and AP ECET mock tests will be scheduled and monitored here.",
    dark: "Consistent rules, clearer expectations", darkText: "Assigned tests allow one attempt. AP ECET mocks use 200 questions, 200 marks, 3 hours and no negative marking." },
  content: { crumb: "Content & settings", title: "Content & platform settings", sub: "A considered publishing workspace for guidance, identity and support.",
    stats: [["Career roadmaps", "Published guidance"], ["Interview guides", "Prepared answers"], ["Reviewed content", "Ready to publish"]],
    card: "Platform settings", text: "Platform name, support email and taglines will be editable here.",
    dark: "Publishing health", darkText: "Check clarity, relevance and resource links before publishing." },
};

/** Screens whose backend is built in a later step. Same layout as the design, with empty counts. */
export default function Later({ kind }) {
  const i = INFO[kind];
  return (
    <>
      <Head crumb={i.crumb} title={i.title} sub={i.sub} />
      <Stats>{i.stats.map(([l, n]) => <Stat key={l} label={l} value="—" note={n} />)}</Stats>
      <div className="a-two">
        <Card title={i.card}><p className="a-body-text">{i.text}</p><span className="a-tag">COMING IN A LATER STEP</span></Card>
        <Card dark title={i.dark}><p>{i.darkText}</p></Card>
      </div>
    </>
  );
}
