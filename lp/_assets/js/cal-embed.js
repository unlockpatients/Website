/* ============================================
   Unlock Patients — Cal.com Embed Loader
   ============================================ */

(function () {
  'use strict';

  // Replace with your Cal.com event link
  var CAL_LINK = 'YOUR_CAL_LINK'; // e.g., 'unlockpatients/45min-demo'

  var loaded = false;

  window.loadCalEmbed = function (name, email) {
    if (loaded) return;
    loaded = true;

    // Remove loading spinner
    var loader = document.querySelector('.cal-loading');

    // Load Cal.com embed script
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal;
        var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          var script = d.createElement('script');
          script.src = A;
          script.async = true;
          d.head.appendChild(script);
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    Cal('init', { origin: 'https://app.cal.com' });

    // Build prefill config
    var config = {
      layout: 'month_view',
      theme: 'light'
    };

    Cal('inline', {
      elementOrSelector: '#cal-embed-container',
      calLink: CAL_LINK,
      config: config
    });

    // Prefill guest info
    Cal('ui', {
      styles: { branding: { brandColor: '#8765D7' } },
      hideEventTypeDetails: false
    });

    // Hide loader once iframe appears
    var checkInterval = setInterval(function () {
      var iframe = document.querySelector('#cal-embed-container iframe');
      if (iframe) {
        if (loader) loader.style.display = 'none';
        clearInterval(checkInterval);
      }
    }, 500);

    // Timeout: remove loader after 10s regardless
    setTimeout(function () {
      if (loader) loader.style.display = 'none';
      clearInterval(checkInterval);
    }, 10000);

    // Listen for booking confirmation
    window.addEventListener('message', function handler(e) {
      try {
        // Cal.com sends postMessage events
        if (e.data && typeof e.data === 'string') {
          var parsed = JSON.parse(e.data);
          if (parsed.event === 'booking_successful' || parsed.action === 'bookingSuccessful') {
            handleBookingComplete();
            window.removeEventListener('message', handler);
          }
        }
        // Cal.com also sends object messages
        if (e.data && e.data.event === 'booking_successful') {
          handleBookingComplete();
          window.removeEventListener('message', handler);
        }
      } catch (err) { /* ignore non-JSON messages */ }
    });

    // Also listen via Cal.com's action callback
    Cal('on', {
      action: 'bookingSuccessful',
      callback: function () {
        handleBookingComplete();
      }
    });
  };

  function handleBookingComplete() {
    // Track in UPTracker
    if (window.UPTracker && window.FormEngine) {
      window.UPTracker.track('demo_booked', {
        keyword_page: window.FormEngine.formData.lp_keyword || '',
        lead_score: window.FormEngine.calculateLeadScore(),
        practice_type: window.FormEngine.formData.practiceType || '',
        role: window.FormEngine.formData.role || '',
        timeline: window.FormEngine.formData.timeline || ''
      });
    }

    // Submit final lead data
    if (window.FormEngine) {
      window.FormEngine.submitLead(true);
    }

    // Clear form data from storage
    try { localStorage.removeItem('up_form_data'); } catch (e) { /* ignore */ }

    // Redirect to thank you page
    setTimeout(function () {
      window.location.href = '/lp/thank-you/';
    }, 1000);
  }
})();
