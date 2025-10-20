import { supabase } from './app.js';

const BUCKET_ID = 'media';
const MEDIA_TABLE = 'media_items';

const uploadButton = document.querySelector('[data-upload-button]');
const uploadInput = document.querySelector('[data-upload-input]');
const albumPickerEl = document.querySelector('[data-album-picker]');
const albumStatsEl = document.querySelector('[data-album-stats]');
const albumSummaryEl = document.querySelector('[data-selected-albums]');
const clearAlbumsButton = document.querySelector('[data-clear-albums]');
const createAlbumForm = document.querySelector('[data-create-album-form]');
const albumTitleInput = document.querySelector('[data-album-title]');
const albumDescriptionInput = document.querySelector('[data-album-description]');
const libraryContainer = document.querySelector('[data-album-library]');
const libraryEmptyEl = document.querySelector('[data-library-empty]');
const libraryCountEl = document.querySelector('[data-library-count]');
const uploadProgressContainer = document.querySelector('[data-upload-progress]');
const uploadProgressLabel = document.querySelector('[data-upload-progress-label]');
const uploadProgressPercent = document.querySelector('[data-upload-progress-percent]');
const uploadProgressBar = document.querySelector('[data-upload-progress-bar]');
const storageOverviewEl = document.querySelector('[data-storage-overview]');
const storageTotalEl = document.querySelector('[data-storage-total-size]');
const storageSelectedSizeEl = document.querySelector('[data-storage-selected-size]');
const storageSelectedCountEl = document.querySelector('[data-storage-selected-count]');
const storageLatestSizeEl = document.querySelector('[data-storage-latest-size]');
const storageLatestNameEl = document.querySelector('[data-storage-latest-name]');

