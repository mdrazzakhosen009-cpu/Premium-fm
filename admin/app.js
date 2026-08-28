// ===============================
// FM FASHION - ADMIN APP.JS
// ===============================

// Same-origin deployment.
// Admin panel এবং server একই domain-এ থাকলে API_BASE ফাঁকা থাকবে।
window.API_BASE = "";

const API = "";

const $ = (s) => document.querySelector(s);

const money = (n) =>
  "৳" + Number(n || 0).toLocaleString("en-BD");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));

let state = {
  products: [],
  orders: [],
  agents: [],
  settings: {}
};


// ===============================
// API HELPER
// ===============================

async function api(path, opt = {}) {

  opt.credentials = "include";

  const r = await fetch(API + path, opt);

  const j = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(
      j.error || `Request failed (${r.status})`
    );
  }

  return j;
}


// ===============================
// TOAST
// ===============================

function toast(msg) {

  let el = document.getElementById("adminToast");

  if (!el) {

    el = document.createElement("div");

    el.id = "adminToast";

    el.style.cssText =
      "position:fixed;right:18px;bottom:18px;z-index:9999;" +
      "background:#111;color:#fff;padding:12px 16px;" +
      "border-radius:12px;box-shadow:0 10px 30px #0004";

    document.body.appendChild(el);
  }

  el.textContent = msg;
  el.hidden = false;

  clearTimeout(el._t);

  el._t = setTimeout(() => {
    el.hidden = true;
  }, 2500);
}


// ===============================
// FORM HELPER
// ===============================

function formDataObject(form) {
  return Object.fromEntries(new FormData(form));
}


// ===============================
// TABS
// ===============================

function setupTabs() {

  document.querySelectorAll(".tab").forEach((b) => {

    b.onclick = () => {

      document.querySelectorAll(".tab")
        .forEach((x) =>
          x.classList.toggle("active", x === b)
        );

      document.querySelectorAll(".panel")
        .forEach((x) =>
          x.classList.toggle(
            "active",
            x.id === b.dataset.tab
          )
        );
    };

  });
}


// ===============================
// LOGIN
// ===============================

async function login(e) {

  e.preventDefault();

  const password =
    $("#password").value.trim();

  if (!password) {
    $("#loginError").textContent =
      "Password দিন।";
    return;
  }

  try {

    await api("/api/admin/login", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        password
      })

    });

    $("#login").hidden = true;

    $("#app").hidden = false;

    await loadAll();

    toast("Login successful");

  } catch (err) {

    console.error(err);

    $("#loginError").textContent =
      err.message || "Login failed";
  }
}


// ===============================
// LOGOUT
// ===============================

async function logout() {

  try {

    await api("/api/admin/logout", {
      method: "POST"
    });

  } catch (e) {}

  location.reload();
}


// ===============================
// IMAGE URL
// ===============================

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


// ===============================
// PRODUCTS
// ===============================

