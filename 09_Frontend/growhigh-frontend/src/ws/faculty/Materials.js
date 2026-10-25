import { useCallback, useEffect, useState } from "react";
import WsShell from "../Shell";
import { Err, List, Row, Select, all } from "../../admin/ui";
import api, { parseError } from "../../api/client";

const KINDS = [["VIDEO", "Video"], ["NOTES", "Notes"], ["PDF", "PDF"], ["LINK", "Web link"]];
const EMPTY = { kind: "VIDEO", title: "", body: "", url: "", file: null };

/** Faculty add notes, upload videos or PDFs, or share links for a topic. */
export default function Materials() {
  const [subs, setSubs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sub, setSub] = useState("");
  const [topic, setTopic] = useState("");
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(null);
  const [er, setEr] = useState({});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pct, setPct] = useState(null);

  useEffect(() => { all("/subjects/").then((r) => { setSubs(r); if (r[0]) setSub(String(r[0].id)); }).catch((e) => setErr(parseError(e).message)); }, []);
  useEffect(() => {
    if (!sub) return;
    all("/topics/", { subject: sub }).then((r) => { setTopics(r); setTopic(r[0] ? String(r[0].id) : ""); }).catch(() => {});
  }, [sub]);
  const load = useCallback(() => {
    if (!topic) { setRows([]); return; }
    api.get("/materials/", { params: { topic, page_size: 100 } }).then((r) => setRows(r.data.results)).catch(() => {});
  }, [topic]);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault(); setEr({}); setErr(""); setOk("");
    const fd = new FormData();
    fd.append("topic_id", topic); fd.append("kind", f.kind); fd.append("title", f.title);
    if (f.kind === "NOTES") fd.append("body", f.body);
    if (f.kind !== "NOTES" && f.url) fd.append("url", f.url);
    if ((f.kind === "VIDEO" || f.kind === "PDF") && f.file) fd.append("file", f.file);
    try {
      const cfg = { onUploadProgress: (p) => setPct(p.total ? Math.round((p.loaded / p.total) * 100) : null), timeout: 0 };
      await (f.id ? api.patch(`/materials/${f.id}/`, fd, cfg) : api.post("/materials/", fd, cfg));
      setOk("Saved. Students can see it now."); setF(null); load();
    } catch (x) { const p = parseError(x); setEr(p.fields || {}); setErr(p.message); }
    setPct(null);
  };
  const hide = async (m) => { try { await api.patch(`/materials/${m.id}/`, { is_active: !m.is_active }); load(); } catch (x) { setErr(parseError(x).message); } };
  const del = async (m) => {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    try { await api.delete(`/materials/${m.id}/`); load(); } catch (x) { setErr(parseError(x).message); }
  };
  const label = (k) => KINDS.find((x) => x[0] === k)?.[1];

  return (
    <WsShell role="faculty" crumb="Learning material" title="Learning material" subtitle="Upload videos, share notes and links. Students see them on the topic page.">
      <Err e={err} />{ok && <div className="ad-alert">{ok}</div>}
      <div className="ad-filters">
        <Select value={sub} onChange={setSub} options={subs.length ? subs.map((s) => [String(s.id), s.name]) : [["", "No subjects yet"]]} />
        <Select value={topic} onChange={setTopic} options={topics.length ? topics.map((t) => [String(t.id), t.name]) : [["", "No topics yet"]]} />
        <button className="ad-btn c" disabled={!topic} onClick={() => { setF({ ...EMPTY }); setEr({}); }}>Add material</button>
      </div>
      {f && (
        <form className="ad-card ws-form" style={{ marginBottom: 24 }} onSubmit={save}>
          <h2>{f.id ? "Edit material" : "Add material"}</h2>
          <label>Type</label>
          <select className="ad-in" value={f.kind} disabled={!!f.id} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label>Title</label><input className="ad-in" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Err e={er.title} />
          {f.kind === "NOTES" && <><label>Notes</label><textarea className="ad-in" rows={7} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /><Err e={er.body} /></>}
          {(f.kind === "VIDEO" || f.kind === "PDF") && (
            <>
              <label>{f.kind === "VIDEO" ? "Upload a video" : "Upload a PDF"} <small>({f.kind === "VIDEO" ? "MP4, WebM or MOV, up to 300 MB" : ".pdf, up to 25 MB"})</small></label>
              <input className="ad-in" type="file" accept={f.kind === "VIDEO" ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" : "application/pdf,.pdf"} onChange={(e) => setF({ ...f, file: e.target.files[0] || null })} /><Err e={er.file} />
              <div className="ad-hint">Or share a link instead of uploading:</div>
            </>
          )}
          {f.kind !== "NOTES" && <><label>Link <small>(optional when you upload a file)</small></label><input className="ad-in" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /><Err e={er.url} /></>}
          {pct !== null && <div style={{ marginTop: 16 }}><div className="ad-pr"><span>Uploading…</span><span>{pct}%</span></div><div className="ws-pbar"><i style={{ width: `${pct}%` }} /></div></div>}
          <div className="ws-btns"><button className="ad-btn c" disabled={pct !== null}>{pct !== null ? "Uploading…" : "Save"}</button><button type="button" className="ad-btn o" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      )}
      <List head={<><span>Material</span><span>Action</span></>} empty={topic ? "No material for this topic yet. Add the first one." : "Pick a subject and topic."} rows={rows.map((m) => (
        <Row key={m.id} title={<>{m.title}{!m.is_active && <span className="ad-pill bad">Hidden</span>}</>} meta={`${label(m.kind)} · ${m.mine ? "Added by you" : `Added by ${m.uploaded_by_name || "admin"}`}${m.file_url ? " · Uploaded file" : ""}`}>
          {m.mine && <><button className="ad-btn o s" onClick={() => setF({ id: m.id, kind: m.kind, title: m.title, body: m.body, url: m.url, file: null })}>Edit</button>
            <button className="ad-btn o s" onClick={() => hide(m)}>{m.is_active ? "Hide" : "Show"}</button>
            <button className="ad-btn d s" onClick={() => del(m)}>Delete</button></>}
        </Row>))} />
    </WsShell>
  );
}
