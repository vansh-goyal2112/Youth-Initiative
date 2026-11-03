import test from "node:test";
import assert from "node:assert/strict";
import {
  isStudentRoute,
  studentBackDestination,
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
  assert.deepEqual(studentBackDestination("/workshops/example-1"), { href: "/workshops", label: "Back to Workshops" });
  assert.deepEqual(studentBackDestination("/completed-workshops"), { href: "/registered-workshops", label: "Back to My Workshops" });
  assert.deepEqual(studentBackDestination("/edit-profile"), { href: "/profile", label: "Back to Profile" });
  assert.deepEqual(studentBackDestination("/scan-attendance"), { href: "/registered-workshops", label: "Back to My Workshops" });
  assert.equal(studentBackDestination("/admin/students"), null);
});
