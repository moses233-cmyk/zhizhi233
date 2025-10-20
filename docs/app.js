const state = {
  theme: localStorage.getItem('theme') || 'light',
  language: localStorage.getItem('language') || 'zh',
};

const html = document.documentElement;
const root = document.body;
const themeToggle = document.querySelector('#theme-toggle');
const languageToggle = document.querySelector('#language-toggle');
const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
const projectCards = Array.from(document.querySelectorAll('.project-card'));
const contactForm = document.querySelector('#contact-form');
const formStatus = contactForm ? contactForm.querySelector('[data-form-status]') : null;
const currentYear = document.querySelector('#current-year');
const testimonialCard = document.querySelector('[data-component="animated-testimonials"]');
const galleryLinks = Array.from(document.querySelectorAll('.gallery-link'));
const lightbox = document.querySelector('.lightbox');
const lightboxDialog = lightbox ? lightbox.querySelector('.lightbox__dialog') : null;
const lightboxImage = lightbox ? lightbox.querySelector('#lightbox-image') : null;
const lightboxCaption = lightbox ? lightbox.querySelector('#lightbox-caption') : null;
const closeTriggers = lightbox
  ? Array.from(lightbox.querySelectorAll('[data-lightbox-close]'))
  : [];
const prevButton = lightbox ? lightbox.querySelector('.lightbox__nav--prev') : null;
const nextButton = lightbox ? lightbox.querySelector('.lightbox__nav--next') : null;


