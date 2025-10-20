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

const galleryGrid = document.querySelector('.gallery-slider');
const videoGrid = document.querySelector('.media-grid');
const heroVideoEl = document.querySelector('[data-hero-video]');
const heroVideoSourceEl = heroVideoEl ? heroVideoEl.querySelector('source') : null;
const heroVideoFallback = heroVideoEl
  ? {
      src:
        heroVideoEl.dataset.fallbackSrc ||
        (heroVideoSourceEl ? heroVideoSourceEl.getAttribute('src') : heroVideoEl.getAttribute('src') || '') ||
        '',
      type:
        heroVideoEl.dataset.fallbackType ||
        (heroVideoSourceEl ? heroVideoSourceEl.getAttribute('type') : heroVideoEl.getAttribute('type') || '') ||
        '',
      poster: heroVideoEl.dataset.fallbackPoster || heroVideoEl.getAttribute('poster') || '',
    }
  : null;
let heroVideoListenersBound = false;
const heroVideoRetryState = {
  src: '',
  attempts: 0,
  maxAttempts: 2,
  lastError: null,
  isPlaying: false,
  retryTimer: null,
  awaitingReady: false,
};
const heroDebugEnabled =
  typeof window !== 'undefined' && window.__HERO_DEBUG__ !== undefined ? window.__HERO_DEBUG__ : true;
const debugHero = (label, extra = {}) => {
  if (!heroDebugEnabled || !heroVideoEl) return;
  const base = {
    readyState: heroVideoEl.readyState,
    paused: heroVideoEl.paused,
    currentTime: heroVideoEl.currentTime,
    networkState: heroVideoEl.networkState,
    buffered: heroVideoEl.buffered?.length ? heroVideoEl.buffered.end(heroVideoEl.buffered.length - 1) : 0,
    dataset: { ...heroVideoEl.dataset },
  };
  console.debug(`[hero] ${label}`, Object.assign(base, extra));
};
const markHeroElement = () => {
  if (!heroDebugEnabled || !heroVideoEl) return;
  window.__heroVideo = heroVideoEl;
  requestAnimationFrame(() => {
    const rect = heroVideoEl.getBoundingClientRect();
    const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    debugHero('bounds', {
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      topElement: topElement ? `${topElement.tagName.toLowerCase()}${topElement.className ? '.' + topElement.className.replace(/\s+/g, '.') : ''}` : null,
    });
  });
};

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
      supabaseClient
        .from('album_items')
        .select('album_id, media_item_id, position, created_at')
        .order('position', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true }),
    ]);

    if (mediaRes.error) throw mediaRes.error;
    if (albumRes.error) throw albumRes.error;
    if (albumItemsRes.error) throw albumItemsRes.error;

    const albumTitleMap = new Map((albumRes.data ?? []).map((album) => [album.id, album.title]));
    const assignmentsByAlbum = new Map();
    const mediaAlbumIds = new Map();

    (albumItemsRes.data ?? []).forEach((row) => {
      const mediaList = mediaAlbumIds.get(row.media_item_id) ?? [];
      mediaList.push(row.album_id);
      mediaAlbumIds.set(row.media_item_id, mediaList);

      const albumList = assignmentsByAlbum.get(row.album_id) ?? [];
      albumList.push(row);
      assignmentsByAlbum.set(row.album_id, albumList);
    });

    assignmentsByAlbum.forEach((list) => {
      list.sort((a, b) => {
        const posA = Number.isFinite(a.position) ? a.position : Number.MAX_SAFE_INTEGER;
        const posB = Number.isFinite(b.position) ? b.position : Number.MAX_SAFE_INTEGER;
        if (posA !== posB) {
          return posA - posB;
        }
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeA - timeB;
      });
    });

    const mediaMap = new Map();
    const videos = [];
    let heroCandidate = null;

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

      mediaMap.set(item.id, base);

      if (item.type === 'video') {
        if (!base.is_featured) {
          videos.push(base);
        }
        const createdTime = getMediaPriorityTimestamp(base);
        const candidateTime = heroCandidate ? getMediaPriorityTimestamp(heroCandidate) : Number.NEGATIVE_INFINITY;

        if (base.is_featured) {
          if (!heroCandidate || !heroCandidate.is_featured || createdTime >= candidateTime) {
            heroCandidate = base;
          }
        } else if (!heroCandidate || (!heroCandidate.is_featured && createdTime >= candidateTime)) {
          heroCandidate = base;
        }
      }
    });

    const albumGroups = (albumRes.data ?? []).map((album) => {
      const assignments = assignmentsByAlbum.get(album.id) ?? [];
      const orderedImages = assignments
        .map((assignment) => mediaMap.get(assignment.media_item_id))
        .filter((media) => media && media.type !== 'video');
      return {
        id: album.id,
        title: album.title || '未命名相册',
        images: orderedImages,
      };
    });

    const unassignedImages = [];
    mediaMap.forEach((media) => {
      if (media.type === 'video') return;
      if (!media.albumIds || !media.albumIds.length) {
        unassignedImages.push(media);
      }
    });

    unassignedImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    renderImages(albumGroups, unassignedImages);
    renderVideos(videos);
    updateAlbumDropdown(albumRes.data);
    updateHeroVideo(heroCandidate);
  } catch (error) {
    console.error('加载媒体内容失败', error);
    updateAlbumDropdown([]);
    updateHeroVideo(null);
  }
}

