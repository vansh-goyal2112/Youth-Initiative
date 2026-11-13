"use client";
import Link from "next/link";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Edit3,
  Eye,
  LoaderCircle,
  Search,
  UserRound,
  UserX,
  Users,
  X,
  RefreshCw,
  UserRoundCheck,
  ShieldCheck,
  Gift,
  Plus,
} from "lucide-react";

import {
  adminFetch,
} from "@/services/adminApi";

export default function AdminStudentsPage() {
  const [students, setStudents] =
    useState([]);
  const [pendingEnrollments, setPendingEnrollments] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [searchText, setSearchText] =
    useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState(null);

  const [
    editingStudent,
    setEditingStudent,
  ] = useState(null);

  const [saving, setSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [message, setMessage] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    firstName: "", lastName: "", email: "", dateOfBirth: "", parentEmail: "",
  });

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await adminFetch(
          "/api/admin/students"
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Students could not be loaded."
        );
      }

      setStudents(
        data.students || []
      );
      setPendingEnrollments(data.pendingEnrollments || []);
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Students could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      return students.filter(
        (student) => {
          return (statusFilter === "all" || (student.accountStatus || "active") === statusFilter) && (!search || [
            student.firstName,
            student.lastName,
            student.fullName,
            student.youthId,
            student.contactEmail,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(search)
            ));
        }
      );
    }, [
      students,
      searchText,
      statusFilter,
    ]);

  async function saveStudent(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const response =
        await adminFetch(
          "/api/admin/students",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                editingStudent
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Student could not be updated."
        );
      }

      setMessage(
        data.message
      );

      setEditingStudent(
        null
      );

      await loadStudents();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Student could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateStudent(
    student
  ) {
    const confirmed =
      window.confirm(
        `Deactivate ${
          student.fullName ||
          student.youthId
        }?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setErrorMessage("");

      const response =
        await adminFetch(
          "/api/admin/students",
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id: student.id,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Student could not be deactivated."
        );
      }

      setMessage(
        data.message
      );

      await loadStudents();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Student could not be deactivated."
      );
    }
  }


  async function enrollStudent(event) {
    event.preventDefault();
    try {
      setEnrolling(true);
      setMessage("");
      setErrorMessage("");
      const response = await adminFetch("/api/admin/students/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrollForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Enrollment could not be started.");
      setMessage(data.message);
      setShowEnrollForm(false);
      setEnrollForm({ firstName: "", lastName: "", email: "", dateOfBirth: "", parentEmail: "" });
      await loadStudents();
    } catch (error) {
      setErrorMessage(error.message || "Enrollment could not be started.");
    } finally {
      setEnrolling(false);
    }
  }

  async function reactivateStudent(student) {
    if (!window.confirm("Reactivate " + (student.fullName || student.youthId) + "?")) return;
    try {
      setSaving(true);
      setErrorMessage("");
      const response = await adminFetch("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          contactEmail: student.contactEmail,
          learningMode: student.learningMode || "",
          interests: student.interests || [],
          accountStatus: "active",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Reactivation failed.");
      setMessage("Student account reactivated in Firebase Authentication and Cosmos DB.");
      await loadStudents();
    } catch (error) {
      setErrorMessage(error.message || "Reactivation failed.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <main className="admin-students-page">
      <div className="admin-students-intro">
        <div><p className="admin-section-eyebrow"><Users size={16}/> STUDENT OPERATIONS</p><h1>Student directory<span>.</span></h1>
          <p>Get a complete view of your youth community. Find profiles, support students, and explore their learning journeys.</p></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="admin-team-refresh" type="button" disabled={loading || enrolling}
            onClick={() => setShowEnrollForm(current => !current)}>
            <Plus size={18} /> Start student registration
          </button>
          <button className="admin-team-refresh" type="button" disabled={loading} onClick={loadStudents}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Refresh students
          </button>
        </div>
      </div>

      {showEnrollForm && (
        <form onSubmit={enrollStudent} className="admin-student-table-card" style={{ padding: 22, marginBottom: 18 }}>
          <h2>Start a student&apos;s enrollment</h2>
          <p style={{ marginBottom: 16 }}>
            Students must verify their email; students under 18 also need guardian consent.
            An account is created only after verification and activation.
          </p>
          <div className="admin-form-two-columns">
            {[
              ["First name", "firstName", "text"],
              ["Last name", "lastName", "text"],
              ["Student email", "email", "email"],
              ["Date of birth", "dateOfBirth", "date"],
              ["Guardian email (required if under 18)", "parentEmail", "email"],
            ].map(([label, name, type]) => (
              <label key={name} className="admin-form-field">
                <span>{label}</span>
                <input type={type} value={enrollForm[name]} required={name !== "parentEmail"}
                  onChange={event => setEnrollForm(current => ({
                    ...current, [name]: event.target.value,
                  }))}
                />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button type="submit" className="admin-team-refresh" disabled={enrolling}>
              {enrolling ? "Starting registration…" : "Send verification / guardian consent"}
            </button>
            <button type="button" className="admin-team-refresh" onClick={() => setShowEnrollForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="admin-students-stats">
        <div><span className="blue"><Users size={22}/></span><div><strong>{students.length}</strong><small>Total students</small></div></div>
        <div><span className="green"><UserRoundCheck size={22}/></span><div><strong>{students.filter(s => (s.accountStatus || "active") === "active").length}</strong><small>Active accounts</small></div></div>
        <div><span className="rose"><ShieldCheck size={22}/></span><div><strong>{students.filter(s => s.accountStatus === "inactive").length}</strong><small>Inactive accounts</small></div></div>
      </div>
      {message && (
        <div className="admin-success-message">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="admin-error-message">
          {errorMessage}
        </div>
      )}

      <div className="admin-students-toolbar">
        <div className="admin-student-search"><Search size={19}/><input type="search" aria-label="Search students" placeholder="Search by name, Youth ID or email…" value={searchText} onChange={event=>setSearchText(event.target.value)}/></div>
        <select className="admin-students-filter" aria-label="Filter by account status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">All account statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <div className="admin-students-results">{filteredStudents.length} results</div>
      </div>
      {pendingEnrollments.length > 0 && (
        <section className="admin-student-table-card" style={{ marginBottom: 20, padding: 18 }}>
          <h2 style={{ marginBottom: 10 }}>Awaiting student activation ({pendingEnrollments.length})</h2>
          <p style={{ marginBottom: 12 }}>
            These are pending registrations, not active student accounts.
            Verification and, for minors, guardian consent must finish before
            they appear in the student directory.
          </p>
          <div className="admin-table-scroll">
            <table className="admin-student-table">
              <thead><tr><th>Student</th><th>Email</th><th>Registration status</th></tr></thead>
              <tbody>
                {pendingEnrollments.map(item => (
                  <tr key={item.id}>
                    <td>{item.fullName}</td>
                    <td>{item.email}</td>
                    <td>{(item.status || "pending").replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="admin-student-table-card">
        {loading ? (
          <div className="admin-student-state">
            <LoaderCircle
              size={32}
              className="button-spinner"
            />

            Loading students...
          </div>
        ) : filteredStudents.length ===
          0 ? (
          <div className="admin-student-state">
            <UserRound
              size={43}
            />

            No students found.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Youth ID</th>
                  <th>Learning</th>
                  <th>XP</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map(
                  (student) => (
                    <tr
                      key={
                        student.id
                      }
                    >
                      <td>
                        <strong>
                          {student.fullName ||
                            `${
                              student.firstName ||
                              ""
                            } ${
                              student.lastName ||
                              ""
                            }`}
                        </strong>

                        <span>
                          {
                            student.contactEmail
                          }
                        </span>
                      </td>

                      <td>
                        <strong className="admin-youth-id">
                          {
                            student.youthId
                          }
                        </strong>
                      </td>

                      <td>
                        {formatMode(
                          student.learningMode
                        )}
                      </td>

                      <td>
                        {student.totalXp ||
                          0}
                      </td>

                      <td>
                        {student.level ||
                          1}
                      </td>

                      <td>
                        <span
                          className={`admin-status-badge ${
                            student.accountStatus ===
                            "inactive"
                              ? "inactive"
                              : "active"
                          }`}
                        >
                          {student.accountStatus ||
                            "active"}
                        </span>
                      </td>

                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            title="View student profile" aria-label="View student profile"
                            onClick={() =>
                              setSelectedStudent(
                                student
                              )
                            }
                          >
                            <Eye
                              size={17}
                            />
                          </button>

                          <button
                            type="button"
                            title="Edit student profile" aria-label="Edit student profile"
                            onClick={() =>
                              setEditingStudent({
                                ...student,

                                interests:
                                  student.interests ||
                                  [],
                              })
                            }
                          >
                            <Edit3
                              size={17}
                            />
                          </button>


                          {student.accountStatus === "inactive" && (
                            <button type="button" title="Reactivate student" aria-label="Reactivate student"
                              disabled={saving} onClick={() => reactivateStudent(student)}>
                              <UserRoundCheck size={17} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Deactivate student" aria-label="Deactivate student"
                            className="delete"
                            disabled={student.accountStatus !== "active"}
                            onClick={() =>
                              deactivateStudent(
                                student
                              )
                            }
                          >
                            <UserX
                              size={17}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedStudent && (
        <StudentViewModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onRedeemed={(balances) => {
            setSelectedStudent(current => current ? { ...current, ...balances } : null);
            setStudents(current => current.map(item => item.id === selectedStudent.id ? { ...item, ...balances } : item));
          }}
          onBadgeRemoved={badgeId => {
            setSelectedStudent(current => current ? { ...current, badges: current.badges.filter(item=>item!==badgeId), badgeCount: Math.max(0,(current.badgeCount||0)-1) } : null);
            setStudents(current => current.map(item => item.id === selectedStudent.id ? { ...item, badges: item.badges?.filter(b=>b!==badgeId)||[], badgeCount:Math.max(0,(item.badgeCount||0)-1) } : item));
          }}
        />
      )}

      {editingStudent && (
        <StudentEditModal
          student={
            editingStudent
          }
          setStudent={
            setEditingStudent
          }
          saving={saving}
          onClose={() =>
            setEditingStudent(
              null
            )
          }
          onSubmit={
            saveStudent
          }
        />
      )}
    </main>
  );
}

function StudentViewModal({
  student,
  onClose,
  onRedeemed,
  onBadgeRemoved,
}) {
  return (
    <div className="admin-student-modal-overlay">
      <section className="admin-student-modal">
        <header>
          <div>
            <span>
              STUDENT PROFILE
            </span>

            <h2>
              {student.fullName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>

        <div className="admin-student-profile-grid">
          <ProfileItem
            label="Youth ID"
            value={
              student.youthId
            }
          />

          <ProfileItem
            label="Email"
            value={
              student.contactEmail
            }
          />

          <ProfileItem
            label="Date of Birth"
            value={
              student.dateOfBirth
            }
          />

          <ProfileItem
            label="Learning Mode"
            value={formatMode(
              student.learningMode
            )}
          />

          <ProfileItem label="Total XP" value={student.totalXp ?? 0} />
          <ProfileItem label="Current XP" value={student.currentXp ?? student.totalXp ?? 0} />

          <ProfileItem
            label="Level"
            value={
              student.level ||
              1
            }
          />

          <ProfileItem
            label="Badges"
            value={
              student.badgeCount ||
              0
            }
          />

          <ProfileItem
            label="Completed Workshops"
            value={
              student.completedWorkshopCount ||
              0
            }
          />
        </div>

        <XpRedemptionPanel student={student} onRedeemed={onRedeemed} />
        <XpCorrectionPanel student={student} onAdjusted={onRedeemed} />
        <AdminBadgeRemoval student={student} onBadgeRemoved={onBadgeRemoved} />

        <div className="admin-student-interests">
          <span>
            INTERESTS
          </span>

          <div>
            {(student.interests ||
              []).length > 0 ? (
              student.interests.map(
                (interest) => (
                  <small
                    key={
                      interest
                    }
                  >
                    {formatInterest(
                      interest
                    )}
                  </small>
                )
              )
            ) : (
              <p>
                No interests selected.
              </p>
            )}
          </div>
        </div>
        <Link
          href={`/admin/reports?youthId=${encodeURIComponent(student.youthId || "")}`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-500"
        >
          Generate Full Report
        </Link>
      </section>
    </div>
  );
}

function XpRedemptionPanel({ student, onRedeemed }) {
  const [canRedeem, setCanRedeem] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(student.currentXp ?? student.totalXp ?? 0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const operationRef = useRef(null);

  useEffect(() => {
    let allowed = false;
    try { allowed = JSON.parse(sessionStorage.getItem("adminSession") || "{}").permissions?.includes("xp.redeem") === true; }
    catch { allowed = false; }
    let active = true;
    queueMicrotask(() => { if (active) setCanRedeem(allowed); });
    if (!allowed) return () => { active = false; };
    adminFetch("/api/admin/rewards?studentId=" + encodeURIComponent(student.id))
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "Could not load redemption history."); return result; })
      .then(result => { if (active) { setBalance(result.currentXp); setHistory(result.history || []); } })
      .catch(cause => { if (active) setError(cause.message || "Could not load redemption history."); });
    return () => { active = false; };
  }, [student.id]);

  if (!canRedeem) return null;

  async function submit(event) {
    event.preventDefault();
    const points = Number(amount);
    if (!Number.isSafeInteger(points) || points <= 0 || points > balance) {
      setError("Enter a whole number of XP no greater than the student's Current XP.");
      return;
    }
    setLoading(true); setError(""); setNotice("");
    if (!operationRef.current) operationRef.current = crypto.randomUUID();
    try {
      const response = await adminFetch("/api/admin/rewards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, amount: points, note, operationId: operationRef.current }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "XP could not be redeemed.");
      operationRef.current = null;
      setBalance(result.currentXp ?? balance - points);
      setNotice(result.message);
      onRedeemed?.({ currentXp: result.currentXp ?? balance - points, totalXp: result.totalXp ?? student.totalXp });
      setAmount(""); setNote("");
      const refreshed = await adminFetch("/api/admin/rewards?studentId=" + encodeURIComponent(student.id));
      if (refreshed.ok) { const latest = await refreshed.json(); setHistory(latest.history || []); }
    } catch (cause) {
      setError(cause.message || "Unable to redeem XP. Check the ledger before trying again.");
    } finally { setLoading(false); }
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5" aria-label="Event XP redemption">
      <div className="mb-3 flex items-center gap-2 text-amber-900"><Gift size={21}/><h3 className="text-base font-extrabold">Redeem XP at an event</h3></div>
      <p className="mb-4 text-sm text-slate-600">Current XP: <strong>{balance}</strong>. Redeeming swag never reduces lifetime XP or level progress.</p>
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1 text-xs font-bold text-slate-700">XP to redeem
          <input className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" inputMode="numeric" type="number" min="1" max={balance} step="1" required value={amount} onChange={event => { setAmount(event.target.value); operationRef.current = null; }}/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Event or reward note (optional)
          <input className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" maxLength={200} placeholder="Open House – hoodie" value={note} onChange={event => {setNote(event.target.value); operationRef.current = null;}}/>
        </label>
        <button type="submit" disabled={loading || balance <= 0} className="min-h-11 rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Processing redemption…" : "Confirm XP redemption"}
        </button>
      </form>
      {notice && <p className="mt-3 text-sm font-semibold text-emerald-800" role="status">{notice}</p>}
      {error && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <div className="mt-5 border-t border-amber-200 pt-4">
        <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">Redemption log</h4>
        {!history.length ? <p className="text-xs text-slate-500">No redemptions recorded for this student.</p> :
          <div className="max-h-40 space-y-2 overflow-y-auto">{history.map(item => (
            <div key={item.id} className="flex justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
              <div><strong>{item.amount} XP</strong><span className="ml-2">{item.note || "Event reward"}</span><p className="mt-1 text-slate-500">{item.actorEmail} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recorded"} · {item.status}</p></div>
            </div>
          ))}</div>}
      </div>
    </section>
  );
}

function AdminBadgeRemoval({ student, onBadgeRemoved }) {
  const [allowed, setAllowed] = useState(false);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customNames, setCustomNames] = useState({});
  useEffect(()=>{
    let active = true;
    queueMicrotask(()=>{
      if (!active) return;
      try {setAllowed(JSON.parse(sessionStorage.getItem("adminSession") || "{}").permissions?.includes("badges.manage")===true);}
      catch {setAllowed(false);}
    });
    adminFetch("/api/admin/badges").then(async response=>{
      if (!response.ok) return;
      const result=await response.json();
      if (active) setCustomNames(Object.fromEntries((result.badges||[]).map(item=>[item.badgeId,item.name])));
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  if (!allowed) return null;
  const badges = Array.isArray(student.badges) ? student.badges : [];
  const known = {"first-step":"First Step","tech-explorer":"Tech Explorer","skill-builder":"Skill Builder","curious-learner":"Curious Learner","workshop-champion":"Workshop Champion"};
  async function revoke(event){
    event.preventDefault();
    if (saving || !selected || reason.trim().length<5) return;
    setSaving(true);setError("");setNotice("");
    try{
      const response=await adminFetch("/api/admin/badges/revoke",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:student.id,badgeId:selected,reason})});
      const result=await response.json();
      if (!response.ok || !result.success) throw new Error(result.message||"Badge removal failed.");
      onBadgeRemoved?.(selected);
      setNotice(result.message);setSelected("");setReason("");
    }catch(cause){setError(cause.message||"Badge removal failed.");}finally{setSaving(false);}
  }
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Remove student badges">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-800"><ShieldCheck size={18}/> Badge management</h3>
      <p className="mb-3 text-xs text-slate-600">Authorized removal records a suppression so the same badge is not immediately re-awarded by an automatic rule.</p>
      {!badges.length ? <p className="text-xs text-slate-500">No badges awarded yet.</p> :
        <form onSubmit={revoke} className="space-y-3">
          <label className="grid gap-1 text-xs font-bold text-slate-700">Awarded badge
            <select required value={selected} onChange={event=>setSelected(event.target.value)} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm">
              <option value="">Choose a badge</option>
              {badges.map(id=><option key={id} value={id}>{customNames[id]||known[id]||id}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">Reason (required)
            <input required minLength={5} maxLength={250} value={reason} onChange={event=>setReason(event.target.value)} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm" placeholder="Incorrect badge award"/>
          </label>
          <button disabled={saving||!selected||reason.trim().length<5} className="min-h-10 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-50 disabled:opacity-50" type="submit">{saving?"Removing…":"Remove badge"}</button>
        </form>}
      {notice&&<p className="mt-3 text-xs font-semibold text-emerald-700" role="status">{notice}</p>}
      {error&&<p className="mt-3 text-xs font-semibold text-rose-700" role="alert">{error}</p>}
    </section>
  );
}

function XpCorrectionPanel({ student, onAdjusted }) {
  const [allowed, setAllowed] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const operationRef = useRef(null);
  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if (!active) return;
      try{setAllowed(JSON.parse(sessionStorage.getItem("adminSession")||"{}").permissions?.includes("xp.adjust")===true);}catch{setAllowed(false);}
    });
    return()=>{active=false;};
  },[]);
  if (!allowed) return null;
  async function submit(event){
    event.preventDefault();
    const points=Number(amount);
    if (!Number.isSafeInteger(points)||points<=0||points>(student.totalXp||0)||reason.trim().length<5){
      setError("Enter an amount within Total XP and a reason of at least five characters.");return;
    }
    setSaving(true);setNotice("");setError("");
    if (!operationRef.current) operationRef.current=crypto.randomUUID();
    try{
      const response=await adminFetch("/api/admin/xp-adjust",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:student.id,amount:points,reason,operationId:operationRef.current})});
      const result=await response.json();
      if (!response.ok||!result.success) throw new Error(result.message||"XP correction failed.");
      operationRef.current=null;
      onAdjusted?.({totalXp:result.totalXp,currentXp:result.currentXp,xpCorrectionDebt:result.xpCorrectionDebt});
      setNotice(result.message);setAmount("");setReason("");
    }catch(cause){setError(cause.message||"XP correction could not be completed. Check the ledger before retrying.");}
    finally{setSaving(false);}
  }
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Correct earned student XP">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-800"><ShieldCheck size={18}/> Correct erroneous XP</h3>
      <p className="mb-3 text-xs text-slate-600">Unlike swag redemption, this removes incorrectly earned lifetime XP. Spendable XP remains at zero if insufficient and an outstanding correction offsets future rewards.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="grid gap-1 text-xs font-bold text-slate-700">XP to remove (maximum {student.totalXp||0})
          <input required type="number" min="1" max={student.totalXp||0} step="1" value={amount} onChange={event=>{setAmount(event.target.value);operationRef.current=null;}} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Correction reason (required)
          <input required minLength={5} maxLength={250} value={reason} onChange={event=>{setReason(event.target.value);operationRef.current=null;}} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm" placeholder="Incorrect attendance XP award"/>
        </label>
        <button disabled={saving||!amount||reason.trim().length<5} type="submit" className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-50 disabled:opacity-50">{saving?"Applying correction…":"Remove erroneous XP"}</button>
      </form>
      {notice&&<p className="mt-3 text-xs font-semibold text-emerald-700" role="status">{notice}</p>}
      {error&&<p className="mt-3 text-xs font-semibold text-rose-700" role="alert">{error}</p>}
    </section>
  );
}

function StudentEditModal({
  student,
  setStudent,
  saving,
  onClose,
  onSubmit,
}) {
  function updateField(
    name,
    value
  ) {
    setStudent(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  return (
    <div className="admin-student-modal-overlay">
      <section className="admin-student-modal">
        <header>
          <div>
            <span>
              EDIT STUDENT
            </span>

            <h2>
              Update Account
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>

        <form
          className="admin-student-edit-form"
          onSubmit={onSubmit}
        >
          <div className="admin-form-two-columns">
            <StudentField
              label="First Name"
              value={
                student.firstName ||
                ""
              }
              onChange={(value) =>
                updateField(
                  "firstName",
                  value
                )
              }
            />

            <StudentField
              label="Last Name"
              value={
                student.lastName ||
                ""
              }
              onChange={(value) =>
                updateField(
                  "lastName",
                  value
                )
              }
            />
          </div>

          <StudentField
            label="Contact Email"
            type="email"
            value={
              student.contactEmail ||
              ""
            }
            onChange={(value) =>
              updateField(
                "contactEmail",
                value
              )
            }
          />

          <label className="admin-form-field">
            <span>
              Learning Mode
            </span>

            <select
              value={
                student.learningMode ||
                ""
              }
              onChange={(event) =>
                updateField(
                  "learningMode",
                  event.target.value
                )
              }
            >
              <option value="">
                Not selected
              </option>

              <option value="in-person">
                In Person
              </option>

              <option value="online">
                Online
              </option>

              <option value="both">
                Both
              </option>
            </select>
          </label>

          <label className="admin-form-field">
            <span>
              Status
            </span>

            <select
              value={
                student.accountStatus ||
                "active"
              }
              onChange={(event) =>
                updateField(
                  "accountStatus",
                  event.target.value
                )
              }
            >
              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </label>

          <div className="admin-student-modal-actions">
            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="button-spinner"
                  />

                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StudentField({
  label,
  value,
  onChange,
  type = "text",
}) {
  return (
    <label className="admin-form-field">
      <span>
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

function ProfileItem({
  label,
  value,
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value ??
          "Not available"}
      </strong>
    </div>
  );
}

function formatMode(mode) {
  if (
    mode === "in-person"
  ) {
    return "In Person";
  }

  if (
    mode === "online"
  ) {
    return "Online";
  }

  if (
    mode === "both"
  ) {
    return "Both";
  }

  return "Not selected";
}

function formatInterest(
  interest
) {
  return interest
    .split(" ")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}