const translations = {
  zh: {
    'theme.text.day': '\u65E5\u95F4\u6A21\u5F0F',
    'form.success': '\u8868\u5355\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u56DE\u590D\u60A8\uFF01',
  },
  en: {
    'meta.title': 'Wang Mingdi - Film & Visual Works',
    'meta.description':
      'The portfolio of filmmaker Wang Mingdi, capturing visual stories for spaces, people, and brands.',
    'nav.brand': 'Wang Mingdi',
    'nav.profile': 'Profile',
    'nav.gallery': 'Photography',
    'nav.video': 'Video',
    'nav.contact': 'Contact',
    'language.toggleAria': 'Switch to Chinese',
    'language.toggleLabel': '\u4E2D\u6587',
    'theme.toggleAria': 'Toggle night mode',
    'theme.toggleLabelLight': 'Switch to night mode',
    'theme.toggleLabelDark': 'Switch to daylight mode',
    'theme.text.night': 'Night Mode',
    'theme.text.day': 'Day Mode',
    'hero.ariaLabel': 'Profile card and client testimonials',
    'hero.media1.alt': 'Portfolio portraits created by Wang Mingdi',
    'hero.media2.alt': 'Wang Mingdi lighting a studio scene',
    'hero.media3.alt': 'Wang Mingdi filming on location',
    'hero.entry1.greeting': 'Hi, I am',
    'hero.entry1.title': 'Wang Mingdi - Photographer / Editor',
    'hero.entry1.subtitle': 'Focused on spatial, architectural, and portrait storytelling for brands.',
    'hero.entry1.quote':
      'Mingdi brings our space to life; from shoot to final cut the images feel premium.',
    'hero.entry1.meta': 'Suzhou NanoTech - Brand Marketing',
    'hero.entry2.greeting': 'Hi, I am',
    'hero.entry2.title': 'Wang Mingdi - Photographer / Editor',
    'hero.entry2.subtitle':
      'Blending an art design background with commercial needs to deliver practical visuals.',
    'hero.entry2.quote':
      'He tackles complex shoots on tight schedules while keeping a consistent visual voice.',
    'hero.entry2.meta': 'Linyi Architectural Design Institute - Project Team',
    'hero.entry3.greeting': 'Hi, I am',
    'hero.entry3.title': 'Wang Mingdi - Photographer / Editor',
    'hero.entry3.subtitle':
      'Licensed drone pilot offering immersive views of cities and natural landscapes.',
    'hero.entry3.quote':
      'Working with Mingdi is smooth; his planning keeps every production efficient.',
    'hero.entry3.meta': 'Humanoid Robotics Program - Lead',
    'hero.actions.prev': 'View previous testimonial',
    'hero.actions.next': 'View next testimonial',
    'hero.actions.primary': 'View Work',
    'hero.actions.secondary': 'Contact Me',
    'profile.title': 'Profile Card',
    'profile.lead': 'Get a quick look at my style, focus areas, and collaboration details.',
    'profile.cta': 'Start a Project',
    'profile.avatar.alt': 'Portrait of Wang Mingdi',
    'profile.name': 'Wang Mingdi',
    'profile.bio':
      'Visual creator with an art design background. Projects cover architecture, manufacturing, brand storytelling, and character documentaries. Licensed CAAC drone pilot delivering end-to-end production.',
    'profile.tags.space': 'Spatial Narrative',
    'profile.tags.industry': 'Industrial Visuals',
    'profile.tags.aerial': 'Aerial',
    'profile.tags.brand': 'Brand Imagery',
    'profile.location.label': 'Based In',
    'profile.location.value': 'Suzhou, China',
    'profile.email.label': 'Email',
    'profile.services.label': 'Services',
    'profile.services.value': 'Promo films, spatial photography, brand shorts, post production',
    'profile.current.label': 'Currently Working On',
    'profile.current.value': 'Smart manufacturing documentary - Architectural visual archive',
    'gallery.title': 'Photography Portfolio',
    'gallery.lead': 'Selected spatial and portrait projects that highlight mood and detail.',
    'gallery.cta': 'Continue to Video',
    'gallery.item1.caption': 'Quiet Sense - Museum visual campaign',
    'gallery.item1.alt': 'Modern museum hall with ambient lighting',
    'gallery.item1.title': 'Quiet Sense - Museum Visual Campaign',
    'gallery.item2.caption': 'Heart of Manufacturing - Smart factory documentary',
    'gallery.item2.alt': 'Robotic arm working inside a factory',
    'gallery.item2.title': 'Heart of Manufacturing - Smart Factory Documentary',
    'gallery.item3.caption': 'City of Light - Night aerial architecture',
    'gallery.item3.alt': 'City skyline glowing at night',
    'gallery.item3.title': 'City of Light - Nighttime Aerial Series',
    'gallery.item4.caption': 'Everyday Moments - Lifestyle brand campaign',
    'gallery.item4.alt': 'Lifestyle coffee shop interior',
    'gallery.item4.title': 'Everyday Moments - Lifestyle Brand Campaign',
    'gallery.item5.caption': 'Profiles in Light - Interview series',
    'gallery.item5.alt': 'Cinematic portrait with rim lighting',
    'gallery.item5.title': 'Profiles in Light - Interview Series',
    'gallery.item6.caption': 'Future Lab - Technology exhibition coverage',
    'gallery.item6.alt': 'Interactive technology installation on stage',
    'gallery.item6.title': 'Future Lab - Technology Exhibition Coverage',
    'video.title': 'Video Portfolio',
    'video.lead': 'Directing and editing highlights that show narrative pace and color control.',
    'video.cta': 'Request the full reel',
    'video.item1.title': '01:00 AM Office - Brand Story Film',
    'video.item1.body':
      'A moody short for a furniture brand, using night office scenes to stress ambience and product detail.',
    'video.item1.point1': 'Direction / Cinematography / Color',
    'video.item1.point2': 'Style: Narrative mood + spatial staging',
    'video.item2.title': 'Flowing Light - Spatial Art Documentary',
    'video.item2.body':
      'Captures an immersive art show with slow motion and aerials, highlighting the dialogue between light and visitors.',
    'video.item2.point1': 'Direction / Aerials / Post production',
    'video.item2.point2': 'Style: Documentary coverage + motion',
    'video.item3.title': 'Future Manufacturing - Corporate Documentary',
    'video.item3.body':
      'Weaves interviews with production scenes to underline technology strengths and human warmth.',
    'video.item3.point1': 'Direction / Cinematography / Interview design',
    'video.item3.point2': 'Style: Corporate documentary + interviews',
    'video.fallback': 'Your browser does not support video playback.',
    'contact.title': 'Let us create your next visual story',
    'contact.lead':
      'Whether you are a brand team, spatial designer, or innovation group, share your brief and I will craft a balanced visual plan.',
    'contact.cta': 'Email Me',
    'contact.phone': 'Phone: +86 193-1434-5676',
    'contact.wechat': 'WeChat: zhiazhia233',
    'contact.location': 'Based in Suzhou - Available nationwide',
    'form.success': 'Form submitted. I will reply soon!',
    'lightbox.dialogAria': 'Image preview',
    'lightbox.close': 'Close',
    'lightbox.prev': 'Previous image',
    'lightbox.next': 'Next image',
    'footer.copy': '\u00A9 2025 Wang Mingdi. All rights reserved.',
    'footer.gallery': 'Portfolio',
    'footer.contact': 'Business Inquiries',
    'footer.backToTop': 'Back to Top',
  },
};

