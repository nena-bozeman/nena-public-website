const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.offsetParent !== null,
  );
}

function initMobileNav() {
  const menuButton = document.getElementById('mobile-menu-btn');
  const closeButton = document.getElementById('close-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!menuButton || !closeButton || !menu) {
    return;
  }
  if (!(menuButton instanceof HTMLButtonElement) || !(closeButton instanceof HTMLButtonElement)) {
    return;
  }

  const elMenu = menu;
  const elMenuButton = menuButton;
  const elCloseButton = closeButton;
  const sections = Array.from(elMenu.querySelectorAll<HTMLElement>('[data-mobile-nav-section]'));
  let lastFocusedElement: HTMLElement | null = null;

  function setMenuOpen(open: boolean) {
    elMenu.toggleAttribute('hidden', !open);
    elMenuButton.setAttribute('aria-expanded', String(open));

    if (open) {
      lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      document.body.classList.add('overflow-hidden');
      window.setTimeout(() => {
        elCloseButton.focus();
      }, 0);
      return;
    }

    document.body.classList.remove('overflow-hidden');
    lastFocusedElement?.focus();
    lastFocusedElement = null;
  }

  function setSectionOpen(section: HTMLElement, open: boolean) {
    const trigger = section.querySelector<HTMLButtonElement>('[data-mobile-nav-trigger]');
    const panel = section.querySelector<HTMLElement>('[data-mobile-nav-panel]');
    if (!trigger || !panel) {
      return;
    }

    section.classList.toggle('mobile-nav-section--open', open);
    trigger.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('hidden', !open);
  }

  elMenuButton.addEventListener('click', () => {
    const opening = elMenu.hasAttribute('hidden');
    setMenuOpen(opening);
    if (opening) {
      const activeSection = sections.find((section) =>
        section.querySelector('[aria-current="page"]'),
      );
      if (activeSection) {
        for (const section of sections) {
          setSectionOpen(section, section === activeSection);
        }
      }
    }
  });

  elCloseButton.addEventListener('click', () => {
    setMenuOpen(false);
  });

  elMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableElements(elMenu);
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  for (const section of sections) {
    const trigger = section.querySelector<HTMLButtonElement>('[data-mobile-nav-trigger]');
    if (!trigger) {
      continue;
    }

    trigger.addEventListener('click', () => {
      const isOpen = section.classList.contains('mobile-nav-section--open');
      for (const otherSection of sections) {
        if (otherSection !== section) {
          setSectionOpen(otherSection, false);
        }
      }
      setSectionOpen(section, !isOpen);
    });
  }

  for (const link of elMenu.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    link.addEventListener('click', () => {
      setMenuOpen(false);
    });
  }
}

initMobileNav();