function updateAlbumDropdown(albums) {
  const list = document.querySelector('[data-album-dropdown]');
  if (!list) return;

  const dropdownItem = list.closest('[data-nav-dropdown]');
  const label = dropdownItem?.querySelector('.nav__dropdown-label');
  list.innerHTML = '';

  if (!Array.isArray(albums) || !albums.length) {
    if (label) {
      label.textContent = '相册';
    }
    const empty = document.createElement('li');
    empty.className = 'nav__dropdown-empty';
    empty.textContent = '暂无相册';
    list.appendChild(empty);
    dropdownItem?.classList.remove('is-ready');
    return;
  }

  if (label) {
    label.textContent = '相册';
  }

  const collator =
    typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
      ? new Intl.Collator('zh-Hans-CN', { sensitivity: 'base', usage: 'sort' })
      : null;

  const sorted = [...albums].sort((a, b) => {
    const titleA = (a?.title || '未命名相册').trim();
    const titleB = (b?.title || '未命名相册').trim();
    return collator ? collator.compare(titleA, titleB) : titleA.localeCompare(titleB);
  });

  sorted.forEach((album) => {
    if (!album || album.id == null) return;
    const title = (album.title || '未命名相册').trim() || '未命名相册';
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'nav__dropdown-link';
    link.href = `album.html?id=${encodeURIComponent(album.id)}`;
    link.textContent = title;
    link.setAttribute('role', 'menuitem');
    item.appendChild(link);
    list.appendChild(item);
  });

  dropdownItem?.classList.add('is-ready');
}