const STORAGE_PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET_ID}/`;

if (!libraryContainer) {
  console.warn('资源库容器未找到，拖拽排序功能将不可用。');
}

const mediaState = {
  items: [],
  isUploading: false,
  isFetching: false,
  map: new Map(),
};

const albumState = {
  items: [],
  selected: new Set(),
  isCreating: false,
  isFetching: false,
};

const albumItemsState = {
  byAlbum: new Map(),
  byMedia: new Map(),
};

const libraryUiState = {
  expanded: new Set(),
};

const uploadProgressState = {
  totalFiles: 0,
  currentFileIndex: 0,
  currentFileName: '',
  currentLoaded: 0,
  currentTotal: 0,
};

let dragContext = null;

function ensureToastContainer() {
  let container = document.querySelector('[data-toast-container]');
  if (!container) {
    container = document.createElement('div');
    container.dataset.toastContainer = 'true';
    container.className =
      'fixed right-6 top-6 z-50 flex max-w-sm flex-col gap-3 text-sm text-white';
    document.body.appendChild(container);
  }
  return container;
}

function showMessage(message, variant = 'info', duration = 4000) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  const variantClasses =
    variant === 'success'
      ? 'border-emerald-400/50 bg-emerald-500/90 text-emerald-50'
      : variant === 'error'
        ? 'border-rose-400/60 bg-rose-500/90 text-rose-50'
        : 'border-white/20 bg-white/10 text-white';

  toast.className = `flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur ${variantClasses}`;
  toast.innerHTML = `
    <span class="flex-1 leading-relaxed">${message}</span>
    <button type="button" class="text-white/70 transition hover:text-white" aria-label="关闭">×</button>
  `;

  const closeButton = toast.querySelector('button');
  closeButton.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.remove();
    }, duration);
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function getMediaSize(media) {
  if (!media) return 0;
  const rawValue =
    typeof media.size_bytes !== 'undefined'
      ? media.size_bytes
      : typeof media.sizeBytes !== 'undefined'
        ? media.sizeBytes
        : typeof media.bytes !== 'undefined'
          ? media.bytes
          : 0;
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return numeric;
}

function renderAlbumStats() {
  if (!albumStatsEl) return;
  if (!albumState.items.length) {
    albumStatsEl.innerHTML = '<li>尚未创建任何相册。</li>';
    return;
  }

  albumStatsEl.innerHTML = albumState.items
    .map((album) => {
      const entries = getAlbumEntries(album.id);
      const hasLocalEntries = entries.length > 0;
      const fallbackCount = album.item_count ?? 0;
      const itemCount = hasLocalEntries ? entries.length : fallbackCount;

      let sizeBytes = 0;
      if (hasLocalEntries) {
        sizeBytes = entries.reduce((sum, entry) => {
          const media = mediaState.map.get(entry.mediaId);
          return sum + getMediaSize(media);
        }, 0);
      } else if (itemCount > 0) {
        const fallbackSize = Number(album.total_size_bytes);
        if (Number.isFinite(fallbackSize) && fallbackSize > 0) {
          sizeBytes = fallbackSize;
        } else {
          sizeBytes = null;
        }
      }

      const sizeLabel = sizeBytes === null ? '—' : formatBytes(sizeBytes);

      return `
      <li class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <div class="min-w-0 flex-1 truncate">
          <span class="font-medium text-white/80">${album.title}</span>
          ${album.description ? `<span class="ml-2 truncate text-white/40">${album.description}</span>` : ''}
        </div>
        <span class="rounded-full bg-white/10 px-3 py-0.5 text-[11px] text-white/60 leading-tight">
          <span>${itemCount} 项</span>
          <span class="ml-2 text-white/40">${sizeLabel}</span>
        </span>
      </li>
    `;
    })
    .join('');
}

function updateAlbumSelectionSummary() {
  if (!albumSummaryEl) {
    updateStorageOverview();
    return;
  }

  if (!albumState.selected.size) {
    albumSummaryEl.textContent = '当前未选择相册';
    updateStorageOverview();
    return;
  }

  const selectedAlbums = albumState.items.filter((album) => albumState.selected.has(album.id));
  const summary = selectedAlbums.map((album) => album.title).join(' / ');
  albumSummaryEl.textContent = `已选相册：${summary}`;
  updateStorageOverview();
}

function renderAlbumPicker() {
  if (!albumPickerEl) return;

  if (!albumState.items.length) {
    albumPickerEl.innerHTML =
      '<p class="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-white/50">暂无相册，请先创建。</p>';
    albumSummaryEl && (albumSummaryEl.textContent = '当前未选择相册');
    return;
  }

  albumPickerEl.innerHTML = '';
  albumState.items.forEach((album) => {
    const button = document.createElement('button');
    const isSelected = albumState.selected.has(album.id);
    button.type = 'button';
    button.dataset.albumId = album.id;
    button.dataset.albumTitle = album.title;
    button.className = [
      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition',
      isSelected
        ? 'border-accent-500/70 bg-accent-600/80 text-white shadow-lg shadow-accent-600/30'
        : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:text-white',
    ].join(' ');
    button.innerHTML = `
      <span class="truncate max-w-[10rem]">${album.title}</span>
      <span class="rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white/60">${album.item_count ?? 0}</span>
    `;

    button.addEventListener('click', () => {
      if (albumState.selected.has(album.id)) {
        albumState.selected.delete(album.id);
      } else {
        albumState.selected.add(album.id);
      }
      renderAlbumPicker();
      updateAlbumSelectionSummary();
    });

    albumPickerEl.appendChild(button);
  });

  updateAlbumSelectionSummary();
}

function clearAlbumSelection() {
  albumState.selected.clear();
  renderAlbumPicker();
  updateAlbumSelectionSummary();
}

function getSelectedAlbumIds() {
  return Array.from(albumState.selected);
}

function extractStoragePath(publicUrl) {
  const marker = STORAGE_PUBLIC_PREFIX;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}

async function refreshAlbums({ preserveSelection = true } = {}) {
  if (albumState.isFetching) return;
  albumState.isFetching = true;
  try {
    const { data, error } = await supabase
      .from('albums_with_stats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const previousSelection = new Set(albumState.selected);
    albumState.items = data ?? [];

    if (preserveSelection) {
      albumState.selected = new Set(
        albumState.items.filter((album) => previousSelection.has(album.id)).map((album) => album.id)
      );
    } else {
      albumState.selected.clear();
    }

    renderAlbumPicker();
    renderAlbumStats();
    renderAlbumLibrary();
  } catch (error) {
    console.error('获取相册列表失败', error);
    showMessage(`获取相册列表失败：${error.message ?? error}`, 'error', 6000);
  } finally {
    albumState.isFetching = false;
  }
}

function getAlbumKey(albumId) {
  return albumId ?? '__unassigned__';
}

function getAlbumEntries(albumId) {
  return albumItemsState.byAlbum.get(albumId) ?? [];
}

function calculateAlbumSize(albumId) {
  const entries = getAlbumEntries(albumId);
  return entries.reduce((sum, entry) => {
    const media = mediaState.map.get(entry.mediaId);
    return sum + getMediaSize(media);
  }, 0);
}

function calculateSelectedAlbumsSize() {
  if (!albumState.selected.size) {
    return 0;
  }
  let total = 0;
  albumState.selected.forEach((albumId) => {
    total += calculateAlbumSize(albumId);
  });
  return total;
}

function getLatestMediaItem() {
  if (!mediaState.items.length) {
    return null;
  }
  return mediaState.items[0];
}

function updateStorageOverview() {
  if (!storageOverviewEl) return;

  const totalBytes = mediaState.items.reduce((sum, item) => sum + getMediaSize(item), 0);
  const selectedBytes = calculateSelectedAlbumsSize();
  const latestMedia = getLatestMediaItem();

  const shouldShow = totalBytes > 0 || albumState.selected.size > 0 || Boolean(latestMedia);
  storageOverviewEl.hidden = !shouldShow;
  if (!shouldShow) {
    return;
  }

  if (storageTotalEl) {
    storageTotalEl.textContent = formatBytes(totalBytes);
  }

  if (storageSelectedSizeEl) {
    storageSelectedSizeEl.textContent = formatBytes(selectedBytes);
  }

  if (storageSelectedCountEl) {
    storageSelectedCountEl.textContent = albumState.selected.size
      ? `已选 ${albumState.selected.size} 个相册`
      : '当前未选择相册';
  }

  if (storageLatestSizeEl) {
    storageLatestSizeEl.textContent = formatBytes(getMediaSize(latestMedia));
  }

  if (storageLatestNameEl) {
    storageLatestNameEl.textContent = latestMedia
      ? latestMedia.title || latestMedia.url || '最新媒体'
      : '尚未上传文件';
  }
}

function renderFeaturedIcon(isFeatured) {
  if (isFeatured) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path
          d="M12 3.5l2.29 4.64 5.12.75-3.7 3.6.87 5.07L12 14.77l-4.58 2.39.87-5.07-3.7-3.6 5.12-.75L12 3.5z"
        />
      </svg>
    `;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5">
      <path
        d="M12 3.5l2.29 4.64 5.12.75-3.7 3.6.87 5.07L12 14.77l-4.58 2.39.87-5.07-3.7-3.6 5.12-.75L12 3.5z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
  `;
}

function updateFeaturedButtonAppearance(button, isFeatured) {
  if (!button) return;
  button.innerHTML = renderFeaturedIcon(isFeatured);
  button.dataset.featuredState = isFeatured ? 'true' : 'false';
  button.setAttribute('aria-pressed', String(Boolean(isFeatured)));
  button.setAttribute('aria-label', isFeatured ? '取消精选' : '设为精选');
  button.title = isFeatured ? '取消精选' : '设为精选';
}

function updateLibraryIndicators() {
  if (libraryCountEl) {
    libraryCountEl.textContent = String(mediaState.items.length);
  }

  if (libraryEmptyEl) {
    libraryEmptyEl.hidden = mediaState.items.length > 0;
  }
}

function renderAlbumLibrary() {
  if (!libraryContainer) {
    updateStorageOverview();
    return;
  }

  updateLibraryIndicators();
  libraryContainer.innerHTML = '';

  const fragment = document.createDocumentFragment();
  const shouldAutoExpand = libraryUiState.expanded.size === 0;

  albumState.items.forEach((album, index) => {
    const entries = albumItemsState.byAlbum.get(album.id) ?? [];
    const items = entries
      .map((entry) => {
        const media = mediaState.map.get(entry.mediaId);
        if (!media) return null;
        return {
          media,
          assignment: {
            albumId: album.id,
            position: entry.position,
            createdAt: entry.created_at,
          },
        };
      })
      .filter(Boolean);

    const albumSize = items.reduce((sum, entry) => sum + getMediaSize(entry.media), 0);
    const panel = createAlbumPanel(album, items, {
      autoOpen: shouldAutoExpand && index === 0,
      totalSize: albumSize,
    });
    fragment.appendChild(panel);
  });

  const unassignedItems = mediaState.items
    .filter((item) => !albumItemsState.byMedia.has(item.id))
    .map((media) => ({
      media,
      assignment: { albumId: null, position: null, createdAt: media.created_at },
    }));

  const unassignedSize = unassignedItems.reduce((sum, entry) => sum + getMediaSize(entry.media), 0);
  const unassignedPanel = createAlbumPanel(
    { id: null, title: '未分类', description: '' },
    unassignedItems,
    {
      isUnassigned: true,
      autoOpen: shouldAutoExpand && !albumState.items.length,
      totalSize: unassignedSize,
    }
  );
  fragment.appendChild(unassignedPanel);

  libraryContainer.appendChild(fragment);
  updateStorageOverview();
}

function createAlbumPanel(album, entries, options = {}) {
  const { isUnassigned = false, autoOpen = false, totalSize = 0 } = options;
  const albumId = album.id ?? null;
  const key = getAlbumKey(albumId);

  const details = document.createElement('details');
  details.className = 'group rounded-2xl border border-white/10 bg-black/30 backdrop-blur';
  details.dataset.albumPanel = key;
  if (libraryUiState.expanded.has(key) || autoOpen) {
    details.open = true;
  }

  details.addEventListener('toggle', () => {
    if (details.open) {
      libraryUiState.expanded.add(key);
    } else {
      libraryUiState.expanded.delete(key);
    }
  });

  const summary = document.createElement('summary');
  summary.className =
    'flex cursor-pointer select-none items-center justify-between gap-4 rounded-2xl px-4 py-3 text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60';

  const header = document.createElement('div');
  header.className = 'min-w-0 flex-1';

  const titleEl = document.createElement('p');
  titleEl.className = 'truncate text-base font-semibold text-white';
  titleEl.textContent = album.title || '未命名相册';
  header.appendChild(titleEl);

  if (album.description && !isUnassigned) {
    const desc = document.createElement('p');
    desc.className = 'mt-1 line-clamp-2 text-xs text-white/50';
    desc.textContent = album.description;
    header.appendChild(desc);
  }

  summary.appendChild(header);

  const summaryActions = document.createElement('div');
  summaryActions.className = 'flex shrink-0 items-center gap-2';

  const countBadge = document.createElement('span');
  countBadge.className =
    'flex flex-col items-end rounded-full bg-white/10 px-3 py-1 text-xs text-white/60 leading-tight';
  const countLabel = document.createElement('span');
  countLabel.textContent = `${entries.length} 项`;
  countBadge.appendChild(countLabel);
  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'text-[10px] text-white/40';
  sizeLabel.textContent = formatBytes(totalSize);
  countBadge.appendChild(sizeLabel);
  summaryActions.appendChild(countBadge);

  if (!isUnassigned) {
    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.dataset.renameAlbum = albumId;
    renameButton.className =
      'rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 transition hover:border-white/60 hover:text-white';
    renameButton.textContent = '重命名';
    renameButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      promptRenameAlbum(albumId, album.title);
    });
    summaryActions.appendChild(renameButton);
  }

  const indicator = document.createElement('span');
  indicator.className =
    'ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-white/60 transition group-open:rotate-90';
  indicator.innerHTML = '&#9656;';
  summaryActions.appendChild(indicator);

  summary.appendChild(summaryActions);
  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'px-4 pb-4';

  const list = document.createElement('ul');
  list.className = 'flex flex-col gap-3 pt-3';
  list.dataset.albumDropzone = 'true';
  list.dataset.albumId = albumId ?? '';
  list.dataset.allowReorder = isUnassigned ? 'false' : 'true';

  if (!entries.length) {
    const empty = document.createElement('li');
    empty.dataset.placeholder = 'true';
    empty.className =
      'rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-4 text-center text-xs text-white/50';
    empty.textContent = isUnassigned
      ? '未分类资源会出现在此处，拖动资源到相册即可完成归类。'
      : '相册暂无资源，拖拽媒体到此处即可添加。';
    list.appendChild(empty);
  } else {
    entries.forEach((entry) => {
      const itemElement = createMediaItemElement(entry.media, { albumId });
      list.appendChild(itemElement);
    });
  }

  content.appendChild(list);
  details.appendChild(content);

  return details;
}

function createMediaItemElement(media, context) {
  const item = document.createElement('li');
  item.dataset.mediaItem = media.id;
  item.dataset.albumId = context.albumId ?? '';
  item.dataset.mediaType = media.type;
  item.draggable = true;
  const itemClasses = [
    'group flex cursor-grab items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 shadow-sm transition hover:border-white/30 hover:bg-white/10 active:cursor-grabbing',
  ];
  if (media.is_featured) {
    itemClasses.push('border-amber-400/60 bg-amber-500/10 text-white');
  }
  item.className = itemClasses.join(' ');
  item.dataset.featured = media.is_featured ? 'true' : 'false';

  const info = document.createElement('div');
  info.className = 'min-w-0 flex-1';

  const titleRow = document.createElement('div');
  titleRow.className = 'flex items-center gap-2';

  const indicator = document.createElement('span');
  indicator.className = `inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
    media.type === 'image' ? 'bg-emerald-400' : 'bg-sky-400'
  }`;
  titleRow.appendChild(indicator);

  const title = document.createElement('p');
  title.className = 'truncate text-sm font-medium text-white';
  title.textContent = media.title || media.url;
  titleRow.appendChild(title);

  info.appendChild(titleRow);

  const meta = document.createElement('p');
  meta.className = 'mt-1 text-[11px] uppercase tracking-widest text-white/40';
  const createdLabel = media.created_at ? formatDate(media.created_at) : '未知时间';
  const sizeLabel = formatBytes(getMediaSize(media));
  meta.textContent = `${media.type} · ${media.uploader_email ?? '未知'} · ${createdLabel} · ${sizeLabel}`;
  info.appendChild(meta);

  const tags = document.createElement('div');
  tags.className = 'mt-2 flex flex-wrap gap-1';
  const sizeBadge = document.createElement('span');
  sizeBadge.className = 'rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60';
  sizeBadge.textContent = sizeLabel;
  tags.appendChild(sizeBadge);
  if (media.albumNames?.length) {
    media.albumNames.forEach((name) => {
      const badge = document.createElement('span');
      badge.className = 'rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60';
      badge.textContent = `#${name}`;
      tags.appendChild(badge);
    });
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'text-[11px] text-white/40';
    placeholder.textContent = '未分类';
    tags.appendChild(placeholder);
  }
  info.appendChild(tags);

  item.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'flex shrink-0 flex-wrap items-center justify-end gap-2';

  const featureButton = document.createElement('button');
  featureButton.type = 'button';
  featureButton.dataset.toggleFeatured = media.id;
  featureButton.className =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-amber-400/60 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60';
  updateFeaturedButtonAppearance(featureButton, Boolean(media.is_featured));
  actions.appendChild(featureButton);

  const preview = document.createElement('a');
  preview.href = media.url;
  preview.target = '_blank';
  preview.rel = 'noopener';
  preview.className =
    'rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/60 hover:text-white';
  preview.textContent = '预览';
  actions.appendChild(preview);

  const renameButton = document.createElement('button');
  renameButton.type = 'button';
  renameButton.dataset.renameMedia = media.id;
  renameButton.className =
    'rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/60 hover:text-white';
  renameButton.textContent = '重命名';
  actions.appendChild(renameButton);

  const assignButton = document.createElement('button');
  assignButton.type = 'button';
  assignButton.dataset.manageAlbums = media.id;
  assignButton.className =
    'rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/60 hover:text-white';
  assignButton.textContent = '相册';
  actions.appendChild(assignButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.dataset.deleteMedia = media.id;
  deleteButton.className =
    'rounded-full border border-rose-400/30 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:bg-rose-400/20 hover:text-white';
  deleteButton.textContent = '删除';
  actions.appendChild(deleteButton);

  item.appendChild(actions);

  return item;
}

