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

const nightSkyState = {
  container: null,
  renderer: null,
  scene: null,
  camera: null,
  material: null,
  geometry: null,
  mesh: null,
  animationId: null,
  resizeHandler: null,
};

function createNightSkyBackground() {
  if (!window.THREE || nightSkyState.renderer) {
    return;
  }

  const container = document.createElement('div');
  container.className = 'night-sky-background';
  container.setAttribute('aria-hidden', 'true');
  document.body.prepend(container);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float iTime;
      uniform vec2 iResolution;

      #define NUM_OCTAVES 3

      float rand(vec2 n) {
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 ip = floor(p);
        vec2 u = fract(p);
        u = u*u*(3.0-2.0*u);

        float res = mix(
          mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
          mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
        return res * res;
      }

      float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.3;
        vec2 shift = vec2(100);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < NUM_OCTAVES; ++i) {
          v += a * noise(x);
          x = rot * x * 2.0 + shift;
          a *= 0.4;
        }
        return v;
      }

      void main() {
        vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
        vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
        vec2 v;
        vec4 o = vec4(0.0);

        float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

        for (float i = 0.0; i < 35.0; i++) {
          v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
          float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));
          vec4 auroraColors = vec4(
            0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
            0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
            0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3),
            1.0
          );
          vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
          float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
          o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
        }

        o = tanh(pow(o / 100.0, vec4(1.6)));
        gl_FragColor = o * 1.5;
      }
    `,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const clock = new THREE.Clock();

  const animate = () => {
    nightSkyState.animationId = requestAnimationFrame(animate);
    material.uniforms.iTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  };

  animate();

  const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', handleResize);

  Object.assign(nightSkyState, {
    container,
    renderer,
    scene,
    camera,
    material,
    geometry,
    mesh,
    resizeHandler: handleResize,
  });

  requestAnimationFrame(() => container.classList.add('is-active'));
}

function destroyNightSkyBackground() {
  if (!nightSkyState.renderer) {
    return;
  }

  cancelAnimationFrame(nightSkyState.animationId);

  if (nightSkyState.resizeHandler) {
    window.removeEventListener('resize', nightSkyState.resizeHandler);
  }

  if (nightSkyState.scene && nightSkyState.mesh) {
    nightSkyState.scene.remove(nightSkyState.mesh);
  }

  if (nightSkyState.geometry) {
    nightSkyState.geometry.dispose();
  }

  if (nightSkyState.material) {
    nightSkyState.material.dispose();
  }

  if (nightSkyState.renderer) {
    nightSkyState.renderer.dispose();
  }

  const { container } = nightSkyState;
  if (container) {
    container.classList.remove('is-active');
    setTimeout(() => {
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    }, 300);
  }

  for (const key of Object.keys(nightSkyState)) {
    nightSkyState[key] = null;
  }
}

function updateNightSky(theme) {
  if (theme === 'dark') {
    createNightSkyBackground();
  } else {
    destroyNightSkyBackground();
  }
}

function applyTheme(theme) {
  state.theme = theme;
  root.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  localStorage.setItem('theme', theme);
  updateNightSky(theme);
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
  if (!contactForm || !formStatus) {
    return;
  }
  const formData = new FormData(contactForm);
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
  filterProjects('all');
  if (contactForm) {
    contactForm.addEventListener('submit', handleFormSubmit);
  }
  initSmoothScroll();
  initIntersectionHighlights();
  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
