const state = {
  theme: localStorage.getItem('theme') || 'light',
};

const root = document.body;
const themeToggle = document.querySelector('#theme-toggle');
const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
const projectCards = Array.from(document.querySelectorAll('.project-card'));
const contactForm = document.querySelector('#contact-form');
const currentYear = document.querySelector('#current-year');
const testimonialCard = document.querySelector('[data-component="animated-testimonials"]');

function applyTheme(theme) {
  state.theme = theme;
  root.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

function filterProjects(category) {
  projectCards.forEach((card) => {
    const matches = category === 'all' || card.dataset.category === category;
    card.hidden = !matches;
    card.setAttribute('aria-hidden', String(!matches));
  });
}

  const galleryItems = galleryLinks.map((link, index) => {
    const image = link.querySelector('img');
    const full = link.dataset.full || link.getAttribute('href');
    const caption =
      link.dataset.caption ||
      image?.getAttribute('alt') ||
      link.nextElementSibling?.textContent?.trim() ||
      '';

    link.setAttribute('role', 'button');
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', 'lightbox');
    link.setAttribute('data-gallery-index', String(index));

    return { link, full, caption, alt: image?.getAttribute('alt') || caption };
  });

  let currentIndex = 0;
  let activeTrigger = null;
  let touchStartX = null;

  function updateLightbox(index) {
    const item = galleryItems[index];
    if (!item) return;

    currentIndex = index;
    lightboxImage.src = item.full;
    lightboxImage.alt = item.alt || item.caption;
    lightboxCaption.textContent = item.caption;
  }

  function openLightbox(index, trigger) {
    updateLightbox(index);
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    activeTrigger = trigger ?? galleryItems[index]?.link ?? null;
    lightboxDialog?.focus({ preventScroll: true });
  }

  function closeLightbox() {
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImage.src = '';
    activeTrigger?.focus({ preventScroll: true });
    activeTrigger = null;
  }

  return errors;


function handleFormSubmit(event) {
  event.preventDefault();
  const targetForm = event.currentTarget;
  const status = targetForm.querySelector('.form-status');
  const formData = new FormData(targetForm);
  const errors = validateForm(formData);

  if (errors.length > 0) {
    if (status) {
      status.textContent = errors.join(' ');
      status.dataset.state = 'error';
    }
    return;
  }

  if (status) {
    status.textContent = '表单已提交，我们会尽快回复您！';
    status.dataset.state = 'success';
  }
  targetForm.reset();
}

  galleryItems.forEach((item, index) => {
    item.link.addEventListener('click', (event) => {
      event.preventDefault();
      openLightbox(index, item.link);
    });

    item.link.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(index, item.link);
      }
    });
  });

  closeTriggers.forEach((trigger) => {
    trigger.addEventListener('click', closeLightbox);
  });

  prevButton?.addEventListener('click', showPrevious);
  nextButton?.addEventListener('click', showNext);

  document.addEventListener('keydown', (event) => {
    if (lightbox.getAttribute('aria-hidden') === 'true') {
      return;
    }

    if (event.key === 'Escape') {
      closeLightbox();
    } else if (event.key === 'ArrowRight') {
      showNext();
    } else if (event.key === 'ArrowLeft') {
      showPrevious();
    }
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  lightbox.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
      touchStartX = event.touches[0].clientX;
    }
  });

  lightbox.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        showPrevious();
      } else {
        showNext();
      }
    }
    touchStartX = null;
  });


function initAnimatedTestimonials() {
  if (!testimonialCard) return;

  const images = Array.from(testimonialCard.querySelectorAll('.profile-card__image'));
  const entries = Array.from(testimonialCard.querySelectorAll('.profile-card__entry'));
  const buttons = Array.from(testimonialCard.querySelectorAll('.profile-card__button'));
  const autoplay = testimonialCard.dataset.autoplay === 'true';

  if (entries.length === 0 || images.length === 0) return;

  let activeIndex = 0;
  let autoplayTimer;

  const setActive = (index) => {
    activeIndex = (index + entries.length) % entries.length;

    images.forEach((image) => {
      const isActive = Number(image.dataset.index) === activeIndex;
      image.classList.toggle('is-active', isActive);
    });

    entries.forEach((entry) => {
      const isActive = Number(entry.dataset.index) === activeIndex;
      entry.classList.toggle('is-active', isActive);
    });
  };

  const handleNext = () => setActive(activeIndex + 1);
  const handlePrev = () => setActive(activeIndex - 1);

  const stopAutoplay = () => {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = undefined;
    }
  };

  const startAutoplay = () => {
    if (!autoplay) return;
    stopAutoplay();
    autoplayTimer = setInterval(handleNext, 5000);
  };

  const restartAutoplay = () => {
    stopAutoplay();
    startAutoplay();
  };

  buttons.forEach((button) => {
    const action = button.dataset.action;
    if (action === 'next') {
      button.addEventListener('click', () => {
        handleNext();
        restartAutoplay();
      });
    } else if (action === 'prev') {
      button.addEventListener('click', () => {
        handlePrev();
        restartAutoplay();
      });
    }
  });

  testimonialCard.addEventListener('mouseenter', stopAutoplay);
  testimonialCard.addEventListener('mouseleave', startAutoplay);

  setActive(0);
  startAutoplay();
}

function init() {
  applyTheme(state.theme);
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  filterButtons.forEach((button) => button.addEventListener('click', handleFilterClick));
  if (projectCards.length > 0) {
    filterProjects('all');
  }
  if (contactForm) {
    contactForm.addEventListener('submit', handleFormSubmit);
  }
  initSmoothScroll();
  initIntersectionHighlights();
  initAnimatedTestimonials();
  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
