const state = {
  theme: localStorage.getItem('theme') || 'light',
};

const root = document.body;
const themeToggle = document.querySelector('#theme-toggle');
const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
const projectCards = Array.from(document.querySelectorAll('.project-card'));
const contactForm = document.querySelector('#contact-form');
const formStatus = document.querySelector('.form-status');
const currentYear = document.querySelector('#current-year');

function applyTheme(theme) {
  state.theme = theme;
  root.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
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

function setActiveFilter(button) {
  filterButtons.forEach((btn) => btn.classList.remove('is-active'));
  button.classList.add('is-active');
}

function handleFilterClick(event) {
  const button = event.currentTarget;
  const category = button.dataset.filter;
  setActiveFilter(button);
  filterProjects(category);
}

function validateForm(data) {
  const errors = [];

  if (!data.get('name')?.trim()) {
    errors.push('请填写姓名。');
  }

  const email = data.get('email');
  if (!email) {
    errors.push('请填写邮箱。');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('邮箱格式不正确。');
  }

  if (!data.get('message')?.trim()) {
    errors.push('请填写合作需求。');
  }

  return errors;
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const errors = validateForm(formData);

  if (errors.length > 0) {
    formStatus.textContent = errors.join(' ');
    formStatus.dataset.state = 'error';
    return;
  }

  formStatus.textContent = '表单已提交，我们会尽快回复您！';
  formStatus.dataset.state = 'success';
  contactForm.reset();
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const targetId = anchor.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);

      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', `#${targetId}`);
      }
    });
  });
}

function initIntersectionHighlights() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    { threshold: 0.2 }
  );

  document.querySelectorAll('.section').forEach((section) => {
    observer.observe(section);
  });
}

function init() {
  applyTheme(state.theme);
  themeToggle.addEventListener('click', toggleTheme);
  filterButtons.forEach((button) => button.addEventListener('click', handleFilterClick));
  filterProjects('all');
  contactForm.addEventListener('submit', handleFormSubmit);
  initSmoothScroll();
  initIntersectionHighlights();
  currentYear.textContent = new Date().getFullYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
