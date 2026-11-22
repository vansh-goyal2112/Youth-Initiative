import test from "node:test";
import assert from "node:assert/strict";
import {
  isStudentRoute,
  studentBackDestination,
  studentActiveTab,
} from "../src/utils/studentRouteConfig.mjs";

test("shared chrome covers learning routes but not admin or onboarding", () => {
  const studentRoutes = [
    "/dashboard",
    "/workshops",
    "/workshops/example-1",
    "/journey",
    "/badges",
    "/profile",
    "/edit-profile",
    "/registered-workshops",
    "/completed-workshops",
    "/scan-attendance",
    "/reward",
    "/registration-success/workshop-3",
  ];
  for (const path of studentRoutes) {
    assert.equal(isStudentRoute(path), true, path);
  }
  for (const path of ["/", "/login", "/register", "/admin", "/admin/students", "/consent-pending", "/reset-request-sent", "/email-verification-pending"]) {
    assert.equal(isStudentRoute(path), false, path);
  }
  assert.equal(isStudentRoute(null), false);
});

test("back links always have a predictable destination", () => {
  assert.equal(studentBackDestination("/dashboard"), null);
  assert.deepEqual(studentBackDestination("/journey"), { href: "/dashboard", label: "Back to Home" });
  assert.deepEqual(studentBackDestination("/badges"), { href: "/dashboard", label: "Back to Home" });
  assert.deepEqual(studentBackDestination("/workshops/example-1"), { href: "/workshops", label: "Back to Experiences" });
  assert.deepEqual(studentBackDestination("/completed-workshops"), { href: "/profile", label: "Back to Profile" });
  assert.deepEqual(studentBackDestination("/edit-profile"), { href: "/profile", label: "Back to Profile" });
  assert.deepEqual(studentBackDestination("/scan-attendance"), { href: "/registered-workshops", label: "Back to My Experiences" });
  assert.equal(studentBackDestination("/admin/students"), null);
});

test("contextual Back follows the actual student origin and tabs highlight profile children", () => {
  assert.deepEqual(studentBackDestination("/scan-attendance", "/dashboard"), { href:"/dashboard", label:"Back to Home" });
  assert.deepEqual(studentBackDestination("/scan-attendance", "/registered-workshops"), { href:"/registered-workshops", label:"Back to My Experiences" });
  assert.deepEqual(studentBackDestination("/edit-profile", "/profile"), { href:"/profile", label:"Back to Profile" });
  assert.equal(studentActiveTab("/edit-profile"), "/profile");
  assert.equal(isStudentRoute("/tasks"), false);
  assert.equal(studentActiveTab("/completed-workshops"), "/profile");
  assert.equal(studentActiveTab("/scan-attendance", "/dashboard"), "/dashboard");
  assert.equal(studentActiveTab("/scan-attendance", "/registered-workshops"), "/profile");
});
