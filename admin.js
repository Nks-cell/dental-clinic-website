(() => {
  "use strict";

  const root = document.getElementById("adminApp");
  if (!root) {
    console.error("Admin Portal: #adminApp element was not found.");
    return;
  }

  const state = {
    user: null,
    bookings: [],
    metrics: { total: 0, pending: 0, confirmed: 0, completed: 0, today: 0 },
    page: 1,
    pages: 1,
    search: "",
    status: "All",
    date: "",
    loading: false,
    notice: "",
    error: ""
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  async function api(url, options = {}) {
    const response = await fetch(url, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });

    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json")
      ? await response.json()
      : { error: (await response.text()).slice(0, 250) || "Unexpected server response" };

    if (!response.ok) {
      if (response.status === 401 && !url.includes("/api/admin/login")) {
        state.user = null;
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  function statusBadge(status) {
    const colors = {
      Pending: "bg-amber-400/15 text-amber-200 border-amber-300/20",
      Confirmed: "bg-emerald-400/15 text-emerald-200 border-emerald-300/20",
      Completed: "bg-sky-400/15 text-sky-200 border-sky-300/20",
      Cancelled: "bg-slate-400/15 text-slate-200 border-slate-300/20",
      Rejected: "bg-rose-400/15 text-rose-200 border-rose-300/20"
    };
    return `<span class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${colors[status] || colors.Pending}">${esc(status || "Pending")}</span>`;
  }

  function showMessage(message, kind = "error") {
    state.notice = kind === "success" ? message : "";
    state.error = kind === "error" ? message : "";
    const el = document.getElementById("adminMessage");
    if (el) {
      el.className = `mb-5 rounded-xl border px-4 py-3 text-sm ${
        kind === "success"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-rose-400/30 bg-rose-400/10 text-rose-200"
      }`;
      el.textContent = message;
      el.classList.remove("hidden");
    }
  }

  function clearMessage() {
    state.notice = "";
    state.error = "";
    const el = document.getElementById("adminMessage");
    if (el) el.classList.add("hidden");
  }

  function renderLogin(message = "") {
    root.innerHTML = `
      <main class="min-h-screen px-4 py-12 flex items-center justify-center">
        <section class="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
          <a href="/" class="text-sm text-sky-300 hover:text-sky-200">← Back to website</a>
          <div class="mt-7 mb-8 flex items-center gap-4">
            <div class="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-2xl shadow-lg">✦</div>
            <div>
              <p class="text-xs uppercase tracking-[0.22em] text-sky-300">DentalCare Smile Studio</p>
              <h1 class="mt-1 text-2xl font-bold text-white">Admin Portal</h1>
              <p class="mt-1 text-sm text-slate-400">Sign in to manage appointments</p>
            </div>
          </div>
          <div id="loginMessage" class="${message ? "" : "hidden"} mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">${esc(message)}</div>
          <form id="adminLoginForm" class="space-y-5">
            <div>
              <label for="adminUsername" class="mb-2 block text-sm font-medium text-slate-200">Username</label>
              <input id="adminUsername" name="username" autocomplete="username" required class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" placeholder="Admin username">
            </div>
            <div>
              <label for="adminPassword" class="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <input id="adminPassword" name="password" type="password" autocomplete="current-password" required class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" placeholder="Admin password">
            </div>
            <button id="loginButton" type="submit" class="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3.5 font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:brightness-110 disabled:opacity-60">Sign in securely</button>
            <p class="text-xs leading-5 text-slate-500">Use the admin credentials configured in Vercel Environment Variables. Do not share your password.</p>
          </form>
        </section>
      </main>`;

    document.getElementById("adminLoginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("loginButton");
      const message = document.getElementById("loginMessage");
      button.disabled = true;
      button.textContent = "Signing in…";
      message.classList.add("hidden");
      const username = document.getElementById("adminUsername").value.trim();
      const password = document.getElementById("adminPassword").value;
      try {
        await api("/api/admin/login", { method: "POST", body: { username, password } });
        await loadDashboard();
      } catch (error) {
        message.textContent = error.message || "Login failed. Check your credentials.";
        message.classList.remove("hidden");
        button.disabled = false;
        button.textContent = "Sign in securely";
      }
    });
  }

  function renderShell() {
    root.innerHTML = `
      <div class="min-h-screen">
        <header class="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
          <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div class="flex items-center gap-3">
              <div class="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-xl">✦</div>
              <div><p class="text-xs uppercase tracking-[0.2em] text-sky-300">DentalCare</p><h1 class="font-bold text-white">Admin Dashboard</h1></div>
            </div>
            <div class="flex items-center gap-3">
              <span class="hidden text-sm text-slate-400 sm:inline">Signed in as <strong class="text-slate-200">${esc(state.user?.username || "admin")}</strong></span>
              <a href="/" class="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">View site</a>
              <button id="logoutButton" class="rounded-xl border border-rose-300/20 px-3 py-2 text-sm text-rose-200 hover:bg-rose-400/10">Log out</button>
            </div>
          </div>
        </header>
        <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Clinic operations</p><h2 class="mt-2 text-3xl font-bold text-white sm:text-4xl">Appointments</h2><p class="mt-2 text-slate-400">Review booking requests and update their status.</p></div>
            <button id="refreshButton" class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">↻ Refresh data</button>
          </div>
          <div id="adminMessage" class="hidden mb-5 rounded-xl border px-4 py-3 text-sm"></div>
          <section id="metricsGrid" class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"></section>
          <section class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl">
            <div class="border-b border-white/10 p-4 sm:p-5">
              <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_170px_auto]">
                <input id="searchBookings" value="${esc(state.search)}" placeholder="Search name, phone, reference…" class="min-w-0 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-sky-400">
                <select id="statusFilter" class="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-white outline-none focus:border-sky-400">
                  ${["All","Pending","Confirmed","Completed","Cancelled","Rejected"].map(s => `<option ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
                <input id="dateFilter" type="date" value="${esc(state.date)}" class="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-white outline-none focus:border-sky-400">
                <button id="filterButton" class="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400">Apply filters</button>
              </div>
            </div>
            <div id="bookingsContainer" class="overflow-x-auto">
              <div class="p-10 text-center text-slate-400">Loading appointments…</div>
            </div>
            <div class="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p id="paginationInfo" class="text-sm text-slate-400"></p>
              <div class="flex gap-2">
                <button id="prevPage" class="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5">Previous</button>
                <button id="nextPage" class="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5">Next</button>
              </div>
            </div>
          </section>
          <p class="mt-5 text-xs leading-5 text-slate-500">Patient information is confidential. Only authorized clinic staff should use this dashboard. Status updates change the database; this demo does not send WhatsApp/SMS notifications.</p>
        </main>
      </div>`;

    document.getElementById("logoutButton").addEventListener("click", logout);
    document.getElementById("refreshButton").addEventListener("click", () => refreshData());
    document.getElementById("filterButton").addEventListener("click", () => {
      state.search = document.getElementById("searchBookings").value.trim();
      state.status = document.getElementById("statusFilter").value;
      state.date = document.getElementById("dateFilter").value;
      state.page = 1;
      refreshData();
    });
    document.getElementById("searchBookings").addEventListener("keydown", (event) => {
      if (event.key === "Enter") document.getElementById("filterButton").click();
    });
    document.getElementById("prevPage").addEventListener("click", () => {
      if (state.page > 1) { state.page--; refreshBookings(); }
    });
    document.getElementById("nextPage").addEventListener("click", () => {
      if (state.page < state.pages) { state.page++; refreshBookings(); }
    });
  }

  function renderMetrics() {
    const items = [
      ["Total bookings", state.metrics.total, "All requests", "✦"],
      ["Pending", state.metrics.pending, "Need review", "◷"],
      ["Confirmed", state.metrics.confirmed, "Approved visits", "✓"],
      ["Completed", state.metrics.completed, "Visits completed", "＋"],
      ["Today", state.metrics.today, "Today's appointments", "▦"]
    ];
    const grid = document.getElementById("metricsGrid");
    if (!grid) return;
    grid.innerHTML = items.map(([label, value, hint, icon]) => `
      <article class="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg">
        <div class="flex items-center justify-between"><span class="text-sm text-slate-400">${label}</span><span class="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/10 text-lg text-sky-300">${icon}</span></div>
        <p class="mt-4 text-3xl font-bold text-white">${Number(value) || 0}</p><p class="mt-1 text-xs text-slate-500">${hint}</p>
      </article>`).join("");
  }

  function renderBookings() {
    const container = document.getElementById("bookingsContainer");
    if (!container) return;
    if (!state.bookings.length) {
      container.innerHTML = `<div class="p-10 text-center"><div class="mb-3 text-3xl">▦</div><h3 class="font-semibold text-white">No appointments found</h3><p class="mt-1 text-sm text-slate-400">Try changing the search or filters.</p></div>`;
    } else {
      container.innerHTML = `
        <table class="min-w-[1050px] w-full text-left text-sm">
          <thead class="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
            <tr><th class="px-5 py-4">Patient</th><th class="px-5 py-4">Treatment / Dentist</th><th class="px-5 py-4">Date & time</th><th class="px-5 py-4">Reference</th><th class="px-5 py-4">Status</th><th class="px-5 py-4">Update status</th></tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${state.bookings.map((b) => `
              <tr class="align-top hover:bg-white/[0.025]">
                <td class="px-5 py-4"><p class="font-semibold text-white">${esc(b.fullName)}</p><p class="mt-1 text-slate-400">${esc(b.phone)}</p><p class="mt-1 text-xs text-slate-500">${esc(b.email)}</p></td>
                <td class="px-5 py-4"><p class="text-slate-200">${esc(b.serviceName)}</p><p class="mt-1 text-xs text-slate-400">${esc(b.dentistName)}</p>${b.reason ? `<p class="mt-2 max-w-xs text-xs text-slate-500">${esc(b.reason)}</p>` : ""}</td>
                <td class="px-5 py-4 whitespace-nowrap"><p class="text-slate-200">${esc(b.date)}</p><p class="mt-1 text-slate-400">${esc(b.timeSlot)}</p></td>
                <td class="px-5 py-4"><span class="rounded-lg bg-white/5 px-2 py-1 font-mono text-xs text-sky-200">${esc(b.reference)}</span></td>
                <td class="px-5 py-4">${statusBadge(b.status)}</td>
                <td class="px-5 py-4">
                  <div class="flex min-w-44 flex-col gap-2">
                    <select data-status-select="${esc(b._id)}" class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white">
                      ${["Pending","Confirmed","Completed","Cancelled","Rejected"].map(s => `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`).join("")}
                    </select>
                    <button data-save-status="${esc(b._id)}" class="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:brightness-110">Save status</button>
                  </div>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>`;
      container.querySelectorAll("[data-save-status]").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-save-status");
          const select = container.querySelector(`[data-status-select="${CSS.escape(id)}"]`);
          if (!select) return;
          const nextStatus = select.value;
          const oldText = button.textContent;
          button.disabled = true;
          button.textContent = "Saving…";
          try {
            await api(`/api/admin/bookings/${encodeURIComponent(id)}/status`, {
              method: "PATCH",
              body: { status: nextStatus }
            });
            showMessage(`Booking status updated to ${nextStatus}.`, "success");
            await refreshData();
          } catch (error) {
            showMessage(error.message || "Could not update booking status.");
          } finally {
            button.disabled = false;
            button.textContent = oldText;
          }
        });
      });
    }

    const info = document.getElementById("paginationInfo");
    if (info) info.textContent = `${state.bookings.length} shown · page ${state.page} of ${Math.max(state.pages, 1)}`;
    const prev = document.getElementById("prevPage");
    const next = document.getElementById("nextPage");
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= state.pages;
    [prev, next].forEach((button) => {
      if (button) button.classList.toggle("opacity-40", button.disabled);
    });
  }

  async function refreshMetrics() {
    const data = await api("/api/admin/dashboard");
    state.metrics = data.metrics || state.metrics;
    renderMetrics();
  }

  async function refreshBookings() {
    const params = new URLSearchParams({
      page: String(state.page),
      limit: "10",
      search: state.search,
      status: state.status,
      date: state.date
    });
    const data = await api(`/api/admin/bookings?${params.toString()}`);
    state.bookings = Array.isArray(data.bookings) ? data.bookings : [];
    state.pages = Math.max(1, Number(data.pagination?.pages) || 1);
    renderBookings();
  }

  async function refreshData() {
    clearMessage();
    const container = document.getElementById("bookingsContainer");
    if (container) container.innerHTML = `<div class="p-10 text-center text-slate-400">Loading appointments…</div>`;
    try {
      await Promise.all([refreshMetrics(), refreshBookings()]);
    } catch (error) {
      if (error.message && /unauthorized/i.test(error.message)) {
        renderLogin("Your session expired. Please sign in again.");
      } else {
        showMessage(error.message || "Unable to load dashboard data.");
        if (container) container.innerHTML = `<div class="p-10 text-center text-rose-200">Could not load appointments. Check the Vercel Runtime Logs and MongoDB connection.</div>`;
      }
    }
  }

  async function loadDashboard() {
    try {
      const me = await api("/api/admin/me");
      state.user = me.user || { username: "admin" };
      renderShell();
      await refreshData();
    } catch {
      state.user = null;
      renderLogin();
    }
  }

  async function logout() {
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch (error) {
      console.warn("Logout request failed:", error);
    }
    state.user = null;
    state.bookings = [];
    renderLogin();
  }

  loadDashboard();
})();
