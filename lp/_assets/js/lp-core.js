/* ============================================
   Unlock Patients — Landing Page Core JS
   UTM tracking, UPTracker, email forms, exit intent
   ============================================ */

(function () {
  'use strict';

  // --- Configuration ---
  var LP_CONFIG = window.LP_CONFIG || { keyword: 'unknown' };

  // --- UTM Management ---
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'];
  var COOKIE_DAYS = 3650; // ~10 years (permanent)

  function setCookie(name, value, days) {
    var maxAge = days * 86400;
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  function captureUTMs() {
    var params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (key) {
      var val = params.get(key);
      if (val) {
        setCookie(key, val, COOKIE_DAYS);
        try { localStorage.setItem(key, val); } catch (e) { }
      }
    });
  }

  function getUTM(key) {
    var params = new URLSearchParams(window.location.search);
    return params.get(key) || getCookie(key) || (function () { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } })();
  }

  function getAllUTMs() {
    var utms = {};
    UTM_KEYS.forEach(function (key) {
      var val = getUTM(key);
      if (val) utms[key] = val;
    });
    return utms;
  }

  function appendUTMsToParams(params) {
    UTM_KEYS.forEach(function (key) {
      var val = getUTM(key);
      if (val) params.set(key, val);
    });
  }

  // --- Field Memory (save & restore form inputs across visits) ---
  var FIELD_COOKIE = 'up_fields';

  function saveFields() {
    try {
      var data = JSON.parse(getCookie(FIELD_COOKIE) || '{}');
      document.querySelectorAll('input[name], select[name]').forEach(function (el) {
        var val = el.value.trim();
        if (val && el.name) data[el.name] = val;
      });
      setCookie(FIELD_COOKIE, JSON.stringify(data), COOKIE_DAYS);
      localStorage.setItem(FIELD_COOKIE, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function restoreFields() {
    try {
      var raw = getCookie(FIELD_COOKIE) || localStorage.getItem(FIELD_COOKIE);
      if (!raw) return;
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function (name) {
        document.querySelectorAll('[name="' + name + '"]').forEach(function (el) {
          if (el.type === 'radio') {
            if (el.value === data[name]) el.checked = true;
          } else if (!el.value) {
            el.value = data[name];
          }
        });
      });
    } catch (e) { /* ignore */ }
  }

  // --- Email Validation ---
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFormError(form, msg) {
    var errorEl = form.querySelector('.form-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'form-error visible';
      form.appendChild(errorEl);
    } else {
      errorEl.classList.add('visible');
    }
    errorEl.textContent = msg;

    var input = form.querySelector('input[type="email"]');
    if (input) input.classList.add('error');
  }

  function clearFormError(form) {
    var errorEl = form.querySelector('.form-error');
    if (errorEl) errorEl.classList.remove('visible');
    var input = form.querySelector('input[type="email"]');
    if (input) input.classList.remove('error');
  }

  // --- Email Form Handler ---
  function initEmailForms() {
    document.querySelectorAll('.lp-email-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFormError(form);

        var input = form.querySelector('input[type="email"]');
        var email = (input.value || '').trim();

        if (!email || !isValidEmail(email)) {
          showFormError(form, 'Please enter a valid work email address.');
          return;
        }

        // UPTracker tracking
        if (window.UPTracker) {
          window.UPTracker.track('lp_email_submitted', {
            keyword_page: LP_CONFIG.keyword,
            form_location: form.id || 'unknown',
            email_domain: email.split('@')[1],
            ...getAllUTMs()
          });

          window.UPTracker.identify(email, {
            lp_keyword: LP_CONFIG.keyword,
            ...getAllUTMs()
          });
        }

        // Save fields for next visit
        saveFields();

        // Build redirect URL
        var params = new URLSearchParams();
        params.set('email', email);
        params.set('lp', LP_CONFIG.keyword);
        appendUTMsToParams(params);

        window.location.href = '/lp/schedule/?' + params.toString();
      });

      // Clear error on input
      var input = form.querySelector('input[type="email"]');
      if (input) {
        input.addEventListener('input', function () { clearFormError(form); });
      }
    });
  }

  // --- Exit Intent ---
  function initExitIntent() {
    var shown = false;
    var popup = document.getElementById('exit-popup');
    if (!popup) return;

    // Only show once per session
    if (sessionStorage.getItem('up_exit_shown')) { shown = true; }

    function showPopup() {
      if (shown) return;
      // Don't show if CTA popup is already open
      var ctaPopup = document.getElementById('cta-popup');
      if (ctaPopup && ctaPopup.classList.contains('active')) return;
      shown = true;
      sessionStorage.setItem('up_exit_shown', '1');
      popup.classList.add('active');

      if (window.UPTracker) {
        window.UPTracker.track('exit_intent_shown', {
          keyword_page: LP_CONFIG.keyword
        });
      }
    }

    function hidePopup() {
      popup.classList.remove('active');
    }

    // Desktop: mouse leaves viewport top
    document.addEventListener('mouseout', function (e) {
      if (e.clientY < 10 && !e.relatedTarget && !e.toElement) {
        showPopup();
      }
    });

    // Mobile: show after 20s of inactivity (no scroll or tap)
    if (window.innerWidth < 768) {
      var idleTimer = null;
      function resetIdle() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
          if (!shown) showPopup();
        }, 35000);
      }
      ['scroll', 'touchstart', 'touchmove'].forEach(function (evt) {
        document.addEventListener(evt, resetIdle, { passive: true });
      });
      resetIdle(); // start the first idle timer
    }

    // Close button
    var closeBtn = popup.querySelector('.lp-popup__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', hidePopup);
    }

    // Close on overlay click
    var overlay = popup.querySelector('.lp-popup__overlay');
    if (overlay) {
      overlay.addEventListener('click', hidePopup);
    }

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hidePopup();
    });
  }

  // --- Sticky Nav ---
  function initStickyNav() {
    var nav = document.querySelector('.lp-nav');
    if (!nav) return;

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          nav.classList.toggle('scrolled', window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // --- Smooth Scroll for Anchor Links ---
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = this.getAttribute('href');
        if (id === '#') return;
        var target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // --- CTA Popup ---
  function initCtaPopup() {
    var popup = document.getElementById('cta-popup');
    if (!popup) return;

    function showCtaPopup() {
      popup.classList.add('active');
      if (window.UPTracker) {
        window.UPTracker.track('cta_popup_shown', { keyword_page: LP_CONFIG.keyword });
      }
    }

    function hideCtaPopup() {
      popup.classList.remove('active');
    }

    // All buttons with .js-open-cta-popup open the popup
    document.querySelectorAll('.js-open-cta-popup').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        showCtaPopup();
      });
    });

    // Close button
    var closeBtn = popup.querySelector('.lp-popup__close');
    if (closeBtn) closeBtn.addEventListener('click', hideCtaPopup);

    // Close on overlay click
    var overlay = popup.querySelector('.lp-popup__overlay');
    if (overlay) overlay.addEventListener('click', hideCtaPopup);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('active')) hideCtaPopup();
    });
  }

  // --- Mobile Hamburger Menu ---
  function initMobileMenu() {
    var hamburger = document.querySelector('.lp-nav__hamburger');
    var dropdown = document.querySelector('.lp-nav__dropdown');
    if (!hamburger || !dropdown) return;

    function closeMenu() {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      dropdown.classList.remove('open');
    }

    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      dropdown.classList.toggle('open');
    });

    // Close on scroll
    window.addEventListener('scroll', function () {
      if (dropdown.classList.contains('open')) closeMenu();
    }, { passive: true });

    // Close when a dropdown link is clicked
    dropdown.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    captureUTMs();
    restoreFields();
    initEmailForms();
    initExitIntent();
    initStickyNav();
    initSmoothScroll();
    initMobileMenu();
    initCtaPopup();

    // UPTracker page view
    if (window.UPTracker) {
      window.UPTracker.track('lp_page_viewed', {
        keyword_page: LP_CONFIG.keyword,
        ...getAllUTMs()
      });
    }
  });

  // Expose helpers for form-engine.js
  window.UP_UTM = {
    getUTM: getUTM,
    getAllUTMs: getAllUTMs,
    appendUTMsToParams: appendUTMsToParams,
    getCookie: getCookie
  };
})();
