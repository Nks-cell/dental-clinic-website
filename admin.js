(function () {
  const appContainer = document.getElementById("adminApp");
  let currentAdmin = null;
  let bookingsData = [];
  let paginationInfo = { page: 1, pages: 1, total: 0 };
  let currentFilters = { search: "", status: "All", date: "" };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    await checkAuthStatus();
  }

  async function checkAuthStatus() {
    try {
      const res = await fetch("/api/admin/me");
      if (res.ok) {
        const data = await res.json();
        currentAdmin = data.user;
        renderDashboardLayout();
        loadDashboardData();
      } else {
        renderLoginView();
      }
    } catch (err) {
      renderLoginView();
    }
  }

  function renderLoginView() {
    appContainer.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="glass-card p-8 sm:p-10 rounded-3xl w-full max-w-md border border-slate-700/50 shadow-2xl relative">
          <div class="text-center space-y-2 mb-8">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 mx-auto flex items-center justify-center text-white text-2xl shadow-lg shadow-sky-500/30">
              <i class="fa-solid fa-tooth"></i>
            </div>
            <h1 class="text-2xl font-bold text-white pt-2">Admin Portal</h1>
            <p class="text-xs text-slate-400">DentalCare Smile Studio Management</p>
          </div>

          <form id="adminLoginForm" class="space-y-5">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Username</label>
              <input type="text" id="adminUsername" required placeholder="admin" class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500">
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Password</label>
              <input type="password" id="adminPassword" required placeholder="••••••••" class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500">
            </div>

            <div id="loginError" class="hidden p-3 rounded-xl text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30"></div>

            <button type="submit" id="loginBtn" class="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg">
              Sign In to Dashboard
            </button>
          </form>

          <div class="mt-6 text-center">
            <a href="/" class="text-xs text-slate-400 hover:text-sky-400 transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Patient Website</a>
          </div>
        </div>
      </div>
    `;

    document
      .getElementById("adminLoginForm")
      .addEventListener("submit", handleLoginSubmit);
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const errorBox = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginBtn");
    errorBox.classList.add("hidden");

    const username = document.getElementById("adminUsername").value;
    const password = document.getElementById("adminPassword").value;

    loginBtn.disabled = true;
    loginBtn.innerHTML =
      '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Authenticating...';

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      await checkAuthStatus();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("hidden");
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = "Sign In to Dashboard";
    }
  }

  function renderDashboardLayout() {
    appContainer.innerHTML = `
      <div class="min-h-screen flex flex-col">
        <!-- Admin Top Navigation -->
        <header class="glass-card border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white font-bold">
              <i class="fa-solid fa-tooth text-base"></i>
            </div>
            <div>
              <span class="text-base font-bold text-white block leading-tight">DentalCare Admin</span>
              <span class="text-xs text-sky-400 font-medium">Control Dashboard</span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <a href="/" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
              <i class="fa-solid fa-globe"></i> View Website
            </a>
            <button id="logoutBtn" class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold px-3 py-2 rounded-lg border border-rose-500/30 transition flex items-center gap-1.5">
              <i class="fa-solid fa-right-from-bracket"></i> Logout
            </button>
          </div>
        </header>

        <!-- Main Body Content -->
        <main class="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
          <!-- Notification Banner -->
          <div id="adminNotice" class="hidden p-4 rounded-2xl glass-card text-xs sm:text-sm border flex items-center justify-between">
            <span id="adminNoticeText"></span>
            <button onclick="document.getElementById('adminNotice').classList.add('hidden')" class="text-slate-400 hover:text-white ml-4"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- Metrics Stat Cards -->
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4" id="metricsGrid">
            <div class="glass-card p-4 rounded-2xl border border-slate-800">
              <span class="text-xs text-slate-400 block font-medium">Total Bookings</span>
              <span id="metricTotal" class="text-2xl font-extrabold text-white mt-1 block">--</span>
            </div>
            <div class="glass-card p-4 rounded-2xl border border-amber-500/30">
              <span class="text-xs text-amber-400 block font-medium">Pending Requests</span>
              <span id="metricPending" class="text-2xl font-extrabold text-amber-300 mt-1 block">--</span>
            </div>
            <div class="glass-card p-4 rounded-2xl border border-emerald-500/30">
              <span class="text-xs text-emerald-400 block font-medium">Confirmed</span>
              <span id="metricConfirmed" class="text-2xl font-extrabold text-emerald-300 mt-1 block">--</span>
            </div>
            <div class="glass-card p-4 rounded-2xl border border-blue-500/30">
              <span class="text-xs text-blue-400 block font-medium">Completed</span>
              <span id="metricCompleted" class="text-2xl font-extrabold text-blue-300 mt-1 block">--</span>
            </div>
            <div class="glass-card p-4 rounded-2xl border border-purple-500/30 col-span-2 md:col-span-1">
              <span class="text-xs text-purple-400 block font-medium">Today's Appointments</span>
              <span id="metricToday" class="text-2xl font-extrabold text-purple-300 mt-1 block">--</span>
            </div>
          </div>

          <!-- Filters & Controls Bar -->
          <div class="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
              <div class="relative flex-1">
                <i class="fa-solid fa-search absolute left-3.5 top-3.5 text-slate-500 text-xs"></i>
                <input type="text" id="searchInput" placeholder="Search customer, phone, ref, service..." class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500">
              </div>

              <select id="statusFilter" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500">
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Rejected">Rejected</option>
              </select>

              <input type="date" id="dateFilter" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500">
            </div>

            <div class="flex gap-2 w-full md:w-auto justify-end">
              <button id="resetFiltersBtn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition">
                Clear Filters
              </button>
              <button id="refreshBtn" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1">
                <i class="fa-solid fa-rotate-right"></i> Refresh
              </button>
            </div>
          </div>

          <!-- Bookings Table -->
          <div class="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th class="p-4">Reference & Date</th>
                    <th class="p-4">Customer Details</th>
                    <th class="p-4">Treatment & Doctor</th>
                    <th class="p-4">Slot</th>
                    <th class="p-4">Status</th>
                    <th class="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="bookingsTableBody" class="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td colspan="6" class="p-8 text-center text-slate-500">Loading appointments...</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Footer -->
            <div class="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span id="paginationSummary">Showing 0 of 0 bookings</span>
              <div class="flex gap-2" id="paginationControls"></div>
            </div>
          </div>
        </main>
      </div>

      <!-- Reschedule Modal -->
      <div id="rescheduleModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="glass-card p-6 rounded-2xl max-w-md w-full border border-slate-700 space-y-4">
          <div class="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 class="font-bold text-white text-base">Reschedule Appointment</h3>
            <button onclick="closeRescheduleModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form id="rescheduleForm" class="space-y-4">
            <input type="hidden" id="rescheduleBookingId">
            <div>
              <label class="block text-xs text-slate-400 mb-1">New Date</label>
              <input type="date" id="rescheduleDate" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">New Time Slot</label>
              <select id="rescheduleSlot" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                <option value="">Select slot</option>
                <option value="09:00 AM">09:00 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="02:00 PM">02:00 PM</option>
                <option value="03:00 PM">03:00 PM</option>
                <option value="04:00 PM">04:00 PM</option>
                <option value="05:00 PM">05:00 PM</option>
              </select>
            </div>

            <div id="rescheduleError" class="hidden p-2 rounded text-xs bg-rose-500/20 text-rose-300"></div>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="closeRescheduleModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document
      .getElementById("logoutBtn")
      .addEventListener("click", handleLogout);
    document
      .getElementById("searchInput")
      .addEventListener("input", debounce(handleFilterChange, 400));
    document
      .getElementById("statusFilter")
      .addEventListener("change", handleFilterChange);
    document
      .getElementById("dateFilter")
      .addEventListener("change", handleFilterChange);
    document
      .getElementById("resetFiltersBtn")
      .addEventListener("click", resetFilters);
    document
      .getElementById("refreshBtn")
      .addEventListener("click", loadDashboardData);
    document
      .getElementById("rescheduleForm")
      .addEventListener("submit", handleRescheduleSubmit);
  }

  async function loadDashboardData() {
    await Promise.all([fetchMetrics(), fetchBookings()]);
  }

  async function fetchMetrics() {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) return;
      const data = await res.json();
      const m = data.metrics;

      document.getElementById("metricTotal").textContent = m.total;
      document.getElementById("metricPending").textContent = m.pending;
      document.getElementById("metricConfirmed").textContent = m.confirmed;
      document.getElementById("metricCompleted").textContent = m.completed;
      document.getElementById("metricToday").textContent = m.today;
    } catch (err) {
      console.error("Failed to load metrics:", err);
    }
  }

  async function fetchBookings(page = 1) {
    try {
      const query = new URLSearchParams({
        page,
        limit: 10,
        search: currentFilters.search,
        status: currentFilters.status,
        date: currentFilters.date,
      });

      const res = await fetch(`/api/admin/bookings?${query.toString()}`);
      if (!res.ok) return;
      const data = await res.json();

      bookingsData = data.bookings;
      paginationInfo = data.pagination;

      renderBookingsTable();
      renderPaginationControls();
    } catch (err) {
      console.error("Failed to load bookings:", err);
    }
  }

  function renderBookingsTable() {
    const tbody = document.getElementById("bookingsTableBody");

    if (!bookingsData || bookingsData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-slate-500">
            No appointment records found matching your filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = bookingsData
      .map((b) => {
        let badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
        if (b.status === "Confirmed")
          badgeClass =
            "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
        if (b.status === "Completed")
          badgeClass = "bg-blue-500/20 text-blue-300 border-blue-500/30";
        if (b.status === "Cancelled" || b.status === "Rejected")
          badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/30";

        return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-4">
            <span class="font-mono font-bold text-sky-400 block">${b.reference}</span>
            <span class="text-slate-400 text-[11px]">${b.date}</span>
          </td>
          <td class="p-4">
            <span class="font-bold text-white block">${escapeHtml(b.fullName)}</span>
            <span class="text-slate-400 block text-[11px]"><i class="fa-solid fa-phone mr-1"></i>${escapeHtml(b.phone)}</span>
            <span class="text-slate-400 block text-[11px]"><i class="fa-solid fa-envelope mr-1"></i>${escapeHtml(b.email)}</span>
          </td>
          <td class="p-4">
            <span class="text-white font-medium block">${escapeHtml(b.serviceName)}</span>
            <span class="text-slate-400 text-[11px]">${escapeHtml(b.dentistName)}</span>
          </td>
          <td class="p-4 font-semibold text-white">
            ${b.timeSlot}
          </td>
          <td class="p-4">
            <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeClass}">
              ${b.status}
            </span>
          </td>
          <td class="p-4 text-right space-x-1">
            ${
              b.status === "Pending"
                ? `
              <button onclick="updateStatus('${b._id}', 'Confirmed')" class="px-2.5 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white font-semibold text-[11px] transition">Confirm</button>
              <button onclick="updateStatus('${b._id}', 'Rejected')" class="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-semibold text-[11px] transition">Reject</button>
            `
                : ""
            }

            ${
              b.status === "Confirmed"
                ? `
              <button onclick="updateStatus('${b._id}', 'Completed')" class="px-2.5 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white font-semibold text-[11px] transition">Complete</button>
              <button onclick="openRescheduleModal('${b._id}', '${b.date}')" class="px-2.5 py-1 rounded bg-purple-600/80 hover:bg-purple-500 text-white font-semibold text-[11px] transition">Reschedule</button>
              <button onclick="updateStatus('${b._id}', 'Cancelled')" class="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold text-[11px] transition">Cancel</button>
            `
                : ""
            }
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function renderPaginationControls() {
    const summary = document.getElementById("paginationSummary");
    const controls = document.getElementById("paginationControls");

    summary.textContent = `Page ${paginationInfo.page} of ${paginationInfo.pages} (${paginationInfo.total} total bookings)`;

    let btns = "";
    for (let i = 1; i <= paginationInfo.pages; i++) {
      const active =
        i === paginationInfo.page
          ? "bg-sky-600 text-white"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700";
      btns += `<button onclick="changePage(${i})" class="px-3 py-1 rounded-lg ${active} text-xs font-semibold">${i}</button>`;
    }
    controls.innerHTML = btns;
  }

  window.changePage = function (page) {
    fetchBookings(page);
  };

  window.updateStatus = async function (id, newStatus) {
    try {
      const res = await fetch(`/api/admin/bookings/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotice(
        data.notificationNotice || "Status updated successfully",
        "success",
      );
      loadDashboardData();
    } catch (err) {
      showNotice(err.message, "error");
    }
  };

  window.openRescheduleModal = function (id, currentDate) {
    document.getElementById("rescheduleBookingId").value = id;
    document.getElementById("rescheduleDate").value = currentDate;
    document.getElementById("rescheduleError").classList.add("hidden");
    document.getElementById("rescheduleModal").classList.remove("hidden");
  };

  window.closeRescheduleModal = function () {
    document.getElementById("rescheduleModal").classList.add("hidden");
  };

  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("rescheduleBookingId").value;
    const date = document.getElementById("rescheduleDate").value;
    const timeSlot = document.getElementById("rescheduleSlot").value;
    const errBox = document.getElementById("rescheduleError");

    try {
      const res = await fetch(`/api/admin/bookings/${id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, timeSlot }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      closeRescheduleModal();
      showNotice("Appointment rescheduled successfully", "success");
      loadDashboardData();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove("hidden");
    }
  }

  function handleFilterChange() {
    currentFilters.search = document.getElementById("searchInput").value;
    currentFilters.status = document.getElementById("statusFilter").value;
    currentFilters.date = document.getElementById("dateFilter").value;
    fetchBookings(1);
  }

  function resetFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("statusFilter").value = "All";
    document.getElementById("dateFilter").value = "";
    currentFilters = { search: "", status: "All", date: "" };
    fetchBookings(1);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    currentAdmin = null;
    renderLoginView();
  }

  function showNotice(msg, type = "info") {
    const notice = document.getElementById("adminNotice");
    const noticeText = document.getElementById("adminNoticeText");
    noticeText.textContent = msg;

    if (type === "error") {
      notice.className =
        "p-4 rounded-2xl glass-card text-xs sm:text-sm border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center justify-between";
    } else {
      notice.className =
        "p-4 rounded-2xl glass-card text-xs sm:text-sm border border-sky-500/30 bg-sky-500/10 text-sky-300 flex items-center justify-between";
    }

    notice.classList.remove("hidden");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
})();
