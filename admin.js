(() => {
  "use strict";

  const app = document.getElementById("adminApp");
  if (!app) {
    console.error("Admin Portal: #adminApp element not found.");
    return;
  }

  const state = {
    appointments: [],
    user: null,
    search: "",
    filter: "All",
    loading: false,
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  async function api(url, method = "GET", body = null) {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : { error: (await response.text()).slice(0, 300) };

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }

  function message(text, success = false) {
    const box = document.getElementById("adminMessage");
    if (!box) return;

    box.textContent = text;
    box.className = success
      ? "mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200"
      : "mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-200";
  }

  function renderLogin(error = "") {
    app.innerHTML = `
      <main class="flex min-h-screen items-center justify-center px-4 py-10">
        <section class="w-full max-w-md rounded-3xl border border-white/10
          bg-white/[0.06] p-8 shadow-2xl backdrop-blur-xl">
          <a href="/" class="text-sm text-sky-300">← Back to website</a>

          <div class="mb-8 mt-7">
            <div class="mb-4 grid h-14 w-14 place-items-center rounded-2xl
              bg-gradient-to-br from-sky-400 to-indigo-500 text-2xl">✦</div>
            <p class="text-xs uppercase tracking-[0.2em] text-sky-300">
              DentalCare Smile Studio
            </p>
            <h1 class="mt-2 text-3xl font-bold text-white">Admin Portal</h1>
            <p class="mt-2 text-sm text-slate-400">
              Sign in to manage clinic appointments.
            </p>
          </div>

          <div id="loginError" role="alert"
            class="${error ? "" : "hidden"} mb-4 rounded-xl
            border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
            ${escapeHTML(error)}
          </div>

          <form id="loginForm" class="space-y-5">
            <div>
              <label for="username" class="mb-2 block text-sm text-slate-200">
                Username
              </label>
              <input id="username" name="username" required
                autocomplete="username"
                class="w-full rounded-xl border border-white/10 bg-slate-950/70
                px-4 py-3 text-white outline-none focus:border-sky-400"
                placeholder="Enter admin username">
            </div>

            <div>
              <label for="password" class="mb-2 block text-sm text-slate-200">
                Password
              </label>
              <input id="password" name="password" type="password" required
                autocomplete="current-password"
                class="w-full rounded-xl border border-white/10 bg-slate-950/70
                px-4 py-3 text-white outline-none focus:border-sky-400"
                placeholder="Enter admin password">
            </div>

            <button id="loginButton" type="submit"
              class="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500
              px-5 py-3.5 font-semibold text-white hover:brightness-110">
              Sign in securely
            </button>
            <p class="text-xs leading-5 text-slate-500">
              Use the administrator credentials configured on your server.
            </p>
          </form>
        </section>
      </main>`;

    document
      .getElementById("loginForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const button = document.getElementById("loginButton");
        const errorBox = document.getElementById("loginError");
        button.disabled = true;
        button.textContent = "Signing in...";
        errorBox.classList.add("hidden");

        try {
          await api("/api/admin/login", "POST", {
            username: document.getElementById("username").value.trim(),
            password: document.getElementById("password").value,
          });

          await loadDashboard();
        } catch (error) {
          errorBox.textContent = error.message;
          errorBox.classList.remove("hidden");
          button.disabled = false;
          button.textContent = "Sign in securely";
        }
      });
  }

  function renderDashboard() {
    app.innerHTML = `
      <div class="min-h-screen">
        <header class="sticky top-0 z-10 border-b border-white/10
          bg-slate-950/90 backdrop-blur-xl">
          <div class="mx-auto flex max-w-7xl items-center justify-between
            gap-3 px-4 py-4 sm:px-6">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-sky-300">
                DentalCare
              </p>
              <h1 class="text-xl font-bold text-white">Admin Dashboard</h1>
            </div>
            <div class="flex gap-2">
              <a href="/" class="rounded-xl border border-white/10 px-3 py-2
                text-sm text-white hover:bg-white/10">View Site</a>
              <button id="logoutButton" class="rounded-xl border
                border-rose-300/20 px-3 py-2 text-sm text-rose-200
                hover:bg-rose-400/10">Logout</button>
            </div>
          </div>
        </header>

        <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="text-sm text-sky-300">CLINIC MANAGEMENT</p>
              <h2 class="mt-2 text-3xl font-bold text-white">
                Appointments
              </h2>
              <p class="mt-2 text-sm text-slate-400">
                Review bookings and manage their status.
              </p>
            </div>
            <button id="refreshButton" class="rounded-xl border
              border-white/10 bg-white/5 px-4 py-3 text-sm text-white
              hover:bg-white/10">↻ Refresh</button>
          </div>

          <div id="adminMessage" class="mb-5 hidden" role="status"></div>

          <section id="stats" class="mb-7 grid grid-cols-2 gap-4
            lg:grid-cols-4"></section>

          <section class="overflow-hidden rounded-2xl border border-white/10
            bg-white/[0.04]">
            <div class="grid gap-3 border-b border-white/10 p-4
              md:grid-cols-[1fr_200px_auto]">
              <input id="searchInput" placeholder="Search patient, phone, email..."
                class="min-w-0 rounded-xl border border-white/10
                bg-slate-950/70 px-4 py-3 text-sm text-white outline-none
                focus:border-sky-400">
              <select id="statusFilter" class="rounded-xl border
                border-white/10 bg-slate-950 px-3 py-3 text-sm text-white">
                <option>All</option>
                <option>Pending</option>
                <option>Confirmed</option>
                <option>Completed</option>
                <option>Cancelled</option>
                <option>Rejected</option>
              </select>
              <button id="applyFilters" class="rounded-xl bg-sky-500
                px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400">
                Search
              </button>
            </div>

            <div id="appointmentList" class="overflow-x-auto">
              <p class="p-8 text-center text-slate-400">Loading bookings...</p>
            </div>
          </section>

          <p class="mt-5 text-xs leading-5 text-slate-500">
            Patient details are confidential. Status updates are saved through
            the server. WhatsApp notifications require separate backend setup.
          </p>
        </main>
      </div>`;

    document.getElementById("logoutButton").onclick = logout;
    document.getElementById("refreshButton").onclick = loadAppointments;

    document.getElementById("applyFilters").onclick = () => {
      state.search = document
        .getElementById("searchInput")
        .value.trim()
        .toLowerCase();
      state.filter = document.getElementById("statusFilter").value;
      renderAppointments();
    };

    document.getElementById("searchInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        document.getElementById("applyFilters").click();
      }
    });
  }

  function getStatus(appointment) {
    return String(appointment.status || "Pending");
  }

  function renderStats() {
    const all = state.appointments;
    const stats = [
      ["Total bookings", all.length],
      ["Pending", all.filter((a) => getStatus(a) === "Pending").length],
      ["Confirmed", all.filter((a) => getStatus(a) === "Confirmed").length],
      ["Completed", all.filter((a) => getStatus(a) === "Completed").length],
    ];

    document.getElementById("stats").innerHTML = stats
      .map(
        ([label, count]) => `
      <article class="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p class="text-sm text-slate-400">${label}</p>
        <p class="mt-3 text-3xl font-bold text-white">${count}</p>
      </article>
    `,
      )
      .join("");
  }

  function renderAppointments() {
    const list = document.getElementById("appointmentList");
    if (!list) return;

    const filtered = state.appointments.filter((a) => {
      const searchable = [
        a.fullName,
        a.name,
        a.phone,
        a.email,
        a.serviceName,
        a.service,
        a.reference,
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchable.includes(state.search) &&
        (state.filter === "All" || getStatus(a) === state.filter)
      );
    });

    if (!filtered.length) {
      list.innerHTML = `
        <div class="p-10 text-center">
          <p class="text-lg font-semibold text-white">No appointments found</p>
          <p class="mt-2 text-sm text-slate-400">
            Try another search or refresh the list.
          </p>
        </div>`;
      renderStats();
      return;
    }

    list.innerHTML = `
      <table class="w-full min-w-[950px] text-left text-sm">
        <thead class="bg-slate-950/60 text-xs uppercase text-slate-400">
          <tr>
            <th class="px-5 py-4">Patient</th>
            <th class="px-5 py-4">Treatment</th>
            <th class="px-5 py-4">Date / Time</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Change status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          ${filtered
            .map((a) => {
              const id = a._id || a.id;
              const status = getStatus(a);
              const name = a.fullName || a.name || "Patient";
              const service = a.serviceName || a.service || "Not specified";

              return `
              <tr class="align-top hover:bg-white/[0.03]">
                <td class="px-5 py-4">
                  <p class="font-semibold text-white">${escapeHTML(name)}</p>
                  <p class="mt-1 text-slate-400">${escapeHTML(a.phone)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHTML(a.email)}</p>
                </td>
                <td class="px-5 py-4 text-slate-200">
                  ${escapeHTML(service)}
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-slate-300">
                  ${escapeHTML(a.date)}
                  <p class="mt-1 text-slate-400">${escapeHTML(a.timeSlot || a.time)}</p>
                </td>
                <td class="px-5 py-4">
                  <span class="rounded-full border border-white/10
                    bg-white/5 px-3 py-1 text-xs text-slate-200">
                    ${escapeHTML(status)}
                  </span>
                </td>
                <td class="px-5 py-4">
                  <div class="flex min-w-40 flex-col gap-2">
                    <select data-status="${escapeHTML(id)}"
                      class="rounded-lg border border-white/10 bg-slate-950
                      px-3 py-2 text-white">
                      ${[
                        "Pending",
                        "Confirmed",
                        "Completed",
                        "Cancelled",
                        "Rejected",
                      ]
                        .map(
                          (s) =>
                            `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`,
                        )
                        .join("")}
                    </select>
                    <button data-save="${escapeHTML(id)}"
                      class="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500
                      px-3 py-2 font-semibold text-white hover:brightness-110">
                      Save status
                    </button>
                  </div>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

    list.querySelectorAll("[data-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.save;
        const select = list.querySelector(`[data-status="${CSS.escape(id)}"]`);
        if (!id || !select) {
          message("Booking ID missing. Check the API response.");
          return;
        }

        button.disabled = true;
        button.textContent = "Saving...";

        try {
          await api(
            `/api/admin/bookings/${encodeURIComponent(id)}/status`,
            "PATCH",
            { status: select.value },
          );

          message("Appointment status updated successfully.", true);
          await loadAppointments();
        } catch (error) {
          message(error.message || "Could not update appointment.");
        } finally {
          button.disabled = false;
          button.textContent = "Save status";
        }
      });
    });

    renderStats();
  }

  async function loadAppointments() {
    if (state.loading) return;
    state.loading = true;

    const list = document.getElementById("appointmentList");
    if (list) {
      list.innerHTML = `<p class="p-8 text-center text-slate-400">Loading...</p>`;
    }

    try {
      const data = await api("/api/admin/bookings");

      state.appointments = Array.isArray(data)
        ? data
        : Array.isArray(data.appointments)
          ? data.appointments
          : Array.isArray(data.bookings)
            ? data.bookings
            : [];

      renderAppointments();
    } catch (error) {
      if (list) {
        list.innerHTML = `
          <div class="p-8 text-center text-rose-200">
            <p class="font-semibold">Unable to load appointments</p>
            <p class="mt-2 text-sm">${escapeHTML(error.message)}</p>
            <p class="mt-2 text-xs text-slate-400">
              Check the backend endpoint and Vercel Runtime Logs.
            </p>
          </div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  async function loadDashboard() {
    try {
      const data = await api("/api/admin/me");
      state.user = data.user || data;
      renderDashboard();
      await loadAppointments();
    } catch {
      state.user = null;
      renderLogin();
    }
  }

  async function logout() {
    try {
      await api("/api/admin/logout", "POST");
    } catch (error) {
      console.warn("Logout endpoint failed:", error.message);
    }

    state.user = null;
    state.appointments = [];
    renderLogin();
  }

  loadDashboard();
})();