async function promptRenameAlbum(albumId, currentTitle = '') {
  if (!albumId) return;
  const nextTitle = window.prompt('请输入新的相册名称：', currentTitle || '');
  if (nextTitle === null) return;
  const trimmed = nextTitle.trim();
  if (!trimmed) {
    showMessage('相册名称不能为空。', 'error');
    return;
  }

  if (trimmed === currentTitle) {
    showMessage('相册名称未发生变化。', 'info', 3000);
    return;
  }

  try {
    const { error } = await supabase.from('albums').update({ title: trimmed }).eq('id', albumId);
    if (error) throw error;
    showMessage('相册名称已更新。', 'success');
    await refreshAlbums({ preserveSelection: true });
    await refreshMediaItems();
  } catch (error) {
    console.error('重命名相册失败', error);
    showMessage(`重命名相册失败：${error.message ?? error}`, 'error', 6000);
  }
}

async function promptRenameMedia(mediaId, currentTitle = '') {
  if (!mediaId) return;
  const nextTitle = window.prompt('请输入新的资源名称：', currentTitle || '');
  if (nextTitle === null) return;
  const trimmed = nextTitle.trim();
  if (!trimmed) {
    showMessage('资源名称不能为空。', 'error');
    return;
  }

  if (trimmed === currentTitle) {
    showMessage('资源名称未发生变化。', 'info', 3000);
    return;
  }

  try {
    const { error } = await supabase.from(MEDIA_TABLE).update({ title: trimmed }).eq('id', mediaId);
    if (error) throw error;
    showMessage('资源名称已更新。', 'success');
    await refreshMediaItems();
  } catch (error) {
    console.error('重命名资源失败', error);
    showMessage(`重命名资源失败：${error.message ?? error}`, 'error', 6000);
  }
}