let hasCapturedDefaultTranslations = false;

function captureDefaultTranslations() {
  if (hasCapturedDefaultTranslations) {
    return;
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (!key || translations.zh[key]) return;
    translations.zh[key] = element.textContent.trim();
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    const entries = element.dataset.i18nAttr;
    if (!entries) return;

    entries
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const parts = entry.split(':').map((value) => value.trim());
        const attrName = parts[0];
        const key = parts[1];
        if (!attrName || !key || translations.zh[key]) return;
        const value = element.getAttribute(attrName);
        if (value !== null) {
          translations.zh[key] = value;
        }
      });
  });

  if (!translations.zh['theme.text.night']) {
    translations.zh['theme.text.night'] = '\u591C\u95F4\u6A21\u5F0F';
  }

  hasCapturedDefaultTranslations = true;
}

function getTranslation(key, lang = state.language) {
  if (!key) return '';
  const langDict = translations[lang];
  if (langDict && Object.prototype.hasOwnProperty.call(langDict, key)) {
    return langDict[key];
  }
  const zhDict = translations.zh;
  if (zhDict && Object.prototype.hasOwnProperty.call(zhDict, key)) {
    return zhDict[key];
  }
  return '';
}

function applyTranslations(lang) {
  const targetLang = lang === 'en' ? 'en' : 'zh';

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    const translation = getTranslation(key, targetLang);
    if (translation) {
      element.textContent = translation;
    }
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    const entries = element.dataset.i18nAttr;
    if (!entries) return;

    entries
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const parts = entry.split(':').map((value) => value.trim());
        const attrName = parts[0];
        const key = parts[1];
        if (!attrName || !key) return;
        const translation = getTranslation(key, targetLang);
        if (translation) {
          element.setAttribute(attrName, translation);
        }
      });
  });

  updateThemeToggleUI(state.theme);
}

function updateLanguageToggleUI(lang) {
  if (!languageToggle) return;
  const isEnglish = lang === 'en';
  languageToggle.setAttribute('aria-pressed', isEnglish ? 'true' : 'false');

  const labelSpan = languageToggle.querySelector('.language-toggle__label');
  const labelText =
    getTranslation('language.toggleLabel', lang) || (isEnglish ? '\u4E2D\u6587' : 'English');
  if (labelSpan) {
    labelSpan.textContent = labelText;
  } else {
    languageToggle.textContent = labelText;
  }

  const ariaLabel =
    getTranslation('language.toggleAria', lang) ||
    (isEnglish ? '\u5207\u6362\u5230\u4E2D\u6587' : 'Switch to English');
  languageToggle.setAttribute('aria-label', ariaLabel);
}

function applyLanguage(lang) {
  captureDefaultTranslations();
  const normalized = lang === 'en' ? 'en' : 'zh';
  state.language = normalized;
  localStorage.setItem('language', normalized);
  html.setAttribute('lang', normalized === 'en' ? 'en' : 'zh-CN');
  const title = getTranslation('meta.title', normalized);
  if (title) {
    document.title = title;
  }
  applyTranslations(normalized);
  updateLanguageToggleUI(normalized);
}

function toggleLanguage() {
  const nextLanguage = state.language === 'zh' ? 'en' : 'zh';
  applyLanguage(nextLanguage);
}

function bindLanguageToggle() {
  if (!languageToggle || languageToggle.dataset.bound === 'true') return;

  languageToggle.addEventListener('click', (event) => {
    event.preventDefault();
    toggleLanguage();
  });

  languageToggle.dataset.bound = 'true';
}

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

const daylightRaysState = {
  container: null,
  raysElement: null,
  emitter: null,
};

class Rays {
  constructor(container) {
    this.container = container;
    this.width = 0;
    this.height = 0;
    this.rays = [];
    this.animationId = null;
    this.resizeHandler = this.resizeHandler.bind(this);
    this.tick = this.tick.bind(this);
    this.init();
  }

