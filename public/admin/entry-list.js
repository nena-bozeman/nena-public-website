/**
 * Decap renders each entry label as a single text node. We format summaries in
 * config.yml as "Title  ·  date" and split here so the date can be right-aligned.
 */
(function () {
  const SEP = "  ·  ";

  function enhanceEntryRow(h2) {
    if (h2.querySelector("span.nena-decap-date")) return;
    const first = h2.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const raw = first.textContent;
    const pos = raw.lastIndexOf(SEP);
    if (pos === -1) return;
    const title = raw.slice(0, pos).trimEnd();
    const date = raw.slice(pos + SEP.length).trim();
    if (!title || !date) return;

    h2.removeChild(first);
    h2.appendChild(document.createTextNode(title));
    const span = document.createElement("span");
    span.className = "nena-decap-date";
    span.textContent = date;
    h2.appendChild(span);
  }

  function enhance() {
    document
      .querySelectorAll('a[href*="/collections/"][href*="/entries/"] h2')
      .forEach(enhanceEntryRow);
  }

  let t;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(enhance, 0);
  }

  enhance();
  const root = document.documentElement;
  const obs = new MutationObserver(schedule);
  obs.observe(root, { childList: true, subtree: true, characterData: true });
})();
