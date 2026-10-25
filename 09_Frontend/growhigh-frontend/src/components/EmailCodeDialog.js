import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api, { parseError } from "../api/client";

/** Opens when the user presses Register: emails a 6-digit code to the address and waits for it.
 *  If the code cannot be delivered, the error is shown and nothing is created. */
export default function EmailCodeDialog({ email, onVerified, onCancel }) {
  const [phase, setPhase] = useState("sending");  // sending | ready | failed
  const [code, setCode] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [wait, setWait] = useState(0);

  const send = useCallback(async () => {
    setPhase("sending"); setMsg("");
    try { await api.post("/auth/send-email-code/", { email }, { skipAuth: true }); setPhase("ready"); setWait(30); }
    catch (e) { const p = parseError(e); setMsg(p.fields?.email || p.message); setPhase("failed"); }
  }, [email]);
  useEffect(() => { send(); }, [send]);
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  useEffect(() => { const k = (e) => e.key === "Escape" && onCancel(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onCancel]);

  const verify = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try { const { data } = await api.post("/auth/verify-email-code/", { email, code: code.trim() }, { skipAuth: true }); onVerified(data.token); }
    catch (x) { setMsg(parseError(x).message); setBusy(false); }
  };

  return createPortal(
    <div className="gh-dlg" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="gh-dlg-box" onSubmit={verify}>
        <h3>Verify your email</h3>
        {phase === "sending" && <p><span className="gh-spin" /> Sending a code to <b>{email}</b>…</p>}
        {phase === "failed" && <><div className="gh-error" style={{ fontSize: 15 }}>{msg}</div>
          <div className="d-flex gap-2 mt-3"><button type="button" className="gh-btn gh-btn-coral gh-btn-sm" onClick={send}>Try again</button>
            <button type="button" className="gh-btn gh-btn-dark gh-btn-sm" onClick={onCancel}>Change email</button></div></>}
        {phase === "ready" && <>
          <p>We sent a 6-digit code to <b>{email}</b>. Enter it to finish registering. Check your spam folder if you do not see it.</p>
          <input className="form-control gh-code" autoFocus inputMode="numeric" maxLength={6} placeholder="______" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          {msg && <div className="gh-error">{msg}</div>}
          <div className="d-flex gap-2 mt-3 flex-wrap">
            <button className="gh-btn gh-btn-coral gh-btn-sm" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and register"}</button>
            <button type="button" className="gh-btn gh-btn-dark gh-btn-sm" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : "Resend code"}</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button></div></>}
      </form>
    </div>, document.body);
}