  init() {
    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler);
    this.animationId = requestAnimationFrame(this.tick);
  }

  resizeHandler() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.emit();
  }

  emit() {
    this.rays = [];
    this.totalRays = Math.floor(this.height * 0.75);

    for (let index = 0; index < this.totalRays; index += 1) {
      this.rays.push(new Ray(this));
    }
  }

  tick() {
    let path = '';

    this.rays.forEach((ray) => {
      ray.tick();
      path += ray.d;
    });

    const clipPath = `path("${path}")`;
    this.container.style.clipPath = clipPath;
    this.container.style.webkitClipPath = clipPath;
    this.animationId = requestAnimationFrame(this.tick);
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.container.style.clipPath = '';
    this.container.style.webkitClipPath = '';
  }
}

class Ray {
  constructor(emitter) {
    this.emitter = emitter;
    const gap = 12;
    this.x = Math.random() * this.emitter.width;
    this.y = Math.floor(Math.random() * ((this.emitter.height / gap) + 1)) * gap;
    this.width = 50 * Math.random();
    this.velocity = 0.25 + this.width / 50;
    this.d = '';
  }

  update() {
    this.x += this.velocity;
    if (this.x > this.emitter.width) {
      this.x = -this.width;
    }
  }

  draw() {
    this.d = `M ${this.x},${this.y} h ${this.width} v 1 h -${this.width} z `;
  }

  tick() {
    this.update();
    this.draw();
  }
}

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

function createDaylightBackground() {
  if (daylightRaysState.emitter) {
    return;
  }

  const container = document.createElement('div');
  container.className = 'daylight-background';
  container.setAttribute('aria-hidden', 'true');

  const raysElement = document.createElement('div');
  raysElement.className = 'daylight-background__rays';
  container.appendChild(raysElement);

  document.body.prepend(container);

  daylightRaysState.container = container;
  daylightRaysState.raysElement = raysElement;
  daylightRaysState.emitter = new Rays(raysElement);

  requestAnimationFrame(() => container.classList.add('is-active'));
}

function destroyDaylightBackground() {
  if (!daylightRaysState.emitter) {
    return;
  }

  daylightRaysState.emitter.destroy();

  const { container } = daylightRaysState;
  if (container) {
    container.classList.remove('is-active');
    setTimeout(() => {
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    }, 300);
  }

  daylightRaysState.container = null;
  daylightRaysState.raysElement = null;
  daylightRaysState.emitter = null;
}

function updateBackgrounds(theme) {
  if (theme === 'dark') {
    destroyDaylightBackground();
    createNightSkyBackground();
  } else {
    destroyNightSkyBackground();
    createDaylightBackground();
  }
}

function updateThemeToggleUI(theme) {
  if (!themeToggle) return;

  const iconSpan = themeToggle.querySelector('.theme-toggle__icon');
  const textSpan = themeToggle.querySelector('.theme-toggle__text');
  const labels = {
    light: themeToggle.dataset.themeLabelLight || '\u5207\u6362\u81F3\u591C\u95F4\u6A21\u5F0F',
    dark: themeToggle.dataset.themeLabelDark || '\u5207\u6362\u81F3\u65E5\u95F4\u6A21\u5F0F',
  };

  themeToggle.setAttribute('aria-label', theme === 'dark' ? labels.dark : labels.light);
  themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  themeToggle.dataset.theme = theme;

  if (iconSpan) {
    iconSpan.innerHTML = theme === 'dark' ? '&#9728;' : '&#127769;';
  }

  if (textSpan) {
    const textKey = theme === 'dark' ? 'theme.text.day' : 'theme.text.night';
    textSpan.textContent =
      getTranslation(textKey) ||
      (theme === 'dark' ? '\u65E5\u95F4\u6A21\u5F0F' : '\u591C\u95F4\u6A21\u5F0F');
  }
}

