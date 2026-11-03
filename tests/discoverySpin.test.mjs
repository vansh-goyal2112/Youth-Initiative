import test from "node:test";
import assert from "node:assert/strict";
import { chooseDiscovery, getDiscoverableWorkshops } from "../src/utils/discoverySpin.mjs";

const date = new Date(2026, 9, 16);
const workshop = (id, startDate, status = "active") => ({ id, title: id, startDate, status });

test("discovery only includes active, unregistered, not-past workshops", () => {
  const available = getDiscoverableWorkshops(
    [
      workshop("upcoming", "2026-10-17"),
      workshop("no-date", null),
      workshop("past", "2026-10-15"),
      workshop("inactive", "2026-10-17", "inactive"),
      workshop("registered", "2026-10-20"),
      workshop("", "2026-10-22"),
    ],
    [{ workshopId: "registered" }],
    date
  );
  assert.deepEqual(available.map(x => x.id), ["upcoming", "no-date"]);
});

test("spin never invents workshops or chooses an excluded candidate", () => {
  const options = [workshop("a", null), workshop("b", null), workshop("c", null)];
  assert.equal(chooseDiscovery([], null, () => .5), null);
  assert.equal(chooseDiscovery(options, "a", () => 0).id, "b");
  assert.equal(chooseDiscovery(options, "a", () => 1).id, "c");
  assert.equal(chooseDiscovery(options, "a", () => -1).id, "b");
  assert.equal(chooseDiscovery([options[0]], "a", () => .5).id, "a");
});
