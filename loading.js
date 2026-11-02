// ============================================================
// Zanos City — the loading screen's watchdog
// Shared by the app and the guest page. When the database is asleep (a free
// project pauses after a few idle days) its requests simply never answer, and
// the page sat on "Loading…" forever with nothing to tell the reader why. After
// a few seconds the loading screen says the server is not answering and offers
// a retry instead.
// ============================================================

const LOADING_PATIENCE_MS = 12000;
let loadingWatchdog = null;

// Call whenever the visible section changes: arms the watchdog when the
// loading section is the one now shown, and disarms it otherwise.
function watchLoading(section) {
  clearTimeout(loadingWatchdog);
  loadingWatchdog = null;
  if (!section) return;
  const slow = section.querySelector('.loading-slow');
  if (!slow) return;
  slow.hidden = true;
  if (section.hidden) return;
  loadingWatchdog = setTimeout(() => { slow.hidden = false; }, LOADING_PATIENCE_MS);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) window.location.reload();
});
