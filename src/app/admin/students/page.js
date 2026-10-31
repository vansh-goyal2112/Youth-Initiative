"use client";
import Link from "next/link";

import {
  useEffect,
  useMemo,
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
  Trash2,
} from "lucide-react";

import {
  adminFetch,
} from "@/services/adminApi";

export default function AdminStudentsPage() {
  const [students, setStudents] =
    useState([]);

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
  const [canPurgeStudent, setCanPurgeStudent] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    firstName: "", lastName: "", email: "", dateOfBirth: "", parentEmail: "",
  });

  useEffect(() => {
    loadStudents();
    adminFetch("/api/admin/auth/verify", { method: "POST" })
      .then(response => response.ok ? response.json() : null)
      .then(data => setCanPurgeStudent(
        data?.admin?.adminRole === "super_admin" &&
        data?.admin?.permissions?.includes("students.delete")
      ))
      .catch(() => {});
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

  async function permanentlyDeleteStudent(student) {
    setMessage("");
    setErrorMessage("");
    try {
      const previewResponse = await adminFetch("/api/admin/students/permanent-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: student.id }),
      });
      const preview = await previewResponse.json();
      if (!previewResponse.ok) throw new Error(preview.message || "Deletion preview unavailable.");
      const related = Object.entries(preview.documents || {})
        .map(([name, count]) => name + ": " + count).join(", ");
      const confirmPhrase = "DELETE " + student.youthId;
      const entered = window.prompt(
        "PERMANENT DELETION: " + (student.fullName || student.youthId) +
        "\nRelated records: " + related +
        "\nFirebase login, profile and associated data will be deleted. External backups may remain." +
        "\n\nType exactly: " + confirmPhrase
      );
      if (entered !== confirmPhrase) return;
      setSaving(true);
      const response = await adminFetch("/api/admin/students/permanent-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: student.id, confirm: confirmPhrase }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Permanent deletion failed.");
      setMessage(result.message);
      await loadStudents();
    } catch (error) {
      setErrorMessage(error.message || "Permanent deletion failed.");
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
          <h2>Start a student's enrollment</h2>
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
                          {canPurgeStudent && (student.accountStatus === "inactive" || student.accountStatus === "deleting") && (
                            <button type="button" title="Permanently delete student" aria-label="Permanently delete student"
                              className="delete" disabled={saving}
                              onClick={() => permanentlyDeleteStudent(student)}>
                              <Trash2 size={17} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Deactivate student" aria-label="Deactivate student"
                            className="delete"
                            disabled={
                              student.accountStatus ===
                              "inactive"
                            }
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
          student={
            selectedStudent
          }
          onClose={() =>
            setSelectedStudent(
              null
            )
          }
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

          <ProfileItem
            label="XP"
            value={
              student.totalXp ||
              0
            }
          />

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
        {value ||
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