const SUPABASE_URL =
  (window.__SB__ && window.__SB__.url) ||
  (window.__ENV && window.__ENV.VITE_SUPABASE_URL) ||
  'https://qsgztmaenhieehyrclcm.supabase.co';
const SUPABASE_ANON_KEY =
  (window.__SB__ && window.__SB__.anonKey) ||
  (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZ3p0bWFlbmhpZWVoeXJjbGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTc5MzUsImV4cCI6MjA3NjM5MzkzNX0.D1GxzSnYesnpflM3tbOWTk7BOopPyn6iqGv6X0K6Ej8';

let supabaseClient;
let realtimeChannel;
let refreshTimer;

const galleryGrid = document.querySelector('.gallery-grid');
const videoGrid = document.querySelector('.media-grid');

if (galleryGrid || videoGrid) {
  init();
}

async function init() {
  supabaseClient = await loadSupabaseClient();
  await renderMedia();
  await subscribeToRealtime();
}

async function loadSupabaseClient() {
  if (window.supabase?.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-supabase-umd]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.1/dist/umd/supabase.js';
    script.async = true;
    script.dataset.supabaseUmd = 'true';
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });

  if (!window.supabase?.createClient) {
    throw new Error('Supabase 脚本加载失败');
  }

  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function renderMedia() {
  try {
    const [mediaRes, albumRes, albumItemsRes] = await Promise.all([
      supabaseClient.from('media_items').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('albums').select('id, title'),
      supabaseClient.from('album_items').select('album_id, media_item_id'),
    ]);

    if (mediaRes.error) throw mediaRes.error;
    if (albumRes.error) throw albumRes.error;
    if (albumItemsRes.error) throw albumItemsRes.error;

    const albumTitleMap = new Map((albumRes.data ?? []).map((album) => [album.id, album.title]));
    const mediaAlbumIds = new Map();
    (albumItemsRes.data ?? []).forEach((row) => {
      const list = mediaAlbumIds.get(row.media_item_id) ?? [];
      list.push(row.album_id);
      mediaAlbumIds.set(row.media_item_id, list);
    });

    const albumOrder = albumRes.data ?? [];
    const images = [];
    const videos = [];

    (mediaRes.data ?? []).forEach((item) => {
      const albumIds = mediaAlbumIds.get(item.id) ?? [];
      const albumNames = albumIds
        .map((id) => albumTitleMap.get(id))
        .filter(Boolean);
      const base = {
        ...item,
        albumIds,
        albumNames,
        createdLabel: formatDate(item.created_at),
      };

      if (item.type === 'video') {
        videos.push(base);
      } else {
        images.push(base);
      }
    });

    renderImages(images, albumOrder);
    renderVideos(videos);
  } catch (error) {
    console.error('加载媒体内容失败', error);
  }
}

