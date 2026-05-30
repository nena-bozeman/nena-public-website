function initHeroCarousel() {
  const carousel = document.querySelector('[data-hero-carousel]');
  if (!carousel) {
    return;
  }

  const slideEls = [...carousel.querySelectorAll<HTMLElement>('[data-hero-slide]')];
  const dotEls = [...carousel.querySelectorAll<HTMLButtonElement>('[data-hero-dot]')];
  const prevBtn = carousel.querySelector<HTMLButtonElement>('[data-hero-prev]');
  const nextBtn = carousel.querySelector<HTMLButtonElement>('[data-hero-next]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intervalMs = 6000;

  let activeIndex = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function showSlide(index: number) {
    activeIndex = (index + slideEls.length) % slideEls.length;

    slideEls.forEach((slide, i) => {
      const isActive = i === activeIndex;
      slide.classList.toggle('opacity-100', isActive);
      slide.classList.toggle('z-10', isActive);
      slide.classList.toggle('opacity-0', !isActive);
      slide.classList.toggle('z-0', !isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    dotEls.forEach((dot, i) => {
      const isActive = i === activeIndex;
      dot.classList.toggle('bg-white', isActive);
      dot.classList.toggle('bg-white/30', !isActive);
      dot.setAttribute('aria-selected', String(isActive));
    });
  }

  function nextSlide() {
    showSlide(activeIndex + 1);
  }

  function prevSlide() {
    showSlide(activeIndex - 1);
  }

  function startAutoplay() {
    if (reducedMotion || slideEls.length <= 1) {
      return;
    }
    stopAutoplay();
    timer = setInterval(nextSlide, intervalMs);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  prevBtn?.addEventListener('click', () => {
    prevSlide();
    startAutoplay();
  });

  nextBtn?.addEventListener('click', () => {
    nextSlide();
    startAutoplay();
  });

  dotEls.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.getAttribute('data-hero-dot'));
      if (!Number.isNaN(index)) {
        showSlide(index);
        startAutoplay();
      }
    });
  });

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);

  carousel.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prevSlide();
      startAutoplay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextSlide();
      startAutoplay();
    }
  });

  startAutoplay();
}

initHeroCarousel();