function applyTheme(theme) {
  state.theme = theme;
  root.dataset.theme = theme;
  updateThemeToggleUI(theme);
  localStorage.setItem('theme', theme);
  updateBackgrounds(theme);
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

function initSmoothScroll() {
  const links = Array.from(document.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = link.getAttribute('href');
      if (!target || target === '#' || target.startsWith('mailto:')) return;
      const destination = document.querySelector(target);
      if (!destination) return;
      event.preventDefault();
      destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initIntersectionHighlights() {
  if (typeof IntersectionObserver === 'undefined') return;
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const navLinks = Array.from(
    document.querySelectorAll('.nav a[href^="#"], .footer__links a[href^="#"]')
  );

  if (!sections.length || !navLinks.length) return;

  const map = new Map(navLinks.map((link) => [link.getAttribute('href'), link]));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = `#${entry.target.id}`;
        const link = map.get(id);
        if (!link || !entry.isIntersecting) return;

        navLinks.forEach((item) => {
          item.classList.remove('is-active');
          const parentItem = item.closest('.nav__item');
          if (parentItem) {
            parentItem.classList.remove('nav__item--selected');
          }
          item.removeAttribute('aria-current');
        });

        link.classList.add('is-active');
        const navItem = link.closest('.nav__item');
        if (navItem) {
          navItem.classList.add('nav__item--selected');
          link.setAttribute('aria-current', 'page');
        }
      });
    },
    { rootMargin: '-40% 0px -40% 0px', threshold: 0.2 }
  );

  sections.forEach((section) => observer.observe(section));
}

function initNavbarVisibility() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastScrollY = window.pageYOffset;
  let ticking = false;
  const deltaThreshold = 6;
  const revealOffset = navbar.offsetHeight;

  const updateVisibility = () => {
    const currentY = window.pageYOffset;
    const delta = currentY - lastScrollY;

    const shouldReveal = delta < -deltaThreshold || currentY <= revealOffset;
    const shouldHide = delta > deltaThreshold && currentY > revealOffset;

    if (shouldReveal) {
      navbar.classList.remove('navbar--hidden');
    } else if (shouldHide) {
      navbar.classList.add('navbar--hidden');
    }

    lastScrollY = currentY;
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    },
    { passive: true }
  );
}

function initGalleryLightbox() {
  if (!galleryLinks.length || !lightbox || !lightboxImage || !lightboxCaption) return;

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

  const updateLightbox = (index) => {
    const item = galleryItems[index];
    if (!item) return;

    currentIndex = index;
    lightboxImage.src = item.full;
    lightboxImage.alt = item.alt || item.caption;
    lightboxCaption.textContent = item.caption;
  };

  const showNext = () => {
    if (!galleryItems.length) return;
    const nextIndex = (currentIndex + 1) % galleryItems.length;
    updateLightbox(nextIndex);
  };

  const showPrevious = () => {
    if (!galleryItems.length) return;
    const prevIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    updateLightbox(prevIndex);
  };

  const openLightbox = (index, trigger) => {
    updateLightbox(index);
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    activeTrigger = trigger ?? galleryItems[index]?.link ?? null;
    lightboxDialog?.focus({ preventScroll: true });
  };

  const closeLightbox = () => {
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImage.src = '';
    activeTrigger?.focus({ preventScroll: true });
    activeTrigger = null;
  };

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
}