function renderImages(images, albumOrder) {
  if (!galleryGrid) return;
  galleryGrid.innerHTML = '';
  lightboxController.unbind();

  const albumGroups = [];
  const albumGroupMap = new Map();

  (albumOrder || []).forEach((album) => {
    const group = {
      id: album.id,
      title: album.title || '未命名相册',
      images: [],
    };
    albumGroupMap.set(album.id, group);
    albumGroups.push(group);
  });

  const unassignedGroup = {
    id: null,
    title: '未分类',
    images: [],
  };

  images.forEach((item) => {
    if (item.albumIds && item.albumIds.length) {
      item.albumIds.forEach((albumId) => {
        const group = albumGroupMap.get(albumId);
        if (group) {
          group.images.push(item);
        }
      });
    } else {
      unassignedGroup.images.push(item);
    }
  });

  albumGroups.forEach((group) => {
    group.images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });
  unassignedGroup.images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stacks = albumGroups.filter((group) => group.images.length);
  if (unassignedGroup.images.length) {
    stacks.push(unassignedGroup);
  }

  if (!stacks.length) {
    galleryGrid.appendChild(createEmptyMessage());
    lightboxController.unbind();
    return;
  }

  const fragment = document.createDocumentFragment();

  stacks.forEach((group) => {
    const section = document.createElement('article');
    section.className = 'album-stack';

    const stack = document.createElement('div');
    stack.className = 'album-stack__stack';

    const maxPreview = 4;
    group.images.forEach((item, index) => {
      const link = document.createElement('a');
      link.className = 'gallery-link album-stack__item';
      link.href = item.url;
      link.dataset.full = item.url;
      link.dataset.caption =
        item.description ||
        item.title ||
        `${group.title} · 媒体图片`;

      link.style.setProperty('--stack-offset', Math.min(index, maxPreview - 1));

      if (index === 0) {
        link.classList.add('album-stack__item--primary');
      } else if (index < maxPreview) {
        link.classList.add('album-stack__item--visible');
      } else {
        link.classList.add('album-stack__item--hidden');
      }

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.title || item.description || `${group.title} 图片`;
      img.loading = 'lazy';

      link.appendChild(img);

      const overlay = document.createElement('div');
      overlay.className = 'album-stack__overlay';

      const overlayTitle = document.createElement('p');
      overlayTitle.className = 'album-stack__overlay-title';
      overlayTitle.textContent = item.title || group.title || '';
      overlay.appendChild(overlayTitle);

      const metaText =
        (item.albumNames && item.albumNames.length && item.albumNames.join(' · ')) ||
        item.createdLabel ||
        item.description ||
        '';
      if (metaText) {
        const overlayMeta = document.createElement('span');
        overlayMeta.className = 'album-stack__overlay-meta';
        overlayMeta.textContent = metaText;
        overlay.appendChild(overlayMeta);
      }

      link.appendChild(overlay);
      stack.appendChild(link);
    });

    section.appendChild(stack);
    fragment.appendChild(section);
  });

  galleryGrid.appendChild(fragment);
  lightboxController.bind(galleryGrid.querySelectorAll('.gallery-link'));
}

function renderVideos(videos) {
  if (!videoGrid) return;
  videoGrid.innerHTML = '';

  if (!videos.length) {
    videoGrid.appendChild(createEmptyMessage());
    return;
  }

  const fragment = document.createDocumentFragment();
  videos.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'media-card';

    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'media-card__video';

    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.preload = 'none';

    const source = document.createElement('source');
    source.src = item.url;
    source.type = inferVideoMime(item.url);
    videoEl.appendChild(source);

    const fallback = document.createElement('span');
    fallback.textContent = '您的浏览器不支持视频播放。';
    videoEl.appendChild(fallback);
    videoWrapper.appendChild(videoEl);

    const body = document.createElement('div');
    body.className = 'media-card__body';

    const title = document.createElement('h3');
    title.textContent = item.title || '未命名视频';

    const summary = document.createElement('p');
    summary.textContent = item.description || '暂未提供视频描述。';

    const metaList = document.createElement('ul');
    const albumLi = document.createElement('li');
    albumLi.textContent = item.albumNames.length
      ? `归属相册：${item.albumNames.join(' / ')}`
      : '归属相册：未分类';
    const uploaderLi = document.createElement('li');
    uploaderLi.textContent = item.createdLabel
      ? `上传于 ${item.createdLabel}`
      : `上传者：${item.uploader_email || '未知'}`;
    metaList.appendChild(albumLi);
    metaList.appendChild(uploaderLi);

    body.appendChild(title);
    body.appendChild(summary);
    body.appendChild(metaList);

    article.appendChild(videoWrapper);
    article.appendChild(body);
    fragment.appendChild(article);
  });

  videoGrid.appendChild(fragment);
}

function createEmptyMessage() {
  const empty = document.createElement('p');
  empty.className = 'media-empty';
  empty.textContent = '暂无媒体内容';
  return empty;
}

