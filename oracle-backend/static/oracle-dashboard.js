      // State
      let currentPage = 'overview';
      let activityRange = 'today';
      let activityVersion = '';
      let lastBatchData = null;
      let batchTab = 'info';
      let lastFlushData = null;
      let flushTab = 'info';
      let calendarMonthOffset = 0;
      let allTimeActivityPoints = [];
          let oracleClockIs24 = localStorage.getItem('oracle_clock_24h') !== 'false';
      let refreshIntervalId = null;
      let websiteAnalyticsRange = '7d';
      let chartsRange = 'week';
      let chartsDimension = 'browser';
      let chartsComparePrevious = false;
      let dailyDownloadsRange = '14';
      let chartsLastExportRows = [];
      let chartsLastExportName = 'chart_data';
	      const NAV_GROUP_STATE_KEY = 'oracle_nav_group_state_v1';
	          const DEFAULT_INFRA_LINKS = {
	            cloudflare: 'https://cqd-analytics.adhamhaithameid.workers.dev/',
	            website: '',
	            uptimeKuma: 'https://cqd-analytics.adhamhaithameid.workers.dev/pipeline-health',
	            githubRepo: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader',
	            googleSheets: 'https://docs.google.com/spreadsheets/d/1ptzLKUVnAkyXnT635Zgb1C6Img9aeAZ1se3nRz_QZmI/edit?gid=0#gid=0',
            figmaDesign: 'https://www.figma.com/design/hQLRpncinKnJQRG1lhCdQG/Google-Classroom-Downloade-Icon?node-id=0-1&t=5Eimhfrvp8RwFC19-1',
            chromeDevDashboard: 'https://chrome.google.com/webstore/devconsole/9fe14497-b35b-4542-9af0-dedfdf6a194c',
            firefoxDevDashboard: 'https://addons.mozilla.org/en-US/firefox/user/19632882/',
            edgeDevDashboard: 'https://partner.microsoft.com/en-us/dashboard/microsoftedge/7b2c7f20-4ea7-4b63-bbdb-5acabc886215/analytics',
            chromeStoreListing: 'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
            firefoxStoreListing: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
            edgeStoreListing: 'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn'
      };
      const USER_CHANGELOG_RECORD_TYPE = 'website_user_changelog_entry';
      const USER_CHANGELOG_REVISION_RECORD_TYPE = 'website_user_changelog_revision';
      const USER_CHANGELOG_CONFIG_RECORD_TYPE = 'website_user_changelog_config';

      // Helpers
      let authInFlight = null;
      let authModalPromise = null;
      let authModalResolve = null;
      let authModalInitialized = false;
      let stepUpInFlight = null;
      let stepUpModalPromise = null;
      let stepUpModalResolve = null;
      let stepUpModalInitialized = false;
      let stepUpChallengeId = '';

      function setAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        if (!errorEl) return;
        if (!message) {
          errorEl.textContent = '';
          errorEl.classList.remove('visible');
          return;
        }
        errorEl.textContent = message;
        errorEl.classList.add('visible');
      }

      function showAuthModal() {
        const modal = document.getElementById('auth-modal');
        const input = document.getElementById('auth-password-input');
        if (!modal || !input) return;
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        input.value = '';
        setAuthError('');
        setTimeout(function() { input.focus(); }, 0);
      }

      function hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        setAuthError('');
      }

      function sleepMs(ms) {
        return new Promise(function(resolve) {
          setTimeout(resolve, ms);
        });
      }

      async function fetchAuthCheckWithRetry(maxAttempts) {
        var attempts = Number(maxAttempts || 1);
        if (!Number.isFinite(attempts) || attempts < 1) attempts = 1;
        attempts = Math.floor(attempts);

        for (var i = 0; i < attempts; i++) {
          try {
            const checkRes = await fetch('/api/auth/check', {
              cache: 'no-store',
              credentials: 'same-origin',
              headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (checkRes.ok) {
              const checkPayload = await checkRes.json().catch(function() { return {}; });
              if (checkPayload && (checkPayload.authRequired === false || checkPayload.authenticated === true)) {
                return checkPayload;
              }
            }
          } catch (_) {
            // Retry below.
          }

          if (i < attempts - 1) {
            await sleepMs(120 * (i + 1));
          }
        }

        return { authenticated: false, authRequired: true };
      }

      function initAuthModal() {
        if (authModalInitialized) return;
        authModalInitialized = true;
        const form = document.getElementById('auth-form');
        const input = document.getElementById('auth-password-input');
        const submitBtn = document.getElementById('auth-password-submit');
        if (!form || !input || !submitBtn) return;

        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          if (submitBtn.disabled) return;
          const password = input.value || '';
          if (!password.trim()) {
            setAuthError('Access key is required.');
            input.focus();
            return;
          }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Unlocking...';
          setAuthError('');

          try {
            const loginRes = await fetch('/api/auth/login', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({ password: password }),
            });

            if (!loginRes.ok) {
              if (loginRes.status === 429) {
                setAuthError('Too many attempts. Please wait and try again.');
              } else {
                setAuthError('Authentication failed. Please try again.');
              }
              input.select();
              input.focus();
              return;
            }

            // Confirm the browser persisted the session cookie before closing modal.
            // Some browsers can apply Set-Cookie from fetch responses with slight delay.
            const checkPayload = await fetchAuthCheckWithRetry(4);
            if (!checkPayload || (checkPayload.authRequired !== false && checkPayload.authenticated !== true)) {
              setAuthError('Session cookie was not saved by your browser. Enable cookies and refresh. For HTTP mode set SESSION_COOKIE_SECURE=false.');
              input.select();
              input.focus();
              return;
            }

            hideAuthModal();
            if (authModalResolve) {
              authModalResolve(true);
            }
            authModalResolve = null;
            authModalPromise = null;
          } catch {
            setAuthError('Login request failed. Check your connection and try again.');
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unlock';
          }
        });
      }

      function requestAuthModalUnlock() {
        initAuthModal();
        if (authModalPromise) return authModalPromise;
        showAuthModal();
        authModalPromise = new Promise(function(resolve) {
          authModalResolve = resolve;
        });
        return authModalPromise;
      }

      function setStepUpError(message) {
        const errorEl = document.getElementById('stepup-error');
        if (!errorEl) return;
        if (!message) {
          errorEl.textContent = '';
          errorEl.classList.remove('visible');
          return;
        }
        errorEl.textContent = message;
        errorEl.classList.add('visible');
      }

      function showStepUpModal(challengeId) {
        const modal = document.getElementById('stepup-modal');
        const input = document.getElementById('stepup-password-input');
        if (!modal || !input) return;
        stepUpChallengeId = challengeId || '';
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        input.value = '';
        setStepUpError('');
        setTimeout(function() { input.focus(); }, 0);
      }

      function hideStepUpModal() {
        const modal = document.getElementById('stepup-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        stepUpChallengeId = '';
        setStepUpError('');
      }

      function resolveStepUpModal(result) {
        if (stepUpModalResolve) {
          stepUpModalResolve(!!result);
        }
        stepUpModalResolve = null;
        stepUpModalPromise = null;
      }

      function closeStepUpModal() {
        hideStepUpModal();
        resolveStepUpModal(false);
      }

      function initStepUpModal() {
        if (stepUpModalInitialized) return;
        stepUpModalInitialized = true;
        const modal = document.getElementById('stepup-modal');
        const form = document.getElementById('stepup-form');
        const input = document.getElementById('stepup-password-input');
        const submitBtn = document.getElementById('stepup-password-submit');
        const cancelBtn = document.getElementById('stepup-cancel-btn');
        if (!modal || !form || !input || !submitBtn || !cancelBtn) return;

        cancelBtn.addEventListener('click', function() {
          closeStepUpModal();
        });

        modal.addEventListener('click', function(ev) {
          if (ev.target === modal) {
            closeStepUpModal();
          }
        });

        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          if (submitBtn.disabled) return;
          const password = input.value || '';
          if (!password.trim()) {
            setStepUpError('Verification key is required.');
            input.focus();
            return;
          }
          if (!stepUpChallengeId) {
            setStepUpError('Step-up challenge expired. Retry the action.');
            return;
          }

          submitBtn.disabled = true;
          cancelBtn.disabled = true;
          submitBtn.textContent = 'Verifying...';
          setStepUpError('');

          try {
            await fetchJSONWithInit('/api/auth/stepup/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ challengeId: stepUpChallengeId, password: password })
            }, { retryOn401: false });
            hideStepUpModal();
            resolveStepUpModal(true);
          } catch (e) {
            var status = 0;
            var code = '';
            if (e && typeof e === 'object') {
              if (typeof e.status === 'number') status = e.status;
              if (typeof e.code === 'string') code = e.code;
            }
            if (status === 429 || code === 'too many attempts') {
              setStepUpError('Too many attempts. Wait before retrying.');
            } else if (code === 'invalid_or_expired_challenge' || code === 'missing_parent_session' || status === 400) {
              setStepUpError('Step-up challenge expired. Retry the action.');
              stepUpChallengeId = '';
            } else if (code === 'unauthorized') {
              setStepUpError('Session expired. Please sign in again.');
              stepUpChallengeId = '';
            } else if (code === 'invalid password' || (status === 401 && code !== 'unauthorized') || status === 403) {
              setStepUpError('Verification failed. Please try again.');
              input.select();
            } else {
              setStepUpError('Verification failed. Please try again.');
            }
            input.focus();
          } finally {
            submitBtn.disabled = false;
            cancelBtn.disabled = false;
            submitBtn.textContent = 'Verify';
          }
        });
      }

      function requestStepUpModal(challengeId) {
        initStepUpModal();
        if (stepUpModalPromise) {
          if (challengeId) stepUpChallengeId = challengeId;
          return stepUpModalPromise;
        }
        showStepUpModal(challengeId);
        stepUpModalPromise = new Promise(function(resolve) {
          stepUpModalResolve = resolve;
        });
        return stepUpModalPromise;
      }

      async function openStepUpModal() {
        if (stepUpInFlight) return stepUpInFlight;
        stepUpInFlight = (async () => {
          try {
            var start = await fetchJSONWithInit('/api/auth/stepup/start', { method: 'POST' });
            if (!start.required) return true;
            if (!start.challengeId) return false;
            return requestStepUpModal(start.challengeId);
          } catch (_) {
            return false;
          }
        })();
        var ok = await stepUpInFlight;
        stepUpInFlight = null;
        return ok;
      }

      async function ensureAuth() {
        if (authInFlight) return authInFlight;
        authInFlight = (async () => {
          try {
            const check = await fetchAuthCheckWithRetry(2);
            if (check.authRequired === false || check.authenticated === true) {
              hideAuthModal();
              return true;
            }
            return requestAuthModalUnlock();
          } catch {
            return false;
          }
        })();
        const ok = await authInFlight;
        authInFlight = null;
        return ok;
      }

      async function fetchJSONWithInit(url, init, options) {
        var requestOptions = options ? Object.assign({}, options) : {};
        var retryOn401 = requestOptions.retryOn401 !== false;
        var requestInit = init ? Object.assign({}, init) : {};
        requestInit.headers = mergeRequestHeaders(init && init.headers);
        if (!requestInit.method) requestInit.method = 'GET';
        if (!requestInit.credentials) requestInit.credentials = 'same-origin';
        let res = await fetch(url, requestInit);
        if (retryOn401 && res.status === 401) {
          const ok = await ensureAuth();
          if (!ok) throw new Error("HTTP 401");
          res = await fetch(url, requestInit);
        }
        if (!res.ok) {
          var payload = null;
          var responseText = '';
          try {
            var contentType = (res.headers && typeof res.headers.get === 'function' && res.headers.get('Content-Type')) || '';
            if (contentType.indexOf('application/json') !== -1) {
              payload = await res.json();
            } else {
              responseText = await res.text();
              if (responseText) {
                try {
                  payload = JSON.parse(responseText);
                } catch (_) { /* non-json response body */ }
              }
            }
          } catch (_) { /* ignore parse errors */ }

          var err = new Error("HTTP " + res.status);
          err.status = res.status;
          if (payload && typeof payload === 'object') {
            err.payload = payload;
            if (typeof payload.error === 'string' && payload.error) {
              err.code = payload.error;
            }
          }
          throw err;
        }
        return res.json();
      }

      async function fetchJSON(url, options) {
        return fetchJSONWithInit(url, null, options);
      }

      /**
       * Wrapper around fetchJSON with a localStorage TTL cache.
       * Serves cached data when fresh enough, reducing redundant API calls
       * on rapid page navigations or re-renders.
       *
       * @param {string} url    API endpoint to fetch.
       * @param {number} ttlMs  Cache lifetime in milliseconds.
       * @returns {Promise<any>} Parsed JSON response (from cache or network).
       * @throws {Error} Network/HTTP errors propagate to the caller; stale
       *   cache entries are NOT used as a fallback on fetch failure.
       */
      function cachedFetchJSON(url, ttlMs, options) {
        var fetchOptions = options ? Object.assign({}, options) : {};
        var forceRefresh = !!fetchOptions.forceRefresh;
        var key = 'orc_cache_' + url;
        if (!forceRefresh) {
          try {
            var cached = localStorage.getItem(key);
            if (cached) {
              var parsed = JSON.parse(cached);
              if (parsed.ts && Date.now() - parsed.ts < ttlMs) {
                return Promise.resolve(parsed.data);
              }
            }
          } catch (_) { /* ignore parse/storage errors */ }
        }
        return fetchJSON(url, fetchOptions).then(function(data) {
          try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
          } catch (e) { if (typeof console !== 'undefined') console.warn('[cachedFetchJSON] localStorage write failed:', e); }
          return data;
        });
      }

      function mergeRequestHeaders(extraHeaders) {
        var headers = {};
        if (extraHeaders) {
          if (typeof Headers !== 'undefined' && extraHeaders instanceof Headers) {
            extraHeaders.forEach(function(v, k) { headers[k] = v; });
          } else if (Array.isArray(extraHeaders)) {
            extraHeaders.forEach(function(entry) {
              if (!entry || entry.length < 2) return;
              headers[String(entry[0])] = String(entry[1]);
            });
          } else {
            Object.keys(extraHeaders).forEach(function(k) { headers[k] = extraHeaders[k]; });
          }
        }
        headers['X-Requested-With'] = 'XMLHttpRequest';
        return headers;
      }

      function formatOracleUtcClock(ts) {
        return new Date(ts).toLocaleTimeString('en-US', {
          timeZone: 'UTC',
          hour12: !oracleClockIs24,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }

      function updateOracleUtcClock() {
        var wrap = document.getElementById('top-utc-clock');
        if (!wrap) return;
        var label = wrap.querySelector('.nav-utc-time');
        if (!label) return;
        var next = formatOracleUtcClock(Date.now());
        if (label.textContent !== next) label.textContent = next;
        label.classList.toggle('is-12h', !oracleClockIs24);
      }

      function initOracleUtcClock() {
        var wrap = document.getElementById('top-utc-clock');
        if (!wrap) return;
        updateOracleUtcClock();
        setInterval(updateOracleUtcClock, 1000);
        wrap.addEventListener('click', function() {
          var label = wrap.querySelector('.nav-utc-time');
          wrap.classList.remove('is-toggling');
          void wrap.offsetWidth;
          wrap.classList.add('is-toggling');
          if (label) {
            label.classList.remove('is-swapping');
            void label.offsetWidth;
            label.classList.add('is-swapping');
          }
          oracleClockIs24 = !oracleClockIs24;
          localStorage.setItem('oracle_clock_24h', oracleClockIs24 ? 'true' : 'false');
          setTimeout(function() {
            updateOracleUtcClock();
          }, 140);
          setTimeout(function() {
            wrap.classList.remove('is-toggling');
            if (label) label.classList.remove('is-swapping');
          }, 300);
        });
      }

      function fmtPct(v) { return (v * 100).toFixed(1) + "%"; }

      // XSS prevention: escape untrusted strings for HTML context
      function escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      var COUNTRY_NAME_ALIASES = {
        UK: 'United Kingdom',
        EL: 'Greece'
      };
      var countryDisplayNames = (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function')
        ? new Intl.DisplayNames(['en'], { type: 'region' })
        : null;

      function resolveCountryName(code) {
        var normalized = String(code || '').trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(normalized)) return '';
        if (normalized === 'XX' || normalized === 'ZZ' || normalized === 'UN' || normalized === 'EU') return '';
        if (COUNTRY_NAME_ALIASES[normalized]) return COUNTRY_NAME_ALIASES[normalized];
        if (!countryDisplayNames) return '';
        try {
          return countryDisplayNames.of(normalized) || '';
        } catch (_) {
          return '';
        }
      }

      function applyCountryTooltip(el, code) {
        if (!el) return;
        var countryName = resolveCountryName(code);
        if (countryName) {
          el.setAttribute('data-tooltip', countryName);
        } else {
          el.removeAttribute('data-tooltip');
        }
      }

      function safeDomIdPart(v) {
        return encodeURIComponent(String(v || ''));
      }

      function deploymentInputId(field, key) {
        return 'dep-' + field + '-' + safeDomIdPart(key);
      }

      
      function fmtNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(1) + "K";
        return (n || 0).toLocaleString();
      }

      function parseMaybeNumber(value) {
        if (value === null || value === undefined || value === "") return null;
        var n = Number(value);
        return Number.isFinite(n) ? n : null;
      }

      function countUniqueMetricKeys(metricMap) {
        var src = metricMap || {};
        return Object.keys(src).filter(function(key) {
          var trimmed = String(key || '').trim();
          if (!trimmed) return false;
          var val = Number(src[key] || 0);
          return Number.isFinite(val) && val > 0;
        }).length;
      }

      function parseApproxCountText(value) {
        var text = String(value || '').trim().toLowerCase();
        if (!text) return 0;
        text = text.replace(/,/g, '').replace(/\s+/g, '');
        if (text.endsWith('+')) text = text.slice(0, -1);
        var multiplier = 1;
        if (text.endsWith('k')) {
          multiplier = 1000;
          text = text.slice(0, -1);
        } else if (text.endsWith('m')) {
          multiplier = 1000000;
          text = text.slice(0, -1);
        }
        var n = Number(text);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.round(n * multiplier);
      }

      function metricCountValue(primaryValue, fallbackText) {
        var n = parseMaybeNumber(primaryValue);
        if (n !== null) return Math.max(0, Math.round(n));
        return parseApproxCountText(fallbackText);
      }

      function fmtNumberOrNA(value, known) {
        if (known === false) return "N/A";
        var n = parseMaybeNumber(value);
        if (n === null) return "N/A";
        return fmtNumber(n);
      }

      function fmtUtcDateTimeFromMs(tsMs) {
        var n = parseMaybeNumber(tsMs);
        if (n === null || n <= 0) return "n/a";
        var d = new Date(n);
        if (isNaN(d.getTime())) return "n/a";
        return d.toLocaleString("en-US", {
          timeZone: "UTC",
          hour12: false
        });
      }

      function inferSummaryDataTimestampMs(summary) {
        var candidates = [];
        if (summary && summary.lastBatch) {
          candidates.push(parseMaybeNumber(summary.lastBatch.ingestedAt));
          candidates.push(parseMaybeNumber(summary.lastBatch.generatedAt));
        }
        if (summary && summary.doState) {
          candidates.push(parseMaybeNumber(summary.doState.capturedAt));
        }
        candidates = candidates.filter(function(v) { return v !== null && v > 0; });
        if (!candidates.length) return null;
        return Math.max.apply(null, candidates);
      }

      function normalizeDeploymentStoreMetrics(payload) {
        var targets = (payload && Array.isArray(payload.targets)) ? payload.targets : [];
        var aggregate = (payload && payload.aggregates) ? payload.aggregates : {};
        var browserRows = Array.isArray(aggregate.browsers) ? aggregate.browsers : [];
        var rowByKey = {};

        browserRows.forEach(function(row) {
          var key = String(row.key || '').trim();
          if (!key) return;
          rowByKey[key] = {
            key: key,
            name: String(row.name || key),
            usersCount: metricCountValue(row.usersCount, row.users || ''),
            reviewsCount: metricCountValue(row.reviews, row.ratingCount || ''),
            syncedAtUtc: metricCountValue(row.syncedAtUtc, '')
          };
        });

        targets.forEach(function(item) {
          var key = String((item && item.recordKey) || '').trim();
          if (!key) return;
          var data = (item && item.data) ? item.data : {};
          var current = rowByKey[key] || { key: key };
          current.name = current.name || String(data.name || key);
          current.usersCount = metricCountValue(
            (Object.prototype.hasOwnProperty.call(data, 'usersCount') ? data.usersCount : current.usersCount),
            data.users || ''
          );
          current.reviewsCount = metricCountValue(
            (Object.prototype.hasOwnProperty.call(data, 'ratingCount') ? data.ratingCount : current.reviewsCount),
            ''
          );
          current.syncedAtUtc = Math.max(
            metricCountValue(current.syncedAtUtc, ''),
            metricCountValue(data.syncedAt, ''),
            metricCountValue(item.updatedAt, '')
          );
          rowByKey[key] = current;
        });

        var rows = Object.keys(rowByKey).map(function(key) { return rowByKey[key]; });
        rows.sort(function(a, b) {
          if (b.usersCount === a.usersCount) return String(a.key).localeCompare(String(b.key));
          return b.usersCount - a.usersCount;
        });

        var usersTotal = parseMaybeNumber(aggregate.usersTotal);
        var reviewsTotal = parseMaybeNumber(aggregate.reviewsTotal);
        if (usersTotal === null) {
          usersTotal = rows.reduce(function(sum, row) { return sum + (row.usersCount || 0); }, 0);
        }
        if (reviewsTotal === null) {
          reviewsTotal = rows.reduce(function(sum, row) { return sum + (row.reviewsCount || 0); }, 0);
        }

        var lastSyncedAtUtc = parseMaybeNumber(aggregate.lastSyncedAtUtc);
        if (lastSyncedAtUtc === null) {
          lastSyncedAtUtc = rows.reduce(function(maxSeen, row) {
            return Math.max(maxSeen, row.syncedAtUtc || 0);
          }, 0);
        }

        return {
          usersTotal: Math.max(0, Math.round(usersTotal || 0)),
          reviewsTotal: Math.max(0, Math.round(reviewsTotal || 0)),
          browsers: rows,
          lastSyncedAtUtc: Math.max(0, Math.round(lastSyncedAtUtc || 0))
        };
      }

      function renderOverviewStoreMetrics(summary) {
        var usersEl = document.getElementById('stat-store-users');
        var reviewsEl = document.getElementById('stat-store-reviews');
        var usersValue = parseMaybeNumber(summary && summary.usersTotal);
        var reviewsValue = parseMaybeNumber(summary && summary.reviewsTotal);
        if (usersEl) usersEl.textContent = usersValue === null ? '--' : fmtNumber(usersValue);
        if (reviewsEl) reviewsEl.textContent = reviewsValue === null ? '--' : fmtNumber(reviewsValue);
      }

      async function loadDeploymentStoreMetrics() {
        try {
          var payload = await fetchJSON('/api/admin/deployments/targets');
          var metrics = normalizeDeploymentStoreMetrics(payload || {});
          renderOverviewStoreMetrics(metrics);
        } catch (_) {
          renderOverviewStoreMetrics({ usersTotal: null, reviewsTotal: null });
        }
      }

      function sourceLabelFromCode(source) {
        var s = String(source || "").toLowerCase();
        if (s === "live") return "Live";
        if (s === "cache") return "Cached";
        if (s === "stale_cache") return "Stale Cache";
        if (s === "unavailable") return "Unavailable";
        return "Unknown";
      }

      function fmtTimestamp(ts, granularity) {
        if (!ts) return '--';
        const date = new Date(ts.includes('T') ? ts : ts + 'T00:00:00Z');
        if (isNaN(date.getTime())) return ts;
        
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        const dateKey = date.toISOString().slice(0, 10);
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayKey = yesterday.toISOString().slice(0, 10);
        const isToday = dateKey === todayKey;
        const isYesterday = dateKey === yesterdayKey;
        
        if (granularity === 'hour') {
          const hours = date.getUTCHours();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const h = hours % 12 || 12;
          const timeStr = h + ':00 ' + ampm;
          if (isToday) return 'Today, ' + timeStr;
          if (isYesterday) return 'Yesterday, ' + timeStr;
          return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) + ', ' + timeStr;
        }
        
        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';
        return date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
      }

      function fmtShortTime(ts) {
        if (!ts) return '';
        const date = new Date(ts.includes('T') ? ts : ts + 'T00:00:00Z');
        if (isNaN(date.getTime())) return ts.slice(-5);
        if (ts.includes('T')) return date.getUTCHours() + ':00';
        return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      }

      function fmtFullDateTime(ts) {
        if (!ts) return '--';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return ts;
        return date.toLocaleString('en-US', {
          timeZone: 'UTC',
          weekday: 'short', month: 'short', day: 'numeric', 
          hour: 'numeric', minute: '2-digit', hour12: true
        });
      }

      function timeAgo(ts) {
        if (!ts) return '';
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);
        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return diffMin + 'm ago';
        if (diffHr < 24) return diffHr + 'h ago';
        return diffDay + 'd ago';
      }

      function getDateRange(days) {
        const today = new Date();
        const to = today.toISOString().slice(0, 10); // inclusive end (today)
        const fromDate = new Date(today);
        if (days > 1) fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
        const from = fromDate.toISOString().slice(0, 10);
        return { from: from, to: to };
      }

      function activityRangeParams(range) {
        switch (range) {
          case 'today': return { range: 'today', granularity: 'hour' };
          case 'week': return { range: 'week', granularity: 'day' };
          case 'month': return { range: 'month', granularity: 'day' };
          case 'year': return { range: 'year', granularity: 'day' };
          case 'all': return { range: 'all', granularity: 'day' };
          default: return { range: 'week', granularity: 'day' };
        }
      }

      function chartsRangeParams(range) {
        switch (String(range || '').toLowerCase()) {
          case 'today': return { range: 'today', granularity: 'hour' };
          case 'week': return { range: 'week', granularity: 'day' };
          case 'month': return { range: 'month', granularity: 'day' };
          case 'year': return { range: 'year', granularity: 'day' };
          case 'all': return { range: 'all', granularity: 'day' };
          default: return { range: 'week', granularity: 'day' };
        }
      }

      function parseIsoDate(iso) {
        var value = String(iso || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        var date = new Date(value + 'T00:00:00Z');
        if (Number.isNaN(date.getTime())) return null;
        return date;
      }

      function previousDateWindow(fromIso, toIso) {
        var fromDate = parseIsoDate(fromIso);
        var toDate = parseIsoDate(toIso);
        if (!fromDate || !toDate) return null;
        var dayMs = 24 * 60 * 60 * 1000;
        var spanDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / dayMs) + 1);
        var prevTo = new Date(fromDate.getTime() - dayMs);
        var prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * dayMs);
        return {
          from: prevFrom.toISOString().slice(0, 10),
          to: prevTo.toISOString().slice(0, 10)
        };
      }

      function setChartsWindowMeta(meta) {
        var node = document.getElementById('charts-window-meta');
        if (!node) return;
        if (!meta) {
          node.textContent = '--';
          return;
        }
        var start = String(meta.windowStartUtc || '').trim();
        var end = String(meta.windowEndUtc || '').trim();
        var generatedAt = String(meta.generatedAtUtc || '').trim();
        var text = (start || '--') + ' → ' + (end || '--');
        if (generatedAt) text += ' · generated ' + generatedAt;
        node.textContent = text;
      }

      function setChartsExportDataset(name, rows) {
        chartsLastExportName = String(name || 'chart_data').trim() || 'chart_data';
        chartsLastExportRows = Array.isArray(rows) ? rows : [];
      }

      function exportRowsAsCSV(name, rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        var columns = Object.keys(rows[0] || {});
        if (!columns.length) return;
        var csv = columns.join(',') + '\n';
        rows.forEach(function(row) {
          var values = columns.map(function(col) {
            var raw = row[col];
            var text = String(raw == null ? '' : raw);
            if (text.includes('"') || text.includes(',') || text.includes('\n')) {
              return '"' + text.replace(/"/g, '""') + '"';
            }
            return text;
          });
          csv += values.join(',') + '\n';
        });
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var dateToken = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = chartsLastExportName + '_' + dateToken + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      }

      function getBrowserIcon(b) {
        var icons = {
          chrome: '🌐',
          firefox: '🦊',
          safari: '🧭',
          edge: '🔷',
          opera: '🎭',
          brave: '🦁'
        };
        return icons[(b || '').toLowerCase()] || '🌐';
      }

      function getOSIcon(o) {
        var icons = {
          windows: '🪟',
          macos: '🍎',
          mac: '🍎',
          linux: '🐧',
          android: '🤖',
          ios: '📱'
        };
        return icons[(o || '').toLowerCase()] || '💻';
      }

      function getFileIcon(t) {
        var icons = {
          pdf: '📕',
          doc: '📝',
          docx: '📝',
          ppt: '📊',
          pptx: '📊',
          xls: '📗',
          xlsx: '📗',
          zip: '🗜️',
          jpg: '🖼️',
          png: '🖼️',
          gif: '🖼️',
          mp4: '🎬',
          mp3: '🎵',
          txt: '📄'
        };
        return icons[(t || '').toLowerCase()] || '📄';
      }

      // Floating tooltip
      var tooltip = document.getElementById('chart-tooltip');
      var currentTooltipEvent = null;
      var currentTooltipPayload = null;

      function positionTooltip(e) {
        if (!tooltip || !e) return;
        var x = Number(e.clientX || 0) + 16;
        var y = Number(e.clientY || 0) + 16;
        var viewportW = Math.max(320, window.innerWidth || 0);
        var viewportH = Math.max(240, window.innerHeight || 0);
        var tipW = Math.max(120, tooltip.offsetWidth || 220);
        var tipH = Math.max(60, tooltip.offsetHeight || 90);
        if (x + tipW > viewportW - 10) x = viewportW - tipW - 10;
        if (y + tipH > viewportH - 10) y = viewportH - tipH - 10;
        if (x < 10) x = 10;
        if (y < 10) y = 10;
        tooltip.style.left = String(x) + 'px';
        tooltip.style.top = String(y) + 'px';
      }
      
      function renderTooltip(e, payload) {
        var model = payload || {};
        var title = String(model.title || '');
        var rows = Array.isArray(model.rows) ? model.rows : [];
        var html = '<div class="tooltip-title">' + escapeHtml(title) + '</div>';
        rows.forEach(function(row) {
          var label = String((row && row.label) || '');
          var value = String((row && row.value) || '');
          var cssClass = String((row && row.className) || '');
          html += '<div class="tooltip-row"><span class="tooltip-label">' + escapeHtml(label) + '</span><span class="tooltip-value ' + escapeHtml(cssClass) + '">' + escapeHtml(value) + '</span></div>';
        });
        tooltip.innerHTML = html;
        tooltip.classList.add('visible');
        positionTooltip(e);
      }

      function showTooltip(e, payload) {
        currentTooltipEvent = e;
        currentTooltipPayload = payload;
        renderTooltip(e, payload);
      }
      
      function hideTooltip() { 
        currentTooltipEvent = null;
        currentTooltipPayload = null;
        if (tooltip) {
          tooltip.style.left = '';
          tooltip.style.top = '';
        }
        tooltip.classList.remove('visible'); 
      }

      // Batch Modal
      function showBatchModal() {
        document.getElementById('batch-modal').classList.add('visible');
        loadBatchInfo();
      }

      function closeBatchModal(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('batch-modal').classList.remove('visible');
      }

      function setBatchTab(tab) {
        batchTab = tab;
        var tabs = document.querySelectorAll('#batch-modal .modal-tabs .tab');
        tabs.forEach(function(t) {
          t.classList.toggle('active', t.textContent.includes(tab === 'info' ? 'Info' : 'JSON'));
        });
        renderBatchContent();
      }

      async function loadBatchInfo() {
        var container = document.getElementById('batch-info-content');
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
        try {
          lastBatchData = await cachedFetchJSON('/api/stats/summary', 30000);
          renderBatchContent();
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load</div>';
        }
      }

      function renderBatchContent() {
        var container = document.getElementById('batch-info-content');
        if (!lastBatchData) return;
        
        if (batchTab === 'json') {
          container.innerHTML = '<div class="json-viewer">' + syntaxHighlight(JSON.stringify(lastBatchData, null, 2)) + '</div>';
          return;
        }
        
        var lb = lastBatchData.lastBatch;
        var ds = lastBatchData.doState;
        var html = '<div class="batch-info-grid">';
        html += '<div class="batch-info-row"><span class="batch-info-label">Status</span><span class="batch-info-value">' + escapeHtml(lastBatchData.status || 'Unknown') + '</span></div>';
        
        if (lb) {
          html += '<div class="batch-info-row"><span class="batch-info-label">Last Batch ID</span><span class="batch-info-value batch-id-value">' + escapeHtml(lb.batchId || '--') + '</span></div>';
          html += '<div class="batch-info-row"><span class="batch-info-label">Received</span><span class="batch-info-value">' + fmtFullDateTime(lb.ingestedAt) + ' (' + timeAgo(lb.ingestedAt) + ')</span></div>';
          html += '<div class="batch-info-row"><span class="batch-info-label">Generated</span><span class="batch-info-value">' + fmtFullDateTime(lb.generatedAt) + '</span></div>';
          html += '<div class="batch-info-row"><span class="batch-info-label">Events</span><span class="batch-info-value">' + fmtNumber(lb.eventsCount) + '</span></div>';
          html += '<div class="batch-info-row"><span class="batch-info-label">Downloads</span><span class="batch-info-value">' + fmtNumber(lb.downloadsCount) + '</span></div>';
          html += '<div class="batch-info-row"><span class="batch-info-label">Success / Fail</span><span class="batch-info-value"><span class="text-success">' + fmtNumber(lb.successCount) + '</span> / <span class="text-danger">' + fmtNumber(lb.failCount) + '</span></span></div>';
        } else {
          html += '<div class="batch-info-row"><span class="batch-info-label">Last Batch</span><span class="batch-info-value text-muted">No batches yet</span></div>';
        }
        
        if (ds) {
          html += '<div class="batch-info-row"><span class="batch-info-label">Pending Events</span><span class="batch-info-value">' + fmtNumber(ds.pendingEvents) + '</span></div>';
        }
        html += '</div>';
        container.innerHTML = html;
      }

      function showFlushModal() {
        document.getElementById('flush-modal').classList.add('visible');
        loadFlushInfo();
      }

      function closeFlushModal(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('flush-modal').classList.remove('visible');
      }

      function setFlushTab(tab) {
        flushTab = tab;
        var tabs = document.querySelectorAll('#flush-modal .modal-tabs .tab');
        tabs.forEach(function(t) {
          t.classList.toggle('active', t.textContent.includes(tab === 'info' ? 'Info' : 'JSON'));
        });
        renderFlushContent();
      }

      async function loadFlushInfo() {
        var container = document.getElementById('flush-info-content');
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
        try {
          lastFlushData = await fetchJSON('/api/admin/sheets/last-flush');
          renderFlushContent();
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load</div>';
        }
      }

      function renderFlushContent() {
        var container = document.getElementById('flush-info-content');
        if (!lastFlushData) return;

        if (flushTab === 'json') {
          container.innerHTML = '<div class="json-viewer">' + syntaxHighlight(JSON.stringify(lastFlushData, null, 2)) + '</div>';
          return;
        }

        if (!lastFlushData.exists || !lastFlushData.run) {
          container.innerHTML = '<div class="empty-state">No Sheets flush recorded yet</div>';
          return;
        }

        var run = lastFlushData.run || {};
        var row = Array.isArray(run.row) ? run.row : [];
        var columnNames = [
          'Date',
          'Total Downloads',
          'Success',
          'Fail',
          'Success Rate',
          'Top Browser',
          'Top OS',
          'Top Country',
          'Top Type',
          'All Browsers',
          'All OS',
          'All Countries',
          'All Languages',
          'All File Types',
          'All Errors',
          'Ext Versions',
          'Total Cancelled'
        ];

        var html = '<div class="batch-info-grid">';
        html += '<div class="batch-info-row"><span class="batch-info-label">Status</span><span class="batch-info-value">' + escapeHtml(String(run.status || 'unknown')) + '</span></div>';
        html += '<div class="batch-info-row"><span class="batch-info-label">Flushed At</span><span class="batch-info-value">' + fmtFullDateTime(run.flushedAtUtc) + (run.flushedAtUtc ? ' (' + timeAgo(run.flushedAtUtc) + ')' : '') + '</span></div>';
        html += '<div class="batch-info-row"><span class="batch-info-label">Archived Day</span><span class="batch-info-value">' + escapeHtml(String(run.archivedDay || '--')) + '</span></div>';
        html += '<div class="batch-info-row"><span class="batch-info-label">Sheet ID</span><span class="batch-info-value">' + escapeHtml(String(run.sheetId || '--')) + '</span></div>';
        html += '<div class="batch-info-row"><span class="batch-info-label">API URL</span><span class="batch-info-value">' + escapeHtml(String(run.apiUrl || '--')) + '</span></div>';
        if (run.error) {
          html += '<div class="batch-info-row"><span class="batch-info-label">Error</span><span class="batch-info-value text-danger">' + escapeHtml(String(run.error)) + '</span></div>';
        }
        html += '</div>';

        if (row.length > 0) {
          html += '<div class="batch-info-grid" style="margin-top:12px">';
          for (var i = 0; i < row.length; i++) {
            var label = columnNames[i] || ('Column ' + (i + 1));
            var value = row[i];
            var display = typeof value === 'string' ? value : JSON.stringify(value);
            html += '<div class="batch-info-row"><span class="batch-info-label">' + escapeHtml(label) + '</span><span class="batch-info-value">' + escapeHtml(String(display || '')) + '</span></div>';
          }
          html += '</div>';
        }

        container.innerHTML = html;
      }

      // Security: syntaxHighlight is ONLY safe for input from JSON.stringify().
      // JSON.stringify guarantees no unquoted HTML-special characters in output.
      // We escape &, <, > for defense-in-depth. Quotes are NOT escaped because
      // the regex below matches JSON string delimiters — escaping them would
      // break pattern matching. Do NOT pass untrusted raw strings here.
      function syntaxHighlight(json) {
        if (typeof json !== 'string') return '';
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
          var cls = 'json-number';
          if (/^"/.test(match)) { cls = /:$/.test(match) ? 'json-key' : 'json-string'; }
          else if (/true|false/.test(match)) { cls = 'json-boolean'; }
          else if (/null/.test(match)) { cls = 'json-null'; }
          return '<span class="' + cls + '">' + match + '</span>';
        });
      }

      function readNavGroupState() {
        try {
          var raw = localStorage.getItem(NAV_GROUP_STATE_KEY);
          if (!raw) return {};
          var parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') return {};
          return parsed;
        } catch (_) {
          return {};
        }
      }

      function persistNavGroupState(state) {
        try {
          localStorage.setItem(NAV_GROUP_STATE_KEY, JSON.stringify(state || {}));
        } catch (_) {}
      }

      function setNavGroupCollapsed(groupKey, collapsed) {
        var root = document.querySelector('.nav-group[data-nav-group="' + groupKey + '"]');
        if (!root) return;
        root.classList.toggle('collapsed', !!collapsed);
        var toggle = root.querySelector('[data-nav-group-toggle]');
        if (toggle) {
          toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }
      }

      function initNavGroupToggles() {
        var state = readNavGroupState();
        document.querySelectorAll('.nav-group[data-nav-group]').forEach(function(groupNode) {
          var groupKey = groupNode.getAttribute('data-nav-group') || '';
          if (!groupKey) return;
          setNavGroupCollapsed(groupKey, !!state[groupKey]);
        });

        document.querySelectorAll('[data-nav-group-toggle]').forEach(function(toggle) {
          if (toggle.dataset.boundClick === '1') return;
          toggle.dataset.boundClick = '1';
          toggle.addEventListener('click', function(ev) {
            ev.preventDefault();
            var groupKey = toggle.getAttribute('data-nav-group-toggle') || '';
            if (!groupKey) return;
            var root = document.querySelector('.nav-group[data-nav-group="' + groupKey + '"]');
            if (!root) return;
            var isCollapsed = root.classList.contains('collapsed');
            var nextState = readNavGroupState();
            nextState[groupKey] = !isCollapsed;
            persistNavGroupState(nextState);
            setNavGroupCollapsed(groupKey, !isCollapsed);
          });
        });
      }

      // Page Navigation
      function showPage(page) {
        currentPage = page;
        var pageGroups = {
          overview: ['overview'],
          activity: ['activity', 'charts'],
          dashboards: ['dashboards', 'deployments', 'notifications'],
          'website-sync': ['website-sync'],
          'website-analysis': ['website-analysis'],
          creative: ['creative'],
          'content-changelog': ['content-changelog'],
          logs: ['logs'],
          danger: ['danger']
        };
        var activePages = pageGroups[page] || [page];
        // Remove active from all pages (CSS transition handles fade-out)
        document.querySelectorAll('.page').forEach(function(p) {
          p.classList.remove('active');
        });
        // Add active to target pages (CSS visibility+opacity transition handles fade-in)
        activePages.forEach(function(p) {
          var el = document.getElementById('page-' + p);
          if (el) {
            el.classList.add('active');
          }
        });
        document.querySelectorAll('.nav-item').forEach(function(n) {
          n.classList.toggle('active', n.dataset.page === page);
        });
        var mobilePageSelect = document.getElementById('mobile-page-select');
        if (mobilePageSelect && mobilePageSelect.value !== page) {
          mobilePageSelect.value = page;
        }
        var titleMeta = {
          overview: { icon: '🏠', label: 'Overview' },
          activity: { icon: '📊', label: 'Activity & Charts' },
          dashboards: { icon: '🛰️', label: 'Ops Hub' },
          'website-sync': { icon: '🌐', label: 'Website Sync' },
          'website-analysis': { icon: '📈', label: 'Website Analysis' },
          creative: { icon: '🎨', label: 'Creative Hub' },
          'content-changelog': { icon: '🗞️', label: 'User Changelog' },
          logs: { icon: '🧾', label: 'Oracle Logs' },
          danger: { icon: '☢️', label: 'Danger Zone' }
        };
        var t = titleMeta[page] || { icon: '📄', label: page };
        document.getElementById('page-title').textContent = t.icon + ' ' + t.label;
        if (page === 'activity') {
          loadActivity();
          loadCharts();
          loadComparison();
        }
        if (page === 'dashboards' || page === 'content-changelog' || page === 'website-analysis') {
          loadDashboardLinks();
        }
        if (page === 'dashboards') {
          loadDeploymentsHub();
          loadNotifications();
        }
        if (page === 'website-sync') loadWebsiteSyncState();
        if (page === 'website-analysis') loadWebsiteAnalytics();
        if (page === 'creative') loadCreativeHub();
        if (page === 'content-changelog') loadUserChangelogRecords();
        if (page === 'logs') loadOracleLogs();
      }

      // Overview Page
      async function loadOverview(forceRefresh) {
        try {
          var data = await cachedFetchJSON("/api/stats/summary", 30000, { forceRefresh: !!forceRefresh });
          var statusLabel = (data.status || "unknown");
          var statusLabelTitle = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
          document.getElementById("sidebar-status").className = "status-dot " + 
            (statusLabel === "online" ? "" : statusLabel === "stale" ? "warning" : "error");
          document.getElementById("sidebar-status-text").textContent = 
            statusLabelTitle;
          var statusIndicatorEl = document.getElementById("status-indicator");
          if (statusIndicatorEl) {
            var statusFlags = Array.isArray(data.flags) && data.flags.length ? (" Flags: " + data.flags.join(", ")) : "";
            statusIndicatorEl.setAttribute("data-tooltip", "Backend status: " + statusLabelTitle + "." + statusFlags);
          }
          document.getElementById("stat-downloads").textContent = fmtNumber(data.totalDownloads);
          document.getElementById("stat-success").textContent = fmtNumber(data.totalSuccess);
          document.getElementById("stat-fail").textContent = fmtNumber(data.totalFail);
          document.getElementById("stat-cancelled").textContent = fmtNumber((data.totals && data.totals.totalCancelled) || 0);
          document.getElementById("stat-countries-reached").textContent = fmtNumber(countUniqueMetricKeys(data.countries || {}));
          document.getElementById("stat-languages-reached").textContent = fmtNumber(countUniqueMetricKeys(data.languages || {}));
          var summaryTs = inferSummaryDataTimestampMs(data);
          document.getElementById("last-updated").textContent = "Data updated (UTC): " + (summaryTs ? fmtUtcDateTimeFromMs(summaryTs) : "n/a");

          setAllTimeTop('browser', data.browsers || {});
          setAllTimeTop('os', data.os || {});
          setAllTimeTop('type', data.types || {});
          setAllTimeTop('country', data.countries || {});
          renderOverviewMiniCharts(data);
          updateVersionFilterOptions(data.versions || {});
          await loadDeploymentStoreMetrics();
          await loadOverviewWebsiteStats(!!forceRefresh);
        } catch (e) {
          document.getElementById("sidebar-status").className = "status-dot error";
          document.getElementById("sidebar-status-text").textContent = "Error";
          var statusIndicatorError = document.getElementById("status-indicator");
          if (statusIndicatorError) {
            statusIndicatorError.setAttribute("data-tooltip", "Backend status: Error. Last overview request failed.");
          }
          renderOverviewWebsiteStatsFallback();
        }
      }

      function renderOverviewWebsiteStatsFallback() {
        setTextOrPlaceholder('stat-website-visits', '--');
        setTextOrPlaceholder('stat-website-feedback', '--');
        setTextOrPlaceholder('stat-website-cta-clicks', '--');
        setTextOrPlaceholder('stat-website-map-ratio', '--');
        setTextOrPlaceholder('stat-website-map-total', '--');
      }

      function setTextOrPlaceholder(id, value) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = String(value == null ? '--' : value);
      }

      async function loadOverviewWebsiteStats(forceRefresh) {
        try {
          var analytics = await cachedFetchJSON('/api/admin/website/analytics?range=all', 45000, { forceRefresh: !!forceRefresh });
          var traffic = analytics && analytics.traffic ? analytics.traffic : {};
          var feedback = analytics && analytics.feedback ? analytics.feedback : {};
          var buttons = analytics && analytics.buttons ? analytics.buttons : {};
          var map = analytics && analytics.map ? analytics.map : {};
          var installClicks = Number(buttons.installClicks || 0);
          var downloadClicks = Number(buttons.downloadClicks || 0);
          var mapYes = Number(map.yes || 0);
          var mapNo = Number(map.no || 0);
          var mapResponses = mapYes + mapNo;
          var ratioPct = mapResponses > 0 ? (mapYes / mapResponses) * 100 : 0;

          setTextOrPlaceholder('stat-website-visits', fmtNumber(Number(traffic.visits || 0)));
          setTextOrPlaceholder('stat-website-feedback', fmtNumber(Number(feedback.totalSubmissions || 0)));
          setTextOrPlaceholder('stat-website-cta-clicks', fmtNumber(installClicks + downloadClicks));
          setTextOrPlaceholder('stat-website-map-ratio', mapResponses > 0 ? (ratioPct.toFixed(1) + '%') : '--');
          setTextOrPlaceholder('stat-website-map-total', 'Yes ' + fmtNumber(mapYes) + ' / No ' + fmtNumber(mapNo));
        } catch (_) {
          renderOverviewWebsiteStatsFallback();
        }
      }

      function setAllTimeTop(dim, valuesMap) {
        var entries = Object.entries(valuesMap || {});
        entries.sort(function(a, b) { return (b[1] || 0) - (a[1] || 0); });
        var top = entries[0] || ['No data', 0];
        var valueEl = document.getElementById('all-top-' + dim);
        var countEl = document.getElementById('all-top-' + dim + '-count');
        if (!valueEl || !countEl) return;
        valueEl.textContent = top[0];
        if (dim === 'country') {
          applyCountryTooltip(valueEl, top[0]);
        } else {
          valueEl.removeAttribute('data-tooltip');
        }
        countEl.textContent = fmtNumber(top[1]) + ' downloads';
      }

      function renderOverviewMiniCharts(summary) {
        var success = summary.totalSuccess || 0;
        var fail = summary.totalFail || 0;
        var downloads = summary.totalDownloads || 0;
        var cancelled = (summary.totals && summary.totals.totalCancelled) ? summary.totals.totalCancelled : 0;
        renderDonutChart('overview-success-fail-chart', {
          centerLabel: 'Outcomes',
          centerValue: fmtNumber(success + fail),
          segments: [
            { name: 'Success', value: success, color: '#14b8a6', dotClass: 'success' },
            { name: 'Failure', value: fail, color: '#ef4444', dotClass: 'fail' }
          ]
        });
        renderDonutChart('overview-cancelled-chart', {
          centerLabel: 'All Events',
          centerValue: fmtNumber(downloads + cancelled),
          segments: [
            { name: 'Downloads', value: downloads, color: '#3b82f6', dotClass: 'downloads' },
            { name: 'Cancelled', value: cancelled, color: '#f59e0b', dotClass: 'cancelled' }
          ]
        });
      }

      function renderDonutChart(containerId, config) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var segments = config.segments || [];
        var total = segments.reduce(function(acc, seg) { return acc + (seg.value || 0); }, 0);
        var radius = 50;
        var circumference = 2 * Math.PI * radius;
        var offset = 0;
        var svg = '<svg class="donut-svg" viewBox="0 0 120 120" aria-hidden="true">';
        svg += '<circle class="donut-track" cx="60" cy="60" r="' + radius + '"></circle>';
        if (total > 0) {
          segments.forEach(function(seg) {
            var value = Math.max(0, Number(seg.value || 0));
            if (value <= 0) return;
            var segLen = (value / total) * circumference;
            svg += '<circle class="donut-segment" cx="60" cy="60" r="' + radius + '" stroke="' + escapeHtml(seg.color || '#3b82f6') + '" stroke-dasharray="' + segLen.toFixed(4) + ' ' + circumference.toFixed(4) + '" stroke-dashoffset="' + (-offset).toFixed(4) + '"></circle>';
            offset += segLen;
          });
        }
        svg += '</svg>';

        var html = '<div class="donut-wrap">' + svg;
        html += '<div class="donut-hole"><div><div class="donut-value">' + escapeHtml(config.centerValue || '0') + '</div><div class="donut-label">' + escapeHtml(config.centerLabel || 'Total') + '</div></div></div></div>';
        html += '<div class="donut-legend">';
        segments.forEach(function(seg) {
          var pct = total > 0 ? (((seg.value || 0) / total) * 100) : 0;
          html += '<div class="donut-row">';
          html += '<span class="donut-dot ' + escapeHtml(seg.dotClass || '') + '"></span>';
          html += '<span class="donut-name">' + escapeHtml(seg.name || '-') + '</span>';
          html += '<span class="donut-count">' + escapeHtml(fmtNumber(seg.value || 0)) + '</span>';
          html += '<span class="donut-pct">' + escapeHtml(pct.toFixed(1)) + '%</span>';
          html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
      }

      function updateVersionFilterOptions(versionMap) {
        var select = document.getElementById('activity-version-filter');
        if (!select) return;
        var current = activityVersion || '';
        var versions = Object.keys(versionMap || {});
        versions.sort(function(a, b) {
          return (versionMap[b] || 0) - (versionMap[a] || 0);
        });
        var html = '<option value="">All Versions</option>';
        versions.forEach(function(v) {
          html += '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>';
        });
        select.innerHTML = html;
        select.value = current;
      }

      async function loadTopToday() {
        var dimensions = ['browser', 'os', 'type', 'country'];
        for (var i = 0; i < dimensions.length; i++) {
          var dim = dimensions[i];
          try {
            var data = await fetchJSON('/api/stats/breakdown?dimension=' + dim + '&range=today');
            var valueEl = document.getElementById('top-' + dim);
            var countEl = document.getElementById('top-' + dim + '-count');
            var tiedEl = document.getElementById('top-' + dim + '-tied');
            var iconEl = document.getElementById('top-' + dim + '-icon');
            
            if (data.values && data.values.length > 0) {
              var top = data.values[0];
              var topCount = top.count;
              var tiedItems = data.values.filter(function(v) { return v.count === topCount; });
              
              if (tiedItems.length > 1) {
                valueEl.textContent = tiedItems.map(function(t) { return t.value; }).join(' / ');
                countEl.textContent = fmtNumber(topCount) + ' each';
                tiedEl.textContent = tiedItems.length + '-way tie';
                if (dim === 'country') {
                  var countryNames = tiedItems
                    .map(function(t) { return resolveCountryName(t.value); })
                    .filter(function(name) { return !!name; });
                  if (countryNames.length) {
                    valueEl.setAttribute('data-tooltip', countryNames.join(' / '));
                  } else {
                    valueEl.removeAttribute('data-tooltip');
                  }
                } else {
                  valueEl.removeAttribute('data-tooltip');
                }
              } else {
                valueEl.textContent = top.value || 'Unknown';
                countEl.textContent = fmtNumber(topCount) + ' downloads';
                tiedEl.textContent = '';
                if (dim === 'country') {
                  applyCountryTooltip(valueEl, top.value);
                } else {
                  valueEl.removeAttribute('data-tooltip');
                }
              }
              
              if (dim === 'browser') iconEl.textContent = getBrowserIcon(top.value);
              if (dim === 'os') iconEl.textContent = getOSIcon(top.value);
              if (dim === 'type') iconEl.textContent = getFileIcon(top.value);
            } else {
              valueEl.textContent = 'No data';
              countEl.textContent = '';
              tiedEl.textContent = '';
              valueEl.removeAttribute('data-tooltip');
            }
          } catch (e) {
            var topValueNode = document.getElementById('top-' + dim);
            if (topValueNode) {
              topValueNode.textContent = '--';
              topValueNode.removeAttribute('data-tooltip');
            }
            document.getElementById('top-' + dim + '-count').textContent = '';
            document.getElementById('top-' + dim + '-tied').textContent = '';
          }
        }
      }

      // Activity Page
      function setActivityRange(range) {
        activityRange = range;
        document.querySelectorAll('#activity-tabs .tab').forEach(function(t) {
          t.classList.toggle('active', t.dataset.range === range);
        });
        loadActivity();
      }

      function onActivityVersionChange() {
        var select = document.getElementById('activity-version-filter');
        activityVersion = select ? select.value : '';
        loadActivity();
      }

      async function loadActivity() {
        var chartContainer = document.getElementById('activity-chart');
        var logContainer = document.getElementById('activity-log');
        chartContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
        logContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
        var range = activityRangeParams(activityRange);
        var params = '?range=' + encodeURIComponent(range.range) + '&granularity=' + encodeURIComponent(range.granularity);
        if (activityVersion) params += '&extVersion=' + encodeURIComponent(activityVersion);

        try {
          var data = await fetchJSON('/api/stats/timeseries' + params);
          
          if (!data.points || !data.points.length) {
            chartContainer.innerHTML = '<div class="empty-state">No activity data</div>';
            logContainer.innerHTML = '<div class="empty-state">No events</div>';
            document.getElementById('log-summary').classList.add('hidden');
            return;
          }

          // Store for sorting/export
          currentGranularity = range.granularity;

          renderBarChart(chartContainer, data.points, range.granularity);

          var totalDownloads = 0, totalSuccess = 0, totalFail = 0;
          data.points.forEach(function(p) {
            totalDownloads += p.downloads || 0;
            totalSuccess += p.success || 0;
            totalFail += p.fail || 0;
          });
          
          document.getElementById('activity-total').textContent = fmtNumber(totalDownloads);
          document.getElementById('activity-success').textContent = fmtNumber(totalSuccess);
          document.getElementById('activity-fail').textContent = fmtNumber(totalFail);

          // Recent activity is always all-time and only sort-filtered by time order.
          var logParams = '?range=all&granularity=day';
          if (activityVersion) logParams += '&extVersion=' + encodeURIComponent(activityVersion);
          var logData = await fetchJSON('/api/stats/timeseries' + logParams);
          currentLogData = (logData && logData.points) ? logData.points : [];
          allTimeActivityPoints = currentLogData.slice();
          renderEnhancedLog(currentLogData, 'day');
          renderActivityCalendar(allTimeActivityPoints);

        } catch (e) {
          chartContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed: ' + escapeHtml(e.message) + '</div>';
          logContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
          document.getElementById('activity-calendar').innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
        }
      }

      // Enhanced log state
      var currentLogData = [];
      var currentGranularity = 'hour';
      var logSortAsc = false;

      function toggleLogSort() {
        logSortAsc = !logSortAsc;
        var btn = document.getElementById('log-sort-btn');
        btn.innerHTML = logSortAsc ? 'Oldest First' : 'Newest First';
        btn.classList.toggle('active', logSortAsc);
        renderEnhancedLog(currentLogData, currentGranularity);
      }

      function renderEnhancedLog(points, granularity) {
        var logContainer = document.getElementById('activity-log');
        
        // Calculate stats
        var downloads = points.map(function(p) { return p.downloads || 0; });
        var maxDownloads = Math.max.apply(null, downloads);
        var minDownloads = Math.min.apply(null, downloads);
        var avgDownloads = downloads.reduce(function(a, b) { return a + b; }, 0) / downloads.length;
        
        // Find peak and low indices
        var peakIdx = downloads.indexOf(maxDownloads);
        var lowIdx = downloads.indexOf(minDownloads);

        // Sort data
        var sortedPoints = points.slice();
        if (logSortAsc) {
          // Already in chronological order from API
        } else {
          sortedPoints = sortedPoints.slice().reverse();
          // Adjust indices for reversed array
          peakIdx = sortedPoints.length - 1 - peakIdx;
          lowIdx = sortedPoints.length - 1 - lowIdx;
        }

        // Build table
        var tableHtml = '<table><thead><tr>';
        tableHtml += '<th>Time</th>';
        tableHtml += '<th>Downloads</th>';
        tableHtml += '<th>Success</th>';
        tableHtml += '<th>Failed</th>';
        tableHtml += '<th>Rate</th>';
        tableHtml += '<th>Trend</th>';
        tableHtml += '</tr></thead><tbody>';

        sortedPoints.forEach(function(p, i) {
          var rate = p.successRate || 0;
          var badgeClass = rate >= 0.9 ? 'badge-success' : rate >= 0.7 ? 'badge-warning' : 'badge-danger';
          var barWidth = maxDownloads > 0 ? ((p.downloads || 0) / maxDownloads) * 100 : 0;
          
          // Trend indicator (compare with previous)
          var trend = '';
          var prevIdx = logSortAsc ? i - 1 : i + 1;
          if (prevIdx >= 0 && prevIdx < sortedPoints.length) {
            var prevDownloads = sortedPoints[prevIdx].downloads || 0;
            var currDownloads = p.downloads || 0;
            if (currDownloads > prevDownloads) {
              trend = '<span class="trend-indicator trend-up">UP</span>';
            } else if (currDownloads < prevDownloads) {
              trend = '<span class="trend-indicator trend-down">DOWN</span>';
            } else {
              trend = '<span class="trend-indicator trend-stable">SAME</span>';
            }
          }

          // Peak/low badges
          var badges = '';
          if (i === peakIdx && maxDownloads > 0) badges += '<span class="peak-badge">Peak</span>';
          if (i === lowIdx && points.length > 1 && maxDownloads !== minDownloads) badges += '<span class="low-badge">Low</span>';

          var rowClass = i === peakIdx ? 'log-row-highlight' : '';
          
          tableHtml += '<tr class="' + rowClass + '">';
          tableHtml += '<td class="td-primary">' + escapeHtml(fmtTimestamp(p.timestamp, granularity)) + badges + '</td>';
          tableHtml += '<td><progress class="mini-progress" max="100" value="' + Math.round(barWidth) + '"></progress>' + fmtNumber(p.downloads) + '</td>';
          tableHtml += '<td class="text-success">' + fmtNumber(p.success) + '</td>';
          tableHtml += '<td class="text-danger">' + fmtNumber(p.fail) + '</td>';
          tableHtml += '<td><span class="badge ' + badgeClass + '">' + fmtPct(rate) + '</span></td>';
          tableHtml += '<td>' + trend + '</td>';
          tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        logContainer.innerHTML = tableHtml;

        // Update summary
        document.getElementById('log-summary').classList.remove('hidden');
        document.getElementById('summary-periods').textContent = points.length;
        document.getElementById('summary-peak').textContent = fmtNumber(maxDownloads);
        document.getElementById('summary-avg').textContent = fmtNumber(Math.round(avgDownloads));
        document.getElementById('summary-low').textContent = fmtNumber(minDownloads);
      }

      function exportLogCSV() {
        if (!currentLogData.length) return;
        
        var csv = 'Time,Downloads,Success,Failed,Rate\n';
        currentLogData.forEach(function(p) {
          csv += fmtTimestamp(p.timestamp, currentGranularity) + ',';
          csv += (p.downloads || 0) + ',';
          csv += (p.success || 0) + ',';
          csv += (p.fail || 0) + ',';
          csv += fmtPct(p.successRate || 0) + '\n';
        });

        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'activity_log_' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      }

      function shiftCalendarMonth(delta) {
        calendarMonthOffset += delta;
        renderActivityCalendar(allTimeActivityPoints || []);
      }

      function renderActivityCalendar(points) {
        var container = document.getElementById('activity-calendar');
        if (!container) return;

        var now = new Date();
        var monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + calendarMonthOffset, 1));
        var year = monthDate.getUTCFullYear();
        var month = monthDate.getUTCMonth();
        var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        var firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
        var weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        var dayCounts = {};
        (points || []).forEach(function(p) {
          if (!p.timestamp) return;
          var key = p.timestamp.slice(0, 10);
          dayCounts[key] = (dayCounts[key] || 0) + (p.downloads || 0);
        });

        var html = '<div class="calendar-caption">' +
          monthDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) +
          '</div>';
        html += '<div class="calendar-grid">';
        weekdayLabels.forEach(function(label) {
          html += '<div class="calendar-header-cell">' + label + '</div>';
        });
        for (var i = 0; i < firstWeekday; i++) {
          html += '<div class="calendar-day calendar-day-faded"></div>';
        }
        for (var d = 1; d <= daysInMonth; d++) {
          var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var hasData = (dayCounts[iso] || 0) > 0;
          html += '<div class="calendar-day ' + (hasData ? 'has-data' : '') + '" title="' + iso + ' - ' + fmtNumber(dayCounts[iso] || 0) + ' downloads">';
          html += '<div>' + d + '</div>';
          html += hasData ? '<div class="calendar-dot"></div>' : '';
          html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
      }

      function renderBarChart(container, points, granularity) {
        var maxVal = Math.max.apply(null, points.map(function(p) { return p.downloads || 0; })) || 1;
        var yLabels = [maxVal, Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0];

        var html = '<div class="chart-wrapper"><div class="chart-y-axis">';
        yLabels.forEach(function(v) { html += '<span class="chart-y-label">' + fmtNumber(v) + '</span>'; });
        html += '</div><div class="chart-grid"><div class="chart-grid-line"></div><div class="chart-grid-line"></div><div class="chart-grid-line"></div><div class="chart-grid-line"></div></div><div class="chart-bars">';

        points.forEach(function(p, i) {
          var height = ((p.downloads || 0) / maxVal) * 100;
          var tooltipData = JSON.stringify({
            time: fmtTimestamp(p.timestamp, granularity),
            downloads: p.downloads || 0,
            success: p.success || 0,
            fail: p.fail || 0,
            rate: fmtPct(p.successRate || 0)
          }).replace(/"/g, '&quot;');
          var y = Math.max(0, 100 - height);
          var barHeight = Math.max(height, 2);
          html += '<div class="chart-bar-wrapper"><svg class="chart-bar-svg" viewBox="0 0 10 100" preserveAspectRatio="none" data-point=\'' + tooltipData + '\'><rect class="chart-bar-rect" x="0" y="' + y + '" width="10" height="' + barHeight + '"></rect></svg></div>';
        });

        html += '</div><div class="chart-x-axis">';
        var step = Math.ceil(points.length / 8);
        points.forEach(function(p, i) {
          var label = i % step === 0 ? fmtShortTime(p.timestamp) : '';
          html += '<span class="chart-x-label">' + escapeHtml(label) + '</span>';
        });
        html += '</div></div>';
        container.innerHTML = html;
        bindChartBarHover(container);
      }

      function handleBarHover(e) { handleBarMove(e); }
      function handleBarMove(e) {
        var data = JSON.parse(e.target.dataset.point);
        showTooltip(e, {
          title: data.time,
          rows: [
            { label: 'Downloads', value: fmtNumber(data.downloads), className: '' },
            { label: 'Success', value: fmtNumber(data.success), className: 'tooltip-success' },
            { label: 'Failed', value: fmtNumber(data.fail), className: 'tooltip-fail' },
            { label: 'Rate', value: data.rate, className: '' },
          ],
        });
      }

      function bindChartBarHover(container) {
        container.querySelectorAll('.chart-bar-svg').forEach(function(bar) {
          if (bar.dataset.hoverBound === '1') return;
          bar.dataset.hoverBound = '1';
          bar.addEventListener('mouseenter', handleBarHover);
          bar.addEventListener('mousemove', handleBarMove);
          bar.addEventListener('mouseleave', hideTooltip);
        });
      }

      // Charts Page
      function bindMetricBarHover(container, formatPayload) {
        if (!container) return;
        container.querySelectorAll('[data-point]').forEach(function(node) {
          if (node.dataset.hoverBound === '1') return;
          node.dataset.hoverBound = '1';
          var move = function(e) {
            var parsed;
            try {
              parsed = JSON.parse(node.getAttribute('data-point') || '{}');
            } catch (_) {
              parsed = {};
            }
            var payload = formatPayload(parsed);
            showTooltip(e, payload);
          };
          node.addEventListener('mouseenter', move);
          node.addEventListener('mousemove', move);
          node.addEventListener('mouseleave', hideTooltip);
        });
      }

      function renderMetricBars(container, points, config) {
        if (!container) return;
        if (!Array.isArray(points) || !points.length) {
          container.innerHTML = '<div class="empty-state">No data</div>';
          return;
        }
        var valueKey = String(config && config.valueKey ? config.valueKey : 'value');
        var granularity = String(config && config.granularity ? config.granularity : 'day');
        var metricLabel = String(config && config.metricLabel ? config.metricLabel : 'Value');
        var maxVal = Math.max.apply(null, points.map(function(row) {
          return Number(row && row[valueKey] || 0);
        })) || 1;

        var html = '<div class="chart-wrapper"><div class="chart-y-axis">';
        [maxVal, Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0].forEach(function(v) {
          html += '<span class="chart-y-label">' + fmtNumber(v) + '</span>';
        });
        html += '</div><div class="chart-grid"><div class="chart-grid-line"></div><div class="chart-grid-line"></div><div class="chart-grid-line"></div><div class="chart-grid-line"></div></div><div class="chart-bars">';

        points.forEach(function(row) {
          var rawVal = Number(row && row[valueKey] || 0);
          var height = (rawVal / maxVal) * 100;
          var y = Math.max(0, 100 - height);
          var barHeight = Math.max(2, height);
          var packed = JSON.stringify(row || {}).replace(/"/g, '&quot;');
          html += '<div class="chart-bar-wrapper">';
          html += '<svg class="chart-bar-svg" viewBox="0 0 10 100" preserveAspectRatio="none" data-point="' + packed + '">';
          html += '<rect class="chart-bar-rect" x="0" y="' + y + '" width="10" height="' + barHeight + '"></rect>';
          html += '</svg></div>';
        });
        html += '</div><div class="chart-x-axis">';
        var step = Math.ceil(points.length / 8);
        points.forEach(function(row, idx) {
          var ts = String((row && row.timestamp) || '');
          var label = idx % step === 0 ? fmtShortTime(ts) : '';
          html += '<span class="chart-x-label">' + escapeHtml(label) + '</span>';
        });
        html += '</div></div>';
        container.innerHTML = html;

        bindMetricBarHover(container, function(row) {
          var ts = String(row.timestamp || '');
          return {
            title: fmtTimestamp(ts, granularity),
            rows: [
              { label: metricLabel, value: fmtNumber(Number(row[valueKey] || 0)) },
              { label: 'Requests', value: fmtNumber(Number(row.requests || 0)) },
              { label: 'Unique Sessions', value: fmtNumber(Number(row.uniqueSessions || 0)) },
              { label: 'Returning', value: fmtNumber(Number(row.returningSessions || 0)) }
            ]
          };
        });
      }

      function renderBreakdownBars(container, dim, rows, colorClass, options) {
        if (!container) return;
        if (!Array.isArray(rows) || !rows.length) {
          container.innerHTML = '<div class="empty-state">No data</div>';
          return;
        }
        var maxCount = Math.max.apply(null, rows.map(function(v) { return Number(v.count || 0); })) || 1;
        var leadText = options && typeof options.leadText === 'string' ? options.leadText.trim() : '';
        var html = '';
        if (leadText) {
          html += '<div class="card-subtitle" style="margin-bottom:8px;">' + escapeHtml(leadText) + '</div>';
        }
        html += '<div class="breakdown-bars">';
        rows.slice(0, 8).forEach(function(v) {
          var count = Number(v.count || 0);
          var pct = (count / maxCount) * 100;
          var labelRaw = String(v.value || 'Unknown');
          var labelTooltip = dim === 'country' ? resolveCountryName(labelRaw) : '';
          var labelAttr = labelTooltip ? (' data-tooltip="' + escapeHtml(labelTooltip) + '"') : '';
          var packed = JSON.stringify({
            dimension: dim,
            label: labelRaw,
            count: count,
            pct: pct
          }).replace(/"/g, '&quot;');
          html += '<div class="breakdown-bar-item" data-point="' + packed + '"><span class="breakdown-bar-label"' + labelAttr + '>' + escapeHtml(labelRaw) + '</span>';
          html += '<div class="breakdown-bar-track"><progress class="breakdown-progress ' + colorClass + '" max="100" value="' + Math.round(pct) + '"></progress><span class="breakdown-progress-value">' + Math.round(pct) + '%</span></div>';
          html += '<span class="breakdown-bar-count">' + fmtNumber(count) + '</span></div>';
        });
        html += '</div>';
        container.innerHTML = html;
        bindMetricBarHover(container, function(row) {
          return {
            title: String(row.label || 'Segment'),
            rows: [
              { label: 'Dimension', value: String(row.dimension || '') },
              { label: 'Count', value: fmtNumber(Number(row.count || 0)) },
              { label: 'Relative', value: Number(row.pct || 0).toFixed(1) + '%' }
            ]
          };
        });
      }

      function renderFunnel(container, stages) {
        if (!container) return;
        if (!Array.isArray(stages) || !stages.length) {
          container.innerHTML = '<div class="empty-state">No funnel data</div>';
          return;
        }
        var start = Number(stages[0].count || 0);
        var html = '<div class="card-subtitle" style="margin-bottom:8px;">Conversion funnel explains how many users moved from one step to the next.</div><div class="funnel-list">';
        stages.forEach(function(stage) {
          var count = Number(stage.count || 0);
          var fromStart = start > 0 ? (count / start) * 100 : 0;
          var fromPrevPct = Number(stage.fromPrev || 0) * 100;
          var packed = JSON.stringify({
            label: stage.label || stage.key || 'Stage',
            count: count,
            fromPrev: fromPrevPct,
            fromStart: Number(stage.fromStart || 0) * 100
          }).replace(/"/g, '&quot;');
          html += '<div class="funnel-row" data-point="' + packed + '">';
          html += '<div class="funnel-row-head"><strong>' + escapeHtml(String(stage.label || stage.key || 'Stage')) + '</strong><span>' + fmtNumber(count) + '</span></div>';
          html += '<div class="funnel-track"><div class="funnel-fill" style="width:' + Math.max(1, Math.min(100, fromStart)) + '%"></div></div>';
          html += '<div class="card-subtitle">From previous: ' + fromPrevPct.toFixed(1) + '% · From start: ' + fromStart.toFixed(1) + '%</div>';
          html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
        bindMetricBarHover(container, function(row) {
          return {
            title: String(row.label || 'Stage'),
            rows: [
              { label: 'Count', value: fmtNumber(Number(row.count || 0)) },
              { label: 'From previous', value: Number(row.fromPrev || 0).toFixed(1) + '%' },
              { label: 'From start', value: Number(row.fromStart || 0).toFixed(1) + '%' }
            ]
          };
        });
      }

      function renderHeatmap(container, cells) {
        if (!container) return;
        if (!Array.isArray(cells) || !cells.length) {
          container.innerHTML = '<div class="empty-state">No heatmap data</div>';
          return;
        }
        var maxCount = Math.max.apply(null, cells.map(function(cell) {
          return Number(cell.count || 0);
        })) || 1;
        var dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var html = '<div class="heatmap-wrap"><div class="heatmap-grid">';
        html += '<div class="heatmap-corner"></div>';
        for (var h = 0; h < 24; h += 1) {
          html += '<div class="heatmap-hour-label">' + String(h).padStart(2, '0') + '</div>';
        }
        for (var d = 0; d < 7; d += 1) {
          html += '<div class="heatmap-day-label">' + dayLabels[d] + '</div>';
          for (var hour = 0; hour < 24; hour += 1) {
            var match = cells.find(function(cell) { return Number(cell.dayOfWeek) === d && Number(cell.hourUtc) === hour; }) || { count: 0 };
            var count = Number(match.count || 0);
            var intensity = maxCount > 0 ? (count / maxCount) : 0;
            var packed = JSON.stringify({ day: dayLabels[d], hour: hour, count: count, intensity: intensity }).replace(/"/g, '&quot;');
            html += '<div class="heatmap-cell" data-point="' + packed + '" style="opacity:' + (0.15 + intensity * 0.85).toFixed(3) + '"></div>';
          }
        }
        html += '</div></div>';
        container.innerHTML = html;
        bindMetricBarHover(container, function(row) {
          return {
            title: String(row.day || '') + ' ' + String(row.hour || '').padStart(2, '0') + ':00 UTC',
            rows: [
              { label: 'Downloads', value: fmtNumber(Number(row.count || 0)) },
              { label: 'Intensity', value: (Number(row.intensity || 0) * 100).toFixed(1) + '%' }
            ]
          };
        });
      }

      function renderUniqueReturning(container, points) {
        if (!container) return;
        if (!Array.isArray(points) || !points.length) {
          container.innerHTML = '<div class="empty-state">No session data</div>';
          return;
        }
        var totals = points.reduce(function(acc, row) {
          acc.unique += Number(row.uniqueSessions || 0);
          acc.returning += Number(row.returningSessions || 0);
          return acc;
        }, { unique: 0, returning: 0 });
        renderDonutChart(container.id, {
          centerLabel: 'Sessions',
          centerValue: fmtNumber(totals.unique),
          segments: [
            { name: 'Unique', value: totals.unique, color: '#22c55e', dotClass: 'success' },
            { name: 'Returning', value: totals.returning, color: '#3b82f6', dotClass: 'downloads' }
          ]
        });
      }

      function updateChartFiltersFromUI() {
        var rangeNode = document.getElementById('charts-range-select');
        var dimNode = document.getElementById('charts-dimension-select');
        var compareNode = document.getElementById('charts-compare-previous');
        chartsRange = rangeNode ? String(rangeNode.value || 'week') : chartsRange;
        chartsDimension = dimNode ? String(dimNode.value || 'browser') : chartsDimension;
        chartsComparePrevious = !!(compareNode && compareNode.checked);
      }

      async function loadCharts() {
        updateChartFiltersFromUI();
        var rangeParams = chartsRangeParams(chartsRange);
        var rangeQuery = '?range=' + encodeURIComponent(rangeParams.range);
        var dims = ['browser', 'os', 'type', 'country'];
        var colors = { browser: 'purple', os: 'blue', type: 'cyan', country: 'green' };

        // Baseline breakdown cards
        await Promise.all(dims.map(async function(dim) {
          var container = document.getElementById('chart-' + dim);
          if (!container) return;
          try {
            var data = await fetchJSON('/api/stats/breakdown?dimension=' + encodeURIComponent(dim) + '&range=' + encodeURIComponent(rangeParams.range));
            renderBreakdownBars(container, dim, Array.isArray(data.values) ? data.values : [], colors[dim] || 'blue');
          } catch (_) {
            container.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
          }
        }));

        // Daily downloads chart uses dedicated day-window selector.
        var dailyContainer = document.getElementById('daily-chart');
        if (dailyContainer) {
          try {
            var dailyQuery = '/api/stats/timeseries?granularity=day';
            if (dailyDownloadsRange === 'all') {
              dailyQuery += '&range=all';
            } else {
              var days = Number(dailyDownloadsRange || 14);
              if (!Number.isFinite(days) || days < 1) days = 14;
              var endDate = new Date();
              var startDate = new Date();
              startDate.setUTCDate(endDate.getUTCDate() - (days - 1));
              dailyQuery += '&from=' + encodeURIComponent(fmtDate(startDate)) + '&to=' + encodeURIComponent(fmtDate(endDate));
            }
            var tsData = await fetchJSON(dailyQuery);
            if (Array.isArray(tsData.points) && tsData.points.length) {
              renderBarChart(dailyContainer, tsData.points, 'day');
            } else {
              dailyContainer.innerHTML = '<div class="empty-state">No data</div>';
            }
          } catch (_) {
            dailyContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
          }
        }

        // Visitors series + compare previous
        var visitorsContainer = document.getElementById('chart-visitors-timeseries');
        var uniqueContainer = document.getElementById('chart-unique-returning');
        try {
          var visitorsData = await fetchJSON('/api/stats/visitors-timeseries' + rangeQuery + '&granularity=' + encodeURIComponent(rangeParams.granularity));
          setChartsWindowMeta(visitorsData.meta || {
            windowStartUtc: visitorsData.windowStartUtc,
            windowEndUtc: visitorsData.windowEndUtc,
            generatedAtUtc: visitorsData.generatedAtUtc
          });
          var points = Array.isArray(visitorsData.points) ? visitorsData.points : [];
          renderMetricBars(visitorsContainer, points, { valueKey: 'visits', granularity: rangeParams.granularity, metricLabel: 'Visits' });
          renderUniqueReturning(uniqueContainer, points);

          var exportRows = points.map(function(row) {
            return {
              timestamp: row.timestamp || '',
              visits: Number(row.visits || 0),
              requests: Number(row.requests || 0),
              uniqueSessions: Number(row.uniqueSessions || 0),
              returningSessions: Number(row.returningSessions || 0)
            };
          });
          setChartsExportDataset('visitors_timeseries', exportRows);

          if (chartsComparePrevious && points.length) {
            var prevWindow = previousDateWindow(visitorsData.from, visitorsData.to);
            if (prevWindow) {
              var prevData = await fetchJSON(
                '/api/stats/visitors-timeseries?from=' + encodeURIComponent(prevWindow.from) +
                '&to=' + encodeURIComponent(prevWindow.to) +
                '&granularity=' + encodeURIComponent(rangeParams.granularity)
              );
              var currTotal = points.reduce(function(sum, row) { return sum + Number(row.visits || 0); }, 0);
              var prevPoints = Array.isArray(prevData.points) ? prevData.points : [];
              var prevTotal = prevPoints.reduce(function(sum, row) { return sum + Number(row.visits || 0); }, 0);
              var delta = calcPctDelta(prevTotal, currTotal);
              var compareNode = document.getElementById('charts-window-meta');
              if (compareNode) {
                compareNode.textContent += ' · Visits delta vs previous: ' + delta;
              }
            }
          }
        } catch (_) {
          if (visitorsContainer) visitorsContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
          if (uniqueContainer) uniqueContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
        }

        // Funnel
        var funnelContainer = document.getElementById('chart-funnel');
        try {
          var funnelData = await fetchJSON('/api/stats/funnel' + rangeQuery);
          var stages = Array.isArray(funnelData.stages) ? funnelData.stages : [];
          renderFunnel(funnelContainer, stages);
        } catch (_) {
          if (funnelContainer) funnelContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
        }

        // Dynamic segments
        var segmentsContainer = document.getElementById('chart-segments');
        try {
          var segmentsData = await fetchJSON('/api/stats/segments?dimension=' + encodeURIComponent(chartsDimension) + '&range=' + encodeURIComponent(rangeParams.range));
          var segmentRows = Array.isArray(segmentsData.values) ? segmentsData.values : [];
          renderBreakdownBars(segmentsContainer, chartsDimension, segmentRows, 'blue', {
            leadText: 'Dynamic segments explain where activity concentrated inside the selected dimension.'
          });
          setChartsExportDataset('segments_' + chartsDimension, segmentRows.map(function(row) {
            return { dimension: chartsDimension, value: row.value, count: Number(row.count || 0) };
          }));
        } catch (_) {
          if (segmentsContainer) segmentsContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
        }

        // Heatmap
        var heatmapContainer = document.getElementById('chart-heatmap');
        try {
          var heatmapData = await fetchJSON('/api/stats/heatmap' + rangeQuery);
          renderHeatmap(heatmapContainer, Array.isArray(heatmapData.cells) ? heatmapData.cells : []);
        } catch (_) {
          if (heatmapContainer) heatmapContainer.innerHTML = '<div class="empty-state empty-state-danger">Failed</div>';
        }
      }

      function calcPctDelta(base, next) {
        var b = Number(base || 0);
        var n = Number(next || 0);
        if (b <= 0) {
          if (n <= 0) return '0%';
          return '+∞';
        }
        var pct = ((n - b) / b) * 100;
        var sign = pct >= 0 ? '+' : '';
        return sign + pct.toFixed(1) + '%';
      }

      // Comparison feature
      var currentComparisonMode = 'week';

      function setComparison(mode) {
        currentComparisonMode = mode;
        document.getElementById('cmp-week').classList.toggle('active', mode === 'week');
        document.getElementById('cmp-month').classList.toggle('active', mode === 'month');
        loadComparison();
      }

      async function loadComparison() {
        var container = document.getElementById('comparison-content');
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading comparison...</div>';

        var now = new Date();
        var from1, to1, from2, to2, label1, label2;

        if (currentComparisonMode === 'week') {
          // This week vs Last week
          var today = new Date(now);
          var dayOfWeek = today.getUTCDay() || 7; // Sunday = 7
          
          // This week (Mon - Today)
          var thisWeekStart = new Date(today);
          thisWeekStart.setUTCDate(today.getUTCDate() - dayOfWeek + 1);
          to2 = fmtDate(today);
          from2 = fmtDate(thisWeekStart);
          label2 = 'This Week';

          // Last week (Mon - Sun)
          var lastWeekEnd = new Date(thisWeekStart);
          lastWeekEnd.setUTCDate(thisWeekStart.getUTCDate() - 1);
          var lastWeekStart = new Date(lastWeekEnd);
          lastWeekStart.setUTCDate(lastWeekEnd.getUTCDate() - 6);
          to1 = fmtDate(lastWeekEnd);
          from1 = fmtDate(lastWeekStart);
          label1 = 'Last Week';
        } else {
          // This month vs Last month
          var thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          from2 = fmtDate(thisMonthStart);
          to2 = fmtDate(now);
          label2 = 'This Month';

          var lastMonthEnd = new Date(thisMonthStart);
          lastMonthEnd.setUTCDate(lastMonthEnd.getUTCDate() - 1);
          var lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
          from1 = fmtDate(lastMonthStart);
          to1 = fmtDate(lastMonthEnd);
          label1 = 'Last Month';
        }

        try {
          var url = '/api/stats/comparison?from1=' + from1 + '&to1=' + to1 + '&from2=' + from2 + '&to2=' + to2;
          var data = await fetchJSON(url);

          var p1 = data.period1;
          var p2 = data.period2;
          var change = data.change;
          if (!p1 || !p2 || !change) {
            container.innerHTML = '<div class="empty-state">No comparison data available</div>';
            return;
          }

          var changeClass = function(str) {
            if (str.startsWith('+') && str !== '+0%' && str !== '+0.0%') return 'positive';
            if (str.startsWith('-')) return 'negative';
            return 'neutral';
          };

          var html = '<div class="comparison-grid">';
          
          // Period 1
          html += '<div class="period-card">';
          html += '<div class="period-label">' + label1 + '</div>';
          html += '<div class="period-dates">' + p1.from + ' to ' + p1.to + '</div>';
          html += '<div class="period-value">' + fmtNumber(p1.downloads) + '</div>';
          html += '<div class="period-stats">';
          html += '<span class="period-stat">Success: <strong>' + fmtNumber(p1.success) + '</strong></span>';
          html += '<span class="period-stat">Fail: <strong>' + fmtNumber(p1.fail) + '</strong></span>';
          html += '<span class="period-stat">' + fmtPct(p1.successRate) + '</span>';
          html += '</div></div>';

          // Arrow
          html += '<div class="comparison-arrow">vs</div>';

          // Period 2
          html += '<div class="period-card">';
          html += '<div class="period-label">' + label2 + '</div>';
          html += '<div class="period-dates">' + p2.from + ' to ' + p2.to + '</div>';
          html += '<div class="period-value">' + fmtNumber(p2.downloads) + '</div>';
          html += '<div class="period-stats">';
          html += '<span class="period-stat">Success: <strong>' + fmtNumber(p2.success) + '</strong></span>';
          html += '<span class="period-stat">Fail: <strong>' + fmtNumber(p2.fail) + '</strong></span>';
          html += '<span class="period-stat">' + fmtPct(p2.successRate) + '</span>';
          html += '</div></div>';

          html += '</div>';

          // Change summary
          html += '<div class="change-summary">';
          html += '<span class="change-badge ' + changeClass(change.downloads) + '">Downloads ' + change.downloads + '</span>';
          html += '<span class="change-badge ' + changeClass(change.success) + '">Success ' + change.success + '</span>';
          html += '<span class="change-badge ' + changeClass(change.fail) + '">Fails ' + change.fail + '</span>';
          html += '</div>';

          container.innerHTML = html;
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load: ' + escapeHtml(e.message) + '</div>';
        }
      }

      function fmtDate(d) {
        return d.toISOString().slice(0, 10);
      }

      // API Export button for Activity page
      function exportAPICSV() {
        var range = activityRangeParams(activityRange);
        var url = '/api/stats/export?format=csv&range=' + encodeURIComponent(range.range) + '&granularity=' + encodeURIComponent(range.granularity);
        window.open(url, '_blank');
      }

      function exportAPIJSON() {
        var range = activityRangeParams(activityRange);
        var url = '/api/stats/export?format=json&range=' + encodeURIComponent(range.range) + '&granularity=' + encodeURIComponent(range.granularity);
        window.open(url, '_blank');
      }

      function onChartsControlsChange() {
        updateChartFiltersFromUI();
        loadCharts();
      }

      function exportActiveChartCSV() {
        if (!Array.isArray(chartsLastExportRows) || chartsLastExportRows.length === 0) {
          window.alert('No chart dataset is ready for export yet.');
          return;
        }
        exportRowsAsCSV(chartsLastExportName, chartsLastExportRows);
      }

      // Load deployment status
      async function loadDeployStatus() {
        var iconNodes = Array.from(document.querySelectorAll('[data-role="deploy-icon"]'));
        var commitNodes = Array.from(document.querySelectorAll('[data-role="deploy-commit"]'));
        var linkNodes = Array.from(document.querySelectorAll('[data-role="deploy-status-btn"]'));
        if (!iconNodes.length || !commitNodes.length || !linkNodes.length) return;

        function setStatusUI(iconText, commitText, href, tooltip, stale) {
          iconNodes.forEach(function(node) { node.textContent = iconText; });
          commitNodes.forEach(function(node) { node.textContent = commitText; });
          linkNodes.forEach(function(node) {
            if (href) node.href = href;
            if (tooltip) node.setAttribute('data-tooltip', tooltip);
            node.classList.toggle('btn-warning', !!stale);
          });
        }

        try {
          var data = await fetchJSON('/api/deploy-status');
          if (data.commit && data.commit !== 'unknown') {
            var commitHref = 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/commit/' + data.commit_full;
            if (data.stale) {
              setStatusUI(
                '⚠️',
                'Stale · ' + data.commit,
                commitHref,
                'Status: stale deployment (>24h). Means latest runtime deploy is older than expected.\nCommit: ' + data.message,
                true
              );
            } else {
              var tip = 'Status: healthy deploy.\nCommit: ' + data.message + '\nDeployed (UTC): ' + new Date(data.deployed_at).toLocaleString('en-US', { timeZone: 'UTC' });
              setStatusUI('✅', 'Live · ' + data.commit, commitHref, tip, false);
            }
          } else {
            setStatusUI('❓', 'Unknown', '', 'Status unknown: backend could not resolve deployment metadata.', false);
          }
        } catch (e) {
          setStatusUI('❌', 'Error', '', 'Deployment status request failed. Check /api/deploy-status and auth state.', false);
        }
      }

      // Dashboards / Management hub
      function applyInfraLink(id, url) {
        var node = document.getElementById(id);
        if (!node) return;
        if (url) {
          node.href = url;
          node.removeAttribute('aria-disabled');
          node.classList.remove('disabled-link');
        } else {
          node.href = '#';
          node.setAttribute('aria-disabled', 'true');
          node.classList.add('disabled-link');
        }
      }

      function joinInfraUrl(base, suffix) {
        var root = String(base || '').trim().replace(/\/+$/, '');
        if (!root) return '';
        return root + suffix;
      }

      async function loadDashboardLinks() {
        try {
          var payload = await fetchJSON('/api/admin/dashboard-links');
          var links = (payload && payload.links) ? payload.links : {};
          applyInfraLink('infra-link-cloudflare', links.cloudflare || DEFAULT_INFRA_LINKS.cloudflare);
          applyInfraLink('infra-link-website', links.website || DEFAULT_INFRA_LINKS.website);
          applyInfraLink('infra-link-uptime', links.uptimeKuma || DEFAULT_INFRA_LINKS.uptimeKuma);
          applyInfraLink('infra-link-github', links.githubRepo || DEFAULT_INFRA_LINKS.githubRepo);
          applyInfraLink('infra-link-sheets', links.googleSheets || DEFAULT_INFRA_LINKS.googleSheets);
          applyInfraLink('infra-link-figma', links.figmaDesign || DEFAULT_INFRA_LINKS.figmaDesign);
          applyInfraLink('infra-link-chrome-dev', links.chromeDevDashboard || DEFAULT_INFRA_LINKS.chromeDevDashboard);
          applyInfraLink('infra-link-firefox-dev', links.firefoxDevDashboard || DEFAULT_INFRA_LINKS.firefoxDevDashboard);
          applyInfraLink('infra-link-edge-dev', links.edgeDevDashboard || DEFAULT_INFRA_LINKS.edgeDevDashboard);
          applyInfraLink('infra-link-chrome-store', links.chromeStoreListing || DEFAULT_INFRA_LINKS.chromeStoreListing);
          applyInfraLink('infra-link-firefox-store', links.firefoxStoreListing || DEFAULT_INFRA_LINKS.firefoxStoreListing);
	          applyInfraLink('infra-link-edge-store', links.edgeStoreListing || DEFAULT_INFRA_LINKS.edgeStoreListing);
	          applyInfraLink('user-changelog-open-website', joinInfraUrl(links.website || DEFAULT_INFRA_LINKS.website, '/changelog'));
	        } catch (_) {
	          applyInfraLink('infra-link-cloudflare', DEFAULT_INFRA_LINKS.cloudflare);
	          applyInfraLink('infra-link-website', DEFAULT_INFRA_LINKS.website);
	          applyInfraLink('infra-link-uptime', DEFAULT_INFRA_LINKS.uptimeKuma);
          applyInfraLink('infra-link-github', DEFAULT_INFRA_LINKS.githubRepo);
          applyInfraLink('infra-link-sheets', DEFAULT_INFRA_LINKS.googleSheets);
          applyInfraLink('infra-link-figma', DEFAULT_INFRA_LINKS.figmaDesign);
          applyInfraLink('infra-link-chrome-dev', DEFAULT_INFRA_LINKS.chromeDevDashboard);
          applyInfraLink('infra-link-firefox-dev', DEFAULT_INFRA_LINKS.firefoxDevDashboard);
          applyInfraLink('infra-link-edge-dev', DEFAULT_INFRA_LINKS.edgeDevDashboard);
          applyInfraLink('infra-link-chrome-store', DEFAULT_INFRA_LINKS.chromeStoreListing);
          applyInfraLink('infra-link-firefox-store', DEFAULT_INFRA_LINKS.firefoxStoreListing);
          applyInfraLink('infra-link-edge-store', DEFAULT_INFRA_LINKS.edgeStoreListing);
          applyInfraLink('user-changelog-open-website', joinInfraUrl(DEFAULT_INFRA_LINKS.website, '/changelog'));
        }
      }

      async function loadDeploymentsHub() {
        var container = document.getElementById('deployment-cards');
        if (!container) return;
        var targets = [];
        var loadTargetsErr = '';
        try {
          var payload = await fetchJSON('/api/admin/deployments/targets');
          targets = payload.targets || [];
        } catch (e) {
          loadTargetsErr = String((e && e.message) || e || 'Unknown error');
        }
        if (loadTargetsErr) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load deployment targets: ' + escapeHtml(loadTargetsErr) + '</div>';
        } else {
          var html = '';
          targets.forEach(function(item) {
            var key = String(item.recordKey || '');
            var v = item.data || {};
            var hasUsersCount = Object.prototype.hasOwnProperty.call(v, 'usersCount') && parseMaybeNumber(v.usersCount) !== null;
            var hasRatingCount = Object.prototype.hasOwnProperty.call(v, 'ratingCount') && parseMaybeNumber(v.ratingCount) !== null;
            var hasLatency = Object.prototype.hasOwnProperty.call(v, 'syncLatencyMs') && parseMaybeNumber(v.syncLatencyMs) !== null;
            var usersCountText = fmtNumberOrNA(v.usersCount, hasUsersCount);
            var ratingCountText = fmtNumberOrNA(v.ratingCount, hasRatingCount);
            var latencyText = hasLatency ? fmtNumber(parseMaybeNumber(v.syncLatencyMs)) + 'ms' : 'N/A';
            var usersMetricText = String(v.usersMetric || 'n/a');
            var syncSourceText = String(v.syncSource || 'n/a');
            var sourceText = item.updatedAt > 0 ? 'Database' : 'Template';
            var updatedAtText = item.updatedAt > 0 ? fmtUtcDateTimeFromMs(item.updatedAt) : 'never';
            var statusBadge = '';
            if (v.syncStatus === 'ok') statusBadge = '<span class="pill">Synced</span>';
            if (v.syncStatus === 'error') statusBadge = '<span class="pill pill-error">Sync Error</span>';
            var usersId = deploymentInputId('users', key);
            var versionId = deploymentInputId('version', key);
            var ratingId = deploymentInputId('rating', key);
            var ratingCountId = deploymentInputId('ratingCount', key);
            var urlId = deploymentInputId('url', key);
            html += '<div class="deployment-card">';
            html += '<div class="deployment-card-head">';
            html += '<div class="deployment-card-title">' + escapeHtml(v.name || key) + '</div>';
            html += statusBadge;
            html += '</div>';
            html += '<div class="deployment-card-body">';
            html += '<input class="auth-input" id="' + escapeHtml(usersId) + '" placeholder="Users" value="' + escapeHtml(v.users || '') + '"/>';
            html += '<input class="auth-input" id="' + escapeHtml(versionId) + '" placeholder="Current version" value="' + escapeHtml(v.version || '') + '"/>';
            html += '<input class="auth-input" id="' + escapeHtml(ratingId) + '" placeholder="Rating (e.g. 5.0)" value="' + escapeHtml(v.rating || '') + '"/>';
            html += '<input class="auth-input" id="' + escapeHtml(ratingCountId) + '" placeholder="Rating count" value="' + escapeHtml(v.ratingCount || '') + '"/>';
            html += '<input class="auth-input" id="' + escapeHtml(urlId) + '" placeholder="Store dashboard URL" value="' + escapeHtml(v.url || '') + '"/>';
            html += '<div class="pill-row"><span class="pill">UsersCount: ' + escapeHtml(usersCountText) + '</span><span class="pill">RatingCount: ' + escapeHtml(ratingCountText) + '</span><span class="pill">Latency: ' + escapeHtml(latencyText) + '</span></div>';
            html += '<div class="pill-row"><span class="pill">Users Metric: ' + escapeHtml(usersMetricText) + '</span><span class="pill">Sync Source: ' + escapeHtml(syncSourceText) + '</span></div>';
            html += '<div class="pill-row"><span class="pill">Source: ' + escapeHtml(sourceText) + '</span><span class="pill">Updated (UTC): ' + escapeHtml(updatedAtText) + '</span></div>';
            html += '<button class="btn btn-secondary" data-action="save-deployment-card" data-record-key="' + escapeHtml(key) + '">Save</button>';
            html += '</div></div>';
          });
          container.innerHTML = html || '<div class="empty-state">No deployment targets found</div>';
        }
      }

      function setDeploymentSyncOutput(payload) {
        var out = document.getElementById('deployment-sync-output');
        if (!out) return;
        out.textContent = JSON.stringify(payload || {}, null, 2);
        out.classList.remove('hidden');
      }

      async function syncDeploymentTargets() {
        try {
          var data = await fetchJSONWithInit('/api/admin/deployments/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setDeploymentSyncOutput(data);
          await loadDeploymentsHub();
          await loadDeploymentStoreMetrics();
        } catch (e) {
          setDeploymentSyncOutput({ ok: false, error: String(e) });
        }
      }

      async function saveDeploymentCard(key) {
        var usersEl = document.getElementById(deploymentInputId('users', key));
        var versionEl = document.getElementById(deploymentInputId('version', key));
        var ratingEl = document.getElementById(deploymentInputId('rating', key));
        var ratingCountEl = document.getElementById(deploymentInputId('ratingCount', key));
        var urlEl = document.getElementById(deploymentInputId('url', key));
        if (!usersEl || !versionEl || !ratingEl || !ratingCountEl || !urlEl) {
          setDeploymentSyncOutput({ ok: false, error: 'Deployment inputs are missing for key: ' + String(key || '') });
          return;
        }
        var record = {
          users: usersEl.value,
          version: versionEl.value,
          rating: ratingEl.value,
          ratingCount: ratingCountEl.value,
          url: urlEl.value
        };
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          await fetchJSONWithInit('/api/admin/records/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordType: 'deployment_target', recordKey: key, data: record })
          });
          setDeploymentSyncOutput({ ok: true, action: 'manual_update', key: key });
          await loadDeploymentsHub();
          await loadDeploymentStoreMetrics();
        } catch (e) {
          setDeploymentSyncOutput({ ok: false, error: String(e) });
        }
      }

      async function copyText(text) {
        try { await navigator.clipboard.writeText(text); } catch (_) {}
      }

      function normalizeKey(input, fallbackPrefix) {
        var v = (input || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
        if (!v) v = fallbackPrefix + '-' + Date.now();
        return v;
      }

      function parseMultilineList(value, maxItems, maxLen) {
        var out = [];
        var lines = String(value || '').split(/\r?\n/);
        for (var i = 0; i < lines.length; i += 1) {
          var item = (lines[i] || '').trim();
          if (!item) continue;
          if (item.length > maxLen) item = item.slice(0, maxLen);
          out.push(item);
          if (out.length >= maxItems) break;
        }
        return out;
      }

      function normalizeVersionToken(value) {
        var v = String(value || '').trim();
        if (v.toLowerCase().startsWith('v')) v = v.slice(1);
        return v.replace(/\s+/g, '');
      }

      function parseUserFriendlyChangelogMarkdown(markdown) {
        var lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
        var releases = [];
        var errors = [];
        var current = null;
        var section = null;

        function pushCurrent() {
          if (!current) return;
          current.version = normalizeVersionToken(current.version || '');
          current.summary = String(current.summary || '').trim();
          if (!current.summary) {
            current.summary = (current.added[0] || current.changed[0] || current.fixed[0] || '').trim();
          }
          if (!current.version || !current.summary) {
            errors.push('Release block missing version or summary.');
            current = null;
            return;
          }
          releases.push({
            version: current.version,
            summary: current.summary,
            added: current.added.slice(0, 12),
            changed: current.changed.slice(0, 12),
            fixed: current.fixed.slice(0, 12)
          });
          current = null;
        }

        lines.forEach(function(rawLine) {
          var line = String(rawLine || '').trim();
          if (!line) return;
          var releaseMatch = line.match(/^##\s+v?([A-Za-z0-9._-]+)\s*$/i);
          if (releaseMatch) {
            pushCurrent();
            current = { version: releaseMatch[1], summary: '', added: [], changed: [], fixed: [] };
            section = null;
            return;
          }
          if (!current) return;
          if (/^###\s+summary\s*$/i.test(line)) { section = 'summary'; return; }
          if (/^###\s+added\s*$/i.test(line)) { section = 'added'; return; }
          if (/^###\s+changed\s*$/i.test(line)) { section = 'changed'; return; }
          if (/^###\s+fixed\s*$/i.test(line)) { section = 'fixed'; return; }

          var bulletMatch = line.match(/^-\s+(.+)$/);
          var value = String(bulletMatch ? bulletMatch[1] : line).trim();
          if (!value) return;
          if (section === 'summary') {
            current.summary = current.summary ? (current.summary + ' ' + value) : value;
            return;
          }
          if (section === 'added') { current.added.push(value); return; }
          if (section === 'changed') { current.changed.push(value); return; }
          if (section === 'fixed') { current.fixed.push(value); return; }
          current.summary = current.summary ? (current.summary + ' ' + value) : value;
        });

        pushCurrent();
        return { releases: releases, errors: errors };
      }

      function buildReleaseMarkdown(release) {
        var lines = [];
        lines.push('## v' + normalizeVersionToken(release.version || ''));
        lines.push('### Summary');
        lines.push(String(release.summary || ''));
        lines.push('### Added');
        (release.added || []).forEach(function(item) { lines.push('- ' + item); });
        lines.push('### Changed');
        (release.changed || []).forEach(function(item) { lines.push('- ' + item); });
        lines.push('### Fixed');
        (release.fixed || []).forEach(function(item) { lines.push('- ' + item); });
        return lines.join('\n');
      }

      function renderReleasePreviewHTML(release) {
        if (!release) return '<div class="empty-state">No release preview.</div>';
        var html = '';
        html += '<div class="content-record-meta">Version: v' + escapeHtml(normalizeVersionToken(release.version || '')) + '</div>';
        html += '<div class="content-record-summary"><strong>Summary:</strong> ' + escapeHtml(release.summary || '') + '</div>';
        var sections = [
          { label: 'Added', items: release.added || [] },
          { label: 'Changed', items: release.changed || [] },
          { label: 'Fixed', items: release.fixed || [] }
        ];
        sections.forEach(function(section) {
          if (!section.items.length) return;
          html += '<div class="content-record-meta" style="margin-top:6px;"><strong>' + escapeHtml(section.label) + '</strong></div>';
          html += '<ul class="cl-changes-list">';
          section.items.slice(0, 5).forEach(function(item) {
            html += '<li>' + escapeHtml(item) + '</li>';
          });
          html += '</ul>';
        });
        return html;
      }

      function releaseToHighlights(release) {
        var highlights = [];
        (release.added || []).forEach(function(item) { highlights.push('Added: ' + item); });
        (release.changed || []).forEach(function(item) { highlights.push('Changed: ' + item); });
        (release.fixed || []).forEach(function(item) { highlights.push('Fixed: ' + item); });
        return highlights.slice(0, 9);
      }

      async function loadCreativeHub() {
        await loadCreativeEmails();
        await loadNewsletterSubscribers();
      }

      function defaultUserChangelogRecordsForDashboard() {
        var now = Date.now();
        return [
          {
            recordKey: 'release-1-3-6',
            updatedAt: now,
            isDefault: true,
            data: {
              version: '1.3.6',
              title: 'Stability and security improvements',
              summary: 'Improved reliability for large download queues and hardened extension-to-backend analytics flow.',
              highlights: [
                'Smoother queue behavior during heavy classroom usage.',
                'More consistent cancel and retry handling.',
                'Security hardening and bug fixes across dashboard integrations.'
              ],
              releasedAtUtc: now
            }
          },
          {
            recordKey: 'release-1-3-5',
            updatedAt: now - 86400000,
            isDefault: true,
            data: {
              version: '1.3.5',
              title: 'Cleaner progress experience',
              summary: 'Refined progress visibility and better user feedback while downloads are running.',
              highlights: [
                'Clearer state transitions in download flow.',
                'Better fallback handling when services are warming up.'
              ],
              releasedAtUtc: now - 86400000
            }
          }
        ];
      }

      function setContentSyncStatus(id, text, isError) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = text || '--';
        if (isError) {
          node.classList.add('status-error');
          node.classList.remove('status-ok');
        } else {
          node.classList.add('status-ok');
          node.classList.remove('status-error');
        }
      }

      function setContentSyncOutput(id, payload) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = JSON.stringify(payload || {}, null, 2);
        node.classList.remove('hidden');
      }

      async function refreshUserChangelogPublicPreview() {
        try {
          var payload = await fetchJSON('/api/public/website/changelog');
          var entries = Array.isArray(payload.entries) ? payload.entries.length : 0;
          var lastUpdatedText = fmtUtcDateTimeFromMs(payload.lastUpdatedAtUtc || payload.generatedAt || 0);
          setContentSyncStatus('user-changelog-sync-status', entries + ' entries · ' + lastUpdatedText, false);
          setContentSyncOutput('user-changelog-output', payload);
          setTextOrPlaceholder('user-changelog-current-source', String(payload.source || 'oracle').toUpperCase());
          setTextOrPlaceholder('user-changelog-current-entry-count', fmtNumber(entries));
          setTextOrPlaceholder('user-changelog-current-updated', lastUpdatedText);
          var currentPreviewNode = document.getElementById('user-changelog-current-preview');
          if (currentPreviewNode) {
            if (entries > 0) {
              var top = payload.entries[0] || {};
              currentPreviewNode.innerHTML = renderReleasePreviewHTML({
                version: top.version || '',
                summary: top.summary || '',
                added: [],
                changed: [],
                fixed: [],
              });
            } else {
              currentPreviewNode.innerHTML = '<div class="empty-state">No live changelog entries yet.</div>';
            }
          }
        } catch (e) {
          setContentSyncStatus('user-changelog-sync-status', 'Failed to read /api/public/website/changelog', true);
          setContentSyncOutput('user-changelog-output', { ok: false, error: String((e && e.message) || e || 'unknown') });
          setTextOrPlaceholder('user-changelog-current-source', '--');
          setTextOrPlaceholder('user-changelog-current-entry-count', '--');
          setTextOrPlaceholder('user-changelog-current-updated', '--');
          var currentPreviewFail = document.getElementById('user-changelog-current-preview');
          if (currentPreviewFail) currentPreviewFail.innerHTML = '<div class="empty-state empty-state-danger">Failed to load live preview.</div>';
        }
      }

      async function loadUserChangelogRevisionHistory() {
        return;
      }

      async function loadUserChangelogRecords() {
        await loadUserChangelogSourceConfig();
        await refreshUserChangelogPublicPreview();
      }

      async function loadUserChangelogSourceConfig() {
        var sourceNode = document.getElementById('user-changelog-source-select');
        var urlNode = document.getElementById('user-changelog-source-url');
        if (!sourceNode || !urlNode) return;
        try {
          var payload = await fetchJSON('/api/admin/records/list?type=' + encodeURIComponent(USER_CHANGELOG_CONFIG_RECORD_TYPE));
          var records = Array.isArray(payload.records) ? payload.records : [];
          var selected = records.find(function(item) {
            return String((item && item.recordKey) || '').trim().toLowerCase() === 'active';
          }) || records[0] || null;
          var data = selected && selected.data ? selected.data : {};
          var source = String(data.source || 'oracle').trim().toLowerCase();
          if (source !== 'github') source = 'oracle';
          sourceNode.value = source;
          var urlValue = String(data.markdownUrl || '').trim();
          if (urlValue) {
            urlNode.value = urlValue;
          } else if (!urlNode.value) {
            urlNode.value = 'https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/user-friendly-changelog.md';
          }
          setContentSyncStatus('user-changelog-source-status', 'loaded', false);
        } catch (_) {
          sourceNode.value = 'oracle';
          setContentSyncStatus('user-changelog-source-status', 'failed to load source config', true);
        }
      }

      async function saveUserChangelogSourceConfig() {
        var sourceNode = document.getElementById('user-changelog-source-select');
        var urlNode = document.getElementById('user-changelog-source-url');
        var source = sourceNode ? String(sourceNode.value || 'oracle').trim().toLowerCase() : 'oracle';
        if (source !== 'github') source = 'oracle';
        var markdownUrl = urlNode ? String(urlNode.value || '').trim() : '';
        if (source === 'github' && (!/^https:\/\//i.test(markdownUrl) || markdownUrl.length < 20)) {
          setContentSyncStatus('user-changelog-source-status', 'invalid GitHub raw markdown URL', true);
          return;
        }
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          await fetchJSONWithInit('/api/admin/records/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recordType: USER_CHANGELOG_CONFIG_RECORD_TYPE,
              recordKey: 'active',
              data: {
                source: source,
                markdownUrl: markdownUrl,
                updatedAtUtc: Date.now()
              }
            })
          });
          setContentSyncStatus('user-changelog-source-status', 'saved', false);
          await refreshUserChangelogPublicPreview();
        } catch (_) {
          setContentSyncStatus('user-changelog-source-status', 'failed to save source config', true);
        }
      }

      async function previewUserChangelogDraft(fromUrlOnly) {
        var markdownNode = document.getElementById('user-changelog-markdown');
        var urlNode = document.getElementById('user-changelog-markdown-url');
        var previewNode = document.getElementById('user-changelog-draft-preview');
        if (!previewNode) return;
        var markdown = markdownNode ? String(markdownNode.value || '').trim() : '';
        var markdownUrl = urlNode ? String(urlNode.value || '').trim() : '';
        if (fromUrlOnly) markdown = '';

        if (!markdown && markdownUrl) {
          try {
            var res = await fetch(markdownUrl, { credentials: 'omit' });
            if (res.ok) {
              markdown = String(await res.text());
              if (markdownNode) markdownNode.value = markdown;
            }
          } catch (_) {}
        }
        if (!markdown) {
          previewNode.innerHTML = '<div class="empty-state">Paste markdown or provide a valid markdown URL first.</div>';
          return;
        }
        var parsed = parseUserFriendlyChangelogMarkdown(markdown);
        if (!parsed.releases.length) {
          previewNode.innerHTML = '<div class="empty-state empty-state-danger">No valid releases found in markdown.</div>';
          return;
        }
        var release = parsed.releases[0];
        var html = renderReleasePreviewHTML(release);
        if (parsed.errors.length) {
          html = '<div class="content-record-meta status-error">Warnings: ' + escapeHtml(parsed.errors.slice(0, 3).join(' | ')) + '</div>' + html;
        }
        previewNode.innerHTML = html;
      }

      function showUserChangelogFormatInfo() {
        window.alert(
          'Supported format:\\n\\n## v1.3.8\\n### Summary\\nOne summary line\\n### Added\\n- bullet\\n### Changed\\n- bullet\\n### Fixed\\n- bullet\\n\\nSource file: user-friendly-changelog.md on GitHub.'
        );
      }

      async function saveUserChangelogRecord(e) {
        e.preventDefault();
        var markdown = (document.getElementById('user-changelog-markdown').value || '').trim();
        var markdownUrl = (document.getElementById('user-changelog-markdown-url').value || '').trim();
        var now = Date.now();

        if (!markdown && markdownUrl) {
          try {
            var fetched = await fetch(markdownUrl, { credentials: 'omit' });
            if (fetched.ok) {
              markdown = String(await fetched.text());
              var mdNode = document.getElementById('user-changelog-markdown');
              if (mdNode) mdNode.value = markdown;
            }
          } catch (_) {}
        }

        if (markdown) {
          var parsedMarkdown = parseUserFriendlyChangelogMarkdown(markdown);
          if (!parsedMarkdown.releases.length) {
            setContentSyncStatus('user-changelog-sync-status', 'Markdown parse failed: no valid releases', true);
            return;
          }
          var okStepUp = await ensureStepUp();
          if (!okStepUp) return;
          try {
            for (var idx = 0; idx < parsedMarkdown.releases.length; idx += 1) {
              var release = parsedMarkdown.releases[idx];
              var version = normalizeVersionToken(release.version || '');
              var keyFromVersion = normalizeKey('release-' + version.replace(/\./g, '-'), 'release');
              var data = {
                version: version,
                title: 'Release update',
                summary: String(release.summary || '').slice(0, 500),
                releasedAtUtc: now - (idx * 1000),
                highlights: releaseToHighlights(release),
                added: (release.added || []).slice(0, 6),
                changed: (release.changed || []).slice(0, 6),
                fixed: (release.fixed || []).slice(0, 6),
                markdown: buildReleaseMarkdown(release),
                updatedAtUtc: now
              };
              await fetchJSONWithInit('/api/admin/records/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordType: USER_CHANGELOG_RECORD_TYPE, recordKey: keyFromVersion, data: data })
              });
            }
            await fetchJSONWithInit('/api/admin/records/upsert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recordType: USER_CHANGELOG_REVISION_RECORD_TYPE,
                recordKey: normalizeKey('rev-' + now, 'rev'),
                data: {
                  source: markdownUrl ? 'github' : 'manual',
                  markdownUrl: markdownUrl || '',
                  createdAtUtc: now,
                  releases: parsedMarkdown.releases.length,
                  valid: parsedMarkdown.errors.length === 0,
                  errors: parsedMarkdown.errors.slice(0, 8)
                }
              })
            });
            var formMd = document.getElementById('user-changelog-form');
            if (formMd) formMd.reset();
            await loadUserChangelogRecords();
          } catch (errMd) {
            setContentSyncStatus('user-changelog-sync-status', 'Failed to save markdown changelog.', true);
          }
          return;
        }

        setContentSyncStatus('user-changelog-sync-status', 'Paste markdown or import URL using the required format.', true);
      }

      async function deleteUserChangelogRecord(key) {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Delete user changelog entry "' + key + '"?')) return;
        try {
          await fetchJSONWithInit('/api/admin/records/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordType: USER_CHANGELOG_RECORD_TYPE, recordKey: key })
          });
          await loadUserChangelogRecords();
        } catch (_) {}
      }

      async function loadCreativeEmails() {
        var container = document.getElementById('creative-email-list');
        if (!container) return;
        try {
          var payload = await fetchJSON('/api/admin/creative/emails');
          var records = payload.records || [];
          if (!records.length) {
            container.innerHTML = '<div class="empty-state">No email templates yet</div>';
            return;
          }
          var html = '';
          records.forEach(function(item) {
            var d = item.data || {};
            var htmlBody = String(d.html || '');
            html += '<div class="creative-card">';
            html += '<h4>' + escapeHtml(d.title || item.recordKey) + '</h4>';
            html += '<div class="creative-meta">Subject: ' + escapeHtml(d.subject || 'n/a') + '</div>';
            html += '<div class="pill-row"><span class="pill">Version: ' + escapeHtml(d.version || 'n/a') + '</span><span class="pill">Schedule: ' + escapeHtml(d.scheduledAt || 'manual') + '</span></div>';
            html += '<div class="creative-preview">' + escapeHtml(htmlBody.slice(0, 800)) + '</div>';
            html += '<div class="inline-btn-row">';
            html += '<button class="btn btn-secondary" data-action="copy-email-html" data-html="' + escapeHtml(htmlBody) + '">Copy HTML</button>';
            html += '<button class="btn btn-danger" data-action="delete-creative-email" data-record-key="' + escapeHtml(item.recordKey || '') + '">Delete</button>';
            html += '</div></div>';
          });
          container.innerHTML = html;
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load email templates</div>';
        }
      }

      async function saveCreativeEmailTemplate(e) {
        e.preventDefault();
        var key = normalizeKey(document.getElementById('email-template-key').value, 'email-template');
        var htmlBody = (document.getElementById('email-template-html').value || '').trim();
        if (!htmlBody) return;
        var data = {
          title: (document.getElementById('email-template-title').value || '').trim(),
          version: (document.getElementById('email-template-version').value || '').trim(),
          subject: (document.getElementById('email-template-subject').value || '').trim(),
          scheduledAt: (document.getElementById('email-template-scheduled-at').value || '').trim(),
          html: htmlBody,
          updatedAt: Date.now()
        };
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          await fetchJSONWithInit('/api/admin/creative/emails/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordKey: key, data: data })
          });
          await loadCreativeEmails();
        } catch (_) {}
      }

      async function deleteCreativeEmailTemplate(key) {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Delete email template "' + key + '"?')) return;
        try {
          await fetchJSONWithInit('/api/admin/creative/emails/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordKey: key })
          });
          await loadCreativeEmails();
        } catch (_) {}
      }

      async function loadNewsletterSubscribers() {
        var container = document.getElementById('newsletter-subscribers-list');
        var summary = document.getElementById('newsletter-summary');
        if (!container) return;
        try {
          var payload = await fetchJSON('/api/admin/newsletter/subscribers');
          var records = payload.records || [];
          if (!records.length) {
            container.innerHTML = '<div class="empty-state">No subscribers yet</div>';
            if (summary) {
              summary.innerHTML =
                '<span class="newsletter-tag">Total: 0</span>' +
                '<span class="newsletter-tag">Active: 0</span>' +
                '<span class="newsletter-tag">Paused: 0</span>' +
                '<span class="newsletter-tag">Unsubscribed: 0</span>';
            }
            return;
          }
          var counts = { total: records.length, active: 0, paused: 0, unsubscribed: 0 };
          var html = '';
          records.forEach(function(item) {
            var d = item.data || {};
            var status = String(d.status || 'active').toLowerCase();
            if (status === 'paused') counts.paused += 1;
            else if (status === 'unsubscribed') counts.unsubscribed += 1;
            else counts.active += 1;
            var statusEmoji = status === 'paused' ? '⏸️' : (status === 'unsubscribed' ? '🚫' : '✅');
            html += '<div class="creative-card">';
            html += '<h4>📧 ' + escapeHtml(d.email || item.recordKey) + '</h4>';
            html += '<div class="creative-meta">Name: ' + escapeHtml(d.name || 'n/a') + '</div>';
            html += '<div class="pill-row"><span class="pill">' + statusEmoji + ' Status: ' + escapeHtml(status) + '</span></div>';
            html += '<button class="btn btn-danger" data-action="delete-newsletter-subscriber" data-record-key="' + escapeHtml(item.recordKey || '') + '">🗑️ Delete</button>';
            html += '</div>';
          });
          container.innerHTML = html;
          if (summary) {
            summary.innerHTML =
              '<span class="newsletter-tag">Total: ' + fmtNumber(counts.total) + '</span>' +
              '<span class="newsletter-tag">Active: ' + fmtNumber(counts.active) + '</span>' +
              '<span class="newsletter-tag">Paused: ' + fmtNumber(counts.paused) + '</span>' +
              '<span class="newsletter-tag">Unsubscribed: ' + fmtNumber(counts.unsubscribed) + '</span>';
          }
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load subscribers</div>';
          if (summary) summary.innerHTML = '';
        }
      }

      async function saveNewsletterSubscriber(e) {
        e.preventDefault();
        var email = (document.getElementById('newsletter-email').value || '').trim();
        if (!email) return;
        var data = {
          email: email,
          name: (document.getElementById('newsletter-name').value || '').trim(),
          status: (document.getElementById('newsletter-status').value || 'active').trim(),
          updatedAt: Date.now()
        };
        try {
          await fetchJSONWithInit('/api/admin/newsletter/subscribers/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: data })
          });
          var form = document.getElementById('newsletter-subscriber-form');
          if (form) form.reset();
          var statusEl = document.getElementById('newsletter-status');
          if (statusEl) statusEl.value = 'active';
          await loadNewsletterSubscribers();
        } catch (_) {}
      }

      async function deleteNewsletterSubscriber(key) {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Delete subscriber "' + key + '"?')) return;
        try {
          await fetchJSONWithInit('/api/admin/newsletter/subscribers/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordKey: key })
          });
          await loadNewsletterSubscribers();
        } catch (_) {}
      }

      async function loadNotifications() {
        var container = document.getElementById('notification-counters');
        var freshness = document.getElementById('notification-freshness');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
        if (freshness) freshness.textContent = 'Source: loading...';
        try {
          var githubPayload = await fetchJSON('/api/admin/github/open-counts');
          if (!githubPayload || githubPayload.ok === false) {
            throw new Error((githubPayload && githubPayload.error) ? githubPayload.error : 'github_unreachable');
          }
          var known = {
            openIssues: githubPayload.issuesKnown !== false,
            openPRs: githubPayload.prsKnown !== false,
            branches: githubPayload.branchesKnown !== false,
            discussions: githubPayload.discussionsKnown !== false
          };
          var github = {
            openIssues: Number(githubPayload.openIssues || 0),
            openPRs: Number(githubPayload.openPRs || 0),
            branches: Number(githubPayload.branches || 0),
            discussions: Number(githubPayload.discussions || 0)
          };
          function renderNotificationCard(label, value, isKnown) {
            var shown = isKnown ? fmtNumber(value) : 'N/A';
            var valueClass = isKnown ? 'stat-value' : 'stat-value status-warning';
            return '<div class="stat-card2"><div class="stat-label">' + label + '</div><div class="' + valueClass + '">' + shown + '</div></div>';
          }
          container.innerHTML =
            renderNotificationCard('🐛 Open Issues', github.openIssues || 0, known.openIssues) +
            renderNotificationCard('🔀 Open PRs', github.openPRs || 0, known.openPRs) +
            renderNotificationCard('🌿 Branches', github.branches || 0, known.branches) +
            renderNotificationCard('💬 Discussions', github.discussions || 0, known.discussions);
          if (freshness) {
            var sourceCode = String(githubPayload.source || (githubPayload.stale ? 'stale_cache' : (githubPayload.cached ? 'cache' : 'live')));
            var parts = ['Source: ' + sourceLabelFromCode(sourceCode)];
            var fetchedAt = fmtUtcDateTimeFromMs(githubPayload.fetchedAt);
            if (fetchedAt !== 'n/a') parts.push('Fetched (UTC): ' + fetchedAt);
            if (githubPayload.partial) parts.push('Partial data');
            freshness.textContent = parts.join(' | ');
          }
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load GitHub counters: ' + escapeHtml(String((e && e.message) || e || 'unknown')) + '</div>';
          if (freshness) freshness.textContent = 'Source: unavailable';
        }
      }

      function setWebsiteAnalysisText(id, value) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = value;
      }

      function setWebsiteAnalysisTableState(tableBodyId, html, emptyLabel, colSpan) {
        var body = document.getElementById(tableBodyId);
        if (!body) return;
        if (html) {
          body.innerHTML = html;
          return;
        }
        body.innerHTML = '<tr><td colspan="' + String(colSpan || 1) + '" class="td-primary">' + escapeHtml(emptyLabel || 'No data') + '</td></tr>';
      }

      function setWebsiteAnalysisOutput(payload) {
        var out = document.getElementById('website-analysis-output');
        if (!out) return;
        out.textContent = JSON.stringify(payload || {}, null, 2);
        out.classList.remove('hidden');
      }

      function setWebsiteChainStatus(id, label, status) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = label;
        node.classList.remove('status-ok', 'status-warning', 'status-error');
        if (status === 'ok') node.classList.add('status-ok');
        else if (status === 'warn') node.classList.add('status-warning');
        else if (status === 'critical') node.classList.add('status-error');
      }

      function resetWebsiteChainHealth(reason) {
        setWebsiteAnalysisText('website-chain-last-batch-accepted', '--');
        setWebsiteAnalysisText('website-chain-last-snapshot', '--');
        setWebsiteAnalysisText('website-chain-lag-minutes', '--');
        setWebsiteAnalysisText('website-chain-thresholds-lag', '--');
        setWebsiteAnalysisText('website-chain-thresholds-backup', '--');
        setWebsiteAnalysisText('website-chain-thresholds-sheets', '--');
        setWebsiteAnalysisText('website-chain-thresholds-integrity', '--');
        setWebsiteChainStatus('website-chain-lag-status', '--', 'critical');
        setWebsiteChainStatus('website-chain-backup-status', '--', 'critical');
        setWebsiteChainStatus('website-chain-sheets-status', '--', 'critical');
        setWebsiteChainStatus('website-chain-batch-integrity-status', '--', 'critical');
        if (reason) {
          setWebsiteAnalysisOutput({ ok: false, source: 'website_chain', error: reason });
        }
      }

      async function loadWebsiteChainHealth() {
        var data = await fetchJSON('/api/admin/ha/status');
        var chain = data && data.websiteChain ? data.websiteChain : {};
        var thresholds = chain && chain.thresholds ? chain.thresholds : {};
        var lastBatch = chain && chain.lastBatchAccepted ? chain.lastBatchAccepted : null;
        var lastSnapshot = chain && chain.lastSnapshotGenerated ? chain.lastSnapshotGenerated : null;
        var lagMinutes = Number(chain && chain.lagMinutes);
        var lagStatus = String(chain && chain.lagStatus || 'unknown').trim().toLowerCase();

        var backup = chain && chain.backupDrift ? chain.backupDrift : {};
        var backupIndicator = String(backup.indicator || 'unknown').trim().toLowerCase();
        var backupDrift = Number(backup.driftMinutes);
        var backupStatus = String(backup.status || 'unknown').trim();

        var sheets = chain && chain.sheetsFlushVerification ? chain.sheetsFlushVerification : {};
        var sheetsIndicator = String(sheets.indicator || 'unknown').trim().toLowerCase();
        var sheetsDrift = Number(sheets.driftMinutes);
        var sheetsStatus = String(sheets.status || 'unknown').trim();
        var sheetsVerified = sheets.verified === true;
        var sheetsChecksumStatus = String(sheets.checksumStatus || 'unknown').trim().toLowerCase();
        var sheetsRowCountStatus = String(sheets.rowCountStatus || 'unknown').trim().toLowerCase();

        var integrity = chain && chain.batchIntegrity ? chain.batchIntegrity : {};
        var integrityStatus = String(integrity.status || 'unknown').trim().toLowerCase();
        var integrityVerified = integrity.verified === true;
        var integrityChecksumStatus = String(integrity.checksumStatus || 'unknown').trim().toLowerCase();
        var integrityRowCountStatus = String(integrity.rowCountStatus || 'unknown').trim().toLowerCase();

        setWebsiteAnalysisText(
          'website-chain-last-batch-accepted',
          lastBatch && Number(lastBatch.acceptedAtUtc || 0) > 0 ? formatWebsiteSyncTimestamp(Number(lastBatch.acceptedAtUtc || 0)) : '--'
        );
        setWebsiteAnalysisText(
          'website-chain-last-snapshot',
          lastSnapshot && Number(lastSnapshot.generatedAtUtc || 0) > 0 ? formatWebsiteSyncTimestamp(Number(lastSnapshot.generatedAtUtc || 0)) : '--'
        );
        setWebsiteAnalysisText(
          'website-chain-lag-minutes',
          Number.isFinite(lagMinutes) ? (fmtNumber(lagMinutes) + ' min') : '--'
        );
        setWebsiteAnalysisText(
          'website-chain-thresholds-lag',
          'Warn ≥ ' + fmtNumber(Number(thresholds.lagWarnMinutes || 0)) + 'm · Critical ≥ ' + fmtNumber(Number(thresholds.lagCriticalMinutes || 0)) + 'm'
        );
        setWebsiteAnalysisText(
          'website-chain-thresholds-backup',
          'Expected ≤ ' + fmtNumber(Number(thresholds.backupExpectedMinutes || 0)) + 'm · Critical ≥ ' + fmtNumber(Number(thresholds.backupCriticalMinutes || 0)) + 'm'
        );
        setWebsiteAnalysisText(
          'website-chain-thresholds-sheets',
          'Expected ≤ ' + fmtNumber(Number(thresholds.sheetsExpectedMinutes || 0)) + 'm · Critical ≥ ' + fmtNumber(Number(thresholds.sheetsCriticalMinutes || 0)) + 'm'
        );
        setWebsiteAnalysisText(
          'website-chain-thresholds-integrity',
          'Checksum: ' + (integrityChecksumStatus || 'unknown').toUpperCase() + ' · Row count: ' + (integrityRowCountStatus || 'unknown').toUpperCase()
        );

        setWebsiteChainStatus('website-chain-lag-status', (lagStatus || 'unknown').toUpperCase(), lagStatus);
        setWebsiteChainStatus(
          'website-chain-backup-status',
          backupStatus + (Number.isFinite(backupDrift) ? (' · drift ' + fmtNumber(backupDrift) + 'm') : ''),
          backupIndicator
        );
        setWebsiteChainStatus(
          'website-chain-sheets-status',
          (sheetsVerified ? 'VERIFIED' : (sheetsStatus || 'unknown').toUpperCase()) +
            ' · checksum ' + (sheetsChecksumStatus || 'unknown').toUpperCase() +
            ' · rows ' + (sheetsRowCountStatus || 'unknown').toUpperCase() +
            (Number.isFinite(sheetsDrift) ? (' · drift ' + fmtNumber(sheetsDrift) + 'm') : ''),
          sheetsVerified ? 'ok' : sheetsIndicator
        );
        setWebsiteChainStatus(
          'website-chain-batch-integrity-status',
          (integrityVerified ? 'VERIFIED' : (integrityStatus || 'unknown').toUpperCase()) +
            ' · checksum ' + (integrityChecksumStatus || 'unknown').toUpperCase() +
            ' · rows ' + (integrityRowCountStatus || 'unknown').toUpperCase(),
          integrityVerified ? 'ok' : (integrityStatus === 'critical' ? 'critical' : integrityStatus)
        );
      }

      async function loadWebsiteAnalytics(rangeOverride) {
        if (typeof rangeOverride !== 'string') {
          rangeOverride = '';
        }
        var rangeEl = document.getElementById('website-analysis-range');
        var range = String(rangeOverride || (rangeEl && rangeEl.value) || websiteAnalyticsRange || '7d').trim() || '7d';
        websiteAnalyticsRange = range;
        if (rangeEl && rangeEl.value !== range) {
          rangeEl.value = range;
        }

        try {
          var data = await fetchJSON('/api/admin/website/analytics?range=' + encodeURIComponent(range));
          var buttons = data.buttons || {};
          var map = data.map || {};
          var feedback = data.feedback || {};
          var traffic = data.traffic || {};

          var installClicks = Number(buttons.installClicks || 0);
          var downloadClicks = Number(buttons.downloadClicks || 0);
          var mapYes = Number(map.yes || 0);
          var mapNo = Number(map.no || 0);
          var yesRatio = Number(map.yesRatio || 0);
          var feedbackTotal = Number(feedback.totalSubmissions || 0);
          var feedbackLast = Number(feedback.lastSubmissionAtUtc || 0);
          var trafficVisits = Number(traffic.visits || 0);
          var trafficRequests = Number(traffic.requests || 0);
          var trafficLastSync = Number(traffic.lastSyncedAtUtc || 0);
          var trafficStatus = String(traffic.status || 'no_data').replace(/_/g, ' ');

          setWebsiteAnalysisText('website-analysis-install-clicks', fmtNumber(installClicks));
          setWebsiteAnalysisText('website-analysis-download-clicks', fmtNumber(downloadClicks));
          setWebsiteAnalysisText('website-analysis-map-yes', fmtNumber(mapYes));
          setWebsiteAnalysisText('website-analysis-map-no', fmtNumber(mapNo));
          setWebsiteAnalysisText('website-analysis-map-yes-ratio', fmtPct(Math.max(0, Math.min(yesRatio, 1))));
          setWebsiteAnalysisText('website-analysis-feedback-total', fmtNumber(feedbackTotal));
          setWebsiteAnalysisText('website-analysis-feedback-last', feedbackLast > 0 ? formatWebsiteSyncTimestamp(feedbackLast) : '--');
          setWebsiteAnalysisText('website-analysis-traffic-visits', fmtNumber(trafficVisits));
          setWebsiteAnalysisText('website-analysis-traffic-requests', fmtNumber(trafficRequests));
          setWebsiteAnalysisText('website-analysis-traffic-status', trafficStatus);
          setWebsiteAnalysisText('website-analysis-traffic-last-sync', trafficLastSync > 0 ? formatWebsiteSyncTimestamp(trafficLastSync) : '--');

          var daily = Array.isArray(data.daily) ? data.daily : [];
          var dailyHtml = '';
          daily.forEach(function(row) {
            dailyHtml += '<tr>';
            dailyHtml += '<td class="td-primary">' + escapeHtml(String(row.dayUtc || '--')) + '</td>';
            dailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.installClicks || 0))) + '</td>';
            dailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.downloadClicks || 0))) + '</td>';
            dailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.mapYes || 0))) + '</td>';
            dailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.mapNo || 0))) + '</td>';
            dailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.feedbackSubmissions || 0))) + '</td>';
            dailyHtml += '</tr>';
          });
          setWebsiteAnalysisTableState('website-analysis-daily-body', dailyHtml, 'No daily website telemetry yet.', 6);

          var trafficDaily = Array.isArray(data.trafficDaily) ? data.trafficDaily : [];
          var trafficDailyHtml = '';
          trafficDaily.forEach(function(row) {
            trafficDailyHtml += '<tr>';
            trafficDailyHtml += '<td class="td-primary">' + escapeHtml(String(row.dayUtc || '--')) + '</td>';
            trafficDailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.visits || 0))) + '</td>';
            trafficDailyHtml += '<td>' + escapeHtml(fmtNumber(Number(row.requests || 0))) + '</td>';
            trafficDailyHtml += '</tr>';
          });
          setWebsiteAnalysisTableState('website-analysis-traffic-daily-body', trafficDailyHtml, 'No daily Cloudflare traffic yet.', 3);

          var placements = Array.isArray(data.placements) ? data.placements : [];
          var placementsHtml = '';
          placements.forEach(function(row) {
            placementsHtml += '<tr>';
            placementsHtml += '<td class="td-primary">' + escapeHtml(String(row.placement || 'unknown')) + '</td>';
            placementsHtml += '<td>' + escapeHtml(String(row.action || 'unknown')) + '</td>';
            placementsHtml += '<td>' + escapeHtml(fmtNumber(Number(row.count || 0))) + '</td>';
            placementsHtml += '</tr>';
          });
          setWebsiteAnalysisTableState('website-analysis-placements-body', placementsHtml, 'No placement telemetry yet.', 3);

          var reasons = Array.isArray(feedback.topReasons) ? feedback.topReasons : [];
          var reasonsHtml = '';
          reasons.forEach(function(row) {
            reasonsHtml += '<tr>';
            reasonsHtml += '<td class="td-primary">' + escapeHtml(String(row.reason || 'Unknown')) + '</td>';
            reasonsHtml += '<td>' + escapeHtml(fmtNumber(Number(row.count || 0))) + '</td>';
            reasonsHtml += '</tr>';
          });
          setWebsiteAnalysisTableState('website-analysis-feedback-reasons-body', reasonsHtml, 'No feedback reasons yet.', 2);

          var feedbackDaily = Array.isArray(feedback.dailySubmissions) ? feedback.dailySubmissions : [];
          var feedbackDailyHtml = '';
          var feedbackPeak = 0;
          feedbackDaily.forEach(function(row) {
            var submissions = Number(row.submissions || 0);
            if (submissions > feedbackPeak) feedbackPeak = submissions;
            feedbackDailyHtml += '<tr>';
            feedbackDailyHtml += '<td class="td-primary">' + escapeHtml(String(row.dayUtc || '--')) + '</td>';
            feedbackDailyHtml += '<td>' + escapeHtml(fmtNumber(submissions)) + '</td>';
            feedbackDailyHtml += '</tr>';
          });
          setWebsiteAnalysisTableState('website-analysis-feedback-daily-body', feedbackDailyHtml, 'No daily feedback yet.', 2);

          var feedbackBrowsers = Array.isArray(feedback.byBrowser) ? feedback.byBrowser : [];
          var topBrowser = feedbackBrowsers.length ? String(feedbackBrowsers[0].reason || '--') : '--';
          var topReason = reasons.length ? String(reasons[0].reason || '--') : '--';
          setWebsiteAnalysisText('website-analysis-feedback-top-browser', topBrowser);
          setWebsiteAnalysisText('website-analysis-feedback-top-reason', topReason);
          setWebsiteAnalysisText('website-analysis-feedback-daily-peak', feedbackDaily.length ? fmtNumber(feedbackPeak) : '--');

          setWebsiteAnalysisOutput(data);
          await loadWebsiteChainHealth();
        } catch (e) {
          setWebsiteAnalysisOutput({ ok: false, error: String((e && e.message) || e || 'unknown') });
          setWebsiteAnalysisTableState('website-analysis-daily-body', '', 'Failed to load daily telemetry.', 6);
          setWebsiteAnalysisTableState('website-analysis-traffic-daily-body', '', 'Failed to load Cloudflare traffic.', 3);
          setWebsiteAnalysisTableState('website-analysis-placements-body', '', 'Failed to load placement telemetry.', 3);
          setWebsiteAnalysisTableState('website-analysis-feedback-reasons-body', '', 'Failed to load feedback summary.', 2);
          setWebsiteAnalysisTableState('website-analysis-feedback-daily-body', '', 'Failed to load feedback timeline.', 2);
          setWebsiteAnalysisText('website-analysis-traffic-visits', '--');
          setWebsiteAnalysisText('website-analysis-traffic-requests', '--');
          setWebsiteAnalysisText('website-analysis-traffic-status', '--');
          setWebsiteAnalysisText('website-analysis-traffic-last-sync', '--');
          setWebsiteAnalysisText('website-analysis-feedback-top-browser', '--');
          setWebsiteAnalysisText('website-analysis-feedback-top-reason', '--');
          setWebsiteAnalysisText('website-analysis-feedback-daily-peak', '--');
          resetWebsiteChainHealth();
        }
      }

      async function websiteTrafficSyncNow() {
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var payload = await fetchJSONWithInit('/api/admin/website/traffic/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setWebsiteAnalysisOutput(payload);
          await loadWebsiteAnalytics();
        } catch (e) {
          setWebsiteAnalysisOutput({ ok: false, error: String(e) });
        }
      }

      function setWebsiteSyncOutput(payload) {
        var out = document.getElementById('website-sync-output');
        if (!out) return;
        out.textContent = JSON.stringify(payload || {}, null, 2);
        out.classList.remove('hidden');
      }

      function setWebsiteSyncText(id, value) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = value;
      }

      function renderWebsiteSyncAnomaly(anomaly) {
        var banner = document.getElementById('website-sync-anomaly-banner');
        var messageNode = document.getElementById('website-sync-anomaly-message');
        var detailsNode = document.getElementById('website-sync-anomaly-details');
        if (!banner || !messageNode || !detailsNode) return;
        if (!anomaly || anomaly.active !== true) {
          banner.classList.add('hidden');
          messageNode.textContent = '';
          detailsNode.innerHTML = '';
          return;
        }
        banner.classList.remove('hidden');
        var source = String(anomaly.source || 'unknown').trim();
        var detectedAt = Number(anomaly.detectedAt || 0);
        var prefix = source ? ('Source: ' + source + ' · ') : '';
        var msg = String(anomaly.message || 'A totals decrease was blocked by monotonic guard.').trim();
        messageNode.textContent = prefix + msg + (detectedAt > 0 ? (' · ' + fmtUtcDateTimeFromMs(detectedAt)) : '');
        var details = Array.isArray(anomaly.details) ? anomaly.details : [];
        if (!details.length) {
          detailsNode.innerHTML = '';
          return;
        }
        detailsNode.innerHTML = details
          .slice(0, 8)
          .map(function(item) {
            return '<li>' + escapeHtml(String(item || '')) + '</li>';
          })
          .join('');
      }

      function formatWebsiteSyncTimestamp(ts) {
        if (!Number.isFinite(Number(ts)) || Number(ts) <= 0) {
          return '--';
        }
        return fmtUtcDateTimeFromMs(Number(ts)) + ' (' + timeAgo(Number(ts)) + ')';
      }

      function formatWebsiteSyncBatch(batch) {
        if (!batch) return '--';
        var status = String(batch.status || 'unknown').trim().slice(0, 24) || 'unknown';
        var batchId = String(batch.batchId || batch.batch_id || '--').trim().slice(0, 64) || '--';
        var createdAt = Number(batch.createdAt || batch.created_at || 0);
        return status + ' · ' + batchId + ' · ' + formatWebsiteSyncTimestamp(createdAt);
      }

      function parseWebsiteOverrideCountries(raw) {
        var trimmed = String(raw || '').trim();
        if (!trimmed) return { ok: true, value: [] };
        var parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch (_) {
          return { ok: false, error: 'Override countries JSON is invalid.' };
        }
        if (!Array.isArray(parsed)) {
          return { ok: false, error: 'Override countries must be a JSON array.' };
        }
        var out = [];
        for (var i = 0; i < parsed.length; i += 1) {
          var row = parsed[i];
          if (!row || typeof row !== 'object') continue;
          var code = String(row.countryCode || '').trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(code)) continue;
          if (code === 'XX' || code === 'ZZ' || code === 'UN' || code === 'EU') continue;
          var count = Number(row.count || 0);
          if (!Number.isFinite(count) || count <= 0) continue;
          out.push({ countryCode: code, count: Math.floor(count) });
          if (out.length >= 300) break;
        }
        return { ok: true, value: out };
      }

      async function loadWebsiteSyncState() {
        var stateNode = document.getElementById('website-sync-published-source');
        if (!stateNode) return;
        try {
          var data = await fetchJSON('/api/admin/website/state');
          var snapshot = null;
          try {
            snapshot = await fetchJSON('/api/public/website/snapshot');
          } catch (_) {
            snapshot = null;
          }
          var control = data.control || {};
          var overrideCountries = Array.isArray(control.overrideCountries) ? control.overrideCountries : [];
          var publishedCountries = Array.isArray(control.publishedCountries) ? control.publishedCountries : [];
          var oneAmEnabled = !!control.oneAmFlushEnabled;
          var overrideEnabled = !!control.overrideEnabled;

          setWebsiteSyncText('website-sync-published-source', String(control.publishedSource || 'n/a'));
          setWebsiteSyncText('website-sync-published-downloads', fmtNumber(Number(control.publishedDownloads || 0)));
          setWebsiteSyncText('website-sync-published-countries', fmtNumber(publishedCountries.length));
          setWebsiteSyncText('website-sync-oneam-state', oneAmEnabled ? 'Enabled' : 'Disabled');
          setWebsiteSyncText('website-sync-override-state', overrideEnabled ? 'Enabled' : 'Disabled');
          setWebsiteSyncText('website-sync-last-oracle', formatWebsiteSyncTimestamp(Number(control.lastOraclePushAt || 0)));
          setWebsiteSyncText('website-sync-last-cloudflare', formatWebsiteSyncTimestamp(Number(control.lastCloudflarePushAt || 0)));
          setWebsiteSyncText('website-sync-last-website', formatWebsiteSyncTimestamp(Number(control.lastWebsiteIngestAt || 0)));
          setWebsiteSyncText('website-sync-last-batch-oracle', formatWebsiteSyncBatch(data.lastBatches && data.lastBatches.oracleToWebsite));
          setWebsiteSyncText('website-sync-last-batch-cloudflare', formatWebsiteSyncBatch(data.lastBatches && data.lastBatches.cloudflareToWebsite));
          setWebsiteSyncText('website-sync-last-batch-website', formatWebsiteSyncBatch(data.lastBatches && data.lastBatches.websiteToOracle));

          if (snapshot && snapshot.overview && snapshot.map) {
            var overview = snapshot.overview || {};
            var map = snapshot.map || {};
            var totals = overview.totals || {};
            var installs = overview.installs || {};
            var versions = overview.versions || {};
            var status = overview.status || {};
            var changelog = snapshot.changelog || {};
            setWebsiteSyncText('website-sync-published-success', fmtNumber(Number(totals.success || 0)));
            setWebsiteSyncText('website-sync-published-fail', fmtNumber(Number(totals.fail || 0)));
            setWebsiteSyncText('website-sync-map-countries', fmtNumber(Number((map.totals && map.totals.countries) || 0)));
            setWebsiteSyncText('website-sync-installs-users', fmtNumber(Number(installs.usersTotal || 0)));
            setWebsiteSyncText('website-sync-snapshot-id', String(snapshot.snapshotId || '--'));
            setWebsiteSyncText('website-sync-snapshot-generated', formatWebsiteSyncTimestamp(Number(snapshot.generatedAt || 0)));
            setWebsiteSyncText('website-sync-worker-health', String(status.workerHealth || '--').toUpperCase());
            setWebsiteSyncText('website-sync-changelog-source', String(changelog.source || 'oracle').toUpperCase());
            setWebsiteSyncText(
              'website-sync-versions',
              'GH ' + String(versions.github || '--') + ' · CH ' + String(versions.chrome || '--') + ' · FF ' + String(versions.firefox || '--') + ' · ED ' + String(versions.edge || '--')
            );
          } else {
            setWebsiteSyncText('website-sync-published-success', '--');
            setWebsiteSyncText('website-sync-published-fail', '--');
            setWebsiteSyncText('website-sync-map-countries', '--');
            setWebsiteSyncText('website-sync-installs-users', '--');
            setWebsiteSyncText('website-sync-snapshot-id', '--');
            setWebsiteSyncText('website-sync-snapshot-generated', '--');
            setWebsiteSyncText('website-sync-worker-health', '--');
            setWebsiteSyncText('website-sync-changelog-source', '--');
            setWebsiteSyncText('website-sync-versions', '--');
          }

          var oneAmCheckbox = document.getElementById('website-sync-oneam-checkbox');
          if (oneAmCheckbox) {
            oneAmCheckbox.checked = oneAmEnabled;
          }
          var overrideEnabledCheckbox = document.getElementById('website-sync-override-enabled');
          if (overrideEnabledCheckbox) {
            overrideEnabledCheckbox.checked = overrideEnabled;
          }
          var overrideDownloadsInput = document.getElementById('website-sync-override-downloads');
          if (overrideDownloadsInput && document.activeElement !== overrideDownloadsInput) {
            overrideDownloadsInput.value = String(Math.max(0, Number(control.overrideDownloads || 0)));
          }
          var overrideCountriesInput = document.getElementById('website-sync-override-countries');
          if (overrideCountriesInput && document.activeElement !== overrideCountriesInput) {
            overrideCountriesInput.value = JSON.stringify(overrideCountries, null, 2);
          }
        } catch (e) {
          setWebsiteSyncOutput({ ok: false, error: String(e) });
        }
      }

      async function websiteSyncForcePush() {
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var payload = await fetchJSONWithInit('/api/admin/website/force-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setWebsiteSyncOutput(payload);
          await loadWebsiteSyncState();
        } catch (e) {
          setWebsiteSyncOutput({ ok: false, error: String(e) });
        }
      }

      async function websiteSyncPullCloudflare() {
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var payload = await fetchJSONWithInit('/api/admin/website/pull-cloudflare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setWebsiteSyncOutput(payload);
          await loadWebsiteSyncState();
        } catch (e) {
          setWebsiteSyncOutput({ ok: false, error: String(e) });
        }
      }

      async function websiteSyncSaveOneAM() {
        var checkbox = document.getElementById('website-sync-oneam-checkbox');
        var enabled = !!(checkbox && checkbox.checked);
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var payload = await fetchJSONWithInit('/api/admin/website/one-am-toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: enabled })
          });
          setWebsiteSyncOutput(payload);
          await loadWebsiteSyncState();
        } catch (e) {
          setWebsiteSyncOutput({ ok: false, error: String(e) });
        }
      }

      async function websiteSyncSaveOverride() {
        var enabledEl = document.getElementById('website-sync-override-enabled');
        var downloadsEl = document.getElementById('website-sync-override-downloads');
        var countriesEl = document.getElementById('website-sync-override-countries');
        var enabled = !!(enabledEl && enabledEl.checked);
        var downloads = Number(downloadsEl && downloadsEl.value ? downloadsEl.value : 0);
        if (!Number.isFinite(downloads) || downloads < 0) downloads = 0;
        downloads = Math.floor(downloads);

        var countriesResult = parseWebsiteOverrideCountries(countriesEl && countriesEl.value ? countriesEl.value : '[]');
        if (!countriesResult.ok) {
          setWebsiteSyncOutput({ ok: false, error: countriesResult.error });
          return;
        }

        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var payload = await fetchJSONWithInit('/api/admin/website/override', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: enabled,
              downloads: downloads,
              countries: countriesResult.value
            })
          });
          setWebsiteSyncOutput(payload);
          await loadWebsiteSyncState();
        } catch (e) {
          setWebsiteSyncOutput({ ok: false, error: String(e) });
        }
      }

      function setOracleLogsOutput(payload) {
        var out = document.getElementById('oracle-logs-output');
        if (!out) return;
        out.textContent = JSON.stringify(payload, null, 2);
        out.classList.remove('hidden');
      }

      async function loadOracleLogs() {
        var container = document.getElementById('oracle-logs-table');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading logs...</div>';
        try {
          var data = await fetchJSON('/api/admin/oracle-logs?limit=500');
          var logs = (data && data.logs) ? data.logs : [];
          if (!logs.length) {
            container.innerHTML = '<div class="empty-state">No oracle operation logs yet</div>';
            setOracleLogsOutput({ ok: true, count: 0 });
            return;
          }
          var html = '<table><thead><tr>';
          html += '<th>Time (UTC)</th>';
          html += '<th>Action</th>';
          html += '<th>Resource</th>';
          html += '<th>Actor</th>';
          html += '<th>Request</th>';
          html += '<th>Status</th>';
          html += '<th>Latency</th>';
          html += '</tr></thead><tbody>';
          logs.forEach(function(row) {
            var statusClass = (row.result === 'ok') ? 'log-status-ok' : 'log-status-error';
            var actor = (row.userId || 'anonymous') + ' (' + (row.role || 'viewer') + ')';
            var reqInfo = (row.method || '') + ' ' + (row.path || '');
            var resourceInfo = (row.resourceType || '-') + ' / ' + (row.resourceId || '-');
            html += '<tr>';
            html += '<td class="td-primary">' + escapeHtml(fmtFullDateTime(row.tsUtc)) + '</td>';
            html += '<td><span class="badge badge-warning">' + escapeHtml(row.actionType || '-') + '</span></td>';
            html += '<td class="log-cell-resource">' + escapeHtml(resourceInfo) + '</td>';
            html += '<td class="log-cell-actor">' + escapeHtml(actor) + '</td>';
            html += '<td class="log-cell-request">' + escapeHtml(reqInfo) + '</td>';
            html += '<td><span class="' + statusClass + '">' + escapeHtml(String(row.statusCode || '')) + ' (' + escapeHtml(row.result || '') + ')</span></td>';
            html += '<td>' + escapeHtml(String(row.latencyMs || 0)) + 'ms</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          container.innerHTML = html;
          setOracleLogsOutput({ ok: true, count: logs.length, latestTsUtc: logs[0].tsUtc || 0 });
        } catch (e) {
          container.innerHTML = '<div class="empty-state empty-state-danger">Failed to load logs</div>';
          setOracleLogsOutput({ ok: false, error: String(e) });
        }
      }

      function oracleLogsRetentionDays() {
        var input = document.getElementById('oracle-logs-retention-days');
        var days = parseInt((input && input.value) ? input.value : '30', 10);
        if (!Number.isFinite(days) || days < 1 || days > 36500) {
          return null;
        }
        return days;
      }

      async function oracleLogsDeleteOlder(dryRun) {
        var days = oracleLogsRetentionDays();
        if (days === null) {
          setOracleLogsOutput({ ok: false, error: 'Retention days must be between 1 and 36500.' });
          return;
        }
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!dryRun && !window.confirm('Delete oracle logs older than ' + days + ' day(s)?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/oracle-logs/delete-older', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: days, dryRun: dryRun })
          });
          setOracleLogsOutput(data);
          if (!dryRun) await loadOracleLogs();
        } catch (e) {
          setOracleLogsOutput({ ok: false, error: String(e) });
        }
      }

      async function oracleLogsClearAll() {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Delete ALL oracle operation logs?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/oracle-logs/clear-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: 'CLEAR_ALL_LOGS', dryRun: false })
          });
          setOracleLogsOutput(data);
          await loadOracleLogs();
        } catch (e) {
          setOracleLogsOutput({ ok: false, error: String(e) });
        }
      }

      function dangerLogRetentionDays() {
        var input = document.getElementById('danger-log-retention-days');
        var days = parseInt((input && input.value) ? input.value : '30', 10);
        if (!Number.isFinite(days) || days < 1 || days > 36500) return null;
        return days;
      }

      async function dangerDeleteOlderLogs(dryRun) {
        var days = dangerLogRetentionDays();
        if (days === null) {
          setDangerOutput({ ok: false, error: 'Retention days must be between 1 and 36500.' });
          return;
        }
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!dryRun && !window.confirm('Delete oracle logs older than ' + days + ' day(s)?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/oracle-logs/delete-older', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: days, dryRun: dryRun })
          });
          setDangerOutput(data);
          var logsInput = document.getElementById('oracle-logs-retention-days');
          if (logsInput) logsInput.value = String(days);
          if (!dryRun && currentPage === 'logs') await loadOracleLogs();
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerDeleteAllLogs() {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Delete ALL oracle operation logs?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/oracle-logs/clear-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: 'CLEAR_ALL_LOGS', dryRun: false })
          });
          setDangerOutput(data);
          if (currentPage === 'logs') await loadOracleLogs();
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      // Danger / admin tooling
      async function ensureStepUp() {
        try {
          var check = await fetchJSON('/api/auth/stepup/check');
          if (!check.required || check.active) return true;
          return openStepUpModal();
        } catch (_) {
          return false;
        }
      }

      function setDangerOutput(payload) {
        var out = document.getElementById('danger-output');
        if (!out) return;
        out.textContent = JSON.stringify(payload, null, 2);
        out.classList.remove('hidden');
      }

      async function dangerDryRun(scope) {
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/danger/clear-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: scope, dryRun: true })
          });
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerExecute(scope) {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Execute destructive clear-data operation?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/danger/clear-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: scope, dryRun: false })
          });
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function runBackup() {
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/backup/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function runSheetsFlushNow() {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Run Google Sheets flush now?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/sheets/flush-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          });
          setDangerOutput(data);
          await loadFlushInfo();
          showFlushModal();
        } catch (e) {
          if (e && e.payload && typeof e.payload === 'object') {
            setDangerOutput(e.payload);
          } else {
            setDangerOutput({ ok: false, error: String(e) });
          }
        }
      }

      async function dangerLoadOutboxStatus() {
        try {
          var data = await fetchJSON('/api/admin/outbox/status');
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerRetryOutbox() {
        var ok = await ensureStepUp();
        if (!ok) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/outbox/retry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerReplayDeadLetter() {
        var ok = await ensureStepUp();
        if (!ok) return;
        if (!window.confirm('Replay dead-letter rows back into the outbox queue?')) return;
        try {
          var data = await fetchJSONWithInit('/api/admin/outbox/replay-dead-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerVerifyAuditChain() {
        try {
          var data = await fetchJSON('/api/admin/audit/verify-chain');
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerLoadAlerts() {
        try {
          var data = await fetchJSON('/api/admin/alerts');
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerLoadFeatureFlags() {
        try {
          var data = await fetchJSON('/api/admin/flags');
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerLoadMigrationsStatus() {
        try {
          var data = await fetchJSON('/api/admin/migrations/status');
          setDangerOutput(data);
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      async function dangerLoadOpsSnapshot() {
        try {
          var parts = await Promise.all([
            fetchJSON('/api/admin/outbox/status').catch(function(e) { return { ok: false, error: String(e) }; }),
            fetchJSON('/api/admin/alerts').catch(function(e) { return { ok: false, error: String(e) }; }),
            fetchJSON('/api/admin/flags').catch(function(e) { return { ok: false, error: String(e) }; }),
            fetchJSON('/api/admin/migrations/status').catch(function(e) { return { ok: false, error: String(e) }; }),
            fetchJSON('/api/admin/audit/verify-chain').catch(function(e) { return { ok: false, error: String(e) }; })
          ]);
          setDangerOutput({
            ok: true,
            snapshotAtUtc: new Date().toISOString(),
            outbox: parts[0],
            alerts: parts[1],
            flags: parts[2],
            migrations: parts[3],
            auditChain: parts[4]
          });
        } catch (e) {
          setDangerOutput({ ok: false, error: String(e) });
        }
      }

      // Keyboard shortcuts
      var shortcutItems = [
        { combo: 'Cmd/Ctrl+1', desc: 'Go to Overview', run: function() { showPage('overview'); } },
        { combo: 'Cmd/Ctrl+2', desc: 'Go to Activity & Charts', run: function () { showPage('activity'); } },
        { combo: 'Cmd/Ctrl+3', desc: 'Go to Ops Hub', run: function() { showPage('dashboards'); } },
        { combo: 'Cmd/Ctrl+8', desc: 'Go to Website Sync', run: function() { showPage('website-sync'); } },
        { combo: 'Cmd/Ctrl+4', desc: 'Go to Creative Hub', run: function () { showPage('creative'); } },
        { combo: 'Cmd/Ctrl+5', desc: 'Go to User Changelog', run: function () { showPage('content-changelog'); } },
        { combo: 'Cmd/Ctrl+7', desc: 'Go to Logs', run: function () { showPage('logs'); } },
        { combo: 'Cmd/Ctrl+0', desc: 'Go to Danger Zone', run: function() { showPage('danger'); } },
        { combo: 'Cmd/Ctrl+R', desc: 'Refresh all data', run: function() { refreshAll(); } },
        { combo: 'Cmd/Ctrl+B', desc: 'Open last batch modal', run: function() { showBatchModal(); } },
        { combo: 'Cmd/Ctrl+Shift+B', desc: 'Open last sheets flush modal', run: function() { showFlushModal(); } },
        { combo: 'Cmd/Ctrl+Shift+D', desc: 'Sync deployment stores', run: function() { syncDeploymentTargets(); } },
        { combo: 'Cmd/Ctrl+Shift+S', desc: 'Open step-up modal', run: function() { openStepUpModal(); } },
        { combo: 'Cmd/Ctrl+/', desc: 'Open shortcuts help', run: function() { openShortcutsModal(); } }
      ];

      function openShortcutsModal() {
        var modal = document.getElementById('shortcuts-modal');
        if (!modal) return;
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
      }

      function closeShortcutsModal() {
        var modal = document.getElementById('shortcuts-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }

      function renderShortcutsList() {
        var container = document.getElementById('shortcuts-list');
        if (!container) return;
        var html = '';
        shortcutItems.forEach(function(item) {
          html += '<div class="shortcut-row">';
          html += '<span class="shortcut-key">' + escapeHtml(item.combo) + '</span>';
          html += '<span class="shortcut-desc">' + escapeHtml(item.desc) + '</span>';
          html += '</div>';
        });
        container.innerHTML = html;
      }

      function shouldIgnoreGlobalShortcut(e) {
        var target = e && e.target;
        if (!target) return false;
        if (target.closest && target.closest('[data-shortcuts-capture="true"]')) return false;
        var editable = target.closest
          ? target.closest('input, textarea, select, [contenteditable], [role="textbox"]')
          : null;
        if (editable) return true;
        var tag = (target.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target.isContentEditable;
      }

      function runKeyboardShortcut(e) {
        if (shouldIgnoreGlobalShortcut(e)) return false;
        var usesMod = e.metaKey || e.ctrlKey;
        if (!usesMod) return false;
        var key = (e.key || '').toLowerCase();
        var withShift = !!e.shiftKey;

        if (!withShift && key === '1') { showPage('overview'); return true; }
        if (!withShift && key === '2') { showPage('activity'); return true; }
        if (!withShift && key === '3') { showPage('dashboards'); return true; }
        if (!withShift && key === '8') { showPage('website-sync'); return true; }
        if (!withShift && key === '4') { showPage('creative'); return true; }
        if (!withShift && key === '5') { showPage('content-changelog'); return true; }
        if (!withShift && key === '7') { showPage('logs'); return true; }
        if (!withShift && key === '0') { showPage('danger'); return true; }
        if (!withShift && key === 'r') { refreshAll(); return true; }
        if (!withShift && key === 'b') { showBatchModal(); return true; }
        if (withShift && key === 'b') { showFlushModal(); return true; }
        if (withShift && key === 'd') { syncDeploymentTargets(); return true; }
        if (withShift && key === 's') { openStepUpModal(); return true; }
        if (!withShift && key === '/') { openShortcutsModal(); return true; }
        return false;
      }

      function bindButtonActions() {
        document.querySelectorAll('.nav-item[data-page]').forEach(function(btn) {
          if (btn.dataset.boundClick === '1') return;
          btn.dataset.boundClick = '1';
          btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            var page = btn.getAttribute('data-page');
            if (page) showPage(page);
          });
        });

        var mobilePageSelect = document.getElementById('mobile-page-select');
        if (mobilePageSelect && mobilePageSelect.dataset.boundChange !== '1') {
          mobilePageSelect.dataset.boundChange = '1';
          mobilePageSelect.addEventListener('change', function() {
            showPage(mobilePageSelect.value);
          });
        }

        var activityVersionFilter = document.getElementById('activity-version-filter');
        if (activityVersionFilter && activityVersionFilter.dataset.boundChange !== '1') {
          activityVersionFilter.dataset.boundChange = '1';
          activityVersionFilter.addEventListener('change', onActivityVersionChange);
        }

        var activityTabs = document.getElementById('activity-tabs');
        if (activityTabs && activityTabs.dataset.boundClick !== '1') {
          activityTabs.dataset.boundClick = '1';
          activityTabs.addEventListener('click', function(ev) {
            var btn = ev.target.closest('.tab[data-range]');
            if (!btn) return;
            ev.preventDefault();
            setActivityRange(btn.dataset.range);
          });
        }

        var comparisonTabs = document.querySelectorAll('[data-comparison-range]');
        comparisonTabs.forEach(function(btn) {
          if (btn.dataset.boundClick === '1') return;
          btn.dataset.boundClick = '1';
          btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            setComparison(btn.getAttribute('data-comparison-range'));
          });
        });

        [
          ['shortcuts-btn', openShortcutsModal],
          ['shortcuts-btn-mobile', openShortcutsModal],
          ['batch-btn', showBatchModal],
          ['batch-btn-mobile', showBatchModal],
          ['flush-btn', showFlushModal],
          ['flush-btn-mobile', showFlushModal],
          ['refresh-btn', refreshAll],
          ['refresh-btn-mobile', refreshAll],
          ['deployment-sync-btn', syncDeploymentTargets],
          ['stepup-btn', openStepUpModal],
          ['log-sort-btn', toggleLogSort],
          ['log-export-btn', exportLogCSV],
          ['notifications-refresh-btn', loadNotifications],
          ['website-sync-refresh-btn', loadWebsiteSyncState],
          ['website-sync-force-push-btn', websiteSyncForcePush],
          ['website-sync-pull-cloudflare-btn', websiteSyncPullCloudflare],
          ['website-sync-oneam-save-btn', websiteSyncSaveOneAM],
          ['website-sync-override-save-btn', websiteSyncSaveOverride],
          ['user-changelog-refresh-btn', loadUserChangelogRecords],
          ['logs-refresh-btn', loadOracleLogs],
          ['logs-dry-run-delete-btn', function() { oracleLogsDeleteOlder(true); }],
          ['logs-delete-older-btn', function() { oracleLogsDeleteOlder(false); }],
          ['logs-delete-all-btn', oracleLogsClearAll],
          ['danger-dryrun-clear-btn', function() { dangerDryRun('all_non_core'); }],
          ['danger-exec-clear-btn', function() { dangerExecute('all_non_core'); }],
          ['danger-run-backup-btn', runBackup],
          ['danger-run-sheets-flush-btn', runSheetsFlushNow],
          ['danger-alerts-btn', dangerLoadAlerts],
          ['danger-audit-verify-btn', dangerVerifyAuditChain],
          ['danger-outbox-status-btn', dangerLoadOutboxStatus],
          ['danger-flags-btn', dangerLoadFeatureFlags],
          ['danger-logs-dry-run-btn', function() { dangerDeleteOlderLogs(true); }],
          ['danger-logs-delete-older-btn', function() { dangerDeleteOlderLogs(false); }],
          ['danger-logs-delete-all-btn', dangerDeleteAllLogs],
          ['batch-modal-close-btn', closeBatchModal],
          ['flush-modal-close-btn', closeFlushModal]
        ].forEach(function(entry) {
          var node = document.getElementById(entry[0]);
          if (!node || node.dataset.boundClick === '1') return;
          node.dataset.boundClick = '1';
          node.addEventListener('click', function(ev) {
            ev.preventDefault();
            entry[1]();
          });
        });

        [
          ['creative-email-template-form', saveCreativeEmailTemplate],
          ['newsletter-subscriber-form', saveNewsletterSubscriber],
          ['user-changelog-form', saveUserChangelogRecord],
        ].forEach(function(entry) {
          var form = document.getElementById(entry[0]);
          if (!form || form.dataset.boundSubmit === '1') return;
          form.dataset.boundSubmit = '1';
          form.addEventListener('submit', entry[1]);
        });

        var batchModal = document.getElementById('batch-modal');
        if (batchModal && batchModal.dataset.boundClick !== '1') {
          batchModal.dataset.boundClick = '1';
          batchModal.addEventListener('click', function(ev) {
            if (ev.target === batchModal) closeBatchModal();
          });
        }
        var batchModalCard = batchModal ? batchModal.querySelector('.modal') : null;
        if (batchModalCard && batchModalCard.dataset.boundClick !== '1') {
          batchModalCard.dataset.boundClick = '1';
          batchModalCard.addEventListener('click', function(ev) {
            ev.stopPropagation();
          });
        }
        var batchTabs = document.getElementById('batch-modal-tabs');
        if (batchTabs && batchTabs.dataset.boundClick !== '1') {
          batchTabs.dataset.boundClick = '1';
          batchTabs.addEventListener('click', function(ev) {
            var btn = ev.target.closest('[data-batch-tab]');
            if (!btn) return;
            ev.preventDefault();
            setBatchTab(btn.getAttribute('data-batch-tab'));
          });
        }

        var flushModal = document.getElementById('flush-modal');
        if (flushModal && flushModal.dataset.boundClick !== '1') {
          flushModal.dataset.boundClick = '1';
          flushModal.addEventListener('click', function(ev) {
            if (ev.target === flushModal) closeFlushModal();
          });
        }
        var flushModalCard = flushModal ? flushModal.querySelector('.modal') : null;
        if (flushModalCard && flushModalCard.dataset.boundClick !== '1') {
          flushModalCard.dataset.boundClick = '1';
          flushModalCard.addEventListener('click', function(ev) {
            ev.stopPropagation();
          });
        }
        var flushTabs = document.getElementById('flush-modal-tabs');
        if (flushTabs && flushTabs.dataset.boundClick !== '1') {
          flushTabs.dataset.boundClick = '1';
          flushTabs.addEventListener('click', function(ev) {
            var btn = ev.target.closest('[data-flush-tab]');
            if (!btn) return;
            ev.preventDefault();
            setFlushTab(btn.getAttribute('data-flush-tab'));
          });
        }

        if (document.body.dataset.boundDynamicActions !== '1') {
          document.body.dataset.boundDynamicActions = '1';
          document.addEventListener('click', function(ev) {
            var actionNode = ev.target.closest('[data-action]');
            if (!actionNode) return;
            var action = actionNode.getAttribute('data-action');
            if (!action) return;
            ev.preventDefault();
            if (action === 'save-deployment-card') saveDeploymentCard(actionNode.getAttribute('data-record-key') || '');
            if (action === 'copy-email-html') copyText(actionNode.getAttribute('data-html') || '');
            if (action === 'delete-creative-email') deleteCreativeEmailTemplate(actionNode.getAttribute('data-record-key') || '');
            if (action === 'delete-newsletter-subscriber') deleteNewsletterSubscriber(actionNode.getAttribute('data-record-key') || '');
            if (action === 'delete-user-changelog-record') deleteUserChangelogRecord(actionNode.getAttribute('data-record-key') || '');
            if (action === 'shift-calendar-month') shiftCalendarMonth(Number(actionNode.getAttribute('data-delta') || '0'));
          });
        }
      }

      function startAutoRefreshLoop() {
        if (refreshIntervalId) clearInterval(refreshIntervalId);
        refreshIntervalId = setInterval(async function() {
          if (document.visibilityState === 'hidden') return;
          var ok = await ensureAuth();
          if (!ok) return;
          refreshAll();
        }, 60000);
      }

      // Refresh all data
      async function refreshAll() {
        var refreshButtons = Array.from(document.querySelectorAll('[data-role="refresh-action"]'));
        refreshButtons.forEach(function(btn) {
          btn.disabled = true;
          if (!btn.dataset.defaultHtml) {
            btn.dataset.defaultHtml = btn.innerHTML;
          }
          if (btn.classList.contains('footer-icon-btn')) {
            btn.innerHTML = '<div class="spinner"></div>';
          } else {
            btn.innerHTML = '<div class="spinner"></div> Refreshing...';
          }
        });
        
        await loadOverview(true);
        await loadTopToday();
        await loadDeployStatus();
        
        if (currentPage === 'activity') {
          await loadActivity();
          await loadCharts();
          await loadComparison();
        }
        if (currentPage === 'dashboards') {
          await loadDashboardLinks();
          loadDeploymentsHub();
          await loadNotifications();
        }
        if (currentPage === 'website-sync') await loadWebsiteSyncState();
        if (currentPage === 'creative') await loadCreativeHub();
        if (currentPage === 'content-changelog') await loadUserChangelogRecords();
        if (currentPage === 'logs') await loadOracleLogs();

        refreshButtons.forEach(function(btn) {
          btn.disabled = false;
          if (btn.dataset.defaultHtml) {
            btn.innerHTML = btn.dataset.defaultHtml;
          } else {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-2.52-6.25"/><path d="M21 4v5h-5"/></svg> Refresh';
          }
        });
      }

      // Init
      window.addEventListener("load", async function() {
        initOracleUtcClock();
        renderShortcutsList();
        bindButtonActions();
        document.addEventListener('keydown', function(e) {
          if ((e.metaKey || e.ctrlKey) && !shouldIgnoreGlobalShortcut(e) && runKeyboardShortcut(e)) {
            e.preventDefault();
            return;
          }

          if (e.key === 'Escape') {
            closeShortcutsModal();
            closeBatchModal();
            closeFlushModal();
            closeStepUpModal();
          }
        });
        document.addEventListener('visibilitychange', function() {
          if (document.hidden) {
            return;
          }
          ensureAuth().then(function(ok) {
            if (!ok) return;
            refreshAll();
          });
        });
        var shortcutsModal = document.getElementById('shortcuts-modal');
        if (shortcutsModal) {
          shortcutsModal.addEventListener('click', function(ev) {
            if (ev.target === shortcutsModal) closeShortcutsModal();
          });
        }
        var authed = await ensureAuth();
        if (authed) {
          await loadDashboardLinks();
          await refreshAll();
        }
        startAutoRefreshLoop();
      });