function initWaveDividers() {
  const dividers = Array.from(document.querySelectorAll('[data-wave-divider]'));
  dividers.forEach((divider) => {
    if (divider.dataset.waveBound === 'true') return;

    const svg = divider.querySelector('svg');
    const path = svg?.querySelector('path');
    if (!svg || !path) return;

    let progress = 0;
    let x = 0.3;
    let time = Math.PI / 2;
    let rafId = null;
    let lastClientY = null;

    const setPath = (value) => {
      const width = divider.offsetWidth || window.innerWidth * 0.7 || 600;
      const baseline = 100;
      const clamped = Math.max(Math.min(value, 160), -160);
      svg.setAttribute('viewBox', `0 0 ${width} 200`);
      path.setAttribute('d', `M0 ${baseline} Q ${width * x} ${baseline + clamped}, ${width} ${baseline}`);
    };

    const lerp = (start, end, alpha) => start + (end - start) * alpha;

    const resetAnimation = () => {
      time = Math.PI / 2;
      progress = 0;
      lastClientY = null;
      setPath(0);
    };

    const stopAnimation = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const animateOut = () => {
      const eased = progress * Math.sin(time);
      progress = lerp(progress, 0, 0.08);
      time += 0.2;
      setPath(eased);
      if (Math.abs(progress) > 0.5) {
        rafId = requestAnimationFrame(animateOut);
      } else {
        resetAnimation();
      }
    };

    const handlePointerEnter = () => {
      stopAnimation();
    };

    const handlePointerDown = (event) => {
      if (!event.isPrimary) return;
      if (interaction.setPointerCapture) {
        try {
          interaction.setPointerCapture(event.pointerId);
        } catch (error) {
          // ignore pointer capture failures
        }
      }
      lastClientY = event.clientY;
    };

    const handlePointerMove = (event) => {
      if (!event.isPrimary) return;
      const rect = divider.getBoundingClientRect();
      x = (event.clientX - rect.left) / rect.width;
      if (!Number.isFinite(x)) {
        x = 0.5;
      } else {
        x = Math.min(Math.max(x, 0.05), 0.95);
      }

      if (lastClientY !== null) {
        const delta = event.clientY - lastClientY;
        progress += delta * 0.6;
        progress = Math.max(Math.min(progress, 200), -200);
      }

      lastClientY = event.clientY;
      setPath(progress);
    };

    const handlePointerLeave = (event) => {
      lastClientY = null;
      if (interaction.releasePointerCapture) {
        try {
          interaction.releasePointerCapture(event.pointerId);
        } catch (error) {
          // ignore release failures
        }
      }
      if (!rafId) {
        rafId = requestAnimationFrame(animateOut);
      }
    };

    const handlePointerUp = (event) => {
      lastClientY = null;
      if (interaction.releasePointerCapture) {
        try {
          interaction.releasePointerCapture(event.pointerId);
        } catch (error) {
          // ignore release failures
        }
      }
    };

    const handleResize = () => {
      setPath(progress);
    };

    const interaction = divider.querySelector('[data-wave-interaction]') || divider;

    interaction.addEventListener('pointerenter', handlePointerEnter);
    interaction.addEventListener('pointerdown', handlePointerDown);
    interaction.addEventListener('pointermove', handlePointerMove);
    interaction.addEventListener('pointerleave', handlePointerLeave);
    interaction.addEventListener('pointercancel', handlePointerUp);
    interaction.addEventListener('pointerup', handlePointerUp);

    window.addEventListener('resize', handleResize);

    setPath(0);
    divider.dataset.waveBound = 'true';
  });
}

function validateForm() {
  return [];
}

function handleFormSubmit(event) {
  event.preventDefault();
  if (!contactForm) {
    return;
  }

  const targetForm = event.currentTarget || contactForm;
  const status = targetForm.querySelector('[data-form-status]') || formStatus;
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
    status.textContent = getTranslation('form.success') || '\u8868\u5355\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u56DE\u590D\u60A8\uFF01';
    status.dataset.state = 'success';
  }
  targetForm.reset();
}
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
  applyLanguage(state.language);
  applyTheme(state.theme);
  bindLanguageToggle();
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
  initNavbarVisibility();
  initGalleryLightbox();
  initWaveDividers();
  initAnimatedTestimonials();
  bindVideoTitleInteraction();
  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

const videoHighlights = () => Array.from(document.querySelectorAll('.video-highlight'));

function bindVideoTitleInteraction() {
  const cards = videoHighlights();
  if (!cards.length) return;

  cards.forEach((card) => {
    if (card.dataset.titleBound === 'true') return;

    const titleWrapper = card.querySelector('.video-highlight__title');
    const titleSpan = titleWrapper?.querySelector('span');
    if (!titleWrapper || !titleSpan) return;

    card.dataset.titleBound = 'true';

    if (!titleSpan.dataset.shadow) {
      titleSpan.setAttribute('data-shadow', titleSpan.textContent || '');
    }

    const state = {
      hidden: card.classList.contains('is-title-hidden'),
      animating: false,
    };

    const hideTitle = () => {
      if (!titleWrapper || state.hidden) return;
      titleWrapper.classList.add('is-hidden');
      card.classList.add('is-title-hidden');
      state.hidden = true;
      state.animating = true;
      setTimeout(() => {
        state.animating = false;
      }, 700);
    };

    card.addEventListener(
      'wheel',
      (event) => {
        if (event.deltaY === 0) return;
        if (!state.hidden) {
          event.preventDefault();
          hideTitle();
          return;
        }
        if (state.animating) {
          event.preventDefault();
        }
      },
      { passive: false }
    );

    card.addEventListener(
      'touchmove',
      (event) => {
        if (!state.hidden) {
          event.preventDefault();
          hideTitle();
          return;
        }
        if (state.animating) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  });
}

document.addEventListener('videos:updated', bindVideoTitleInteraction);
