document.addEventListener('DOMContentLoaded', () => {

  // --- 1. Progressive Form Logic ---
  const hotelNameInput = document.getElementById('hotel-name');
  if (hotelNameInput) {
    hotelNameInput.addEventListener('input', function() { 
      if (this.value.trim().length >= 2) {
        document.getElementById('formStep2').classList.add('visible'); 
      }
    });
  }
  
  // --- 2. REAL Scan Submission (Calling Vercel Serverless Function) ---
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      const n = document.getElementById('hotel-name').value.trim();
      const l = document.getElementById('hotel-location').value.trim();
      const em = document.getElementById('hotel-email').value.trim();

      // Honeypot Trap Check
      const trap = document.getElementById('website-url').value;
      if (trap !== "") return;
      
      if (!n || !l || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        alert("Please fill in all fields correctly.");
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
            hotel_name: n, 
            location: l, 
            email: em, 
            theme: "cleanliness", 
            model: "perplexity", 
            tier: "free",
            turnstileToken: turnstileToken
          })
        });
        
        const data = await response.json();

        if (response.ok) {
          this.textContent = '✓ Report on its way!';
          this.style.backgroundColor = 'var(--sage-500)';
        } else {
          throw new Error(data.error || 'Server rejected request');
        }
      } catch (error) {
        console.error('Scan Error:', error);
        this.textContent = `${error.message}`;
        this.style.backgroundColor = "#D9534F";
        
        setTimeout(() => {
          this.textContent = 'Run free scan ➔';
          this.style.backgroundColor = "";
          this.disabled = false; 
        }, 4000);
      }
    });
  }

  // --- 3. Blind Spots Tabs ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  if (tabBtns.length > 0) {
    tabBtns.forEach(btn => { 
      btn.addEventListener('click', function() {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        this.classList.add('active'); 
        document.getElementById(this.getAttribute('data-tab')).classList.add('active');
      }); 
    });
  }

});

// --- 4. Ledger UI Functions (Attached to window for HTML inline calling) ---
window.switchLdgTab = function(tabId, btnElement) {
  document.querySelectorAll('.ldg-tab-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  document.querySelectorAll('.ldg-ui-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-' + tabId).classList.add('active');
};

window.toggleEditMode = function(isEdit, btnElement) {
  document.querySelectorAll('.ldg-toggle-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  
  const container = document.getElementById('ldg-entries-container');
  if(isEdit) {
    container.classList.add('is-editing');
  } else {
    container.classList.remove('is-editing');
  }
};
