const eventName = "student-journey-progress";

export function notifyJourneyProgress() {
  window.dispatchEvent(new Event(eventName));
  try {
    window.localStorage.setItem(eventName, String(Date.now()));
  } catch {
    // Focus and periodic refresh also work when storage is unavailable.
  }
}

export function watchJourneyProgress(refresh, page = window, doc = document) {
  let running = false;
  let queued = false;
  let stopped = false;
  async function update() {
    if (stopped || doc.visibilityState !== "visible") return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      await refresh();
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void update();
      }
    }
  }
  function storage(event) {
    if (event.key === eventName) void update();
  }
  page.addEventListener(eventName, update);
  page.addEventListener("storage", storage);
  page.addEventListener("focus", update);
  doc.addEventListener("visibilitychange", update);
  const timer = page.setInterval(update, 30000);
  return () => {
    stopped = true;
    page.clearInterval(timer);
    page.removeEventListener(eventName, update);
    page.removeEventListener("storage", storage);
    page.removeEventListener("focus", update);
    doc.removeEventListener("visibilitychange", update);
  };
}
