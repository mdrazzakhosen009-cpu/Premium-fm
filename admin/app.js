// ==========================================
// FM FASHION - ADMIN APP
// Complete copy-paste ready
// ==========================================

window.API_BASE = "";

const API = "";

const $ = (selector) =>
  document.querySelector(selector);

const money = (value) =>
  "৳" +
  Number(value || 0).toLocaleString("en-BD");

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );

let state = {
  products: [],
  orders: [],
  agents: [],
  settings: {},
  dashboard: {}
};

// ==========================================
// API
// ==========================================

async function api(path, options = {}) {
  const opts = {
    ...options,
    credentials: "include"
  };

  const response = await fetch(API + path, opts);

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

// ==========================================
// TOAST
// ==========================================

function toast(message) {
  let element =
    document.getElementById("adminToast");

  if (!element) {
    element =
      document.createElement("div");

    element.id = "adminToast";

    element.style.cssText =
      "position:fixed;" +
      "right:18px;" +
      "bottom:18px;" +
      "z-index:99999;" +
      "background:#111;" +
      "color:#fff;" +
      "padding:12px 16px;" +
      "border-radius:12px;" +
      "box-shadow:0 10px 30px #0004;" +
      "font-size:14px;";
      
    document.body.appendChild(element);
  }

  element.textContent = message;
  element.hidden = false;

  clearTimeout(element._timer);

  element._timer = setTimeout(() => {
    element.hidden = true;
  }, 3000);
}

// ==========================================
// IMAGE URL
// ==========================================

function imageUrl(src) {
  if (!src) {
    return "assets/logo.png";
  }

  if (
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }

  if (src.startsWith("/")) {
    return API + src;
  }

  return src;
}

// ==========================================
// LOGIN
// ==========================================

async function login(event) {
  event.preventDefault();

  const password =
    $("#password")?.value.trim();

  if (!password) {
    $("#loginError").textContent =
      "Password দিন।";
    return;
  }

  $("#loginError").textContent =
    "Signing in...";

  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        password
      })
    });

    // Verify session before opening dashboard
    await api("/api/admin/me");

    $("#login").hidden = true;
    $("#app").hidden = false;

    await loadAll();

    $("#loginError").textContent = "";

    toast("Login successful");

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    $("#login").hidden = false;
    $("#app").hidden = true;

    $("#loginError").textContent =
      error.message ||
      "Login failed";
  }
}

// ==========================================
// LOGOUT
// ==========================================

async function logout() {
  try {
    await api(
      "/api/admin/logout",
      {
        method: "POST"
      }
    );
  } catch (error) {
    console.error(error);
  }

  location.reload();
}

// ==========================================
// TABS
// ==========================================

