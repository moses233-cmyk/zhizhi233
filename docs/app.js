document.addEventListener('DOMContentLoaded', () => {
  const galleryLinks = Array.from(document.querySelectorAll('.gallery-link'));
  const lightbox = document.querySelector('#lightbox');
  const lightboxImage = document.querySelector('#lightbox-image');
  const lightboxCaption = document.querySelector('#lightbox-caption');
  const lightboxDialog = lightbox?.querySelector('.lightbox__dialog');
  const prevButton = lightbox?.querySelector('.lightbox__nav--prev');
  const nextButton = lightbox?.querySelector('.lightbox__nav--next');
  const closeTriggers = lightbox ? Array.from(lightbox.querySelectorAll('[data-lightbox-close]')) : [];

  if (!galleryLinks.length || !lightbox || !lightboxImage || !lightboxCaption) {
    return;
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

  function showNext() {
    const nextIndex = (currentIndex + 1) % galleryItems.length;
    updateLightbox(nextIndex);
  }

  function showPrevious() {
    const prevIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    updateLightbox(prevIndex);
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
});
