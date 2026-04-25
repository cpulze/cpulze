document.addEventListener('DOMContentLoaded', () => {

  // 1. Progressive form
  const hotelNameInput = document.getElementById('hotel-name');
  if (hotelNameInput) {
    hotelNameInput.addEventListener('input', function () {
      if (this.value.trim().length >= 2) {
        document.getElementById('formStep2').classList.add('visible');
      }
    });
  }

  // 2. Scan submission
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', async function (e) {
      e.preventDefault();

      const n  = document.getElementById('hotel-name').value.trim();
      const l  = document.getElementById('hotel-location').value.trim();
      const em = document.getElementById('hotel-email').value.trim();
      const trap = document.getElementById('website-url').value;
      if (trap !== '') return;

      if (!n || !l || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        alert('Please fill in all fields correctly.');
        return;
      }

      const originalText = this.textContent;
      this.textContent = 'Submitting…';
      this.disabled = true;

      const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;

      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotel_name: n, location: l, email: em,
            theme: 'cleanliness', model: 'perplexity', tier: 'free',
            turnstileToken
          })
        });
        const data = await response.json();
        if (response.ok) {
          this.textContent = '✓ Report on its way!';
          this.style.backgroundColor = '#2a7a50';
        } else {
          throw new Error(data.error || 'Server rejected request');
        }
      } catch (err) {
        this.textContent = err.message;
        this.style.backgroundColor = '#c0392b';
        setTimeout(() => {
          this.textContent = originalText;
          this.style.backgroundColor = '';
          this.disabled = false;
        }, 4000);
      }
    });
  }

  // 3. Blind spots tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  if (tabBtns.length) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(this.getAttribute('data-tab')).classList.add('active');
      });
    });
  }

  // 4. Pricing toggle — monthly / annual
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  if (toggleBtns.length) {
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        toggleBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if (this.dataset.period === 'annual') {
          document.body.classList.add('show-annual');
        } else {
          document.body.classList.remove('show-annual');
        }
      });
    });
  }

});

// 5. Ledger UI (called from inline HTML)
window.switchLdgTab = function (tabId, btnElement) {
  document.querySelectorAll('.ldg-tab-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  document.querySelectorAll('.ldg-ui-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-' + tabId).classList.add('active');
};

window.toggleEditMode = function (isEdit, btnElement) {
  document.querySelectorAll('.ldg-toggle-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  const container = document.getElementById('ldg-entries-container');
  if (container) {
    container.classList.toggle('is-editing', isEdit);
  }
};