function renderImages(albumGroups, unassignedImages) {
  if (!galleryGrid) return;
  galleryGrid.innerHTML = '';
  lightboxController.unbind();

  const sortByNewest = (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const normalizedAlbums = (albumGroups ?? [])
    .map((group) => ({
      ...group,
      images: [...(group.images ?? [])].filter(Boolean).sort(sortByNewest),
    }))
    .filter((group) => group.images.length);

  const singles = [...(unassignedImages ?? [])]
    .filter(Boolean)
    .sort(sortByNewest);

  if (!normalizedAlbums.length && !singles.length) {
    galleryGrid.appendChild(createEmptyMessage());
    return;
  }

  if (normalizedAlbums.length) {
    const viewport = document.createElement('div');
    viewport.className = 'gallery-slider__viewport';

    const track = document.createElement('div');
    track.className = 'gallery-slider__track';

    const createSlide = (group) => {
      const cover = group.images[0];
      const link = document.createElement('a');
      link.className = 'gallery-slider__item';
      link.href = `album.html?id=${encodeURIComponent(group.id)}`;
      link.setAttribute('aria-label', `查看专辑「${group.title || '未命名专辑'}」`);
      link.dataset.albumId = String(group.id);

      const image = document.createElement('img');
      image.className = 'gallery-slider__image';
      image.src = cover.url;
      image.alt = cover.title || group.title || '作品图像';
      image.loading = 'lazy';

      const label = document.createElement('span');
      label.className = 'gallery-slider__label';
      label.textContent = group.title || cover.title || '未命名专辑';

      link.appendChild(image);
      link.appendChild(label);

      return link;
    };

    normalizedAlbums.forEach((group) => {
      track.appendChild(createSlide(group));
    });

    if (normalizedAlbums.length > 1) {
      normalizedAlbums.forEach((group) => {
        const clone = createSlide(group);
        clone.classList.add('is-duplicate');
        clone.setAttribute('aria-hidden', 'true');
        clone.tabIndex = -1;
        track.appendChild(clone);
      });

      track.classList.add('is-animated');
      const durationSeconds = Math.max(18, normalizedAlbums.length * 6);
      track.style.setProperty('--gallery-scroll-duration', `${durationSeconds}s`);
    }

    viewport.appendChild(track);
    galleryGrid.appendChild(viewport);
  }

  if (singles.length) {
    const singlesContainer = document.createElement('div');
    singlesContainer.className = 'gallery-slider__singles';

    singles.forEach((item) => {
      const link = document.createElement('a');
      link.className = 'gallery-link gallery-slider__single';
      link.href = item.url;
      link.dataset.full = item.url;
      link.dataset.caption = item.description || item.title || '未命名作品';

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.title || item.description || '未命名作品';
      img.loading = 'lazy';

      link.appendChild(img);
      singlesContainer.appendChild(link);
    });

    galleryGrid.appendChild(singlesContainer);
    lightboxController.bind(singlesContainer.querySelectorAll('.gallery-link'));
  }
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
    article.className = 'video-highlight';

    const glow = document.createElement('div');
    glow.className = 'video-highlight__glow';

    const frame = document.createElement('div');
    frame.className = 'video-highlight__frame';

    const inner = document.createElement('div');
    inner.className = 'video-highlight__inner';
    inner.dataset.title = item.title || '';

    const videoEl = document.createElement('video');
    videoEl.className = 'video-highlight__video';
    videoEl.controls = true;
    videoEl.preload = 'metadata';
    videoEl.playsInline = true;

    const source = document.createElement('source');
    const resolvedSrc = resolveVideoSource(item);
    source.src = resolvedSrc || item.url || '';
    source.type = resolveVideoMime(item) || inferVideoMime(resolvedSrc || item.url || '');
    videoEl.appendChild(source);

    const fallback = document.createElement('span');
    fallback.textContent = '您的浏览器不支持视频播放。';
    videoEl.appendChild(fallback);
    inner.appendChild(videoEl);
    frame.appendChild(inner);

    if (item.title) {
      const titleOverlay = document.createElement('div');
      titleOverlay.className = 'video-highlight__title';

      const titleText = document.createElement('span');
      titleText.textContent = item.title;
      titleOverlay.appendChild(titleText);

      frame.appendChild(titleOverlay);
    }

    article.appendChild(glow);
    article.appendChild(frame);
    fragment.appendChild(article);
  });

  videoGrid.appendChild(fragment);
  document.dispatchEvent(new CustomEvent('videos:updated'));
}

function updateHeroVideo(media) {
  if (!heroVideoEl) return;
  ensureHeroVideoBindings();

  const nextSrc = resolveVideoSource(media) || (heroVideoFallback ? heroVideoFallback.src : '') || '';
  const nextType =
    resolveVideoMime(media) || (media && media.url ? inferVideoMime(media.url) : heroVideoFallback?.type || '');
  const nextPoster =
    resolvePoster(media) || (heroVideoFallback ? heroVideoFallback.poster : '') || heroVideoEl.getAttribute('poster') || '';
  const nextId = media && media.id ? String(media.id) : 'fallback';

  if (!nextSrc) {
    clearHeroVideoSource();
    heroVideoRetryState.src = '';
    heroVideoRetryState.attempts = 0;
    heroVideoRetryState.lastError = null;
    heroVideoEl.pause();
    heroVideoEl.dataset.mediaId = 'fallback';
    if (heroVideoFallback?.poster) {
      heroVideoEl.setAttribute('poster', heroVideoFallback.poster);
    }
    debugHero('no-source-fallback', { nextId, fallbackPoster: heroVideoFallback?.poster });
    return;
  }

  const currentSrc = heroVideoSourceEl
    ? heroVideoSourceEl.getAttribute('src') || ''
    : heroVideoEl.getAttribute('src') || '';
  if (currentSrc === nextSrc && heroVideoEl.dataset.mediaId === nextId) {
    heroVideoRetryState.src = nextSrc;
    heroVideoRetryState.attempts = 0;
    if (heroVideoEl.readyState < 2) {
      heroVideoEl.load();
    }
    scheduleHeroAutoplay(true);
    debugHero('reuse-source', { nextId, src: nextSrc });
    return;
  }

  heroVideoRetryState.src = nextSrc;
  heroVideoRetryState.attempts = 0;
  heroVideoRetryState.lastError = null;
  heroVideoRetryState.isPlaying = false;
  heroVideoRetryState.awaitingReady = false;

  heroVideoEl.dataset.mediaId = nextId;
  prepareHeroVideoElement();
  debugHero('update-source', { nextId, src: nextSrc, type: nextType });
  if (heroVideoSourceEl) {
    heroVideoSourceEl.setAttribute('src', nextSrc);
    if (nextType) {
      heroVideoSourceEl.setAttribute('type', nextType);
    } else {
      heroVideoSourceEl.removeAttribute('type');
    }
    heroVideoEl.removeAttribute('src');
  } else {
    heroVideoEl.setAttribute('src', nextSrc);
    if (nextType) {
      heroVideoEl.setAttribute('type', nextType);
    } else {
      heroVideoEl.removeAttribute('type');
    }
  }

  if (nextPoster) {
    heroVideoEl.setAttribute('poster', nextPoster);
  } else if (heroVideoFallback?.poster) {
    heroVideoEl.setAttribute('poster', heroVideoFallback.poster);
  } else {
    heroVideoEl.removeAttribute('poster');
  }

  heroVideoEl.load();
  heroVideoEl.currentTime = 0;

  requestAnimationFrame(() => {
    scheduleHeroAutoplay(true);
  });
  markHeroElement();
}

