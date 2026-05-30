function initNavDropdowns() {
  const dropdowns = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-dropdown]'));
  if (dropdowns.length === 0) {
    return;
  }

  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function clearCloseTimer() {
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }

  function setOpen(dropdown: HTMLElement, open: boolean) {
    const trigger = dropdown.querySelector<HTMLButtonElement>('[data-nav-dropdown-trigger]');
    const panel = dropdown.querySelector<HTMLElement>('[data-nav-dropdown-panel]');
    if (!trigger || !panel) {
      return;
    }

    dropdown.classList.toggle('nav-dropdown--open', open);
    trigger.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('hidden', !open);
  }

  function closeAll(except?: HTMLElement) {
    for (const dropdown of dropdowns) {
      if (dropdown !== except) {
        setOpen(dropdown, false);
      }
    }
  }

  for (const dropdown of dropdowns) {
    const trigger = dropdown.querySelector<HTMLButtonElement>('[data-nav-dropdown-trigger]');
    const panel = dropdown.querySelector<HTMLElement>('[data-nav-dropdown-panel]');
    if (!trigger || !panel) {
      continue;
    }

    trigger.addEventListener('click', () => {
      const isOpen = dropdown.classList.contains('nav-dropdown--open');
      closeAll();
      setOpen(dropdown, !isOpen);
    });

    dropdown.addEventListener('mouseenter', () => {
      clearCloseTimer();
      closeAll(dropdown);
      setOpen(dropdown, true);
    });

    dropdown.addEventListener('mouseleave', () => {
      clearCloseTimer();
      closeTimer = setTimeout(() => {
        setOpen(dropdown, false);
      }, 120);
    });

    dropdown.addEventListener('focusin', () => {
      clearCloseTimer();
      closeAll(dropdown);
      setOpen(dropdown, true);
    });

    dropdown.addEventListener('focusout', (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && dropdown.contains(next)) {
        return;
      }
      clearCloseTimer();
      closeTimer = setTimeout(() => {
        setOpen(dropdown, false);
      }, 0);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAll();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    const insideDropdown = dropdowns.some((dropdown) => dropdown.contains(target));
    if (!insideDropdown) {
      closeAll();
    }
  });
}

initNavDropdowns();
