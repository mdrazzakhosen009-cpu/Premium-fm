// FM Fashion — Fully Integrated Store, Order & Admin Logic
document.addEventListener('DOMContentLoaded', () => {
  const storeData = getStoreData();

  // Initialize Storefront or Admin based on current page
  renderStoreFront(storeData);
  initAdminPanel(storeData);
});

// Default Initial Database Structure
function getStoreData() {
  const defaultData = {
    settings: {
      store_name: "FM FASHION",
      delivery_promise: "দেশজুড়ে Fast Delivery & Reliable Service",
      bkash_number: "01700000000",
      nagad_number: "01800000000",
      rocket_number: "",
      bkash_enabled: true,
      nagad_enabled: true,
      cod_enabled: true,
      payment_note: "বিকাশ বা নগদ সেন্ড মনি করার পর ট্রানজাকশন আইডি দিন।",
      admin_pass: "12345"
    },
    products: [
      { id: 1, name: "Classic Black Panjabi", price: 1850, old_price: 2200, category: "Panjabi", description: "Premium cotton fabrics with stylish embroidery.", image: "logo.png" },
      { id: 2, name: "Executive Formal Shirt", price: 1450, old_price: 1800, category: "Shirt", description: "Comfortable and slim-fit formal shirt for men.", image: "logo.png" }
    ],
    agents: [
      { id: 1, name: "Hotline Agent 1", whatsapp: "8801700000000", messenger_url: "#", active: true }
    ],
    orders: []
  };

  try {
    const saved = localStorage.getItem('fm_store_data');
    return saved ? JSON.parse(saved) : defaultData;
  } catch (e) {
    return defaultData;
  }
}

function saveStoreData(data) {
  localStorage.setItem('fm_store_data', JSON.stringify(data));
}

// Render Storefront (index.html)
function renderStoreFront(data) {
  // Update Store Title
  document.querySelectorAll('#storeTitle, .brand b, .store-name').forEach(el => {
    el.textContent = data.settings.store_name;
  });

  // Render Dynamic Products on Store
  const productContainer = document.getElementById('storeProductList') || document.querySelector('.products-grid');
  if (productContainer) {
    productContainer.innerHTML = data.products.map(p => `
      <div class="product-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
        <img src="${p.image || 'logo.png'}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px;">
        <h3 style="margin: 10px 0 5px; font-size: 16px; color:#fff;">${p.name}</h3>
        <p style="color: #d4af37; font-weight: bold;">৳${p.price} ${p.old_price ? `<del style="color:#888; font-size:13px; margin-left:8px;">৳${p.old_price}</del>` : ''}</p>
        <p style="font-size: 13px; color: #aaa; margin-bottom: 10px;">${p.description || ''}</p>
        <button onclick="openCheckout(${p.id}, '${p.name}', ${p.price})" style="background: #d4af37; color: #000; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">Order Now</button>
      </div>
    `).join('');
  }

  // Render Support Agents on Store if container exists
  const agentContainer = document.getElementById('storeAgentList');
  if (agentContainer) {
    agentContainer.innerHTML = data.agents.filter(a => a.active).map(a => `
      <div style="margin-bottom: 10px;">
        <a href="https://wa.me/${a.whatsapp}" target="_blank" style="background:#25D366; color:#fff; padding:8px 15px; border-radius:5px; text-decoration:none; display:inline-block; margin-right:5px;">💬 WhatsApp: ${a.name}</a>
      </div>
    `).join('');
  }
}

// Global Order Trigger from Storefront
window.openCheckout = function(id, name, price) {
  const custName = prompt(`"${name}" অর্ডার করতে আপনার নাম লিখুন:`);
  if (!custName) return;
  const custPhone = prompt("আপনার মোবাইল নম্বরটি দিন:");
  if (!custPhone) return;
  const custAddress = prompt("আপনার সম্পূর্ণ ঠিকানা ও ডেলিভারি এরিয়া দিন:");
  if (!custAddress) return;

  let data = getStoreData();
  const newOrder = {
    id: Date.now(),
    productName: name,
    price: price,
    customerName: custName,
    phone: custPhone,
    address: custAddress,
    date: new Date().toLocaleString()
  };

  data.orders.push(newOrder);
  saveStoreData(data);
  alert('সফলভাবে অর্ডারটি প্লে করা হয়েছে! অ্যাডমিন প্যানেলে এটি যোগ হয়ে গেছে।');
};

