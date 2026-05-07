import { hrefWithBase, loadPagefind } from '../lib/pagefindClient.mjs';

const baseUrl = import.meta.env.BASE_URL;
const isDev = import.meta.env.DEV;

type PagefindApi = Awaited<ReturnType<typeof loadPagefind>>;

function initSearch() {
  const form = document.getElementById('search-page-form');
  const input = document.getElementById('search-page-q');
  const status = document.getElementById('search-page-status');
  const list = document.getElementById('search-page-results');
  if (!form || !input || !status || !list) {
    return;
  }
  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !(status instanceof HTMLElement) ||
    !(list instanceof HTMLUListElement)
  ) {
    return;
  }
  const elForm = form;
  const elInput = input;
  const elStatus = status;
  const elList = list;

  function getQueryFromUrl() {
    return new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
  }

  function setUrlQuery(q: string) {
    const u = new URL(window.location.href);
    if (q) {
      u.searchParams.set('q', q);
    } else {
      u.searchParams.delete('q');
    }
    window.history.replaceState({}, '', u);
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

    function renderUnloaded( detail?: string ) {
      if (isDev) {
        elStatus.textContent =
          'Local search index is created after a production build. Run pnpm build, then pnpm preview to try search here.';
      } else {
        elStatus.textContent =
          detail ||
          'Search is not available. The Pagefind index may be missing, or the site was built with a different base than this URL (set ASTRO_BASE_PATH to match GitHub Pages vs root).';
      }
    }

  let debounceId = 0;
  function debounceInput(fn: (q: string) => void) {
    return (arg: string) => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        fn(arg);
      }, 300);
    };
  }

  let pagefindInstance: PagefindApi | null = null;

  async function getPagefind() {
    if (isDev) {
      return null;
    }
    if (pagefindInstance) {
      return pagefindInstance;
    }
    try {
        pagefindInstance = await loadPagefind(baseUrl);
        return pagefindInstance;
      } catch (err) {
        console.error('[search]', 'Failed to load Pagefind. Check that the build ran pagefind, BASE_URL matches this deploy, and /pagefind/ is served.', err);
        return null;
      }
  }

  async function runSearch(query: string) {
    if (!query) {
      elStatus.textContent = '';
      elList.innerHTML = '';
      return;
    }

    elStatus.textContent = 'Searching…';
    elList.innerHTML = '';

    if (isDev) {
      renderUnloaded();
      return;
    }

    const pagefind = await getPagefind();
    if (!pagefind) {
      renderUnloaded();
      return;
    }

      let response;
      try {
        response = await pagefind.search(query);
      } catch (err) {
        console.error('[search]', err);
        renderUnloaded('Search failed. Open the browser console (F12) for details.');
        return;
      }
      if (!response || !response.results || response.results.length === 0) {
        elStatus.textContent = 'No results found.';
        return;
      }

      const { results } = response;
      elStatus.textContent = `Found ${results.length} result${results.length === 1 ? '' : 's'}.`;
      const fragment = document.createDocumentFragment();
      for (const r of results) {
        let d;
        try {
          d = await r.data();
        } catch (err) {
          console.error('[search]', 'Result fragment failed to load', err);
          continue;
        }
      const li = document.createElement('li');
      li.className = 'rounded-lg border border-gray-200 bg-cream/40 p-4';
      const t =
        typeof d.meta?.title === 'string' && d.meta.title ? d.meta.title : 'Untitled';
      const href = hrefWithBase(d.url, baseUrl);
      const part = d.excerpt || d.plain_excerpt || '';
      li.innerHTML = [
        '<a class="font-serif text-lg font-semibold text-primary hover:underline" href="',
        escapeHtml(href),
        '">',
        escapeHtml(t),
        '</a>',
        '<p class="mt-1 text-sm text-gray-700 prose-green">',
        part,
        '</p>',
      ].join('');
      fragment.appendChild(li);
    }
    elList.appendChild(fragment);
  }

  const runSearchDebounced = debounceInput(runSearch);

  elInput.value = getQueryFromUrl();
  void runSearch(getQueryFromUrl());

  elForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = elInput.value.trim();
    setUrlQuery(q);
    void runSearch(q);
  });

  elInput.addEventListener('input', () => {
    const q = elInput.value.trim();
    setUrlQuery(q);
    runSearchDebounced(q);
  });
}

initSearch();
