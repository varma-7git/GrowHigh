import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import WsShell from "../Shell";
import { Btn, Tabs } from "../kit";
import { Err } from "../../admin/ui";
import api, { parseError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

/** Profile for student and faculty: view, edit, change password. `role` picks the shell. */
export default function Profile({ role }) {
  const { user } = useAuth();
  const base = `/${role}/profile`;
  const T = [["Profile", base], ["Edit profile", `${base}/edit`], ["Password", `${base}/password`]];
  return <ProfileBody role={role} user={user} T={T} />;
}

function ProfileBody({ role, user, T }) {
  const { update } = useAuth();
  const tab = useLocation().pathname.split("/")[3] || "";
  const [u, setU] = useState(user);
  const [f, setF] = useState({ full_name: user.full_name, email: user.email || "", phone: user.phone || "" });
  const [p, setP] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [regs, setRegs] = useState([]);
  const [reg, setReg] = useState(user.regulation?.id ? String(user.regulation.id) : "");
  useEffect(() => { if (role === "student") api.get("/regulations/", { params: { page_size: 100 } }).then((r) => setRegs(r.data.results)).catch(() => {}); }, [role]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const save = async () => {
    setErr(""); setOk("");
    try { const { data } = await api.patch("/auth/me/", role === "student" && reg ? { ...f, regulation_id: Number(reg) } : f); setU(data); update(data); setOk("Profile updated."); } catch (e) { const x = parseError(e); setErr(Object.values(x.fields || {}).join(" ") || x.message); }
  };
  const pass = async () => {
    setErr(""); setOk("");
    try { await api.post("/auth/change-password/", p); setP({ old_password: "", new_password: "", confirm_password: "" }); setOk("Password changed."); } catch (e) { const x = parseError(e); setErr(Object.values(x.fields || {}).join(" ") || x.message); }
  };
  const Fld = ({ l, k, o, set, disabled, type }) => <><label>{l}</label><input className="ad-in" type={type} disabled={disabled} value={o[k] ?? ""} onChange={(e) => set({ ...o, [k]: e.target.value })} /></>;
  return (
    <WsShell role={role} crumb="My profile" title="My profile" subtitle="Your details and password.">
      <Tabs items={T} /><Err e={err} />{ok && <div className="ad-alert">{ok}</div>}
      {tab === "" && (
        <div className="ad-card"><h2>{u.full_name}</h2><div className="ws-tags">{[u.login_id, u.email, u.phone, u.regulation?.code, u.branch?.code || u.branch?.name, u.year_of_study && `Year ${u.year_of_study}`, u.department].filter(Boolean).map((t) => <span key={t}>{t}</span>)}</div></div>
      )}
      {tab === "edit" && (
        <div className="ad-card ws-form" style={{ maxWidth: 640 }}>
          <Fld l="Full name" k="full_name" o={f} set={setF} /><Fld l={role === "student" ? "Roll number" : "Faculty ID"} k="login_id" o={u} set={() => {}} disabled /><Fld l="Email" k="email" o={f} set={setF} /><Fld l="Phone" k="phone" o={f} set={setF} />
          {role === "student" && <><label>Regulation</label><select className="ad-in" value={reg} onChange={(e) => setReg(e.target.value)}><option value="">Select regulation</option>{regs.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</select></>}
          <div className="ws-btns"><Btn b={["Save changes", null, save]} kind="c" /></div>
        </div>
      )}
      {tab === "password" && (
        <div className="ad-card ws-form" style={{ maxWidth: 640 }}>
          <Fld l="Current password" k="old_password" o={p} set={setP} type="password" /><Fld l="New password" k="new_password" o={p} set={setP} type="password" /><Fld l="Confirm new password" k="confirm_password" o={p} set={setP} type="password" />
          <div className="ad-hint">At least 8 characters with a letter and a number.</div>
          <div className="ws-btns"><Btn b={["Update password", null, pass]} kind="c" /></div>
        </div>
      )}
    </WsShell>
  );
}