function setupTabs() {
  document
    .querySelectorAll(".tab")
    .forEach((button) => {
      button.onclick = () => {

        document
          .querySelectorAll(".tab")
          .forEach((item) => {
            item.classList.toggle(
              "active",
              item === button
            );
          });

        document
          .querySelectorAll(".panel")
          .forEach((panel) => {
            panel.classList.toggle(
              "active",
              panel.id ===
                button.dataset.tab
            );
          });
      };
    });
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboard() {
  const data =
    await api(
      "/api/admin/dashboard"
    );

  state.dashboard = data;

  if ($("#revenue")) {
    $("#revenue").textContent =
      money(data.revenue);
  }

  if ($("#ordersCount")) {
    $("#ordersCount").textContent =
      Number(data.orders || 0);
  }

  if ($("#productsCount")) {
    $("#productsCount").textContent =
      Number(data.products || 0);
  }

  if ($("#agentsCount")) {
    $("#agentsCount").textContent =
      Number(data.agents || 0);
  }
}

// ==========================================
// PRODUCTS
// ==========================================

async function loadProducts() {
  state.products =
    await api(
      "/api/admin/products"
    );

  renderProducts();
}

function renderProducts() {
  const box =
    $("#productTable");

  if (!box) return;

  if (!state.products.length) {
    box.innerHTML =
      `<div class="empty">
        No products yet. Add your first product.
      </div>`;

    return;
  }

  box.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Category</th>
            <th>Flags</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${state.products
            .map(
              (product) => `
                <tr>

                  <td>
                    <div style="
                      display:flex;
                      gap:10px;
                      align-items:center
                    ">

                      <img
                        src="${esc(
                          imageUrl(
                            product.image
                          )
                        )}"
                        style="
                          width:52px;
                          height:52px;
                          object-fit:cover;
                          border-radius:10px
                        "
                      >

                      <div>
                        <b>
                          ${esc(
                            product.name
                          )}
                        </b>

                        <small
                          style="display:block"
                        >
                          #${product.id}
                        </small>
                      </div>

                    </div>
                  </td>

                  <td>
                    ${money(
                      product.price
                    )}

                    ${
                      product.old_price
                        ? `
                          <del>
                            ${money(
                              product.old_price
                            )}
                          </del>
                        `
                        : ""
                    }
                  </td>

                  <td>
                    ${esc(
                      product.category ||
                        "General"
                    )}
                  </td>

                  <td>
                    ${
                      product.featured
                        ? "Featured "
                        : ""
                    }

                    ${
                      product.is_new
                        ? "New"
                        : ""
                    }
                  </td>

                  <td>
                    <button
                      onclick="editProduct(${product.id})"
                    >
                      Edit
                    </button>

                    <button
                      onclick="deleteProduct(${product.id})"
                    >
                      Delete
                    </button>
                  </td>

                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

window.editProduct = (id) => {
  const product =
    state.products.find(
      (item) => item.id === id
    );

  if (!product) return;

  const form =
    $("#productForm");

  if (!form) return;

  form.reset();

  [
    "id",
    "name",
    "price",
    "old_price",
    "category",
    "description",
    "tags"
  ].forEach((key) => {
    if (form.elements[key]) {
      form.elements[key].value =
        product[key] ?? "";
    }
  });

  if (form.elements.featured) {
    form.elements.featured.checked =
      !!product.featured;
  }

  if (form.elements.is_new) {
    form.elements.is_new.checked =
      !!product.is_new;
  }

  $("#pTitle").textContent =
    "Edit Product";

  $("#productModal")
    .classList.add("open");
};

window.deleteProduct =
  async (id) => {

    if (
      !confirm(
        "Delete this product?"
      )
    ) {
      return;
    }

    try {
      await api(
        `/api/admin/products/${id}`,
        {
          method: "DELETE"
        }
      );

      await loadAll();

      toast(
        "Product deleted"
      );

    } catch (error) {
      toast(error.message);
    }
  };

async function saveProduct(event) {
  event.preventDefault();

  const form = event.target;

  const formData =
    new FormData(form);

  const id =
    formData.get("id");

  try {

    await api(
      id
        ? `/api/admin/products/${id}`
        : "/api/admin/products",
      {
        method:
          id ? "PUT" : "POST",
        body: formData
      }
    );

    $("#productModal")
      .classList.remove("open");

    form.reset();

    if (form.elements.id) {
      form.elements.id.value = "";
    }

    $("#pTitle").textContent =
      "Add Product";

    await loadAll();

    toast(
      "Product saved successfully"
    );

  } catch (error) {
    toast(error.message);
  }
}

// ==========================================
// ORDERS
// ==========================================

async function loadOrders() {
  state.orders =
    await api(
      "/api/admin/orders"
    );

  renderOrders();
}

function renderOrders() {
  const box =
    $("#orderTable");

  if (!box) return;

  if (!state.orders.length) {
    box.innerHTML =
      `<div class="empty">
        No orders yet.
      </div>`;

    return;
  }

  const statuses = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
  ];

  box.innerHTML = `
    <div class="table-wrap">
      <table>

        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${state.orders
            .map(
              (order) => `
                <tr>

                  <td>
                    FMF-${String(
                      order.id
                    ).padStart(6, "0")}
                  </td>

                  <td>
                    ${esc(
                      order.customer_name
                    )}

                    <small
                      style="display:block"
                    >
                      ${esc(
                        order.phone
                      )}
                    </small>
                  </td>

                  <td>
                    ${money(
                      order.total
                    )}
                  </td>

                  <td>
                    ${esc(
                      order.payment_method
                    )}
                  </td>

                  <td>

                    <select
                      onchange="
                        updateOrder(
                          ${order.id},
                          this.value
                        )
                      "
                    >

                      ${statuses
                        .map(
                          (status) => `
                            <option
                              ${
                                status ===
                                order.status
                                  ? "selected"
                                  : ""
                              }
                            >
                              ${status}
                            </option>
                          `
                        )
                        .join("")}

                    </select>

                  </td>

                </tr>
              `
            )
            .join("")}
        </tbody>

      </table>
    </div>
  `;
}

window.updateOrder =
  async (id, status) => {

    try {

      await api(
        `/api/admin/orders/${id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            status
          })
        }
      );

      await loadDashboard();

      toast(
        "Order status updated"
      );

    } catch (error) {
      toast(error.message);
    }
  };

// ==========================================
// AGENTS
// ==========================================

async function loadAgents() {
  state.agents =
    await api(
      "/api/admin/agents"
    );

  renderAgents();
}