function ensureHeroVideoBindings() {
  if (!heroVideoEl || heroVideoListenersBound) return;

  const markReady = () => {
    heroVideoEl.classList.add('is-ready');
    heroVideoRetryState.attempts = 0;
    heroVideoRetryState.lastError = null;
    debugHero('ready');
  };

  const handleRecoverableIssue = () => {
    scheduleHeroRetry('recoverable');
  };

  heroVideoEl.addEventListener('loadedmetadata', () => {
    markReady();
    scheduleHeroAutoplay();
    debugHero('loadedmetadata');
  });
  heroVideoEl.addEventListener('canplay', () => {
    scheduleHeroAutoplay();
    debugHero('canplay');
  });
  heroVideoEl.addEventListener('play', () => {
    markReady();
    heroVideoRetryState.isPlaying = true;
    heroVideoRetryState.awaitingReady = false;
    if (heroVideoRetryState.retryTimer) {
      clearTimeout(heroVideoRetryState.retryTimer);
      heroVideoRetryState.retryTimer = null;
    }
    debugHero('play');
  });
  heroVideoEl.addEventListener('playing', () => {
    heroVideoRetryState.isPlaying = true;
    debugHero('playing');
  });
  heroVideoEl.addEventListener('pause', () => {
    heroVideoRetryState.isPlaying = false;
    debugHero('pause');
  });
  heroVideoEl.addEventListener('stalled', handleRecoverableIssue);
  heroVideoEl.addEventListener('suspend', handleRecoverableIssue);
  heroVideoEl.addEventListener('waiting', handleRecoverableIssue);
  heroVideoEl.addEventListener('abort', handleRecoverableIssue);
  heroVideoEl.addEventListener('error', (event) => {
    heroVideoRetryState.lastError = event?.target?.error || event?.detail || new Error('hero video error');
    scheduleHeroRetry('error');
    debugHero('error', { error: heroVideoRetryState.lastError });
  });

  heroVideoListenersBound = true;
  markHeroElement();
}

function prepareHeroVideoElement() {
  if (!heroVideoEl) return;
  heroVideoEl.defaultMuted = true;
  heroVideoEl.muted = true;
  heroVideoEl.autoplay = true;
  heroVideoEl.loop = true;
  heroVideoEl.playsInline = true;
  heroVideoEl.preload = 'auto';
  heroVideoEl.controls = false;
  heroVideoEl.disablePictureInPicture = true;
  heroVideoEl.crossOrigin = 'anonymous';
  heroVideoEl.setAttribute('crossorigin', 'anonymous');
  heroVideoEl.setAttribute('muted', '');
  heroVideoEl.setAttribute('autoplay', '');
  heroVideoEl.setAttribute('loop', '');
  heroVideoEl.setAttribute('preload', 'auto');
  heroVideoEl.setAttribute('playsinline', '');
  heroVideoEl.setAttribute('webkit-playsinline', '');
  heroVideoEl.setAttribute('x5-playsinline', '');
  heroVideoEl.setAttribute(
    'controlslist',
    'nodownload noplaybackrate noremoteplayback nofullscreen'
  );
  heroVideoEl.removeAttribute('controls');
}

