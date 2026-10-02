// ============================================================
// Zanos City — where the property is
// Shared by the guest page and the tenant's Information tab, which is why it
// lives apart from both. Needs i18n.js (t, currentLang) loaded first.
// ============================================================

// The address is stored once per language. A reader gets their own, and falls
// back to the other rather than to nothing when only one has been filled in.
function addressForLang(greek, english) {
  const primary = currentLang === 'en' ? english : greek;
  return (primary || english || greek || '').trim();
}

// An owner-pinned point (coordinates, or a place name) beats searching the
// address, since address text alone can land on the wrong building. Failing that
// the English address is searched, being the one a real phone has been seen to
// resolve to the right building.
function mapQuery(greek, english, point) {
  const pinned = (point || '').trim();
  if (pinned) return pinned;
  return (english || greek || '').trim();
}

function mapsOpenUrl(query) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

// The embed is always requested in English. The same English query found the
// building under hl=en and returned an empty world map under hl=el, so the
// Greek locale is the thing that breaks it, not the address text. The button
// below it opens the phone's own maps app, which speaks the reader's language.
function mapsEmbedUrl(query) {
  return 'https://maps.google.com/maps?q=' + encodeURIComponent(query)
    + '&z=17&output=embed&hl=en';
}

function locationEscape(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

// Fills a container with the address, an embedded map and a link that opens the
// phone's own maps app — the thing a person standing outside actually wants.
// Leaves it empty when there is no address, rather than a map of nowhere.
function renderLocation(container, greek, english, point) {
  if (!container) return;
  const shown = addressForLang(greek, english);
  // A pinned point is enough to show a map even with no address written.
  if (!shown && !(point || '').trim()) { container.innerHTML = ''; container.hidden = true; return; }

  const query = mapQuery(greek, english, point);
  container.hidden = false;
  container.innerHTML = `
    <h2>${locationEscape(t('loc.title'))}</h2>
    ${shown ? `<p class="loc-address">${locationEscape(shown)}</p>` : ''}
    <div class="map-frame">
      <iframe src="${locationEscape(mapsEmbedUrl(query))}" title="${locationEscape(t('loc.mapTitle'))}"
        loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>
    </div>
    <a class="btn-small map-open" href="${locationEscape(mapsOpenUrl(query))}"
       target="_blank" rel="noopener noreferrer">${locationEscape(t('loc.open'))}</a>`;
}
