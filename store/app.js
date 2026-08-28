// FM Fashion — Full Admin & Store App Logic
document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE || '';

  // Tab Switching
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Modal Handling
  const productModal = document.getElementById('productModal');
  const agentModal = document.getElementById('agentModal');
  const newProductBtn = document.getElementById('newProduct');
  const newAgentBtn = document.getElementById('newAgent');

  if (newProductBtn) {
    newProductBtn.addEventListener('click', () => {
      document.getElementById('pTitle').textContent = 'Add Product';
      document.getElementById('productForm').reset();
      document.querySelector('#productForm input[name="id"]').value = '';
      if (productModal) productModal.classList.add('open');
    });
  }

  if (newAgentBtn) {
    newAgentBtn.addEventListener('click', () => {
      document.getElementById('agentForm').reset();
      document.querySelector('#agentForm input[name="id"]').value = '';
      if (agentModal) agentModal.classList.add('open');
    });
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (productModal) productModal.classList.remove('open');
      if (agentModal) agentModal.classList.remove('open');
    });
  });

  // Load Initial Dashboard Data & Stats
  loadDashboardData();

  const refreshBtn = document.getElementById('refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDashboardData);
  }

  // Product Form Submission
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Product saved successfully locally! (Connect backend for permanent cloud sync)');
      if (productModal) productModal.classList.remove('open');
      loadDashboardData();
    });
  }

  // Agent Form Submission
  const agentForm = document.getElementById('agentForm');
  if (agentForm) {
    agentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Support Agent saved successfully!');
      if (agentModal) agentModal.classList.remove('open');
      loadDashboardData();
    });
  }

  // Settings Form Submission
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const savedMsg = document.getElementById('saved');
      if (savedMsg) {
        savedMsg.textContent = 'Settings saved successfully!';
        setTimeout(() => savedMsg.textContent = '', 3000);
      }
    });
  }

  // AI Product Analysis Simulation
  const aiForm = document.getElementById('aiForm');
  if (aiForm) {
    aiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const aiResult = document.getElementById('aiResult');
      if (aiResult) {
        aiResult.innerHTML = `
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-top: 15px;">
            <h3>AI Suggested Details:</h3>
            <p><b>Name:</b> Premium Fashion Outfit</p>
            <p><b>Category:</b> Winter / Premium Collection</p>
            <p><b>Tags:</b> jacket, men, premium, stylish</p>
            <button class="gold" style="margin-top: 10px;" onclick="alert('Product published from AI!')">Publish Product</button>
          </div>
        `;
      }
    });
  }
});

function loadDashboardData() {
  const revEl = document.getElementById('revenue');
  const ordEl = document.getElementById('ordersCount');
  const prodEl = document.getElementById('productsCount');
  const agentEl = document.getElementById('agentsCount');

  if (revEl) revEl.textContent = '৳12,500';
  if (ordEl) ordEl.textContent = '3';
  if (prodEl) prodEl.textContent = '5';
  if (agentEl) agentEl.textContent = '2';

  // Render dummy table rows for preview
  const productTable = document.getElementById('productTable');
  if (productTable) {
    productTable.innerHTML = `
      <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
        <span><b>Classic Black Panjabi</b> — ৳1,850</span>
        <span style="color: #4cd137;">Active</span>
      </div>
      <div style="padding: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span><b>Executive Formal Shirt</b> — ৳1,450</span>
        <span style="color: #4cd137;">Active</span>
      </div>
    `;
  }
}