function inferVideoMime(url) {
  const lower = (url.split('.').pop() || '').toLowerCase();
  switch (lower) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'avi':
      return 'video/x-msvideo';
    case 'mkv':
      return 'video/x-matroska';
    default:
      return 'video/mp4';
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function subscribeToRealtime() {
  if (realtimeChannel) {
    await supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabaseClient
    .channel('public:media-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'media_items' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'album_items' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'albums' }, scheduleRefresh)
    .subscribe();
}

function scheduleRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(() => {
    renderMedia();
  }, 400);
}

const lightboxController = (() => {
  const originalLightbox = document.getElementById('lightbox');
  if (!originalLightbox || !originalLightbox.parentNode) {
    return {
      bind() {},
      unbind() {},
    };
  }

  const lightboxEl = originalLightbox.cloneNode(true);
  originalLightbox.parentNode.replaceChild(lightboxEl, originalLightbox);

  const replaceWithClone = (node) => {
    if (!node || !node.parentNode) return node;
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    return clone;
  };

  const dialog = lightboxEl.querySelector('.lightbox__dialog');
  const image = lightboxEl.querySelector('#lightbox-image');
  const caption = lightboxEl.querySelector('#lightbox-caption');
  const closeButtons = Array.from(lightboxEl.querySelectorAll('[data-lightbox-close]')).map(
    (button) => replaceWithClone(button)
  );
  const prevButton = replaceWithClone(lightboxEl.querySelector('.lightbox__nav--prev'));
  const nextButton = replaceWithClone(lightboxEl.querySelector('.lightbox__nav--next'));

  let items = [];
  let currentIndex = 0;
  let activeTrigger = null;
  let touchStartX = null;

  const open = (index, trigger) => {
    if (!items.length) return;
    currentIndex = index;
    activeTrigger = trigger ?? null;
    update();
    lightboxEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    dialog?.focus({ preventScroll: true });
  };

  const close = () => {
    lightboxEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    if (image) image.src = '';
    activeTrigger?.focus({ preventScroll: true });
    activeTrigger = null;
  };

  const showNext = () => {
    if (!items.length) return;
    currentIndex = (currentIndex + 1) % items.length;
    update();
  };

  const showPrev = () => {
    if (!items.length) return;
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    update();
  };

  const update = () => {
    const item = items[currentIndex];
    if (!item || !image || !caption) return;
    image.src = item.full;
    image.alt = item.alt || item.caption;
    caption.textContent = item.caption;
  };

  const handleKeydown = (event) => {
    if (lightboxEl.getAttribute('aria-hidden') === 'true') return;
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowRight') {
      showNext();
    } else if (event.key === 'ArrowLeft') {
      showPrev();
    }
  };

  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      touchStartX = event.touches[0].clientX;
    }
  };

  const handleTouchEnd = (event) => {
    if (touchStartX === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) {
        showPrev();
      } else {
        showNext();
      }
    }
    touchStartX = null;
  };

  const handleWheel = (event) => {
    if (lightboxEl.getAttribute('aria-hidden') === 'true') return;
    event.preventDefault();
    if (event.deltaY > 0) {
      showNext();
    } else if (event.deltaY < 0) {
      showPrev();
    }
  };

  const bind = (links) => {
    items = Array.from(links).map((link) => ({
      link,
      full: link.dataset.full || link.getAttribute('href'),
      caption:
        link.dataset.caption ||
        link.querySelector('img')?.getAttribute('alt') ||
        link.nextElementSibling?.textContent?.trim() ||
        '',
      alt: link.querySelector('img')?.getAttribute('alt'),
    }));

    items.forEach((item, index) => {
      item.link.addEventListener('click', (event) => {
        event.preventDefault();
        open(index, item.link);
      });
      item.link.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(index, item.link);
        }
      });
    });
  };

  const unbind = () => {
    items = [];
  };

  closeButtons.forEach((button) => {
    button.addEventListener('click', close);
  });
  prevButton?.addEventListener('click', showPrev);
  nextButton?.addEventListener('click', showNext);
  lightboxEl.addEventListener('click', (event) => {
    if (event.target === lightboxEl) {
      close();
    }
  });
  lightboxEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  lightboxEl.addEventListener('touchend', handleTouchEnd);
  lightboxEl.addEventListener('wheel', handleWheel, { passive: false });
  document.addEventListener('keydown', handleKeydown);

  return { bind, unbind };
})();
