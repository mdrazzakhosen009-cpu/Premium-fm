// FM Fashion — Integrated Store & Admin Logic
document.addEventListener('DOMContentLoaded', () => {
  // Load Store Data from LocalStorage or Defaults
  const storeData = getStoreData();

  // Update Store UI with Dynamic Data
  renderStoreFront(storeData);

  // Handle Admin Panel Actions if on Admin Page
  initAdminPanel(storeData);
});

function getStoreData() {
  const defaultData = {
    settings: {
      store_name: "FM FASHION",
      delivery_promise: "দেশজুড়ে Delivery — দ্রুত ও নির্ভরযোগ্য",
      bkash_number: "01700000000",
      nagad_number: "01800000000",
      rocket_number: "",
      bkash_enabled: true,
      nagad_enabled: true,
      cod_enabled: true,
      payment_note: "বিকাশ বা নগদ সেন্ড মনি করার পর ট্রানজাকশন আইডি দিন।"
    },
    products: [
      { id: 1, name: "Classic Black Panjabi", price: 1850, old_price: 2200, category: "Panjabi", description: "Premium cotton fabrics with stylish embroidery.", image: "logo.png", featured: true, is_new: true },
      { id: 2, name: "Executive Formal Shirt", price: 1450, old_price: 1800, category: "Shirt", description: "Comfortable and slim-fit formal shirt for men.", image: "logo.png", featured: true, is_new: false }
    ],
    agents: [
      { id: 1, name: "Support Team 1", whatsapp: "8801700000000", messenger_url: "#", active: true }
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

function renderStoreFront(data) {
  // Update Store Title / Promotes if elements exist on index.html
  const storeTitleEls = document.querySelectorAll('#storeTitle, .brand b');
  storeTitleEls.forEach(el => el.textContent = data.settings.store_name);

  // Render Products on index.html if product container exists
  const productContainer = document.getElementById('storeProductList') || document.querySelector('.products-grid') || document.getElementById('productTable');
  if (productContainer && !document.getElementById('app')) {
    productContainer.innerHTML = data.products.map(p => `
      <div class="product-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
        <img src="${p.image || 'logo.png'}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px;">
        <h3 style="margin: 10px 0 5px; font-size: 16px;">${p.name}</h3>
        <p style="color: #d4af37; font-weight: bold;">৳${p.price} ${p.old_price ? `<del style="color:#888; font-size:13px; margin-left:8px;">৳${p.old_price}</del>` : ''}</p>
        <p style="font-size: 13px; color: #aaa; margin-bottom: 10px;">${p.description || ''}</p>
        <button onclick="addToCart(${p.id})" style="background: #d4af37; color: #000; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">Order Now</button>
      </div>
    `).join('');
  }
}

function initAdminPanel(data) {
  const appPanel = document.getElementById('app');
  if (!appPanel) return; // Not on admin page

  // Render Dashboard Stats
  document.getElementById('revenue').textContent = '৳' + (data.orders.length * 1500 + 12500);
  document.getElementById('ordersCount').textContent = data.orders.length;
  document.getElementById('productsCount').textContent = data.products.length;
  document.getElementById('agentsCount').textContent = data.agents.filter(a => a.active).length;

  // Render Admin Product Table
  const pTable = document.getElementById('productTable');
  if (pTable) {
    pTable.innerHTML = data.products.map(p => `
      <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
        <span><b>${p.name}</b> — ৳${p.price}</span>
        <button onclick="deleteProduct(${p.id})" style="background: #ff6b6b; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
      </div>
    `).join('');
  }

  // Handle Product Form Add
  const productForm = document.getElementById('productForm');
  if (productForm && !productForm.dataset.listener) {
    productForm.dataset.listener = "true";
    productForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(productForm);
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
      alert('Product added successfully and synced with store!');
      document.getElementById('productModal').classList.remove('open');
      location.reload();
    });
  }

  // Handle Settings Form
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    if (!settingsForm.dataset.loaded) {
      settingsForm.dataset.loaded = "true";
      settingsForm.querySelector('[name="store_name"]').value = data.settings.store_name || '';
      settingsForm.querySelector('[name="delivery_promise"]').value = data.settings.delivery_promise || '';
      settingsForm.querySelector('[name="bkash_number"]').value = data.settings.bkash_number || '';
      settingsForm.querySelector('[name="nagad_number"]').value = data.settings.nagad_number || '';
    }

    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      data.settings.store_name = settingsForm.querySelector('[name="store_name"]').value;
      data.settings.delivery_promise = settingsForm.querySelector('[name="delivery_promise"]').value;
      data.settings.bkash_number = settingsForm.querySelector('[name="bkash_number"]').value;
      data.settings.nagad_number = settingsForm.querySelector('[name="nagad_number"]').value;
      saveStoreData(data);
      const savedMsg = document.getElementById('saved');
      if (savedMsg) {
        savedMsg.textContent = 'Settings saved & synced successfully!';
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

window.addToCart = function(id) {
  alert('Product added to cart!');
};
        