function renderProducts() {

  const box = $("#productTable");

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

          ${state.products.map((p) => `

            <tr>

              <td>

                <div style="
                  display:flex;
                  gap:10px;
                  align-items:center
                ">

                  <img
                    src="${esc(imageUrl(p.image))}"
                    style="
                      width:52px;
                      height:52px;
                      object-fit:cover;
                      border-radius:10px
                    "
                  >

                  <div>

                    <b>${esc(p.name)}</b>

                    <small style="display:block">
                      #${p.id}
                    </small>

                  </div>

                </div>

              </td>

              <td>

                ${money(p.price)}

                ${
                  p.old_price
                    ? `<del>${money(p.old_price)}</del>`
                    : ""
                }

              </td>

              <td>
                ${esc(p.category || "General")}
              </td>

              <td>

                ${p.featured ? "Featured " : ""}
                ${p.is_new ? "New" : ""}

              </td>

              <td>

                <button
                  onclick="editProduct(${p.id})">
                  Edit
                </button>

                <button
                  onclick="deleteProduct(${p.id})">
                  Delete
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}


// ===============================
// EDIT PRODUCT
// ===============================

window.editProduct = (id) => {

  const p =
    state.products.find((x) => x.id === id);

  if (!p) return;

  const f = $("#productForm");

  f.reset();

  for (
    const k of [
      "id",
      "name",
      "price",
      "old_price",
      "category",
      "description",
      "tags"
    ]
  ) {

    if (f.elements[k]) {
      f.elements[k].value = p[k] ?? "";
    }

  }

  f.elements.featured.checked =
    !!p.featured;

  f.elements.is_new.checked =
    !!p.is_new;

  $("#pTitle").textContent =
    "Edit Product";

  $("#productModal")
    .classList.add("open");
};


// ===============================
// DELETE PRODUCT
// ===============================

window.deleteProduct = async (id) => {

  if (!confirm("Delete this product?")) {
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

    toast("Product deleted");

  } catch (e) {

    toast(e.message);
  }
};


// ===============================
// SAVE PRODUCT
// ===============================

async function saveProduct(e) {

  e.preventDefault();

  const f = e.target;

  const data =
    new FormData(f);

  const id =
    data.get("id");

  try {

    await api(
      id
        ? `/api/admin/products/${id}`
        : "/api/admin/products",
      {
        method: id ? "PUT" : "POST",
        body: data
      }
    );

    $("#productModal")
      .classList.remove("open");

    f.reset();

    await loadAll();

    toast(
      "Product saved and synced to store"
    );

  } catch (e) {

    toast(e.message);
  }
}


// ===============================
// ORDERS
// ===============================

function renderOrders() {

  const box = $("#orderTable");

  if (!state.orders.length) {

    box.innerHTML =
      `<div class="empty">
        No orders yet.
      </div>`;

    return;
  }

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

          ${state.orders.map((o) => `

            <tr>

              <td>
                FMF-${String(o.id).padStart(6, "0")}
              </td>

              <td>

                ${esc(o.customer_name)}

                <small style="display:block">
                  ${esc(o.phone)}
                </small>

              </td>

              <td>
                ${money(o.total)}
              </td>

              <td>
                ${esc(o.payment_method)}
              </td>

              <td>

                <select
                  onchange="updateOrder(${o.id},this.value)"
                >

                  ${
                    [
                      "Pending",
                      "Confirmed",
                      "Processing",
                      "Shipped",
                      "Delivered",
                      "Cancelled"
                    ]
                    .map(
                      (s) =>
                        `<option ${
                          s === o.status
                            ? "selected"
                            : ""
                        }>${s}</option>`
                    )
                    .join("")
                  }

                </select>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}


// ===============================
// UPDATE ORDER
// ===============================

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

      toast(
        "Order status updated"
      );

    } catch (e) {

      toast(e.message);
    }
  };


// ===============================
// AGENTS
// ===============================

function renderAgents() {

  const box = $("#agentTable");

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

          ${state.agents.map((a) => `

            <tr>

              <td>
                ${esc(a.name)}
              </td>

              <td>
                ${esc(a.whatsapp)}
              </td>

              <td>

                ${
                  a.messenger_url
                    ? `<a
                        href="${esc(a.messenger_url)}"
                        target="_blank">
                        Open
                       </a>`
                    : "—"
                }

              </td>

              <td>
                ${a.active ? "Yes" : "No"}
              </td>

              <td>

                <button
                  onclick="editAgent(${a.id})">
                  Edit
                </button>

                <button
                  onclick="deleteAgent(${a.id})">
                  Delete
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}


// ===============================
// EDIT AGENT
// ===============================

window.editAgent = (id) => {

  const a =
    state.agents.find((x) => x.id === id);

  if (!a) return;

  const f = $("#agentForm");

  f.reset();

  f.elements.id.value =
    a.id;

  f.elements.name.value =
    a.name;

  f.elements.whatsapp.value =
    a.whatsapp;

  f.elements.messenger_url.value =
    a.messenger_url || "";

  f.elements.active.checked =
    !!a.active;

  $("#agentModal")
    .classList.add("open");
};


// ===============================
// DELETE AGENT
// ===============================

window.deleteAgent = async (id) => {

  if (!confirm("Delete this agent?")) {
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

    toast("Agent deleted");

 