function renderAgents() {
  const box =
    $("#agentTable");

  if (!box) return;

  if (!state.agents.length) {
    box.innerHTML =
      `<div class="empty">
        No agents yet.
      </div>`;

    return;
  }

  box.innerHTML = `
    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Agent</th>
            <th>WhatsApp</th>
            <th>Messenger</th>
            <th>Active</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>

          ${state.agents
            .map(
              (agent) => `
                <tr>

                  <td>
                    ${esc(
                      agent.name
                    )}
                  </td>

                  <td>
                    ${esc(
                      agent.whatsapp
                    )}
                  </td>

                  <td>
                    ${
                      agent.messenger_url
                        ? `
                          <a
                            href="${esc(
                              agent.messenger_url
                            )}"
                            target="_blank"
                            rel="noopener"
                          >
                            Open
                          </a>
                        `
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      agent.active
                        ? "Yes"
                        : "No"
                    }
                  </td>

                  <td>

                    <button
                      onclick="
                        editAgent(
                          ${agent.id}
                        )
                      "
                    >
                      Edit
                    </button>

                    <button
                      onclick="
                        deleteAgent(
                          ${agent.id}
                        )
                      "
                    >
                      Delete
                    </button>

                  </td>

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}

window.editAgent = (id) => {
  const agent =
    state.agents.find(
      (item) => item.id === id
    );

  if (!agent) return;

  const form =
    $("#agentForm");

  if (!form) return;

  form.reset();

  form.elements.id.value =
    agent.id;

  form.elements.name.value =
    agent.name;

  form.elements.whatsapp.value =
    agent.whatsapp;

  form.elements.messenger_url.value =
    agent.messenger_url || "";

  form.elements.active.checked =
    !!agent.active;

  $("#agentModal")
    .classList.add("open");
};

window.deleteAgent =
  async (id) => {

    if (
      !confirm(
        "Delete this agent?"
      )
    ) {
      return;
    }

    try {

      await api(
        `/api/admin/agents/${id}`,
        {
          method: "DELETE"
        }
      );

      await loadAll();

      toast(
        "Agent deleted"
      );

    } catch (error) {
      toast(error.message);
    }
  };

async function saveAgent(event) {
  event.preventDefault();

  const form =
    event.target;

  const data = {
    name:
      form.elements.name.value.trim(),

    whatsapp:
      form.elements.whatsapp.value.trim(),

    messenger_url:
      form.elements.messenger_url.value.trim(),

    active:
      form.elements.active.checked
  };

  const id =
    form.elements.id.value;

  try {

    await api(
      id
        ? `/api/admin/agents/${id}`
        : "/api/admin/agents",
      {
        method:
          id ? "PUT" : "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(data)
      }
    );

    $("#agentModal")
      .classList.remove("open");

    form.reset();

    form.elements.active.checked =
      true;

    await loadAll();

    toast(
      "Agent saved successfully"
    );

  } catch (error) {
    toast(error.message);
  }
}

// ==========================================
// SETTINGS
// ==========================================

async function loadSettings() {
  state.settings =
    await api(
      "/api/admin/settings"
    );

  renderSettings();
}

function renderSettings() {
  const form =
    $("#settingsForm");

  if (!form) return;

  const settings =
    state.settings;

  const fields = [
    "store_name",
    "logo",
    "delivery_promise",
    "bkash_number",
    "nagad_number",
    "rocket_number",
    "payment_note"
  ];

  fields.forEach((key) => {
    if (form.elements[key]) {
      form.elements[key].value =
        settings[key] || "";
    }
  });

  [
    "bkash_enabled",
    "nagad_enabled",
    "rocket_enabled",
    "cod_enabled"
  ].forEach((key) => {
    if (form.elements[key]) {
      form.elements[key].checked =
        settings[key] === "1";
    }
  });

  if ($("#storeTitle")) {
    $("#storeTitle").textContent =
      settings.store_name ||
      "FM FASHION";
  }
}

async function saveSettings(event) {
  event.preventDefault();

  const form =
    event.target;

  const data = {
    store_name:
      form.elements.store_name.value,

    logo:
      form.elements.logo.value,

    delivery_promise:
      form.elements.delivery_promise.value,

    bkash_number:
      form.elements.bkash_number.value,

    nagad_number:
      form.elements.nagad_number.value,

    rocket_number:
      form.elements.rocket_number.value,

    payment_note:
      form.elements.payment_note.value,

    bkash_enabled:
      form.elements.bkash_enabled.checked,

    nagad_enabled:
      form.elements.nagad_enabled.checked,

    rocket_enabled:
      form.elements.rocket_enabled.checked,

    cod_enabled:
      form.elements.cod_enabled.checked
  };

  try {

    const result =
      await api(
        "/api/admin/settings",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)
        }
      );

    state.settings =
      result.settings ||
      state.settings;

    renderSettings();

    if ($("#saved")) {
      $("#saved").textConte
