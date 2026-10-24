// Spatial UI Admin Dashboard Logic

const root = document.getElementById("admin-root");
let userEmail = null;

// --- API Helpers ---
async function api(endpoint, method = "GET", body = null) {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(endpoint, options);
  if (res.status === 401) {
    userEmail = null;
    renderLogin();
    throw new Error("Unauthorized");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API Error");
  return data;
}

// --- Renderers ---

function renderLogin() {
  root.innerHTML = `
    <div class="glass-panel login-box">
      <h2 style="text-align:center; color:var(--cyan); margin-bottom:20px;">Admin Login</h2>
      <form id="loginForm">
        <input type="email" id="email" placeholder="Admin Email" required>
        <input type="password" id="password" placeholder="Password" required>
        <p id="loginErr" style="color:var(--coral); margin-bottom:15px; font-size:0.9rem;"></p>
        <button type="submit" class="btn" style="width:100%;">Login</button>
      </form>
    </div>
  `;
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await api("/api/admin/login", "POST", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      });
      initAdmin(); // Refresh state
    } catch (err) {
      document.getElementById("loginErr").innerText = err.message;
      btn.disabled = false;
    }
  });
}

async function renderDashboard() {
  root.innerHTML = `
    <div class="admin-nav">
      <h2>✨ Lumora <span style="color:var(--cyan)">Admin Workspace</span></h2>
      <div>
        <span style="margin-right:20px; color:var(--lavender);">${userEmail}</span>
        <button class="btn" style="padding: 8px 15px;" id="logoutBtn">Logout</button>
      </div>
    </div>
    <div class="container">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="color:var(--white);">Appointments</h2>
        <button class="btn" onclick="renderDashboard()">↻ Refresh</button>
      </div>
      <div class="glass-panel" style="padding: 20px; overflow-x:auto;">
        <table class="table-glass">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Patient</th>
              <th>Contact</th>
              <th>Date & Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="aptList"><tr><td colspan="6" style="text-align:center;">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/admin/logout", "POST");
    userEmail = null;
    renderLogin();
  });

  try {
    const appointments = await api("/api/admin/appointments");
    const tbody = document.getElementById("aptList");

    if (appointments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;">No appointments found.</td></tr>';
      return;
    }

    tbody.innerHTML = appointments
      .map(
        (apt) => `
      <tr>
        <td style="font-family:monospace; color:var(--cyan);">${apt.reference}</td>
        <td>${escapeHTML(apt.patientName)}</td>
        <td>${escapeHTML(apt.phone)}<br><small style="color:#aaa;">${escapeHTML(apt.email)}</small></td>
        <td>${apt.date} <br> <span style="color:var(--mint);">${apt.time}</span></td>
        <td><span class="status-badge status-${apt.status}">${apt.status.toUpperCase()}</span></td>
        <td>
          <select onchange="updateStatus('${apt._id}', this.value)" style="background:rgba(0,0,0,0.5); color:#fff; border:1px solid var(--glass-border); padding:5px; border-radius:5px;">
            <option value="pending" ${apt.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="confirmed" ${apt.status === "confirmed" ? "selected" : ""}>Confirm</option>
            <option value="completed" ${apt.status === "completed" ? "selected" : ""}>Complete</option>
            <option value="cancelled" ${apt.status === "cancelled" ? "selected" : ""}>Cancel</option>
          </select>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    if (err.message !== "Unauthorized") {
      document.getElementById("aptList").innerHTML =
        '<tr><td colspan="6" style="color:var(--coral);">Failed to load data.</td></tr>';
    }
  }
}

// Utility for preventing basic XSS in admin UI
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag],
  );
}

window.updateStatus = async (id, status) => {
  try {
    await api(`/api/admin/appointments/${id}/status`, "PATCH", { status });
    renderDashboard();
  } catch (err) {
    alert("Failed to update status: " + err.message);
  }
};

// --- Initialization ---
async function initAdmin() {
  try {
    const me = await api("/api/admin/me");
    userEmail = me.email;
    renderDashboard();
  } catch (err) {
    renderLogin();
  }
}

// Start app
initAdmin();