function getMediaById(mediaId) {
  if (!mediaId) return null;
  return mediaState.map.get(mediaId) ?? mediaState.items.find((item) => item.id === mediaId) ?? null;
}

async function toggleMediaFeatured(mediaId) {
  const targetItem = getMediaById(mediaId);
  if (!targetItem) {
    showMessage('未找到对应的媒体记录。', 'error');
    return;
  }

  const nextState = !targetItem.is_featured;

  try {
    const { error } = await supabase.from(MEDIA_TABLE).update({ is_featured: nextState }).eq('id', mediaId);
    if (error) throw error;

    showMessage(nextState ? '已设为素材精选。' : '已取消素材精选。', 'success');
    await refreshMediaItems();
  } catch (error) {
    console.error('更新素材精选状态失败', error);
    showMessage(`更新精选状态失败：${error.message ?? error}`, 'error', 6000);
  }
}

function handleLibraryClick(event) {
  const featureButton = event.target.closest('[data-toggle-featured]');
  if (featureButton) {
    const mediaId = featureButton.dataset.toggleFeatured;
    if (mediaId) {
      toggleMediaFeatured(mediaId);
    }
    return;
  }

  const deleteButton = event.target.closest('[data-delete-media]');
  if (deleteButton) {
    const mediaId = deleteButton.dataset.deleteMedia;
    const targetItem = getMediaById(mediaId);
    if (!targetItem) {
      showMessage('未找到对应的媒体记录。', 'error');
      return;
    }

    const confirmed = window.confirm(`确定要删除「${targetItem.title ?? targetItem.url}」吗？操作不可撤销。`);
    if (!confirmed) return;

    deleteMediaItem(targetItem);
    return;
  }

  const renameButton = event.target.closest('[data-rename-media]');
  if (renameButton) {
    const mediaId = renameButton.dataset.renameMedia;
    const targetItem = getMediaById(mediaId);
    if (!targetItem) {
      showMessage('未找到对应的媒体记录。', 'error');
      return;
    }
    promptRenameMedia(mediaId, targetItem.title ?? '');
    return;
  }

  const manageButton = event.target.closest('[data-manage-albums]');
  if (manageButton) {
    const mediaId = manageButton.dataset.manageAlbums;
    const targetItem = getMediaById(mediaId);
    if (!targetItem) {
      showMessage('未找到对应的媒体记录。', 'error');
      return;
    }
    openAlbumAssignmentDialog(targetItem);
  }
}

