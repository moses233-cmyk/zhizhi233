import { supabase } from './app.js';

const BUCKET_ID = 'media';
const MEDIA_TABLE = 'media_items';

const imagesListEl = document.querySelector('[data-images-list]');
const videosListEl = document.querySelector('[data-videos-list]');
const imagesCountEl = document.querySelector('[data-images-count]');
const videosCountEl = document.querySelector('[data-videos-count]');
const uploadButton = document.querySelector('[data-upload-button]');
const uploadInput = document.querySelector('[data-upload-input]');
const albumPickerEl = document.querySelector('[data-album-picker]');
const albumStatsEl = document.querySelector('[data-album-stats]');
const albumSummaryEl = document.querySelector('[data-selected-albums]');
const clearAlbumsButton = document.querySelector('[data-clear-albums]');
const createAlbumForm = document.querySelector('[data-create-album-form]');
const albumTitleInput = document.querySelector('[data-album-title]');
const albumDescriptionInput = document.querySelector('[data-album-description]');

const STORAGE_PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET_ID}/`;

if (!imagesListEl || !videosListEl) {
  console.warn('媒体列表容器未找到，跳过后台界面初始化。');
}

const mediaState = {
  items: [],
  isUploading: false,
  isFetching: false,
};

const albumState = {
  items: [],
  selected: new Set(),
  isCreating: false,
  isFetching: false,
};

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

function renderEmptyState(target, type) {
  if (!target) return;
  target.innerHTML = `
    <li class="flex items-center justify-between rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white/60">
      <span>暂无${type === 'image' ? '图片' : '视频'}资源</span>
      <span class="text-xs uppercase tracking-[0.2em] text-white/30">waiting</span>
    </li>
  `;
}

function renderAlbumStats() {
  if (!albumStatsEl) return;
  if (!albumState.items.length) {
    albumStatsEl.innerHTML = '<li>尚未创建任何相册。</li>';
    return;
  }

  albumStatsEl.innerHTML = albumState.items
    .map(
      (album) => `
      <li class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <div class="min-w-0 flex-1 truncate">
          <span class="font-medium text-white/80">${album.title}</span>
          ${album.description ? `<span class="ml-2 truncate text-white/40">${album.description}</span>` : ''}
        </div>
        <span class="rounded-full bg-white/10 px-3 py-0.5 text-[11px] text-white/60">
          ${album.item_count ?? 0} 项
        </span>
      </li>
    `
    )
    .join('');
}

function updateAlbumSelectionSummary() {
  if (!albumSummaryEl) return;
  if (!albumState.selected.size) {
    albumSummaryEl.textContent = '当前未选择相册';
    return;
  }

  const selectedAlbums = albumState.items.filter((album) => albumState.selected.has(album.id));
  const summary = selectedAlbums.map((album) => album.title).join(' / ');
  albumSummaryEl.textContent = `已选相册：${summary}`;
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
  } catch (error) {
    console.error('获取相册列表失败', error);
    showMessage(`获取相册列表失败：${error.message ?? error}`, 'error', 6000);
  } finally {
    albumState.isFetching = false;
  }
}

function renderMediaList(type) {
  const listEl = type === 'image' ? imagesListEl : videosListEl;
  const countEl = type === 'image' ? imagesCountEl : videosCountEl;
  if (!listEl) return;

  const items = mediaState.items.filter((item) => item.type === type);

  if (!items.length) {
    renderEmptyState(listEl, type);
    if (countEl) countEl.textContent = '0';
    return;
  }

  const albumMap = new Map(albumState.items.map((album) => [album.id, album.title]));

  listEl.innerHTML = items
    .map((item) => {
      const tags = (item.albumIds || [])
        .map((albumId) => albumMap.get(albumId))
        .filter(Boolean);
      const badgeMarkup = tags.length
        ? tags
            .map(
              (title) =>
                `<span class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">#${title}</span>`
            )
            .join('')
        : '<span class="text-[11px] text-white/40">未分类</span>';

      return `
      <li class="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 transition hover:border-white/30 hover:bg-black/40">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${item.type === 'image' ? 'bg-emerald-400' : 'bg-sky-400'}"></span>
            <p class="truncate text-sm font-medium text-white">${item.title ?? item.url}</p>
          </div>
          <p class="mt-1 line-clamp-2 text-xs text-white/50">${item.description || '尚未填写描述'}</p>
          <p class="mt-1 text-[11px] uppercase tracking-widest text-white/30">
            ${item.type} · ${item.uploader_email ?? '未知'} · ${formatDate(item.created_at)}
          </p>
          <div class="mt-2 flex flex-wrap gap-1">${badgeMarkup}</div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <a
            href="${item.url}"
            target="_blank"
            rel="noopener"
            class="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/60 hover:text-white"
          >
            预览
          </a>
          <button
            type="button"
            data-delete-media="${item.id}"
            class="rounded-full border border-rose-400/30 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:bg-rose-400/20 hover:text-white"
          >
            删除
          </button>
        </div>
      </li>
    `;
    })
    .join('');

  if (countEl) countEl.textContent = String(items.length);
}

function syncLists() {
  renderMediaList('image');
  renderMediaList('video');
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
      supabase.from('album_items').select('album_id, media_item_id'),
    ]);

    if (mediaRes.error) throw mediaRes.error;
    if (albumItemRes.error) throw albumItemRes.error;

    const albumMapping = new Map();
    (albumItemRes.data ?? []).forEach((row) => {
      const list = albumMapping.get(row.media_item_id) ?? [];
      list.push(row.album_id);
      albumMapping.set(row.media_item_id, list);
    });

    mediaState.items = (mediaRes.data ?? []).map((item) => ({
      ...item,
      albumIds: albumMapping.get(item.id) ?? [],
    }));

    syncLists();
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

  let successCount = 0;
  let failureCount = 0;

  try {
    for (const file of files) {
      const mediaType = determineMediaType(file);
      if (!mediaType) {
        failureCount += 1;
        showMessage(`跳过 ${file.name}：不支持的文件类型。`, 'error', 5000);
        continue;
      }

      const storagePath = buildStoragePath(file, mediaType, albumIds);
      const uploadResult = await supabase.storage.from(BUCKET_ID).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
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

      successCount += 1;
    }
  } finally {
    toggleUploadState(false);
    uploadInput.value = '';
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

function handleMediaListClick(event) {
  const button = event.target.closest('[data-delete-media]');
  if (!button) return;
  const mediaId = button.dataset.deleteMedia;
  const targetItem = mediaState.items.find((entry) => entry.id === mediaId);

  if (!targetItem) {
    showMessage('未找到对应的媒体记录。', 'error');
    return;
  }

  const confirmed = window.confirm(`确定要删除「${targetItem.title ?? targetItem.url}」吗？操作不可撤销。`);
  if (!confirmed) return;

  deleteMediaItem(targetItem);
}

function initUploadControls() {
  if (uploadButton) {
    uploadButton.addEventListener('click', handleUploadClick);
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', handleFileSelection);
  }
}

function initListInteractions() {
  imagesListEl?.addEventListener('click', handleMediaListClick);
  videosListEl?.addEventListener('click', handleMediaListClick);
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
  syncLists();
  renderAlbumPicker();
  renderAlbumStats();
  initUploadControls();
  initListInteractions();
  initAlbumControls();
  await refreshAlbums({ preserveSelection: true });
  await refreshMediaItems();
}

initDashboardInterface();

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    mediaState.items = [];
    albumState.selected.clear();
    syncLists();
    renderAlbumPicker();
    showMessage('已退出登录。', 'info');
  }
});
