import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'moses233@qq.com';
const NORMALIZED_ADMIN_EMAIL = ADMIN_EMAIL.toLowerCase();
const ADMIN_PASSWORD = 'Moses233';
const DASHBOARD_PAGE = 'dashboard.html';
const LOGIN_PAGE = 'index.html';

const { url, anonKey } = resolveSupabaseConfig();
export const supabase = createClient(url, anonKey);

const currentPage = document.body.dataset.page ?? 'login';

bootstrap();

async function bootstrap() {
  if (currentPage === 'login') {
    await initLoginPage();
    return;
  }

  if (currentPage === 'dashboard') {
    await initDashboardPage();
    return;
  }

  console.warn('Unknown admin page context:', currentPage);
}

function resolveSupabaseConfig() {
  if (window.__SB__?.url && window.__SB__?.anonKey) {
    return {
      url: window.__SB__.url,
      anonKey: window.__SB__.anonKey,
    };
  }

  const getEnv = (key) => window.__ENV?.[key] ?? window[key];
  const fallbackUrl = getEnv('VITE_SUPABASE_URL');
  const fallbackAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

  if (!fallbackUrl || !fallbackAnonKey) {
    throw new Error('缺少 Supabase 配置信息，请检查环境变量。');
  }

  return { url: fallbackUrl, anonKey: fallbackAnonKey };
}

function setStatus(message = '', variant = 'neutral') {
  const statusEl = document.querySelector('[data-status]');
  if (!statusEl) return;

  statusEl.textContent = message;

  if (variant === 'neutral' || !message) {
    statusEl.removeAttribute('data-variant');
  } else {
    statusEl.dataset.variant = variant;
  }
}

function buildAdminUrl(targetFile) {
  const base = window.location.href;
  try {
    return new URL(targetFile, base).href;
  } catch (error) {
    console.error('生成后台跳转地址失败', error);
    return targetFile;
  }
}

function redirectToDashboard() {
  const target = buildAdminUrl(DASHBOARD_PAGE);
  if (target === window.location.href) return;
  window.location.href = target;
}

function redirectToLogin() {
  const target = buildAdminUrl(LOGIN_PAGE);
  if (target === window.location.href) return;
  window.location.href = target;
}

function clearAuthHash() {
  if (window.location.hash.includes('access_token') || window.location.hash.includes('type=')) {
    const cleanPath = window.location.pathname + window.location.search;
    window.history.replaceState({}, document.title, cleanPath);
  }
}

function isAdminSession(session) {
  return session?.user?.email?.toLowerCase() === NORMALIZED_ADMIN_EMAIL;
}

async function ensureAdminSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('读取 Supabase 会话失败', error);
      return null;
    }

    const session = data.session;
    if (!session) {
      return null;
    }

    if (!isAdminSession(session)) {
      await supabase.auth.signOut();
      return null;
    }

    return session;
  } catch (error) {
    console.error('检测 Supabase 会话时出现异常', error);
    return null;
  }
}

async function initLoginPage() {
  const form = document.querySelector('[data-login-form]');
  const emailInput = document.querySelector('[data-email-input]');
  const passwordInput = document.querySelector('[data-password-input]');
  const submitButton = form?.querySelector('button[type="submit"]');

  if (!form || !emailInput || !passwordInput || !submitButton) {
    console.warn('登录表单未找到，跳过初始化。');
    return;
  }

  const setLoading = (loading) => {
    submitButton.disabled = loading;
    emailInput.disabled = loading;
    passwordInput.disabled = loading;
    form.classList.toggle('is-loading', loading);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const email = (emailInput.value || '').trim().toLowerCase();
    const password = (passwordInput.value || '').trim();

    if (!email) {
      setStatus('请输入邮箱地址。', 'error');
      emailInput.focus();
      return;
    }

    if (!password) {
      setStatus('请输入登录密码。', 'error');
      passwordInput.focus();
      return;
    }

    if (email !== NORMALIZED_ADMIN_EMAIL) {
      setStatus(`仅允许管理员邮箱 ${ADMIN_EMAIL} 登录。`, 'error');
      emailInput.focus();
      return;
    }

    if (password !== ADMIN_PASSWORD) {
      setStatus('密码错误，请重试。', 'error');
      passwordInput.select();
      return;
    }

    setLoading(true);
    setStatus('正在验证，请稍候...');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data?.user?.email?.toLowerCase() !== NORMALIZED_ADMIN_EMAIL) {
        await supabase.auth.signOut();
        setStatus('该账号没有访问权限。', 'error');
        return;
      }

      setStatus('登录成功，正在跳转...', 'success');
      redirectToDashboard();
      return;
    } catch (error) {
      console.error('登录失败', error);
      const description = error?.message ? `登录失败：${error.message}` : '登录失败，请检查邮箱或密码。';
      setStatus(description, 'error');
    } finally {
      setLoading(false);
    }
  });

  const existingSession = await ensureAdminSession();
  clearAuthHash();

  if (existingSession) {
    setStatus('检测到已登录，会自动跳转。', 'success');
    redirectToDashboard();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      clearAuthHash();

      if (isAdminSession(session)) {
        setStatus('登录成功，正在跳转...', 'success');
        redirectToDashboard();
        return;
      }

      await supabase.auth.signOut();
      setStatus('该邮箱没有访问权限。', 'error');
    }

    if (event === 'SIGNED_OUT') {
      setStatus('');
    }
  });
}

async function initDashboardPage() {
  const dashboardView = document.querySelector('[data-dashboard-view]');
  if (!dashboardView) {
    console.warn('仪表盘内容未找到，跳过初始化。');
    return;
  }

  const session = await ensureAdminSession();
  if (!session) {
    redirectToLogin();
    return;
  }

  clearAuthHash();

  const emailEl = document.querySelector('[data-admin-email]');
  if (emailEl && session.user?.email) {
    emailEl.textContent = session.user.email;
  }

  const signOutButton = document.querySelector('[data-signout]');
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      await supabase.auth.signOut();
      redirectToLogin();
    });
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      redirectToLogin();
      return;
    }

    if (event === 'TOKEN_REFRESHED' && session && !isAdminSession(session)) {
      await supabase.auth.signOut();
      redirectToLogin();
    }
  });
}