function openAlbumAssignmentDialog(media) {
  if (!media) return;

  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-sm text-white backdrop-blur-sm';

  const dialog = document.createElement('div');
  dialog.className = 'w-full max-w-md rounded-3xl border border-white/10 bg-night-800 p-6 shadow-2xl';

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-3';
  const title = document.createElement('h3');
  title.className = 'text-lg font-semibold text-white';
  title.textContent = '管理资源相册';
  header.appendChild(title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className =
    'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/40 hover:text-white';
  closeButton.innerHTML = '&times;';
  header.appendChild(closeButton);

  dialog.appendChild(header);

  const description = document.createElement('p');
  description.className = 'mt-2 text-xs text-white/60';
  description.textContent = '勾选要展示的相册，不选择则资源会归为未分类。';
  dialog.appendChild(description);

  const form = document.createElement('form');
  form.className = 'mt-4 flex flex-col gap-3';

  if (!albumState.items.length) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-center text-white/60';
    emptyNotice.textContent = '当前尚未创建任何相册，请先创建相册后再进行归类。';
    form.appendChild(emptyNotice);
  } else {
    albumState.items.forEach((album) => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'album';
      checkbox.value = album.id;
      checkbox.checked = media.albumIds?.includes(album.id);
      checkbox.className = 'h-4 w-4 rounded border-white/30 bg-transparent text-accent-500 focus:ring-accent-500/60';

      const info = document.createElement('div');
      info.className = 'min-w-0 flex-1';

      const titleText = document.createElement('p');
      titleText.className = 'truncate text-sm text-white';
      titleText.textContent = album.title || '未命名相册';
      info.appendChild(titleText);

      if (album.description) {
        const desc = document.createElement('p');
        desc.className = 'truncate text-xs text-white/50';
        desc.textContent = album.description;
        info.appendChild(desc);
      }

      label.appendChild(checkbox);
      label.appendChild(info);
      form.appendChild(label);
    });
  }

  const actions = document.createElement('div');
  actions.className = 'mt-4 flex items-center justify-end gap-2';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className =
    'rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white';
  cancelButton.textContent = '取消';
  actions.appendChild(cancelButton);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'rounded-full bg-accent-600 px-5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-500 disabled:opacity-60';
  submitButton.textContent = '保存';
  actions.appendChild(submitButton);

  form.appendChild(actions);
  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  closeButton.addEventListener('click', () => {
    close();
  });

  cancelButton.addEventListener('click', () => {
    close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!albumState.items.length) {
      close();
      return;
    }

    const selected = Array.from(form.querySelectorAll('input[name="album"]:checked')).map((input) => input.value);

    try {
      await updateMediaAlbums(media.id, selected);
      showMessage('资源相册已更新。', 'success');
      close();
      await Promise.all([refreshMediaItems(), refreshAlbums({ preserveSelection: true })]);
    } catch (error) {
      console.error('更新资源相册失败', error);
      showMessage(`更新资源相册失败：${error.message ?? error}`, 'error', 6000);
    }
  });
}

async function updateMediaAlbums(mediaId, desiredAlbumIds) {
  const cleanedIds = Array.from(new Set((desiredAlbumIds ?? []).filter(Boolean)));
  const currentEntries = albumItemsState.byMedia.get(mediaId) ?? [];
  const currentIds = currentEntries.map((entry) => entry.album_id);

  const currentSet = new Set(currentIds);
  const desiredSet = new Set(cleanedIds);

  const toRemove = currentIds.filter((id) => !desiredSet.has(id));
  const toAdd = cleanedIds.filter((id) => !currentSet.has(id));

  if (toRemove.length) {
    const { error: deleteError } = await supabase
      .from('album_items')
      .delete()
      .eq('media_item_id', mediaId)
      .in('album_id', toRemove);
    if (deleteError) throw deleteError;
  }

  if (toAdd.length) {
    const rows = toAdd.map((albumId) => ({
      album_id: albumId,
      media_item_id: mediaId,
      position: determineNextPosition(albumId),
    }));
    const { error: insertError } = await supabase.from('album_items').insert(rows);
    if (insertError) throw insertError;
  }
}

function determineNextPosition(albumId) {
  const entries = albumItemsState.byAlbum.get(albumId) ?? [];
  const numericPositions = entries
    .map((entry) => (Number.isFinite(entry.position) ? entry.position : null))
    .filter((value) => value !== null);
  if (numericPositions.length) {
    return Math.max(...numericPositions) + 1;
  }
  return entries.length + 1;
}

