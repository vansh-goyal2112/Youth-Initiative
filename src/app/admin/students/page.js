"use client";
import Link from "next/link";
import XpRedemptionPanel from "@/components/admin/XpRedemptionPanel";
import { schoolGradeNumber } from "@/utils/workshopGrades.mjs";

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
  Plus,
} from "lucide-react";

import {
  adminFetch,
} from "@/services/adminApi";

const gradeOptions = ["K", ...Array.from({ length: 12 }, (_, index) => String(index + 1))];
const consentLabels = {
  approved: "Approved",
  pending: "Awaiting consent",
  denied: "Declined",
  rejected: "Declined",
  not_required: "Not required",
};

function formatGrade(grade) {
  const value = schoolGradeNumber(grade);
  return value === 0 ? "Kindergarten" : value === null ? null : "Grade " + value;
}

function DuplicateFlag({ matches }) {
  if (!matches?.length) return null;
  return <span className="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
    Possible duplicate · Matching {matches.join(" and ")}
  </span>;
}

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
    const { schoolGrade, ...profile } = editingStudent;
    const originalGrade = students.find(student => student.id === profile.id)?.schoolGrade;
    const changes = schoolGrade && schoolGrade !== originalGrade
      ? { ...profile, schoolGrade }
      : profile;

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
                changes
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
      <div id="pending-registrations" className="scroll-mt-24">
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
                      <td><div>{item.fullName}</div><DuplicateFlag matches={item.duplicateMatches} /></td>
                      <td>{item.email}</td>
                      <td>{(item.status || "pending").replaceAll("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
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
                        <DuplicateFlag matches={student.duplicateMatches} />
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
          key={selectedStudent.id}
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
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    const request = new AbortController();
    adminFetch("/api/admin/students?studentId=" + encodeURIComponent(student.id), { signal: request.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load student profile details.");
        if (!request.signal.aborted) setProfile(data);
      })
      .catch(error => { if (!request.signal.aborted) setProfileError(error.message); });
    return () => request.abort();
  }, [student.id]);

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

          <ProfileItem label="School grade" value={formatGrade(student.schoolGrade)} />
          <ProfileItem label="Parent or guardian email" value={profile?.parentEmail} />
          <ProfileItem label="Consent status" value={
            profile?.consentStatus ? consentLabels[profile.consentStatus] || profile.consentStatus.replaceAll("_", " ") : null
          } />

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
            label="Completed Experiences"
            value={
              student.completedWorkshopCount ||
              0
            }
          />
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="student-workshop-history">
          <h3 id="student-workshop-history" className="text-base font-extrabold">Experience history</h3>
          {profileError ? <p role="alert" className="mt-2 text-sm text-red-700">{profileError}</p> :
            !profile ? <p role="status" className="mt-2 text-sm text-slate-600">Loading consent details and experience history…</p> :
            profile.history.length === 0 ? <p className="mt-2 text-sm text-slate-600">No experience records yet.</p> :
            <div className="admin-table-scroll">
              <table className="admin-student-table">
                <thead><tr><th>Experience</th><th>Date</th><th>Status</th><th>XP award</th></tr></thead>
                <tbody>{profile.history.map(item => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.date ? item.date.slice(0, 10) : "—"}</td>
                    <td>
                      {item.status ? item.status.replaceAll("_", " ") : "Unknown"}
                      {item.status === "completed" && (item.completionSource === "self_reported" || item.attendanceStatus === "self_reported") && " · Self-reported"}
                      {item.status === "completed" && item.attendanceStatus === "verified" && " · Verified"}
                    </td>
                    <td>{formatWorkshopAward(item)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
        </section>

        <XpRedemptionPanel student={student} onRedeemed={onRedeemed} />
        <XpAdjustmentPanel student={student} onAdjusted={onRedeemed} />
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

function formatWorkshopAward(item) {
  if (item.status === "reversed" || item.xpStatus === "reversed") return "Reversed";
  if (item.xpAwarded !== null) return item.xpAwarded.toLocaleString() + " XP awarded";
  if (item.xpStatus === "processing" || item.xpStatus === "reversing") return "Needs review";
  return item.status === "completed" ? "Award not confirmed" : "—";
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

function XpAdjustmentPanel({ student, onAdjusted }) {
  const [allowed, setAllowed] = useState(false);
  const [action, setAction] = useState("remove");
  const grant = action === "grant";
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const operationRef = useRef(null);
  const inFlight = useRef(false);
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
    if (inFlight.current) return;
    const points=Number(amount);
    if (!Number.isSafeInteger(points)||points<=0||points>1000000||(!grant&&points>(student.totalXp||0))||reason.trim().length<5){
      setError(grant ? "Enter a positive whole-number XP amount and a reason of at least five characters." : "Enter an amount within Lifetime XP and a reason of at least five characters.");return;
    }
    inFlight.current = true;
    setSaving(true);setNotice("");setError("");
    if (!operationRef.current) operationRef.current=crypto.randomUUID();
    try{
      const response=await adminFetch("/api/admin/xp-adjust",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:student.id,action,amount:points,reason,operationId:operationRef.current})});
      const result=await response.json();
      if (!response.ok||!result.success) throw new Error(result.message||"XP adjustment failed.");
      operationRef.current=null;
      onAdjusted?.({totalXp:result.totalXp,currentXp:result.currentXp,xpCorrectionDebt:result.xpCorrectionDebt,level:result.level});
      setNotice(result.message);setAmount("");setReason("");
    }catch(cause){setError(cause.message||"XP adjustment could not be confirmed. Check the ledger before retrying.");}
    finally{inFlight.current = false;setSaving(false);}
  }
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Adjust student XP">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-800"><ShieldCheck size={18}/> Adjust student XP</h3>
      <p className="mb-3 text-xs text-slate-600">{grant ? "Add earned XP when staff have verified the reason. Outstanding corrections are applied before spendable XP increases." : "Remove incorrectly earned XP. If spendable XP is too low, the outstanding correction offsets future earnings."}</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="grid gap-1 text-xs font-bold text-slate-700">Action
          <select disabled={saving} value={action} onChange={event => {
            setAction(event.target.value);
            setAmount("");
            setReason("");
            setNotice("");
            setError("");
            operationRef.current = null;
          }} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm">
            <option value="grant">Grant XP</option>
            <option value="remove">Correct erroneous XP</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          {grant ? "XP to grant" : `XP to remove (maximum ${student.totalXp || 0})`}
          <input required type="number" disabled={saving} min="1" max={grant ? 1000000 : Math.min(student.totalXp || 0, 1000000)} step="1" value={amount} onChange={event=>{setAmount(event.target.value);operationRef.current=null;}} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Reason (required)
          <input required disabled={saving} minLength={5} maxLength={250} value={reason} onChange={event=>{setReason(event.target.value);operationRef.current=null;}} className="min-h-10 rounded-xl border border-slate-300 bg-white p-2 text-sm" placeholder={grant ? "Verified attendance at Robotics Experience" : "Incorrect attendance XP award"}/>
        </label>
        <button disabled={saving||!amount||reason.trim().length<5} type="submit" className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-50 disabled:opacity-50">{saving ? "Saving XP adjustment…" : grant ? "Grant XP" : "Remove erroneous XP"}</button>
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
            <span>School grade</span>
            <select value={schoolGradeNumber(student.schoolGrade) === null ? "" : student.schoolGrade}
              onChange={event => updateField("schoolGrade", event.target.value)}>
              <option value="" disabled>Choose a grade</option>
              {gradeOptions.map(grade => <option value={grade} key={grade}>{formatGrade(grade)}</option>)}
            </select>
          </label>

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