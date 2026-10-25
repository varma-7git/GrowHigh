import { useCallback, useEffect, useMemo, useState } from "react";
import api, { parseError } from "../api/client";
import { Act, Card, Filter, FormModal, Head, Rows, Search, Stat, Stats } from "./ui";

const cnt = (path, params) => api.get(path, { params: { ...params, page_size: 1 } }).then((r) => r.data.count).catch(() => 0);
const fail = (e) => { throw parseError(e); };

export function Branches({ notify }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [subjectsTotal, setSubjectsTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/branches/", { params: { page_size: 100 } });
      const withCounts = await Promise.all(data.results.map(async (b) => ({
        ...b, students: await cnt("/users/", { role: "STUDENT", branch: b.id }), subjects: await cnt("/subjects/", { branch: b.id }),
      })));
      setRows(withCounts); setSubjectsTotal(await cnt("/subjects/"));
    } catch (e) { notify(parseError(e).message, "danger"); }
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  const shown = rows.filter((b) => `${b.name} ${b.code}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = async (b) => {
    try { await api.patch(`/branches/${b.id}/`, { is_active: !b.is_active }); notify(`${b.name} ${b.is_active ? "hidden" : "shown again"}.`, "success"); load(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  const fields = [{ name: "name", label: "Branch name" }, { name: "code", label: "Short code", hint: "e.g. CSE" }];

  return (
    <>
      <Head crumb="Branches" title="Branches & learning capacity" sub="Keep academic structure connected to students, subjects and syllabus coverage."
        action={<button className="a-btn a-btn-coral" onClick={() => setModal({})}>Add branch</button>} />
      <Stats>
        <Stat label="Branches" value={rows.length} note="Academic structure" />
        <Stat label="Students" value={rows.reduce((s, b) => s + b.students, 0)} note="Total across branches" />
        <Stat label="Subjects" value={subjectsTotal} note="Common and branch subjects" />
      </Stats>
      <Search value={search} onChange={setSearch} placeholder="Search branch" />
      <div className="a-grid3">
        {shown.map((b) => (
          <Card key={b.id} className={`a-branch ${b.is_active ? "" : "off"}`}>
            <span className="a-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 5.5C5 4.5 8 4.5 12 6c4-1.5 7-1.5 9-.5V19c-2-1-5-1-9 .5-4-1.5-7-1.5-9-.5z" /><path d="M12 6v13.5" /></svg></span>
            <h3>{b.name}</h3>
            <p>{b.students} students · {b.subjects} subjects</p>
            <small>{b.code}{b.is_active ? "" : " · Hidden"}</small>
            <div className="a-acts"><Act onClick={() => setModal(b)}>Edit</Act><em>/</em><Act danger={b.is_active} onClick={() => toggle(b)}>{b.is_active ? "Hide" : "Show"}</Act></div>
          </Card>
        ))}
      </div>
      <Card title="Branch relationships">
        <Rows head="Branch / Students / Subjects / Actions" rows={shown.map((b) => ({
          id: b.id, title: b.code, meta: [b.name, `Students: ${b.students}`, `Subjects: ${b.subjects}`],
          actions: <><Act onClick={() => setModal(b)}>Edit</Act><em>/</em><Act danger={b.is_active} onClick={() => toggle(b)}>{b.is_active ? "Hide" : "Show"}</Act></>,
        }))} />
        <p className="a-note">Branches are hidden, never deleted, so student records stay intact. Subject count includes common subjects.</p>
      </Card>
      {modal && <FormModal title={modal.id ? "Edit branch" : "Add branch"} fields={fields} initial={modal} onClose={() => setModal(null)}
        onSave={async (v) => {
          await (modal.id ? api.patch(`/branches/${modal.id}/`, v) : api.post("/branches/", v)).catch(fail);
          notify("Branch saved.", "success"); load();
        }} />}
    </>
  );
}

export function Subjects({ notify }) {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  const loadSubjects = useCallback(() => {
    api.get("/subjects/", { params: { page_size: 100 } }).then((r) => setSubjects(r.data.results)).catch((e) => notify(parseError(e).message, "danger"));
  }, [notify]);
  useEffect(() => { loadSubjects(); api.get("/branches/", { params: { page_size: 100 } }).then((r) => setBranches(r.data.results)).catch(() => {}); }, [loadSubjects]);

  const loadTopics = useCallback(() => {
    if (!sel) { setTopics([]); return; }
    api.get("/topics/", { params: { subject: sel, page_size: 100 } }).then((r) => setTopics(r.data.results)).catch(() => {});
  }, [sel]);
  useEffect(() => { loadTopics(); }, [loadTopics]);

  const bname = (id) => branches.find((b) => b.id === id)?.code || "Common";
  const shown = useMemo(() => subjects.filter((s) =>
    (filter === "" || (filter === "common" ? s.branch_id === null : String(s.branch_id) === filter))
    && `${s.name} ${s.code}`.toLowerCase().includes(search.toLowerCase())), [subjects, filter, search]);
  const current = subjects.find((s) => s.id === sel) || shown[0];
  useEffect(() => { if (current && current.id !== sel) setSel(current.id); }, [current, sel]);

  const hide = async (path, obj, reload) => {
    try { await api.patch(`${path}${obj.id}/`, { is_active: !obj.is_active }); reload(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  const subjectFields = [{ name: "name", label: "Subject name" }, { name: "code", label: "Code", hint: "e.g. MATH" },
    { name: "branch_id", label: "Branch", type: "select", options: [["", "Common to all branches"], ...branches.map((b) => [String(b.id), b.name])] }];
  const topicFields = [{ name: "name", label: "Topic name" }, { name: "order_no", label: "Order number", type: "number", hint: "Optional. Lower numbers show first." }];

  return (
    <>
      <Head crumb="Subjects & topics" title="Subjects & topics" sub="A relationship-first workspace for syllabus content and question coverage."
        action={<button className="a-btn a-btn-coral" onClick={() => setModal({ kind: "subject" })}>Add subject</button>} />
      <Stats>
        <Stat label="Subjects" value={subjects.length} note="Common and branch" />
        <Stat label={current ? `${current.name} topics` : "Topics"} value={topics.length} note="In the selected subject" />
        <Stat label="Hidden" value={subjects.filter((s) => !s.is_active).length + topics.filter((t) => !t.is_active).length} note="Not shown to students" />
      </Stats>
      <Search value={search} onChange={setSearch} placeholder="Search subject">
        <Filter value={filter} onChange={setFilter} options={[["", "All subjects"], ["common", "Common subjects"], ...branches.map((b) => [String(b.id), b.code])]} />
      </Search>
      <div className="a-two">
        <Card title="Subject library" tag={current ? `${current.name.toUpperCase()} SELECTED` : ""}>
          <Rows head="Subject / Branch / Action" empty="No subjects yet." rows={shown.map((s) => ({
            id: s.id, title: <span className={`a-pick ${s.id === sel ? "on" : ""}`} onClick={() => setSel(s.id)}>{s.name}</span>,
            meta: [`Code: ${s.code}`, `Branch: ${bname(s.branch_id)}`, s.is_active ? null : "Hidden"],
            actions: <><Act onClick={() => setSel(s.id)}>Topics</Act><em>/</em><Act onClick={() => setModal({ kind: "subject", item: s })}>Edit</Act><em>/</em><Act danger={s.is_active} onClick={() => hide("/subjects/", s, loadSubjects)}>{s.is_active ? "Hide" : "Show"}</Act></>,
          }))} />
        </Card>
        <Card title={current ? `${current.name} → linked topics` : "Linked topics"}>
          <Rows head="Topic / Action" empty="No topics yet for this subject." rows={topics.map((t) => ({
            id: t.id, title: t.name, meta: [`Order: ${t.order_no}`, t.is_active ? null : "Hidden"],
            actions: <><Act onClick={() => setModal({ kind: "topic", item: t })}>Edit</Act><em>/</em><Act danger={t.is_active} onClick={() => hide("/topics/", t, loadTopics)}>{t.is_active ? "Hide" : "Show"}</Act></>,
          }))} />
          <button className="a-btn a-btn-coral" disabled={!current} onClick={() => setModal({ kind: "topic" })}>Add topic</button>
        </Card>
      </div>
      <div className="a-two">
        <Card dark title="Keep the hierarchy clear"><p>Branch → Subject → Topic → Question. Hiding a topic removes it from practice but keeps all history.</p></Card>
        <Card title="Content health"><p className="a-body-text">Question counts per topic appear here once the question bank is built.</p></Card>
      </div>
      {modal?.kind === "subject" && <FormModal title={modal.item ? "Edit subject" : "Add subject"} fields={subjectFields}
        initial={modal.item ? { ...modal.item, branch_id: modal.item.branch_id ? String(modal.item.branch_id) : "" } : { branch_id: filter && filter !== "common" ? filter : "" }}
        onClose={() => setModal(null)}
        onSave={async (v) => {
          const body = { ...v, branch_id: v.branch_id === "" ? null : Number(v.branch_id) };
          await (modal.item ? api.patch(`/subjects/${modal.item.id}/`, body) : api.post("/subjects/", body)).catch(fail);
          notify("Subject saved.", "success"); loadSubjects();
        }} />}
      {modal?.kind === "topic" && <FormModal title={modal.item ? "Edit topic" : `Add topic to ${current?.name}`} fields={topicFields} initial={modal.item || {}} onClose={() => setModal(null)}
        onSave={async (v) => {
          const body = { name: v.name }; if (v.order_no !== "") body.order_no = Number(v.order_no);
          await (modal.item ? api.patch(`/topics/${modal.item.id}/`, body) : api.post("/topics/", { ...body, subject_id: current.id })).catch(fail);
          notify("Topic saved.", "success"); loadTopics();
        }} />}
    </>
  );
}