function normalizeAlbumId(value) {
  if (!value) return null;
  if (value === '__unassigned__') return null;
  return value;
}

function getDragAfterElement(container, y) {
  const elements = Array.from(container.querySelectorAll('[data-media-item]:not(.is-dragging)'));
  return elements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function clearDropzoneHighlights() {
  document
    .querySelectorAll('[data-album-dropzone]')
    .forEach((zone) => {
      zone.style.outline = '';
      zone.style.outlineOffset = '';
    });
}

function resetUploadProgress() {
  if (uploadProgressLabel) {
    uploadProgressLabel.textContent = '正在上传文件...';
  }
  if (uploadProgressPercent) {
    uploadProgressPercent.textContent = '0%';
  }
  if (uploadProgressBar) {
    uploadProgressBar.style.width = '0%';
  }
  uploadProgressState.currentLoaded = 0;
  uploadProgressState.currentTotal = 0;
  uploadProgressState.currentFileName = '';
  uploadProgressState.currentFileIndex = 0;
}

function setUploadProgressVisibility(visible) {
  if (!uploadProgressContainer) return;
  uploadProgressContainer.hidden = !visible;
}

function startUploadProgress(totalFiles) {
  uploadProgressState.totalFiles = totalFiles;
  resetUploadProgress();
  if (totalFiles > 0) {
    setUploadProgressVisibility(true);
  }
}

function finishUploadProgress() {
  setUploadProgressVisibility(false);
  uploadProgressState.totalFiles = 0;
  resetUploadProgress();
}

function updateUploadProgress(details) {
  if (!uploadProgressContainer) return;

  const {
    fileName = '文件',
    fileIndex = uploadProgressState.currentFileIndex,
    totalFiles = uploadProgressState.totalFiles || 1,
    loaded = 0,
    total = uploadProgressState.currentTotal || 0,
  } = details || {};

  const safeTotal = total > 0 ? total : 1;
  const percent = Math.max(0, Math.min(100, Math.round((loaded / safeTotal) * 100)));

  uploadProgressState.currentFileName = fileName;
  uploadProgressState.currentFileIndex = fileIndex;
  uploadProgressState.currentLoaded = loaded;
  uploadProgressState.currentTotal = total;

  if (uploadProgressLabel) {
    uploadProgressLabel.textContent = `上传中 (${fileIndex}/${totalFiles}) · ${fileName}`;
  }

  if (uploadProgressPercent) {
    uploadProgressPercent.textContent = `${percent}%`;
  }

  if (uploadProgressBar) {
    uploadProgressBar.style.width = `${percent}%`;
  }
}

function handleDragStart(event) {
  const item = event.target.closest('[data-media-item]');
  if (!item) return;
  dragContext = {
    mediaId: item.dataset.mediaItem,
    albumId: normalizeAlbumId(item.dataset.albumId),
  };
  item.classList.add('is-dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.dataset.mediaItem || 'media');
  }
}

function handleDragEnd(event) {
  const item = event.target.closest('[data-media-item]');
  item?.classList.remove('is-dragging');
  dragContext = null;
  clearDropzoneHighlights();
}

function handleDragOver(event) {
  if (!dragContext) return;
  const dropzone = event.target.closest('[data-album-dropzone]');
  if (!dropzone) return;
  event.preventDefault();

  const dragging = libraryContainer?.querySelector('[data-media-item].is-dragging');
  if (!dragging) return;

  dropzone.querySelectorAll('[data-placeholder]').forEach((el) => el.remove());

  const afterElement = getDragAfterElement(dropzone, event.clientY);
  if (!afterElement) {
    dropzone.appendChild(dragging);
  } else {
    dropzone.insertBefore(dragging, afterElement);
  }

  dropzone.style.outline = '2px dashed rgba(59,130,246,0.6)';
  dropzone.style.outlineOffset = '4px';
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

async function handleDrop(event) {
  if (!dragContext) return;
  const dropzone = event.target.closest('[data-album-dropzone]');
  if (!dropzone) return;
  event.preventDefault();

  const targetAlbumId = normalizeAlbumId(dropzone.dataset.albumId);
  dropzone.querySelectorAll('[data-placeholder]').forEach((el) => el.remove());

  const orderedIds = Array.from(dropzone.querySelectorAll('[data-media-item]')).map((el) => el.dataset.mediaItem);
  const mediaId = dragContext.mediaId;

  try {
    if (dragContext.albumId === targetAlbumId) {
      if (targetAlbumId) {
        await persistAlbumArrangement(targetAlbumId, orderedIds);
        showMessage('已更新排序。', 'success');
      } else {
        showMessage('资源保持未分类状态。', 'info', 2500);
      }
    } else {
      if (dragContext.albumId) {
        const { error: removeError } = await supabase
          .from('album_items')
          .delete()
          .eq('album_id', dragContext.albumId)
          .eq('media_item_id', mediaId);
        if (removeError) throw removeError;
      }

      if (targetAlbumId) {
        await persistAlbumArrangement(targetAlbumId, orderedIds);
        showMessage('资源已移动到新的相册。', 'success');
      } else {
        showMessage('资源已移出相册，归为未分类。', 'success');
      }
    }
  } catch (error) {
    console.error('更新资源排序失败', error);
    showMessage(`更新资源排序失败：${error.message ?? error}`, 'error', 6000);
  } finally {
    dragContext = null;
    clearDropzoneHighlights();
    await Promise.all([refreshMediaItems(), refreshAlbums({ preserveSelection: true })]);
  }
}

function handleDragLeave(event) {
  const dropzone = event.target.closest('[data-album-dropzone]');
  if (!dropzone) return;
  if (event.relatedTarget && dropzone.contains(event.relatedTarget)) {
    return;
  }
  dropzone.style.outline = '';
  dropzone.style.outlineOffset = '';
}

async function persistAlbumArrangement(albumId, orderedIds) {
  if (!albumId) return;
  const uniqueOrderedIds = Array.from(new Set(orderedIds));
  const updates = uniqueOrderedIds.map((mediaId, index) => ({
    album_id: albumId,
    media_item_id: mediaId,
    position: index + 1,
  }));

  const existingEntries = albumItemsState.byAlbum.get(albumId) ?? [];
  const existingIds = new Set(existingEntries.map((entry) => entry.mediaId));
  const desiredSet = new Set(uniqueOrderedIds);
  const removedIds = Array.from(existingIds).filter((id) => !desiredSet.has(id));

  const { error } = await supabase.from('album_items').upsert(updates, { onConflict: 'album_id,media_item_id' });
  if (error) throw error;

  if (removedIds.length) {
    const { error: deleteError } = await supabase
      .from('album_items')
      .delete()
      .eq('album_id', albumId)
      .in('media_item_id', removedIds);
    if (deleteError) throw deleteError;
  }
}

function toggleUploadState(loading) {
  mediaState.isUploading = loading;
  if (uploadButton) {
    uploadButton.disabled = loading;
    uploadButton.classList.toggle('opacity-60', loading);
    uploadButton.classList.toggle('cursor-not-allowed', loading);
    uploadButton.textContent = loading ? '上传中...' : '上传媒体';
  }
}

function determineMediaType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(extension)) return 'video';
  return null;
}

