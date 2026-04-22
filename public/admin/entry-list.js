/**
 * Decap renders each entry label as a single text node. We format summaries in
 * config.yml as "Title  ·  date" and split here so the date can use muted styling.
 */
(function () {
  const SEP = "  ·  ";
  const DATE_OR_YEAR = /^(\d{4}-\d{2}-\d{2}|\d{1,4})$/;

  function enhanceEntryRow(h2) {
    if (h2.querySelector("span.nena-decap-date")) return;
    const first = h2.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const raw = first.textContent;
    const pos = raw.lastIndexOf(SEP);
    if (pos === -1) return;
    const title = raw.slice(0, pos);
    const rest = raw.slice(pos + SEP.length).trim();
    if (!DATE_OR_YEAR.test(rest)) return;

    h2.removeChild(first);
    const titleNode = document.createTextNode(title);
    const span = document.createElement("span");
    span.className = "nena-decap-date";
    span.textContent = SEP + rest;
    const before = h2.firstChild;
    h2.insertBefore(titleNode, before);
    h2.insertBefore(span, before);
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
