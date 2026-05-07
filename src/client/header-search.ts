function initHeaderSearch() {
  const root = document.getElementById('header-search');
  const form = document.getElementById('header-search-form');
  const button = document.getElementById('header-search-toggle');
  const input = document.getElementById('header-search-q');
  if (!root || !form || !button || !input) {
    return;
  }
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
    return;
  }
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const elRoot = root;
  const elForm = form;
  const elButton = button;
  const elInput = input;

  const openClass = 'header-search--open';
  const action = elForm.getAttribute('action') || '';

  function isOpen() {
    return elRoot.classList.contains(openClass);
  }

  function setOpen(open: boolean) {
    elRoot.classList.toggle(openClass, open);
    elButton.setAttribute('aria-expanded', String(open));
    if (open) {
      window.setTimeout(() => {
        elInput.focus();
      }, 0);
    } else {
      elInput.blur();
    }
  }

  function goToSearchQuery(q: string) {
    if (!action) {
      return;
    }
    const u = new URL(action, window.location.origin);
    const trimmed = String(q).trim();
    if (trimmed) {
      u.searchParams.set('q', trimmed);
      window.location.assign(u.pathname + u.search);
    } else {
      window.location.assign(u.pathname);
    }
  }

  elButton.addEventListener('click', () => {
    setOpen(!isOpen());
  });

  elForm.addEventListener('submit', (e) => {
    e.preventDefault();
    goToSearchQuery(elInput.value);
  });

  elInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      elButton.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!isOpen()) {
      return;
    }
    const t = e.target;
    if (t instanceof Node && !elRoot.contains(t)) {
      setOpen(false);
    }
  });
}

initHeaderSearch();