// Initialize Admin Panel (admin.html)
function initAdminPanel(data) {
  const appPanel = document.getElementById('app');
  if (!appPanel) return; // Not on admin page

  // Update Stats
  const rev = data.orders.reduce((sum, o) => sum + Number(o.price), 12500);
  const revEl = document.getElementById('revenue');
  if(revEl) revEl.textContent = '৳' + rev;

  const ordCountEl = document.getElementById('ordersCount');
  if(ordCountEl) ordCountEl.textContent = data.orders.length;

  const prodCountEl = document.getElementById('productsCount');
  if(prodCountEl) prodCountEl.textContent = data.products.length;

  const agCountEl = document.getElementById('agentsCount');
  if(agCountEl) agCountEl.textContent = data.agents.filter(a => a.active).length;

  // Render Product Table in Admin
  const pTable = document.getElementById('productTable');
  if (pTable) {
    pTable.innerHTML = data.products.map(p => `
      <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
        <span><b>${p.name}</b> — ৳${p.price} (${p.category || 'General'})</span>
        <button onclick="deleteProduct(${p.id})" style="background: #ff6b6b; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
      </div>
    `).join('');
  }

  // Render Order Table in Admin
  const oTable = document.getElementById('orderTable');
  if (oTable) {
    if (data.orders.length === 0) {
      oTable.innerHTML = `<p style="padding:15px; color:#888;">কোনো নতুন অর্ডার নেই।</p>`;
    } else {
      oTable.innerHTML = data.orders.map(o => `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <p><b>${o.productName}</b> — ৳${o.price}</p>
          <p style="font-size:13px; color:#aaa;">গ্রাহক: ${o.customerName} | ফোন: ${o.phone} | ঠিকানা: ${o.address}</p>
          <small style="color:#d4af37;">${o.date}</small>
        </div>
      `).join('');
    }
  }

  // Render Agent Table in Admin
  const aTable = document.getElementById('agentTable');
  if (aTable) {
    aTable.innerHTML = data.agents.map(a => `
      <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
        <span><b>${a.name}</b> — ${a.whatsapp}</span>
        <button onclick="deleteAgent(${a.id})" style="background: #ff6b6b; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
      </div>
    `).join('');
  }

  // Product Form Submission
  const productForm = document.getElementById('productForm');
  if (productForm && !productForm.dataset.listener) {
    productForm.dataset.listener = "true";
    productForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newP = {
        id: Date.now(),
        name: productForm.querySelector('[name="name"]').value,
        price: Number(productForm.querySelector('[name="price"]').value),
        old_price: Number(productForm.querySelector('[name="old_price"]').value || 0),
        category: productForm.querySelector('[name="category"]').value,
        description: productForm.querySelector('[name="description"]').value,
        image: "logo.png"
      };
      data.products.push(newP);
      saveStoreData(data);
      alert('প্রোডাক্ট সফলভাবে যোগ করা হয়েছে!');
      const modal = document.getElementById('productModal');
      if(modal) modal.classList.remove('open');
      location.reload();
    });
  }

  // Agent Form Submission
  const agentForm = document.getElementById('agentForm');
  if (agentForm && !agentForm.dataset.listener) {
    agentForm.dataset.listener = "true";
    agentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newA = {
        id: Date.now(),
        name: agentForm.querySelector('[name="name"]').value,
        whatsapp: agentForm.querySelector('[name="whatsapp"]').value,
        active: true
      };
      data.agents.push(newA);
      saveStoreData(data);
      alert('সাপোর্ট এজেন্ট সফলভাবে যোগ করা হয়েছে!');
      const modal = document.getElementById('agentModal');
      if(modal) modal.classList.remove('open');
      location.reload();
    });
  }

  // Settings Form Submission & Password Change
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    if (!settingsForm.dataset.loaded) {
      settingsForm.dataset.loaded = "true";
      if(settingsForm.querySelector('[name="store_name"]')) settingsForm.querySelector('[name="store_name"]').value = data.settings.store_name || '';
      if(settingsForm.querySelector('[name="delivery_promise"]')) settingsForm.querySelector('[name="delivery_promise"]').value = data.settings.delivery_promise || '';
      if(settingsForm.querySelector('[name="bkash_number"]')) settingsForm.querySelector('[name="bkash_number"]').value = data.settings.bkash_number || '';
      if(settingsForm.querySelector('[name="nagad_number"]')) settingsForm.querySelector('[name="nagad_number"]').value = data.settings.nagad_number || '';
    }

    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if(settingsForm.querySelector('[name="store_name"]')) data.settings.store_name = settingsForm.querySelector('[name="store_name"]').value;
      if(settingsForm.querySelector('[name="delivery_promise"]')) data.settings.delivery_promise = settingsForm.querySelector('[name="delivery_promise"]').value;
      if(settingsForm.querySelector('[name="bkash_number"]')) data.settings.bkash_number = settingsForm.querySelector('[name="bkash_number"]').value;
      if(settingsForm.querySelector('[name="nagad_number"]')) data.settings.nagad_number = settingsForm.querySelector('[name="nagad_number"]').value;
      
      // Admin Password Change Field Check
      const newPassInput = settingsForm.querySelector('[name="admin_password"]');
      if (newPassInput && newPassInput.value) {
        data.settings.admin_pass = newPassInput.value;
      }

      saveStoreData(data);
      const savedMsg = document.getElementById('saved');
      if (savedMsg) {
        savedMsg.textContent = 'সেটিংস সফলভাবে সেভ ও সিঙ্ক হয়েছে!';
        setTimeout(() => savedMsg.textContent = '', 3000);
      }
    });
  }
}

window.deleteProduct = function(id) {
  let data = getStoreData();
  data.products = data.products.filter(p => p.id !== id);
  saveStoreData(data);
  location.reload();
};

window.deleteAgent = function(id) {
  let data = getStoreData();
  data.agents = data.agents.filter(a => a.id !== id);
  saveStoreData(data);
  location.reload();
};
