(function () {
  const SUPABASE_URL =
    (window.__SB__ && window.__SB__.url) ||
    (window.__ENV && window.__ENV.VITE_SUPABASE_URL) ||
    'https://qsgztmaenhieehyrclcm.supabase.co';
  const SUPABASE_ANON_KEY =
    (window.__SB__ && window.__SB__.anonKey) ||
    (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZ3p0bWFlbmhpZWVoeXJjbGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTc5MzUsImV4cCI6MjA3NjM5MzkzNX0.D1GxzSnYesnpflM3tbOWTk7BOopPyn6iqGv6X0K6Ej8';

  let supabaseClient;

  document.addEventListener('DOMContentLoaded', () => {
    const albumId = new URLSearchParams(window.location.search).get('id');
    if (!albumId) {
      hidePreloader();
      showMessage('未找到相册，请从作品集重新选择。');
      return;
    }

    const preloaderPromise = runPreloader();
    const dataPromise = loadAlbumData(albumId);

    Promise.all([preloaderPromise, dataPromise])
      .then(([, data]) => {
        if (!data) return;
        if (!Array.isArray(data.images) || !data.images.length) {
          prepareHeader(data.album, data.images);
          showMessage('该相册暂无图片，稍后再来探索吧。');
          return;
        }

        prepareHeader(data.album, data.images);
        initApp(data);
      })
      .catch((error) => {
        console.error('加载相册失败', error);
        hidePreloader();
        showMessage(`加载相册失败：${error?.message || '未知错误'}`);
      });
  });

  function runPreloader() {
    const preloader = document.querySelector('.preloader');
    const counter = preloader?.querySelector('.preloader-counter');
    if (!preloader || !counter) return Promise.resolve();

    return new Promise((resolve) => {
      let count = 0;
      const increment = 5;
      const interval = 128;

      const timer = setInterval(() => {
        count += increment;
        if (count <= 100) {
          counter.textContent = String(count);
        }

        if (count >= 100) {
          clearInterval(timer);
          counter.textContent = '100';
          setTimeout(() => {
            preloader.classList.add('preloader-hidden');
            setTimeout(resolve, 256);
          }, 256);
        }
      }, interval);
    });
  }

  function hidePreloader() {
    const preloader = document.querySelector('.preloader');
    if (!preloader) return;
    preloader.classList.add('preloader-hidden');
  }

  function showMessage(message) {
    const view = document.getElementById('album-view');
    const messageEl = document.getElementById('album-message');
    if (view) {
      view.classList.add('album-view--hidden');
    }
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.hidden = false;
    }
  }

  async function loadAlbumData(albumId) {
    try {
      supabaseClient = supabaseClient || (await loadSupabaseClient());
      const [{ data: album, error: albumError }, { data: albumItems, error: albumItemsError }] =
        await Promise.all([
          supabaseClient.from('albums').select('id, title, description').eq('id', albumId).maybeSingle(),
          supabaseClient.from('album_items').select('media_item_id').eq('album_id', albumId),
        ]);

      if (albumError) throw albumError;
      if (!album) {
        hidePreloader();
        showMessage('未找到相册，请从作品集重新选择。');
        return null;
      }
      if (albumItemsError) throw albumItemsError;

      const mediaIds = (albumItems || []).map((item) => item.media_item_id);
      if (!mediaIds.length) {
        hidePreloader();
        return { album, images: [] };
      }

      const { data: mediaItems, error: mediaError } = await supabaseClient
        .from('media_items')
        .select('*')
        .in('id', mediaIds)
        .order('created_at', { ascending: false });

      if (mediaError) throw mediaError;

      const images = (mediaItems || [])
        .filter((item) => item && item.type !== 'video')
        .map((item) => ({
          ...item,
          createdLabel: formatDate(item.created_at),
        }));

      return { album, images };
    } catch (error) {
      hidePreloader();
      showMessage(`加载相册失败：${error?.message || '未知错误'}`);
      throw error;
    }
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

  function prepareHeader(album, images) {
    if (!album) return;
    const titleEl = document.querySelector('[data-album-title]');
    const descriptionEl = document.querySelector('[data-album-description]');
    const countEl = document.querySelector('[data-album-count]');

    if (titleEl) {
      titleEl.textContent = album.title || '未命名相册';
    }
    if (descriptionEl) {
      descriptionEl.textContent = album.description || '';
      descriptionEl.hidden = !descriptionEl.textContent;
    }
    if (countEl) {
      const count = Array.isArray(images) ? images.length : 0;
      countEl.textContent = count ? `共 ${count} 张照片` : '';
      countEl.hidden = !countEl.textContent;
    }

    document.title = `${album.title || '相册'} · 作品预览`;
  }

  function initApp(data) {
    if (typeof gsap === 'undefined' || typeof Flip === 'undefined') {
      console.error('GSAP 或 Flip 插件未加载');
      return;
    }

    if (typeof CustomEase !== 'undefined') {
      CustomEase.create('mainEase', 'M0,0 C0.65,0.05 0.36,1 1,1');
      CustomEase.create('sideEase', 'M0,0 C0.86,0 0.07,1 1,1');
      CustomEase.create('natural', 'M0,0 C0.34,0.01 0.2,1 1,1');
      CustomEase.create('naturalOut', 'M0,0 C0.43,0.13 0.23,0.96 1,1');
      CustomEase.create('cinematic', 'M0,0 C0.645,0.045 0.355,1 1,1');
    }

    const images = data.images || [];
    const album = data.album || {};
    const grid = document.getElementById('grid');
    const sliderImage = document.getElementById('slider-image');
    const sliderImageNext = document.getElementById('slider-image-next');
    const sliderImageBg = document.getElementById('slider-image-bg');
    const transitionOverlay = document.getElementById('transition-overlay');
    const content = document.getElementById('content');
    const contentTitle = content?.querySelector('.content-title span');
    const contentParagraph = document.getElementById('content-paragraph');
    const thumbnailsContainer = document.getElementById('thumbnails');
    const switchContainer = document.getElementById('switch');
    const switchGrid = document.querySelector('.switch-button-grid');
    const switchSlider = document.querySelector('.switch-button-slider');

    if (!grid || !thumbnailsContainer || !contentTitle || !contentParagraph) {
      console.warn('界面元素缺失，无法初始化相册视图');
      return;
    }

    const TIMING = {
      BASE: 0.512,
      SHORTEST: 0.256,
      SHORT: 0.384,
      LONG: 0.768,
      LONGEST: 1.024,
      STAGGER_TINY: 0.032,
      STAGGER_SMALL: 0.064,
      STAGGER_MED: 0.128,
      PAUSE: 1.536,
    };

    const normalizedImages = images.map((item, index) => {
      const metaPieces = [];
      if (item.description) metaPieces.push(item.description);
      if (item.createdLabel) metaPieces.push(item.createdLabel);
      const description = metaPieces.join(' · ') || album.description || '';
      return {
        url: item.url,
        title: item.title || `${album.title || '相册'} · 第 ${index + 1} 张`,
        description,
      };
    });

    grid.innerHTML = '';
    thumbnailsContainer.innerHTML = '';

    normalizedImages.forEach((item, index) => {
      const gridItem = document.createElement('div');
      gridItem.className = 'grid-item';
      gridItem.dataset.index = String(index);
      if (index === Math.min(4, normalizedImages.length - 1)) {
        gridItem.classList.add('target');
        gridItem.id = 'target-item';
      }

      const gridImg = document.createElement('div');
      gridImg.className = 'grid-item-img';
      gridImg.style.backgroundImage = `url(${item.url})`;
      gridItem.appendChild(gridImg);
      grid.appendChild(gridItem);

      const thumb = document.createElement('div');
      thumb.className = 'thumbnail';
      thumb.dataset.index = String(index);
      const thumbImg = document.createElement('div');
      thumbImg.className = 'thumbnail-img';
      thumbImg.style.backgroundImage = `url(${item.url})`;
      thumb.appendChild(thumbImg);
      thumbnailsContainer.appendChild(thumb);
    });

    const gridItems = Array.from(grid.querySelectorAll('.grid-item'));
    const thumbnailItems = Array.from(thumbnailsContainer.querySelectorAll('.thumbnail'));

    let currentMode = 'grid';
    let isAnimating = false;
    let activeIndex = 0;
    let previousIndex = 0;
    let slideDirection = 'right';

    const imageUrls = normalizedImages.map((item) => `url(${item.url})`);
    const slideContent = normalizedImages.map((item) => ({
      title: item.title,
      paragraph: item.description,
    }));

    const setActiveThumbnail = (index) => {
      thumbnailItems.forEach((thumb) => {
        thumb.classList.toggle('active', Number(thumb.dataset.index) === index);
      });
    };

    const updateContent = (index) => {
      const contentData = slideContent[index] || slideContent[0];
      if (!contentData) return;
      contentTitle.textContent = contentData.title || album.title || '';
      contentParagraph.textContent = contentData.paragraph || album.description || '';
      contentParagraph.style.opacity = contentParagraph.textContent ? '1' : '0.8';
    };

    setActiveThumbnail(activeIndex);
    updateContent(activeIndex);

    const getGridItemByIndex = (index) => document.querySelector(`.grid-item[data-index="${index}"]`);

    const showSliderView = () =>
      new Promise((resolve) => {
        const activeItem = getGridItemByIndex(activeIndex) || gridItems[0];
        if (!activeItem) {
          resolve();
          return;
        }

        const activeItemRect = activeItem.getBoundingClientRect();
        const activeImageUrl = imageUrls[activeIndex];

        sliderImage.style.backgroundImage = activeImageUrl;
        sliderImageBg.style.backgroundImage = activeImageUrl;

        gsap.set([sliderImage, sliderImageBg, sliderImageNext], {
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        });

        updateContent(activeIndex);
        setActiveThumbnail(activeIndex);

        gsap.set(sliderImage, {
          width: activeItemRect.width,
          height: activeItemRect.height,
          x: activeItemRect.left,
          y: activeItemRect.top,
          opacity: 1,
          visibility: 'visible',
        });

        const heightState = Flip.getState(sliderImage);
        gsap.set(sliderImage, {
          height: '100vh',
          y: 0,
          width: activeItemRect.width,
          x: activeItemRect.left,
        });

        Flip.from(heightState, {
          duration: TIMING.BASE,
          ease: 'mainEase',
          onComplete: () => {
            const widthState = Flip.getState(sliderImage);
            gsap.set(sliderImage, { width: '100vw', x: 0 });
            Flip.from(widthState, {
              duration: TIMING.BASE,
              ease: 'mainEase',
              onComplete: () => {
                gsap.to(grid, {
                  opacity: 0,
                  duration: TIMING.SHORTEST,
                  ease: 'power2.inOut',
                });

                const contentTl = gsap.timeline({ onComplete: resolve });
                contentTl.to(
                  content,
                  { opacity: 1, duration: TIMING.SHORT, ease: 'mainEase' },
                  0,
                );
                contentTl.to(
                  contentTitle,
                  {
                    y: 0,
                    duration: TIMING.BASE,
                    ease: 'sideEase',
                  },
                  TIMING.STAGGER_TINY,
                );
                contentTl.to(
                  contentParagraph,
                  {
                    opacity: 1,
                    duration: TIMING.BASE,
                    ease: 'mainEase',
                  },
                  TIMING.STAGGER_SMALL,
                );
                contentTl.to(
                  thumbnailItems,
                  {
                    opacity: 1,
                    y: 0,
                    duration: TIMING.SHORT,
                    stagger: TIMING.STAGGER_TINY,
                    ease: 'sideEase',
                  },
                  TIMING.STAGGER_MED,
                );
              },
            });
          },
        });
      });

    const showGridView = () =>
      new Promise((resolve) => {
        const activeItem = getGridItemByIndex(activeIndex) || gridItems[0];
        if (!activeItem) {
          resolve();
          return;
        }

        const activeItemRect = activeItem.getBoundingClientRect();

        const contentTl = gsap.timeline({
          onComplete: () => {
            gsap.to(grid, {
              opacity: 1,
              duration: TIMING.SHORTEST,
              ease: 'power2.inOut',
            });

            gsap.set([sliderImageNext, sliderImageBg, transitionOverlay], {
              opacity: 0,
              visibility: 'hidden',
            });

            const widthState = Flip.getState(sliderImage);
            gsap.set(sliderImage, {
              width: activeItemRect.width,
              x: activeItemRect.left,
              height: '100vh',
              y: 0,
            });

            Flip.from(widthState, {
              duration: TIMING.BASE,
              ease: 'mainEase',
              onComplete: () => {
                const heightState = Flip.getState(sliderImage);
                gsap.set(sliderImage, {
                  height: activeItemRect.height,
                  y: activeItemRect.top,
                });

                Flip.from(heightState, {
                  duration: TIMING.BASE,
                  ease: 'mainEase',
                  onComplete: () => {
                    gsap.to(sliderImage, {
                      opacity: 0,
                      duration: TIMING.SHORTEST,
                      ease: 'power2.inOut',
                      onComplete: () => {
                        sliderImage.style.visibility = 'hidden';
                        resolve();
                      },
                    });
                  },
                });
              },
            });
          },
        });

        contentTl.to(
          thumbnailItems,
          {
            opacity: 0,
            y: 20,
            duration: TIMING.SHORT,
            stagger: -TIMING.STAGGER_TINY,
            ease: 'sideEase',
          },
          0,
        );
        contentTl.to(
          contentParagraph,
          {
            opacity: 0,
            duration: TIMING.SHORT,
            ease: 'mainEase',
          },
          TIMING.STAGGER_TINY,
        );
        contentTl.to(
          contentTitle,
          {
            y: '100%',
            duration: TIMING.SHORT,
            ease: 'sideEase',
          },
          TIMING.STAGGER_SMALL,
        );
        contentTl.to(
          content,
          {
            opacity: 0,
            duration: TIMING.SHORT,
            ease: 'mainEase',
          },
          TIMING.STAGGER_MED,
        );
      });

    const transitionToSlide = (index) => {
      if (isAnimating || index === activeIndex) return;
      isAnimating = true;

      slideDirection = index > activeIndex ? 'right' : 'left';
      previousIndex = activeIndex;

      setActiveThumbnail(index);

      const newImageUrl = imageUrls[index];
      sliderImageNext.style.backgroundImage = newImageUrl;
      sliderImageBg.style.backgroundImage = newImageUrl;

      gsap.set([sliderImageNext, sliderImageBg, sliderImage], {
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      });

      gsap.set([sliderImageNext, sliderImageBg], { visibility: 'visible' });

      const xOffset = slideDirection === 'right' ? '100%' : '-100%';

      gsap.set(sliderImageNext, {
        x: xOffset,
        y: 0,
        opacity: 1,
        width: '100vw',
        height: '100vh',
      });

      gsap.set(sliderImageBg, {
        x: xOffset,
        y: 0,
        opacity: 0.9,
        width: '100vw',
        height: '100vh',
        scale: 1,
      });

      const masterTl = gsap.timeline({
        onComplete: () => {
          sliderImage.style.backgroundImage = newImageUrl;
          gsap.set([sliderImageNext, sliderImageBg, transitionOverlay], {
            opacity: 0,
            x: 0,
            y: 0,
            visibility: 'hidden',
          });

          gsap.set(sliderImage, { x: 0, opacity: 1 });

          updateContent(index);
          activeIndex = index;

          const showTl = gsap.timeline({
            onComplete: () => {
              isAnimating = false;
            },
          });

          showTl.to(
            contentTitle,
            {
              y: 0,
              duration: TIMING.BASE,
              ease: 'sideEase',
            },
            0,
          );
          showTl.to(
            contentParagraph,
            {
              opacity: 1,
              duration: TIMING.BASE,
              ease: 'mainEase',
            },
            TIMING.STAGGER_SMALL,
          );
        },
      });

      masterTl.to(
        contentParagraph,
        {
          opacity: 0,
          duration: TIMING.SHORT,
          ease: 'mainEase',
        },
        0,
      );
      masterTl.to(
        contentTitle,
        {
          y: '100%',
          duration: TIMING.SHORT,
          ease: 'sideEase',
        },
        TIMING.STAGGER_TINY,
      );
      masterTl.to(
        transitionOverlay,
        {
          opacity: 0.15,
          duration: TIMING.SHORTEST,
          ease: 'power1.in',
          visibility: 'visible',
        },
        TIMING.STAGGER_SMALL,
      );
      masterTl.to(
        transitionOverlay,
        {
          opacity: 0,
          duration: TIMING.SHORT,
          ease: 'power1.out',
        },
        TIMING.STAGGER_MED,
      );
      masterTl.to(
        sliderImage,
        {
          x: slideDirection === 'right' ? '-35%' : '35%',
          opacity: 1,
          duration: TIMING.LONG,
          ease: 'mainEase',
        },
        0,
      );
      masterTl.to(
        sliderImageBg,
        {
          x: slideDirection === 'right' ? '-10%' : '10%',
          y: 0,
          opacity: 0.95,
          scale: 1,
          duration: TIMING.LONG,
          ease: 'sideEase',
        },
        TIMING.STAGGER_TINY,
      );
      masterTl.to(
        sliderImageNext,
        {
          x: 0,
          opacity: 1,
          duration: TIMING.LONG,
          ease: 'sideEase',
        },
        TIMING.STAGGER_SMALL,
      );
    };

    const toggleView = (mode) => {
      if (isAnimating || currentMode === mode) return;
      isAnimating = true;

      const current = document.querySelector('.switch-button-current');
      current?.classList.remove('switch-button-current');
      const nextButton = document.querySelector(`.switch-button-${mode}`);
      nextButton?.classList.add('switch-button-current');

      currentMode = mode;

      const action = mode === 'slider' ? showSliderView : showGridView;
      action().then(() => {
        isAnimating = false;
      });
    };

    gridItems.forEach((item) => {
      item.addEventListener('click', () => {
        const index = Number(item.dataset.index);
        if (Number.isNaN(index)) return;
        if (currentMode === 'grid') {
          activeIndex = index;
          setActiveThumbnail(activeIndex);
          toggleView('slider');
        } else {
          transitionToSlide(index);
        }
      });
    });

    thumbnailItems.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const index = Number(thumb.dataset.index);
        if (Number.isNaN(index)) return;
        if (currentMode !== 'slider') {
          activeIndex = index;
          toggleView('slider');
        } else {
          transitionToSlide(index);
        }
      });
    });

    switchGrid?.addEventListener('click', () => toggleView('grid'));
    switchSlider?.addEventListener('click', () => toggleView('slider'));

    switchContainer?.addEventListener('mouseenter', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('.switch-button');
      if (!(button instanceof HTMLElement)) return;
      if (button.classList.contains('switch-button-grid')) {
        switchContainer.style.paddingLeft = '30px';
      } else if (button.classList.contains('switch-button-slider')) {
        switchContainer.style.paddingRight = '30px';
      }
    });

    switchContainer?.addEventListener('mouseleave', () => {
      if (!switchContainer) return;
      switchContainer.style.paddingLeft = '20px';
      switchContainer.style.paddingRight = '20px';
    });

    document.addEventListener('keydown', (event) => {
      if (currentMode !== 'slider' || isAnimating) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        const nextIndex = (activeIndex + 1) % imageUrls.length;
        transitionToSlide(nextIndex);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        const prevIndex = (activeIndex - 1 + imageUrls.length) % imageUrls.length;
        transitionToSlide(prevIndex);
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (event) => {
      if (currentMode !== 'slider' || isAnimating) return;
      touchStartX = event.changedTouches[0].screenX;
    });

    document.addEventListener('touchend', (event) => {
      if (currentMode !== 'slider' || isAnimating) return;
      touchEndX = event.changedTouches[0].screenX;
      const swipeThreshold = 50;
      if (touchEndX < touchStartX - swipeThreshold) {
        const nextIndex = (activeIndex + 1) % imageUrls.length;
        transitionToSlide(nextIndex);
      } else if (touchEndX > touchStartX + swipeThreshold) {
        const prevIndex = (activeIndex - 1 + imageUrls.length) % imageUrls.length;
        transitionToSlide(prevIndex);
      }
    });

    window.addEventListener('resize', () => {
      if (currentMode === 'slider') {
        gsap.set(sliderImage, {
          width: '100vw',
          height: '100vh',
          x: 0,
          y: 0,
        });
      }
    });
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
})();
