/**
 * Decap renders each entry label as a single text node. We format summaries in
 * config.yml as "Title  ·  date" and split here so the date can be right-aligned.
 */
(function () {
  const SEP = "  ·  ";
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  /** Format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss without UTC timezone shift. */
  function formatDisplayDate(value) {
    const match = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/,
    );
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return value;
    const datePart = `${MONTHS[month - 1]} ${day}, ${year}`;
    if (match[4] == null) return datePart;
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${datePart} ${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
  }

  function enhanceEntryRow(h2) {
    if (h2.querySelector("span.nena-decap-date")) return;
    const first = h2.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const raw = first.textContent;
    const pos = raw.lastIndexOf(SEP);
    if (pos === -1) return;
    const title = raw.slice(0, pos).trimEnd();
    const date = raw.slice(pos + SEP.length).trim();
    if (!title || !date || date === "Invalid date" || date === "Invalid Date") return;

    h2.removeChild(first);
    h2.appendChild(document.createTextNode(title));
    const span = document.createElement("span");
    span.className = "nena-decap-date";
    span.textContent = formatDisplayDate(date);
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
