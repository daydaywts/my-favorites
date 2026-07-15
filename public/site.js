(() => {
  'use strict';

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const sidebar = q('[data-sidebar]');
  q('[data-menu-button]')?.addEventListener('click', () => sidebar?.classList.add('open'));
  qa('[data-menu-close]').forEach((element) => element.addEventListener('click', () => sidebar?.classList.remove('open')));

  const themeToggle = q('[data-theme-toggle]');
  const syncThemeToggle = () => {
    if (!themeToggle) return;
    const dark = document.documentElement.classList.contains('dark');
    const label = dark ? '切换到日间模式' : '切换到夜间模式';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
  };
  let themeTransitionTimer = null;
  themeToggle?.addEventListener('click', () => {
    const root = document.documentElement;
    root.classList.add('theme-changing');
    void root.offsetWidth;
    root.classList.toggle('dark');
    localStorage.setItem('favorites-theme', root.classList.contains('dark') ? 'dark' : 'light');
    syncThemeToggle();
    if (themeTransitionTimer) window.clearTimeout(themeTransitionTimer);
    themeTransitionTimer = window.setTimeout(() => root.classList.remove('theme-changing'), 340);
  });
  syncThemeToggle();

  const dialog = q('[data-search-dialog]');
  const globalSearch = q('[data-global-search]');
  const searchResults = q('[data-search-results]');
  const searchItems = qa('[data-search-item]');
  const searchEmpty = q('[data-search-empty]');
  let searchCloseTimer = null;

  const resetSearch = () => {
    if (globalSearch) globalSearch.value = '';
    searchResults?.classList.remove('is-visible');
    searchResults?.setAttribute('aria-hidden', 'true');
    dialog?.classList.remove('has-results');
    searchItems.forEach((item) => { item.hidden = true; });
    if (searchEmpty) searchEmpty.hidden = true;
  };

  const openSearch = () => {
    if (!dialog) return;
    if (searchCloseTimer) window.clearTimeout(searchCloseTimer);
    dialog.classList.remove('is-closing');
    resetSearch();
    if (dialog.hasAttribute('open')) {
      globalSearch?.focus();
      return;
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    window.setTimeout(() => globalSearch?.focus(), 30);
  };
  const closeSearch = () => {
    if (!dialog || !dialog.hasAttribute('open') || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    searchCloseTimer = window.setTimeout(() => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      dialog.classList.remove('is-closing');
      resetSearch();
    }, 180);
  };
  q('[data-search-open]')?.addEventListener('click', openSearch);
  q('[data-search-close]')?.addEventListener('click', closeSearch);
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) closeSearch(); });
  dialog?.addEventListener('cancel', (event) => { event.preventDefault(); closeSearch(); });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
  });
  globalSearch?.addEventListener('input', () => {
    const query = globalSearch.value.trim().toLocaleLowerCase('zh-CN');
    const hasQuery = query.length > 0;
    searchResults?.classList.toggle('is-visible', hasQuery);
    searchResults?.setAttribute('aria-hidden', hasQuery ? 'false' : 'true');
    dialog?.classList.toggle('has-results', hasQuery);
    if (!hasQuery) {
      searchItems.forEach((item) => { item.hidden = true; });
      if (searchEmpty) searchEmpty.hidden = true;
      return;
    }
    let visible = 0;
    searchItems.forEach((item) => {
      const matched = (item.dataset.text || '').includes(query);
      item.hidden = !matched;
      if (matched) visible += 1;
    });
    if (searchEmpty) searchEmpty.hidden = visible !== 0;
  });
  resetSearch();

  const grid = q('[data-library-grid]');
  const cards = grid ? qa('[data-library-card]', grid) : [];
  const emptyState = q('[data-empty-state]');
  const initialParams = new URLSearchParams(location.search);
  const tagOptions = qa('[data-tag-option]');
  const tagChips = qa('[data-tag-chip]');
  const initialTags = initialParams.getAll('tag').filter((tag) => tag && tag !== '全部');
  const selectedTags = new Set(tagOptions.length ? initialTags : []);
  const selectedChipTags = new Set(tagChips.length ? initialTags : []);
  let includeAnime = true;

  const syncTagOptions = () => {
    tagOptions.forEach((button) => {
      const tag = button.dataset.tagOption || '全部';
      button.classList.toggle('active', tag === '全部' ? selectedTags.size === 0 : selectedTags.has(tag));
    });
    const label = q('[data-tag-label]');
    if (!label) return;
    if (selectedTags.size === 0) label.textContent = '全部标签';
    else if (selectedTags.size === 1) label.textContent = [...selectedTags][0];
    else label.textContent = `已选 ${selectedTags.size} 个标签`;
  };

  const syncTagUrl = () => {
    if (!tagOptions.length) return;
    const params = new URLSearchParams(location.search);
    params.delete('tag');
    selectedTags.forEach((tag) => params.append('tag', tag));
    const search = params.toString();
    history.replaceState({}, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  };

  const syncTagChips = () => {
    tagChips.forEach((button) => {
      const tag = button.dataset.tagChip || '全部';
      button.classList.toggle('active', tag === '全部' ? selectedChipTags.size === 0 : selectedChipTags.has(tag));
    });
  };

  const syncTagChipUrl = () => {
    if (!tagChips.length) return;
    const params = new URLSearchParams(location.search);
    params.delete('tag');
    selectedChipTags.forEach((tag) => params.append('tag', tag));
    const search = params.toString();
    history.replaceState({}, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  };

  const syncAnimeTagOption = () => {
    const animeOption = q('[data-tag-option="二次元"]');
    if (animeOption) animeOption.hidden = !includeAnime;
  };

  const applyFilters = () => {
    if (!cards.length) return;
    const query = (q('[data-page-search]')?.value || '').trim().toLocaleLowerCase('zh-CN');
    let visible = 0;
    cards.forEach((card) => {
      const tags = (card.dataset.tags || '').split('|');
      const matchesSelectedTags = !tagOptions.length || selectedTags.size === 0 ||
        tags.some((tag) => selectedTags.has(tag));
      const matchesChip = !tagChips.length || selectedChipTags.size === 0 ||
        tags.some((tag) => selectedChipTags.has(tag));
      const matchesAnime = includeAnime || !tags.includes('二次元');
      const matched = matchesSelectedTags && matchesChip && matchesAnime &&
        (card.dataset.search || '').includes(query);
      card.hidden = !matched;
      if (matched) visible += 1;
    });
    emptyState?.classList.toggle('visible', visible === 0);
  };

  const workDateValue = (value) => {
    const [year = 0, month = 1, day = 1] = String(value || '').match(/\d+/g)?.map(Number) || [];
    return year * 10000 + month * 100 + day;
  };

  const sortByReleaseDate = (direction) => {
    if (!grid || !cards.length) return;
    [...cards]
      .sort((a, b) => direction === 'asc'
        ? workDateValue(a.dataset.releaseDate) - workDateValue(b.dataset.releaseDate)
        : workDateValue(b.dataset.releaseDate) - workDateValue(a.dataset.releaseDate))
      .forEach((card) => grid.appendChild(card));
  };

  q('[data-page-search]')?.addEventListener('input', applyFilters);
  q('[data-anime-toggle]')?.addEventListener('click', (event) => {
    includeAnime = !includeAnime;
    const button = event.currentTarget;
    button.classList.toggle('active', includeAnime);
    button.setAttribute('aria-pressed', includeAnime ? 'true' : 'false');
    if (!includeAnime && selectedTags.delete('二次元')) {
      syncTagOptions();
      syncTagUrl();
    }
    syncAnimeTagOption();
    applyFilters();
  });
  tagOptions.forEach((button) => button.addEventListener('click', () => {
    const tag = button.dataset.tagOption || '全部';
    if (tag === '全部') selectedTags.clear();
    else if (selectedTags.has(tag)) selectedTags.delete(tag);
    else selectedTags.add(tag);
    syncTagOptions();
    syncTagUrl();
    applyFilters();
  }));
  tagChips.forEach((button) => button.addEventListener('click', () => {
    const tag = button.dataset.tagChip || '全部';
    if (tag === '全部') selectedChipTags.clear();
    else if (selectedChipTags.has(tag)) selectedChipTags.delete(tag);
    else selectedChipTags.add(tag);
    syncTagChips();
    syncTagChipUrl();
    applyFilters();
  }));
  qa('[data-release-sort]').forEach((button) => button.addEventListener('click', () => {
    const direction = button.dataset.releaseSort || 'desc';
    sortByReleaseDate(direction);
    qa('[data-release-sort]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const label = q('[data-release-sort-label]');
    if (label) label.textContent = direction === 'asc' ? '作品日期：从旧到新' : '作品日期：从新到旧';
    button.closest('details')?.removeAttribute('open');
  }));
  document.addEventListener('click', (event) => {
    qa('[data-filter-menu][open]').forEach((menu) => { if (!menu.contains(event.target)) menu.removeAttribute('open'); });
  });
  syncTagOptions();
  syncTagChips();
  syncAnimeTagOption();
  sortByReleaseDate('desc');
  applyFilters();

  const articleList = q('[data-article-list]');
  const articleCards = articleList ? qa('[data-article-card]', articleList) : [];
  const sortArticles = (direction) => {
    if (!articleList || !articleCards.length) return;
    [...articleCards]
      .sort((a, b) => direction === 'asc'
        ? (a.dataset.date || '').localeCompare(b.dataset.date || '')
        : (b.dataset.date || '').localeCompare(a.dataset.date || ''))
      .forEach((article) => articleList.appendChild(article));
  };
  qa('[data-article-sort]').forEach((button) => button.addEventListener('click', () => {
    const direction = button.dataset.articleSort || 'desc';
    sortArticles(direction);
    qa('[data-article-sort]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const label = q('[data-article-sort-label]');
    if (label) label.textContent = direction === 'asc' ? '文章时间：从旧到新' : '文章时间：从新到旧';
    button.closest('details')?.removeAttribute('open');
  }));
  sortArticles('desc');

  const recommendation = q('[data-recommendation]');
  if (recommendation) {
    const slides = qa('[data-recommendation-slide]', recommendation);
    const infos = qa('[data-recommendation-info]', recommendation);
    const dots = qa('[data-recommendation-dot]', recommendation);
    let current = 0;
    let timer = null;
    const showRecommendation = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === current;
        slide.classList.toggle('active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      infos.forEach((info, infoIndex) => {
        const active = infoIndex === current;
        info.classList.toggle('active', active);
        info.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === current));
    };
    const stopRecommendation = () => { if (timer) window.clearInterval(timer); timer = null; };
    const startRecommendation = () => {
      stopRecommendation();
      if (slides.length > 1) timer = window.setInterval(() => showRecommendation(current + 1), 4000);
    };
    dots.forEach((dot) => dot.addEventListener('click', () => {
      showRecommendation(Number(dot.dataset.index || 0));
      startRecommendation();
    }));
    recommendation.addEventListener('mouseenter', stopRecommendation);
    recommendation.addEventListener('mouseleave', startRecommendation);
    recommendation.addEventListener('focusin', stopRecommendation);
    recommendation.addEventListener('focusout', (event) => { if (!recommendation.contains(event.relatedTarget)) startRecommendation(); });
    showRecommendation(0);
    startRecommendation();
  }
})();