function attemptHeroPlayback(resetTime = false) {
  if (!heroVideoEl) return;
  if (heroVideoEl.readyState < 2) {
    scheduleHeroAutoplay(resetTime);
    return;
  }
  if (heroVideoRetryState.isPlaying) return;
  prepareHeroVideoElement();
  if (resetTime) {
    try {
      heroVideoEl.currentTime = 0;
    } catch (error) {
      heroVideoRetryState.lastError = error;
      debugHero('reset-current-time-error', { error });
    }
  }
  try {
    const playPromise = heroVideoEl.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch((error) => {
        heroVideoRetryState.lastError = error;
        debugHero('play-rejection', { error });
      });
    }
    return playPromise;
  } catch (error) {
    heroVideoRetryState.lastError = error;
    debugHero('play-throw', { error });
    return null;
  }
}

function scheduleHeroRetry(reason) {
  if (!heroVideoEl) return;

  if (!heroVideoRetryState.src) {
    if (reason === 'error' && heroVideoFallback?.src && heroVideoEl.dataset.mediaId !== 'fallback') {
      console.warn('Hero video fallback triggered without source context', heroVideoRetryState.lastError);
      updateHeroVideo(null);
    }
    return;
  }

  if (heroVideoRetryState.attempts < heroVideoRetryState.maxAttempts - (reason === 'recoverable' ? 1 : 0)) {
    heroVideoRetryState.attempts += 1;
    if (heroVideoRetryState.retryTimer) {
      clearTimeout(heroVideoRetryState.retryTimer);
    }
    const delay = reason === 'error' ? 320 : 200;
    heroVideoRetryState.retryTimer = setTimeout(() => {
      heroVideoRetryState.retryTimer = null;
      if (heroVideoRetryState.isPlaying) return;
      heroVideoEl.pause();
      heroVideoEl.load();
      heroVideoRetryState.isPlaying = false;
      requestAnimationFrame(() => {
        scheduleHeroAutoplay(true);
      });
    }, delay);
    return;
  }

  if (reason === 'error' && heroVideoFallback?.src && heroVideoEl.dataset.mediaId !== 'fallback') {
    console.warn('Hero video fallback triggered after retry', heroVideoRetryState.lastError);
    heroVideoRetryState.src = '';
    updateHeroVideo(null);
  }
}

function clearHeroVideoSource() {
  if (heroVideoSourceEl) {
    heroVideoSourceEl.removeAttribute('src');
    heroVideoSourceEl.removeAttribute('type');
  }
  heroVideoEl.removeAttribute('src');
  heroVideoEl.removeAttribute('type');
}

function scheduleHeroAutoplay(resetTime = false) {
  if (!heroVideoEl) return;
  if (heroVideoEl.readyState >= 2) {
    attemptHeroPlayback(resetTime);
    return;
  }
  if (heroVideoRetryState.awaitingReady) return;
  heroVideoRetryState.awaitingReady = true;
  debugHero('awaiting-ready', { resetTime });

  const onReady = () => {
    heroVideoRetryState.awaitingReady = false;
    heroVideoEl.removeEventListener('canplay', onReady);
    heroVideoEl.removeEventListener('loadeddata', onReady);
    attemptHeroPlayback(resetTime);
    debugHero('ready-listener-fired');
  };

  heroVideoEl.addEventListener('canplay', onReady, { once: true });
  heroVideoEl.addEventListener('loadeddata', onReady, { once: true });
}

function getMediaPriorityTimestamp(media) {
  if (!media) return Number.NEGATIVE_INFINITY;
  return new Date(
    media.updated_at ||
      media.updatedAt ||
      media.modified_at ||
      media.modifiedAt ||
      media.created_at ||
      media.createdAt ||
      0
  ).getTime();
}

function resolvePoster(media) {
  if (!media) return '';
  return media.poster_url || media.poster || media.thumbnail_url || media.preview_url || '';
}

function resolveVideoMime(media) {
  if (!media) return '';
  if (media.mime_type) return media.mime_type;
  if (media.content_type) return media.content_type;
  if (media.type && media.type.includes('/')) return media.type;
  if (media.url) return inferVideoMime(media.url);
  return '';
}

function resolveVideoSource(media) {
  if (!media) return '';
  const candidates = [
    media.streaming_url,
    media.stream_url,
    media.playback_url,
    media.hls_url,
    media.embed_url,
    media.public_url,
    media.publicUrl,
    media.url,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  if (Array.isArray(media.sources)) {
    const found = media.sources.find((source) => source && typeof source.url === 'string' && source.url.trim());
    if (found) {
      return found.url.trim();
    }
  }
  return '';
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

