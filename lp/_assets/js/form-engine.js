/* ============================================
   Unlock Patients — Multi-Step Form Engine
   State machine, validation, persistence, lead scoring
   ============================================ */

(function () {
  'use strict';

  // --- Configuration ---

  var FormEngine = {
    currentStep: 1,
    totalVisibleSteps: 4,
    formData: {},
    geoDetected: null,

    init: function () {
      this.readURLParams();
      this.restoreFromStorage();
      this.detectGeolocation();
      this.bindEvents();
      this.renderStep(this.currentStep);
      this.updateProgressBar();
    },

    // --- URL Params ---
    readURLParams: function () {
      var params = new URLSearchParams(window.location.search);
      if (params.get('email')) this.formData.email = params.get('email');
      if (params.get('lp')) this.formData.lp_keyword = params.get('lp');

      // UTMs
      var utmHelper = window.UP_UTM;
      if (utmHelper) {
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'].forEach(function (key) {
          var val = utmHelper.getUTM(key);
          if (val) FormEngine.formData[key] = val;
        });
      }
    },

    // --- Persistence ---
    restoreFromStorage: function () {
      try {
        var saved = localStorage.getItem('up_form_data');
        if (saved) {
          var parsed = JSON.parse(saved);
          // Merge: URL params take precedence
          Object.keys(parsed).forEach(function (key) {
            if (!FormEngine.formData[key]) FormEngine.formData[key] = parsed[key];
          });
        }
      } catch (e) { /* ignore */ }
    },

    saveToStorage: function () {
      try {
        localStorage.setItem('up_form_data', JSON.stringify(this.formData));
        // Also save to shared field cookie for cross-page restore
        var days = 3650;
        var maxAge = days * 86400;
        document.cookie = 'up_fields=' + encodeURIComponent(JSON.stringify(this.formData)) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
        localStorage.setItem('up_fields', JSON.stringify(this.formData));
      } catch (e) { /* ignore */ }
    },

    // --- Geolocation ---
    detectGeolocation: function () {
      var self = this;
      fetch('https://ipapi.co/json/')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          self.geoDetected = ['US', 'CA'].includes(data.country_code);
          self.formData._country = data.country_code;
        })
        .catch(function () {
          self.geoDetected = null; // Unknown — show step 5
        });
    },

    // --- Event Binding ---
    bindEvents: function () {
      var self = this;

      // Continue buttons
      document.querySelectorAll('[data-action="next"]').forEach(function (btn) {
        btn.addEventListener('click', function () { self.nextStep(); });
      });

      // Back buttons
      document.querySelectorAll('[data-action="back"]').forEach(function (btn) {
        btn.addEventListener('click', function () { self.prevStep(); });
      });

      // Radio options — auto-advance after selection (steps 2, 3, 4)
      document.querySelectorAll('.radio-option input[type="radio"], .card-option input[type="radio"]').forEach(function (input) {
        input.addEventListener('change', function () {
          var step = parseInt(this.closest('.form-step').id.replace('step-', ''));
          // Save the value
          self.formData[this.name] = this.value;
          self.saveToStorage();

          // Track in UPTracker
          if (window.UPTracker) {
            window.UPTracker.track('form_field_changed', {
              step: step,
              field: this.name,
              value: this.value,
              keyword_page: self.formData.lp_keyword || ''
            });
          }

          // Auto-advance after a brief delay for visual feedback
          setTimeout(function () { self.nextStep(); }, 300);
        });
      });

      // Input field tracking
      document.querySelectorAll('.form-group input, .form-group select').forEach(function (input) {
        input.addEventListener('change', function () {
          if (window.UPTracker) {
            var val = this.type === 'email' ? this.value.split('@')[1] : (this.name === 'phone' ? 'provided' : this.value);
            window.UPTracker.track('form_field_changed', {
              field: this.name,
              value: val,
              keyword_page: self.formData.lp_keyword || ''
            });
          }
        });
      });

      // Step 1 "Next" button — grey until all fields valid
      var nextBtn = document.querySelector('.btn-next');
      if (nextBtn) {
        function checkStep1Ready() {
          var email = (document.getElementById('field-email').value || '').trim();
          var name = (document.getElementById('field-name').value || '').trim();
          var phone = (document.getElementById('field-phone').value || '').trim();
          var size = document.getElementById('field-practice-size').value;
          var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            && name.length >= 2
            && /^[\d\s\-\+\(\)]{7,}$/.test(phone)
            && size !== '';
          nextBtn.classList.toggle('ready', valid);
        }
        document.querySelectorAll('#step-1 input, #step-1 select').forEach(function (el) {
          el.addEventListener('input', checkStep1Ready);
          el.addEventListener('change', checkStep1Ready);
        });
        // Check on load in case fields are pre-filled
        setTimeout(checkStep1Ready, 100);
      }

      // Pre-fill email if we have it
      var emailField = document.getElementById('field-email');
      if (emailField && this.formData.email) {
        emailField.value = this.formData.email;
      }

      // Enter key on step 1
      var step1 = document.getElementById('step-1');
      if (step1) {
        step1.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            self.nextStep();
          }
        });
      }
    },

    // --- Step Navigation ---
    nextStep: function () {
      if (!this.validateStep(this.currentStep)) return;

      this.collectStepData(this.currentStep);
      this.saveToStorage();

      // Track step completion
      if (window.UPTracker) {
        window.UPTracker.track('form_step_completed', {
          step: this.currentStep,
          step_name: this.getStepName(this.currentStep),
          keyword_page: this.formData.lp_keyword || '',
          lead_score: this.calculateLeadScore()
        });
      }

      // After step 1, submit partial lead
      if (this.currentStep === 1) {
        this.submitLead(false);

        // Identify in UPTracker
        if (window.UPTracker && this.formData.email) {
          window.UPTracker.identify(this.formData.email, {
            name: this.formData.fullName,
            phone: this.formData.phone,
            practice_size: this.formData.practiceSize,
            lp_keyword: this.formData.lp_keyword
          });
        }
      }

      // Determine next step
      var next = this.currentStep + 1;

      this.currentStep = next;
      this.renderStep(this.currentStep);
      this.updateProgressBar();

      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    prevStep: function () {
      var prev = this.currentStep - 1;

      if (prev < 1) return;
      this.currentStep = prev;
      this.renderStep(this.currentStep);
      this.updateProgressBar();
    },

    renderStep: function (step) {
      document.querySelectorAll('.form-step').forEach(function (el) {
        el.classList.remove('active');
      });
      var stepEl = document.getElementById('step-' + step);
      if (stepEl) stepEl.classList.add('active');

      // Load Cal.com on step 4
      if (step === 4 && window.loadCalEmbed) {
        window.loadCalEmbed(this.formData.fullName || '', this.formData.email || '');
      }
    },

    updateProgressBar: function () {
      var displayStep = this.currentStep;

      document.querySelectorAll('.progress-step').forEach(function (el, idx) {
        var stepNum = idx + 1;
        el.classList.remove('active', 'completed');
        if (stepNum === displayStep) {
          el.classList.add('active');
        } else if (stepNum < displayStep) {
          el.classList.add('completed');
        }
      });
    },

    // --- Validation ---
    validateStep: function (step) {
      var valid = true;

      if (step === 1) {
        valid = this.validateField('field-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }, 'Please enter a valid email address.')
          && this.validateField('field-name', function (v) { return v.trim().length >= 2; }, 'Please enter your full name.')
          && this.validateField('field-phone', function (v) { return /^[\d\s\-\+\(\)]{7,}$/.test(v.trim()); }, 'Please enter a valid phone number.')
          && this.validateField('field-practice-size', function (v) { return v !== ''; }, 'Please select your practice size.');
      }

      if (step === 2) {
        valid = this.validateRadio('role', 'Please select your role.');
      }

      if (step === 3) {
        valid = this.validateRadio('timeline', 'Please select a timeline.');
      }

      return valid;
    },

    validateField: function (fieldId, checkFn, errorMsg) {
      var field = document.getElementById(fieldId);
      if (!field) return true;

      var errorEl = field.parentElement.querySelector('.field-error');
      if (checkFn(field.value)) {
        field.classList.remove('error');
        if (errorEl) errorEl.classList.remove('visible');
        return true;
      } else {
        field.classList.add('error');
        if (errorEl) {
          errorEl.textContent = errorMsg;
          errorEl.classList.add('visible');
        }
        field.focus();
        return false;
      }
    },

    validateRadio: function (name, errorMsg) {
      var checked = document.querySelector('input[name="' + name + '"]:checked');
      if (checked) return true;

      // Show error
      var container = document.querySelector('[data-radio-group="' + name + '"]');
      if (container) {
        var errorEl = container.querySelector('.field-error');
        if (errorEl) {
          errorEl.textContent = errorMsg;
          errorEl.classList.add('visible');
        }
      }
      return false;
    },

    // --- Data Collection ---
    collectStepData: function (step) {
      if (step === 1) {
        this.formData.email = (document.getElementById('field-email').value || '').trim();
        this.formData.fullName = (document.getElementById('field-name').value || '').trim();
        this.formData.phone = (document.getElementById('field-phone').value || '').trim();
        this.formData.practiceSize = document.getElementById('field-practice-size').value;
      }

      // Steps 2-5: collected via radio change event
    },

    // --- Step Names ---
    getStepName: function (step) {
      var names = { 1: 'contact_info', 2: 'role', 3: 'timeline', 4: 'scheduling' };
      return names[step] || 'unknown';
    },

    // --- Lead Scoring ---
    calculateLeadScore: function () {
      var score = 0;

      // Practice size
      var sizeScores = { '1-2': 10, '3-5': 20, '6-10': 30, '11-25': 40, '26+': 50 };
      score += sizeScores[this.formData.practiceSize] || 0;

      // Role
      var roleScores = {
        'own': 30, 'own_manage': 30, 'manage': 20,
        'group': 40, 'marketing': 15, 'other': 5
      };
      score += roleScores[this.formData.role] || 0;

      // Timeline
      var timelineScores = {
        'asap': 30, '1-3months': 20, '4-6months': 10,
        '6plus': 5, 'researching': 2
      };
      score += timelineScores[this.formData.timeline] || 0;

      // UTM source bonus
      if (this.formData.utm_source === 'google' && this.formData.gclid) score += 10;

      return score;
    },

    // --- Lead Submission (via UPTracker) ---
    submitLead: function (isFinal) {
      if (!window.UPTracker) return;

      window.UPTracker.track('lead_submitted', {
        email: this.formData.email || '',
        name: this.formData.fullName || '',
        phone: this.formData.phone || '',
        practiceSize: this.formData.practiceSize || '',
        role: this.formData.role || '',
        practiceType: this.formData.practiceType || '',
        timeline: this.formData.timeline || '',
        usCanada: this.formData.usCanada || '',
        lp_keyword: this.formData.lp_keyword || '',
        lead_score: this.calculateLeadScore(),
        is_final: isFinal,
        utm_source: this.formData.utm_source || '',
        utm_medium: this.formData.utm_medium || '',
        utm_campaign: this.formData.utm_campaign || '',
        utm_term: this.formData.utm_term || '',
        utm_content: this.formData.utm_content || '',
        gclid: this.formData.gclid || ''
      });

      // Force flush to ensure lead data is sent immediately
      window.UPTracker.flush();
    }
  };

  // --- Init on DOM ready ---
  document.addEventListener('DOMContentLoaded', function () {
    FormEngine.init();
  });

  // Expose for Cal.com embed callback
  window.FormEngine = FormEngine;
})();
