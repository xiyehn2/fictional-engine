// ==UserScript==
// @name         Slate (Bootstrap)
// @version      1.0.0
// @match        https://kimstudy.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      port-0-kim-md4imgh5adfd6ddf.sel5.cloudtype.app
// @connect      raw.githubusercontent.com
// @connect      github.com
// ==/UserScript==

// GENERATED FILE — do not edit. Source: src/bootstrap/bootstrap.prod.template.js,
// emitted by `npm run build:bootstrap`.

(function () {
  'use strict';

  // The overlay bytes live on GitHub (raw) and carry their own version in the
  // Tampermonkey `@version` header. Any cloudtype / localhost @connect line is
  // for the OVERLAY's own backend calls: the overlay is eval'd in THIS
  // bootstrap's context, so its GM_xmlhttpRequest is gated by this script's
  // @connect list, not its own header.
  var SCRIPT_URL = 'https://raw.githubusercontent.com/xiyehn2/fictional-engine/main/user.prod.js';

  // GM storage keys for this loader's state, namespaced per environment so a dev
  // and a prod bootstrap installed side by side never clobber each other's cache.
  var KEY_PREFIX = 'app-bootstrap-prod';
  var VERSION_KEY = KEY_PREFIX + '-version';  // last @version we adopted (semver)
  var SCRIPT_KEY = KEY_PREFIX + '-script';    // cached overlay body
  var ETAG_KEY = KEY_PREFIX + '-etag';        // ETag of the cached body

  // Conditional GET: send If-None-Match with the stored ETag so an unchanged file
  // comes back 304 with no body (near-zero transfer). Resolves with
  // { status, body, etag }; body/etag are null on 304. If GitHub ignores the
  // conditional header we simply get 200 every time — the version guard below
  // still makes that correct, just less thrifty.
  //
  // A unique cache-busting query param + no-cache header defeat the raw CDN's
  // ~5-min edge cache (and any local GM/browser cache), so a freshly published
  // version is picked up on the very next page load instead of minutes later.
  // ETag still yields a cheap 304 from origin when the content is unchanged.
  function fetchScript(etag) {
    return new Promise(function (resolve, reject) {
      var headers = { 'Cache-Control': 'no-cache' };
      if (etag) headers['If-None-Match'] = etag;
      var url = SCRIPT_URL + (SCRIPT_URL.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: headers,
        timeout: 20000,
        onload: function (r) {
          if (r.status === 304) { resolve({ status: 304, body: null, etag: etag }); return; }
          if (r.status >= 200 && r.status < 300) {
            resolve({ status: r.status, body: r.responseText, etag: parseEtag(r.responseHeaders) });
            return;
          }
          reject(new Error('HTTP ' + r.status + ' for ' + SCRIPT_URL));
        },
        onerror: function () { reject(new Error('request failed: ' + SCRIPT_URL)); },
        ontimeout: function () { reject(new Error('timeout: ' + SCRIPT_URL)); }
      });
    });
  }

  // GM_xmlhttpRequest hands back response headers as one raw string.
  function parseEtag(rawHeaders) {
    if (!rawHeaders) return null;
    var m = rawHeaders.match(/^etag:\s*(.+)$/im);
    return m ? m[1].trim() : null;
  }

  // The semver (x.y.z) version the bootstrap compares against, read from the
  // fetched file's own `// @version` header (stamped there by the build).
  function parseVersion(body) {
    var m = body.match(/\/\/\s*@version\s+(\d+\.\d+\.\d+)/);
    return m ? m[1] : null;
  }

  // <0 if a sorts before b, 0 if equal, >0 if a sorts after b — numeric per
  // part, so 1.0.10 sorts after 1.0.9. Mirrors compareSemver in src/version.ts.
  function compareVersions(a, b) {
    var pa = a.split('.');
    var pb = b.split('.');
    for (var i = 0; i < 3; i++) {
      var da = parseInt(pa[i] || '0', 10);
      var db = parseInt(pb[i] || '0', 10);
      if (da !== db) return da - db;
    }
    return 0;
  }

  // Run the fetched overlay bundle. DIRECT eval (not `(0, eval)` / `new Function`)
  // is deliberate: the overlay bundle references GM_xmlhttpRequest / GM_getValue /
  // GM_setValue as free identifiers, and direct eval executes in THIS function's
  // scope where those grant-injected identifiers are visible. Indirect eval would
  // run in global scope and lose them. This is also why the bootstrap must declare
  // the same @grant and @connect lines the overlay needs.
  function runOverlay(body) {
    try {
      // eslint-disable-next-line no-eval
      eval(body);
      return true;
    } catch (e) {
      console.error('[bootstrap] overlay failed to run:', e);
      return false;
    }
  }

  function main() {
    var storedVersion = GM_getValue(VERSION_KEY, '0.0.0');
    var cached = GM_getValue(SCRIPT_KEY, '');
    var etag = GM_getValue(ETAG_KEY, '');

    fetchScript(etag).then(
      function (res) {
        if (res.status === 304) {
          // Unchanged since last fetch — run the cached copy, no re-download.
          if (cached) {
            console.log('[bootstrap] overlay unchanged (304, v' + storedVersion + '), running cached copy');
            runOverlay(cached);
          } else {
            // 304 but nothing cached: our stored ETag is orphaned. Drop it and refetch.
            console.warn('[bootstrap] 304 with no cached overlay — clearing ETag and refetching');
            GM_setValue(ETAG_KEY, '');
            main();
          }
          return;
        }

        // 200: fresh bytes. Record the new ETag regardless of the version verdict.
        if (res.etag) GM_setValue(ETAG_KEY, res.etag);

        var latest = parseVersion(res.body);
        if (latest === null) {
          // No parseable @version — run the fetched bytes rather than block updates,
          // but don't advance the stored version (nothing to compare next time).
          console.warn('[bootstrap] could not parse @version from fetched overlay; running it anyway');
          GM_setValue(SCRIPT_KEY, res.body);
          runOverlay(res.body);
          return;
        }

        // Adopt only if strictly newer than what we run today (or nothing cached).
        // The compare guards against a stale CDN edge serving an OLDER copy from
        // downgrading a user.
        if (compareVersions(latest, storedVersion) > 0 || !cached) {
          GM_setValue(SCRIPT_KEY, res.body);
          GM_setValue(VERSION_KEY, latest);
          console.log('[bootstrap] loaded overlay version ' + latest + ' (was ' + storedVersion + ')');
          runOverlay(res.body);
        } else {
          console.log('[bootstrap] fetched v' + latest + ' not newer than v' + storedVersion + ', running cached copy');
          runOverlay(cached);
        }
      },
      function (err) {
        // Fetch failed (offline / GitHub down). Fall back to the cached overlay so
        // the tool still works without a network round-trip.
        console.warn('[bootstrap] fetch failed, using cached overlay:', err);
        if (cached) runOverlay(cached);
        else console.error('[bootstrap] no cached overlay and fetch failed — nothing to run');
      }
    );
  }

  main();
})();