function buildStoragePath(file, mediaType, albumIds) {
  const extension = file.name.split('.').pop()?.toLowerCase() || (mediaType === 'image' ? 'jpg' : 'mp4');
  const folder = mediaType === 'image' ? 'images' : 'videos';
  const albumSegment = albumIds?.[0] ?? 'unclassified';
  const randomSegment =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const uniqueName = `${randomSegment}.${extension}`;
  return `${folder}/${albumSegment}/${uniqueName}`;
}

async function refreshMediaItems() {
  mediaState.isFetching = true;
  try {
    const [mediaRes, albumItemRes] = await Promise.all([
      supabase
        .from(MEDIA_TABLE)
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('album_items')
        .select('album_id, media_item_id, position, created_at')
        .order('position', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true }),
    ]);

    if (mediaRes.error) throw mediaRes.error;
    if (albumItemRes.error) throw albumItemRes.error;

    const albumTitleMap = new Map(albumState.items.map((album) => [album.id, album.title]));
    const albumMapping = new Map();
    const assignmentsByAlbum = new Map();
    const assignmentsByMedia = new Map();

    (albumItemRes.data ?? []).forEach((row) => {
      const albumList = albumMapping.get(row.media_item_id) ?? [];
      albumList.push(row.album_id);
      albumMapping.set(row.media_item_id, albumList);

      const albumEntries = assignmentsByAlbum.get(row.album_id) ?? [];
      albumEntries.push({
        mediaId: row.media_item_id,
        position: row.position,
        created_at: row.created_at,
      });
      assignmentsByAlbum.set(row.album_id, albumEntries);

      const mediaEntries = assignmentsByMedia.get(row.media_item_id) ?? [];
      mediaEntries.push({
        album_id: row.album_id,
        position: row.position,
        created_at: row.created_at,
      });
      assignmentsByMedia.set(row.media_item_id, mediaEntries);
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

    mediaState.items = (mediaRes.data ?? []).map((item) => {
      const albumIds = albumMapping.get(item.id) ?? [];
      const albumNames = albumIds
        .map((albumId) => albumTitleMap.get(albumId))
        .filter(Boolean);
      return {
        ...item,
        albumIds,
        albumNames,
      };
    });

    mediaState.map = new Map(mediaState.items.map((item) => [item.id, item]));
    albumItemsState.byAlbum = assignmentsByAlbum;
    albumItemsState.byMedia = assignmentsByMedia;

    renderAlbumLibrary();
    renderAlbumStats();
  } catch (error) {
    console.error('获取媒体列表失败', error);
    showMessage(`获取媒体列表失败：${error.message ?? error}`, 'error', 6000);
  } finally {
    mediaState.isFetching = false;
  }
}

async function createAlbum(event) {
  event.preventDefault();
  if (albumState.isCreating) return;
  const title = albumTitleInput?.value.trim();
  const description = albumDescriptionInput?.value.trim();

  if (!title) {
    showMessage('请填写相册名称。', 'error');
    return;
  }

  albumState.isCreating = true;
  try {
    const { data, error } = await supabase
      .from('albums')
      .insert({
        title,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;

    albumTitleInput.value = '';
    if (albumDescriptionInput) albumDescriptionInput.value = '';

    showMessage(`已创建相册「${data.title}」`, 'success');
    albumState.selected.add(data.id);
    await refreshAlbums({ preserveSelection: true });
  } catch (error) {
    console.error('创建相册失败', error);
    showMessage(`创建相册失败：${error.message ?? error}`, 'error', 6000);
  } finally {
    albumState.isCreating = false;
  }
}

async function uploadFiles(files) {
  if (!files.length) return;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('读取会话失败', sessionError);
    showMessage(`无法读取登录状态：${sessionError.message}`, 'error');
    return;
  }

  const session = sessionData?.session;
  if (!session?.user?.email) {
    showMessage('登录状态已过期，请重新登录。', 'error');
    return;
  }

  const albumIds = getSelectedAlbumIds();
  toggleUploadState(true);
  startUploadProgress(files.length);

  let successCount = 0;
  let failureCount = 0;

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const mediaType = determineMediaType(file);
      if (!mediaType) {
        failureCount += 1;
        showMessage(`跳过 ${file.name}：不支持的文件类型。`, 'error', 5000);
        updateUploadProgress({
          fileName: file.name,
          fileIndex: index + 1,
          totalFiles: files.length,
          loaded: 1,
          total: 1,
        });
        continue;
      }

      const storagePath = buildStoragePath(file, mediaType, albumIds);
      const totalBytes = file.size && file.size > 0 ? file.size : 1;
      updateUploadProgress({
        fileName: file.name,
        fileIndex: index + 1,
        totalFiles: files.length,
        loaded: 0,
        total: totalBytes,
      });
      const uploadResult = await supabase.storage.from(BUCKET_ID).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
        onUploadProgress: (event) => {
          const progressTotal = event?.total ?? totalBytes;
          const loadedValue = event?.loaded ?? progressTotal;
          updateUploadProgress({
            fileName: file.name,
            fileIndex: index + 1,
            totalFiles: files.length,
            loaded: loadedValue,
            total: progressTotal || 1,
          });
        },
      });

      if (uploadResult.error) {
        failureCount += 1;
        console.error('文件上传失败', uploadResult.error);
        showMessage(`上传 ${file.name} 失败：${uploadResult.error.message}`, 'error', 6000);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_ID).getPublicUrl(storagePath);

      const title = file.name.replace(/\.[^/.]+$/, '');
      const insertResult = await supabase
        .from(MEDIA_TABLE)
        .insert({
          type: mediaType,
          title,
          description: '',
          url: publicUrl,
          uploader_email: session.user.email,
          size_bytes: file.size ?? null,
          is_featured: false,
        })
        .select()
        .single();

      if (insertResult.error) {
        console.error('写入媒体记录失败', insertResult.error);
        await supabase.storage.from(BUCKET_ID).remove([storagePath]).catch((cleanupError) => {
          console.error('清理失败', cleanupError);
        });
        failureCount += 1;
        showMessage(`保存 ${file.name} 数据失败：${insertResult.error.message}`, 'error', 6000);
        continue;
      }

      const mediaRecord = insertResult.data;

      if (albumIds.length) {
        const rows = albumIds.map((albumId, index) => ({
          album_id: albumId,
          media_item_id: mediaRecord.id,
          position: index + 1,
        }));
        const albumInsert = await supabase.from('album_items').insert(rows);
        if (albumInsert.error) {
          console.error('关联相册失败', albumInsert.error);
          await supabase.from(MEDIA_TABLE).delete().eq('id', mediaRecord.id);
          await supabase.storage.from(BUCKET_ID).remove([storagePath]).catch((cleanupError) => {
            console.error('清理失败', cleanupError);
          });
          failureCount += 1;
          showMessage(`关联相册失败：${albumInsert.error.message}`, 'error', 6000);
          continue;
        }
      }

      updateUploadProgress({
        fileName: file.name,
        fileIndex: index + 1,
        totalFiles: files.length,
        loaded: totalBytes,
        total: totalBytes,
      });
      successCount += 1;
    }
  } finally {
    toggleUploadState(false);
    uploadInput.value = '';
    finishUploadProgress();
  }

  if (successCount) {
    showMessage(`成功上传 ${successCount} 个媒体文件。`, 'success');
    await Promise.all([refreshMediaItems(), refreshAlbums({ preserveSelection: true })]);
  }

  if (failureCount) {
    showMessage(`有 ${failureCount} 个文件上传失败，请查看日志。`, 'error', 6000);
  }
}

