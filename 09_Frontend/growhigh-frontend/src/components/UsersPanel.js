import { useCallback, useEffect, useState } from "react";
import api, { parseError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const ROLES = [["", "All"], ["STUDENT", "Students"], ["FACULTY", "Faculty"], ["COMPANY", "Companies"], ["ADMIN", "Admins"]];

function detail(u) {
  if (u.role === "STUDENT") return [u.branch?.name, u.year_of_study ? `Year ${u.year_of_study}` : null, u.college_name].filter(Boolean).join(" · ");
  if (u.role === "FACULTY") return u.department || "";
  if (u.role === "COMPANY") return u.company_name || "";
  return "";
}

/** Admin: every registered user, with search, filter, block/unblock and password reset. */
export default function UsersPanel({ notify }) {
  const { user: me } = useAuth();
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [], next: null, previous: null });

  const load = useCallback(() => {
    api.get("/users/", { params: { role: role || undefined, search: search || undefined, page, page_size: 20 } })
      .then((r) => setData(r.data)).catch((e) => notify(parseError(e).message, "danger"));
  }, [role, search, page, notify]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (u) => {
    try {
      await api.patch(`/users/${u.id}/`, { is_active: !u.is_active });
      notify(`${u.full_name} ${u.is_active ? "blocked" : "unblocked"}.`, "success");
      load();
    } catch (e) { notify(parseError(e).message, "danger"); }
  };

  const reset = async (u) => {
    if (!window.confirm(`Reset the password for ${u.full_name}? A new temporary password will be shown once.`)) return;
    try {
      const { data: d } = await api.post(`/users/${u.id}/reset-password/`);
      notify(`New temporary password for ${u.login_id}: ${d.temporary_password}  (share it with the user and ask them to change it)`, "warning");
    } catch (e) { notify(parseError(e).message, "danger"); }
  };

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-5 d-flex gap-2 flex-wrap">
          {ROLES.map(([k, l]) => (
            <button key={k} className={`btn btn-sm ${role === k ? "btn-dark" : "btn-outline-dark"}`} onClick={() => { setRole(k); setPage(1); }}>{l}</button>
          ))}
        </div>
        <div className="col-md-7">
          <input className="form-control" placeholder="Search by name or login ID" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <p className="gh-hint">{data.count} user{data.count === 1 ? "" : "s"}</p>
      <div className="gh-panel p-0">
        <div className="table-responsive">
          <table className="table gh-table-stack align-middle mb-0">
            <thead><tr><th>Login ID</th><th>Name</th><th>Email</th><th>Role</th><th>Details</th><th>Registered</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.results.length === 0 && <tr><td colSpan="8" className="text-muted p-3">No users found.</td></tr>}
              {data.results.map((u) => (
                <tr key={u.id}>
                  <td data-label="Login ID">{u.login_id}</td><td data-label="Name">{u.full_name}</td><td data-label="Email">{u.email || "-"}</td>
                  <td data-label="Role"><span className={`gh-role gh-role-${u.role}`}>{u.role}</span></td>
                  <td data-label="Details" className="small">{detail(u)}</td>
                  <td data-label="Registered" className="small">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td data-label="Status">{u.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Blocked</span>}</td>
                  <td className="text-nowrap">
                    {u.id !== me.id && (
                      <>
                        <button className="btn btn-sm btn-outline-dark me-1" onClick={() => toggle(u)}>{u.is_active ? "Block" : "Unblock"}</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => reset(u)}>Reset password</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="d-flex justify-content-between mt-3">
        <button className="btn btn-sm btn-outline-dark" disabled={!data.previous} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="gh-hint">Page {page}</span>
        <button className="btn btn-sm btn-outline-dark" disabled={!data.next} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </>
  );
}
