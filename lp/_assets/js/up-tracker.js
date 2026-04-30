/* ============================================
   Unlock Patients Tracking Pixel (up-tracker.js)
   Lightweight analytics — replaces PostHog
   Write-only webhook to t.unlockpatients.com
   ============================================ */

(function (window) {
  'use strict';

  var COOKIE_NAME = 'up_did';
  var COOKIE_DAYS = 3650; // ~10 years (permanent)
  var FLUSH_INTERVAL_MS = 3000;
  var MAX_BATCH_SIZE = 20;

  var config = { apiUrl: '', apiKey: '' };
  var queue = [];
  var distinctId = '';
  var userTraits = {};
  var flushTimer = null;
  var initialized = false;

  // --- Utility: UUID v4 ---
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // --- Utility: Cookies ---
  function setCookie(name, value, days) {
    var maxAge = days * 86400;
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  // --- Distinct ID Management ---
  function loadOrCreateDistinctId() {
    // Try cookie first, then localStorage
    var id = getCookie(COOKIE_NAME);
    if (!id) {
      try { id = localStorage.getItem(COOKIE_NAME); } catch (e) { /* ignore */ }
    }
    if (!id) {
      id = generateUUID();
    }
    persistDistinctId(id);
    return id;
  }

  function persistDistinctId(id) {
    setCookie(COOKIE_NAME, id, COOKIE_DAYS);
    try { localStorage.setItem(COOKIE_NAME, id); } catch (e) { /* ignore */ }
  }

  // --- Auto Properties ---
  function getAutoProperties() {
    return {
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || '',
      screen: window.screen ? window.screen.width + 'x' + window.screen.height : '',
      language: navigator.language || ''
    };
  }

  // --- Core: Queue Event ---
  function enqueue(event, properties) {
    if (!initialized) return;

    var item = {
      distinct_id: distinctId,
      event: event,
      properties: Object.assign({}, getAutoProperties(), properties || {}),
      timestamp: new Date().toISOString()
    };

    queue.push(item);

    // Flush if batch is full
    if (queue.length >= MAX_BATCH_SIZE) {
      flush();
    }
  }

  // --- Core: Flush Queue ---
  function flush() {
    if (queue.length === 0 || !config.apiUrl) return;

    var batch = queue.splice(0, MAX_BATCH_SIZE);
    var payload = JSON.stringify({ events: batch });

    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', config.apiUrl + '/track', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('x-api-key', config.apiKey);
      xhr.send(payload);
    } catch (e) {
      // Silent fail — do not block user experience
    }
  }

  // --- Core: Beacon (page unload) ---
  function sendBeacon() {
    if (queue.length === 0 || !config.apiUrl) return;

    var batch = queue.splice(0);
    var payload = JSON.stringify({ events: batch });

    if (navigator.sendBeacon) {
      // sendBeacon doesn't support custom headers, so encode API key in payload
      var beaconPayload = JSON.stringify({ events: batch, _key: config.apiKey });
      navigator.sendBeacon(config.apiUrl + '/track', beaconPayload);
    } else {
      // Fallback: synchronous XHR (blocking, but only on unload)
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', config.apiUrl + '/track', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('x-api-key', config.apiKey);
        xhr.send(payload);
      } catch (e) { /* ignore */ }
    }
  }

  // --- Public API ---
  var UPTracker = {
    /**
     * Initialize the tracker
     * @param {Object} opts - { apiUrl: string, apiKey: string }
     */
    init: function (opts) {
      if (initialized) return;

      config.apiUrl = (opts.apiUrl || '').replace(/\/$/, ''); // strip trailing slash
      config.apiKey = opts.apiKey || '';
      distinctId = loadOrCreateDistinctId();
      initialized = true;

      // Start periodic flush
      flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

      // Flush on page unload
      window.addEventListener('beforeunload', sendBeacon);
      window.addEventListener('pagehide', sendBeacon);

      // Flush on visibility change (mobile tab switch)
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          sendBeacon();
        }
      });
    },

    /**
     * Track an event
     * @param {string} event - Event name
     * @param {Object} [properties] - Event properties
     */
    track: function (event, properties) {
      enqueue(event, properties);
    },

    /**
     * Identify a user (links anonymous ID to real identity)
     * @param {string} userId - User identifier (typically email)
     * @param {Object} [traits] - User traits (name, phone, etc.)
     */
    identify: function (userId, traits) {
      if (!userId) return;

      var previousId = distinctId;
      distinctId = userId;
      persistDistinctId(userId);
      userTraits = Object.assign(userTraits, traits || {});

      // Send identify event with alias from anonymous → identified
      enqueue('$identify', {
        $user_id: userId,
        $anon_id: previousId,
        $set: userTraits
      });
    },

    /**
     * Get current distinct ID (for debugging)
     */
    getDistinctId: function () {
      return distinctId;
    },

    /**
     * Force flush queued events
     */
    flush: flush
  };

  // Expose globally
  window.UPTracker = UPTracker;

})(window);