async function deleteMediaItem(item) {
  if (!item) return;

  try {
    const storagePath = extractStoragePath(item.url);
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from(BUCKET_ID).remove([storagePath]);
      if (storageError) {
        throw new Error(`删除存储文件失败：${storageError.message}`);
      }
    }

    const { error: deleteError } = await supabase.from(MEDIA_TABLE).delete().eq('id', item.id);
    if (deleteError) {
      throw new Error(`删除数据库记录失败：${deleteError.message}`);
    }

    showMessage('媒体已删除。', 'success');
    await Promise.all([refreshMediaItems(), refreshAlbums({ preserveSelection: true })]);
  } catch (error) {
    console.error('删除媒体失败', error);
    showMessage(error.message ?? '删除媒体失败，请重试。', 'error', 6000);
  }
}

function handleUploadClick() {
  if (!uploadInput || mediaState.isUploading) return;
  uploadInput.value = '';
  uploadInput.click();
}

function handleFileSelection(event) {
  const files = Array.from(event.target.files ?? []);
  if (!files.length) return;
  uploadFiles(files);
}

function initUploadControls() {
  if (uploadButton) {
    uploadButton.addEventListener('click', handleUploadClick);
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', handleFileSelection);
  }
}

function initLibraryInteractions() {
  if (!libraryContainer) return;
  libraryContainer.addEventListener('click', handleLibraryClick);
  libraryContainer.addEventListener('dragstart', handleDragStart);
  libraryContainer.addEventListener('dragend', handleDragEnd);
  libraryContainer.addEventListener('dragover', handleDragOver);
  libraryContainer.addEventListener('drop', handleDrop);
  libraryContainer.addEventListener('dragleave', handleDragLeave);
}

function initAlbumControls() {
  if (clearAlbumsButton) {
    clearAlbumsButton.addEventListener('click', clearAlbumSelection);
  }

  if (createAlbumForm) {
    createAlbumForm.addEventListener('submit', createAlbum);
  }
}

async function initDashboardInterface() {
  renderAlbumPicker();
  renderAlbumStats();
  renderAlbumLibrary();
  initUploadControls();
  initLibraryInteractions();
  initAlbumControls();
  await refreshAlbums({ preserveSelection: true });
  await refreshMediaItems();
}

initDashboardInterface();

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    mediaState.items = [];
    albumState.selected.clear();
    mediaState.map = new Map();
    albumItemsState.byAlbum = new Map();
    albumItemsState.byMedia = new Map();
    libraryUiState.expanded.clear();
    renderAlbumLibrary();
    renderAlbumPicker();
    showMessage('已退出登录。', 'info');
  }
});
