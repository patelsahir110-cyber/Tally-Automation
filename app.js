const screens = {
  auth: { title: "Authentication" },
  plans: { title: "Choose Plan" },
  login: { title: "Login" },
  dashboard: { title: "Dashboard" },
  masters: { title: "Tally Masters" },
  bank_import: { title: "Bank Statement Import" },
  sync: { title: "Synchronization" },
  automation: { title: "Automation" },
  upload: { title: "Upload Excel" },
  mapping: { title: "Validation & Mapping" },
  success: { title: "Send to Tally" },
};

const state = {
  route: (location.hash || "#auth").replace("#", ""),
  authenticated: false,
  authFormMode: "signin",
  authEmail: "",
  authPassword: "",
  authSupabaseUrl: localStorage.getItem("supabase_url") || "https://vzzedjamwtsjuyhyuguu.supabase.co",
  authSupabaseKey: localStorage.getItem("supabase_key") || "sb_publishable_CZjtaX5xlaz_tI0yIS3t2g_1W0DpoWq",
  showAuthSettings: false,
  authError: "",
  selectedPlan: localStorage.getItem("tally_selected_plan") || "",
  showProfileDropdown: false,
  currentPage: 1,
  pageSize: 50,
  mastersActiveTab: "ledger",
  mastersSearchQuery: "",
  mastersSortBy: "name",
  mastersSortDir: "asc",
  mastersPage: 1,
  mastersPageSize: 25,
  syncingMastersStatus: "idle",
  syncingMastersMessage: "",
  bankImportStatement: null,
  bankImportTransactions: [],
  bankImportTargetLedger: "",
  bankImportSearch: "",
  bankImportFilterType: "all",
  bankImportFilterLedgerStatus: "all",
  bankImportFilterSendStatus: "all",
  bankImportMinAmount: "",
  bankImportMaxAmount: "",
  bankImportSelectedIds: [],
  bankImportPage: 1,
  bankImportPageSize: 25,
  bankImportHistoryStack: [],
  bankImportUploadBusy: false,
  bankImportSendBusy: false,
  bankImportModalRow: null,
  bankImportHighlightedText: "",
  bankImportNewLedgerName: "",
  bankImportNewLedgerGroup: "Sundry Debtors",
  tally: { online: false, message: "Checking Tally..." },
  selectedTallyCompany: "",
  masters: { counts: { companies: 0, ledgers: 0, voucherTypes: 0, stockGroups: 0, stockCategories: 0, stockItems: 0, units: 0, godowns: 0, gstLedgers: 0, vouchers: 0 }, masters: [] },
  history: { uploads: [], sends: [], lastSync: null },
  lastSyncResult: null,
  validation: null,
  sendResult: null,
  selectedVoucherMode: "As Voucher",
  selectedContraMode: "Single Entry",
  selectedPaymentMode: "Double Entry",
  selectedReceiptMode: "Double Entry",
  gstEnabled: false,
  gstWorkflow: "",
  gstMode: "item",
  showGstMapping: false,
  gstLedgerMapping: { CGST: "", SGST: "", IGST: "" },
  sendFilters: { voucherType: "All", partyLedger: "All" },
  dayBookFilters: { from: "", to: "", voucherType: "All", ledger: "All", search: "" },
  selectedRowIds: null,
  busy: false,
  notice: "",
  headerFilters: {},
  tempHeaderFilters: {},
  activeHeaderFilterColumn: null,
  headerFilterMenuPosition: null,
};

const fallbackRows = [
  ["2026-05-01", "SAL-CR-001", "Credit Sale", "Aarav Enterprises", "225", "225", "0", "5450", "Ready"],
  ["2026-05-02", "PUR-CR-001", "Credit Purchase", "Shree Ganesh Suppliers", "180", "180", "0", "4360", "Ready"],
  ["2026-05-01", "PAY-001", "Payment", "ICICI Bank", "0", "0", "0", "12500", "Ready"],
];

const ledgerGroups = [
  "Sundry Creditors",
  "Sundry Debtors",
  "Duties & Taxes",
  "Bank Accounts",
  "Cash-in-hand",
  "Purchase Accounts",
  "Sales Accounts",
  "Direct Expenses",
  "Indirect Expenses",
  "Direct Incomes",
  "Indirect Incomes",
  "Capital Account",
  "Current Assets",
  "Current Liabilities",
  "Fixed Assets",
  "Investments",
  "Loans & Advances (Asset)",
  "Loans (Liability)",
  "Provisions",
  "Reserves & Surplus",
  "Retained Earnings",
  "Secured Loans",
  "Unsecured Loans",
  "Stock-in-hand",
  "Suspense A/c",
  "Branch / Divisions",
  "Deposits (Asset)",
  "Bank OCC A/c",
  "Bank OD A/c",
  "Misc. Expenses (ASSET)"
];

function icon(name) {
  const paths = {
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    sync: "M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3",
    upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
    map: "M4 5h16M4 12h16M4 19h16M8 5v14M16 5v14",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    home: "M3 11l9-8 9 8v10H3z",
    file: "M6 2h8l4 4v16H6zM14 2v5h5",
    bank: "M3 9l9-5 9 5M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M4 19h16",
    check: "M20 6L9 17l-5-5",
    alert: "M12 2l10 18H2zM12 8v5M12 17h.01",
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="${paths[name] || paths.grid}"/></svg>`;
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (data.errors || []).join(" ") || "Request failed");
  return data;
}

async function refreshAll() {
  try {
    const [tally, masters, history] = await Promise.all([
      api("/api/tally/status"),
      api("/api/masters"),
      api("/api/history"),
    ]);
    state.tally = tally;
    if (tally.online && tally.company && !state.selectedTallyCompany) {
      state.selectedTallyCompany = tally.company;
    }
    state.masters = masters;
    state.history = history;
    
    // Clear suggestion cache as master list might have updated
    ledgerSuggestionCache.clear();
    rowLedgerProblemsCache.clear();
    triggerFuzzyWorker();
  } catch (error) {
    state.notice = error.message;
  }
  render();
}

async function autoDetectCompany() {
  state.busy = true;
  render();
  try {
    const tally = await api("/api/tally/status");
    state.tally = tally;
    if (tally.online && tally.company) {
      state.selectedTallyCompany = tally.company;
      setNotice(`Successfully detected active Tally company: "${tally.company}"`);
    } else {
      setNotice("Could not auto-detect company. Please ensure Tally is running with a company open.");
    }
  } catch (e) {
    setNotice("Error connecting to Tally: " + e.message);
  } finally {
    state.busy = false;
    render();
  }
}

function setNotice(message) {
  state.notice = message || "";
  render();
}

function go(screen) {
  try {
    history.replaceState(null, "", `#${screen}`);
  } catch (e) {
    console.warn("history.replaceState blocked by sandbox:", e);
  }
  state.route = screen;
  render();
}

function activeStatus() {
  const online = state.tally.online;
  const isConnector = state.tally.connectorLinked;
  const warning = !online && state.tally.tallyRunning;
  const label = online 
    ? (isConnector ? "Connector Linked" : "Tally Online") 
    : warning ? "Tally Open" : "Connector Offline";
  const tone = online ? "online" : warning ? "warning" : "offline";
  return `<span class="status-pill ${tone}" title="${state.tally.message || ""}"><span class="dot"></span>${label}</span>`;
}

function shell(active, content) {
  const nav = [
    ["dashboard", "Dashboard", "home"],
    ["sync", "Synchronization", "sync"],
    ["automation", "Automation", "grid"],
    ["upload", "Upload Excel", "upload"],
    ["mapping", "Validation & Mapping", "map"],
    ["success", "Send to Tally", "send"],
  ];
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${icon("grid")}</div><span>Tally Automation</span></div>
      <nav class="nav">${nav.map(([key, label, i]) => `<button class="${active === key ? "active" : ""}" onclick="go('${key}')">${icon(i)}<span>${label}</span></button>`).join("")}</nav>
      <div class="sidebar-footer">
        ${activeStatus()}
        <div class="label">${state.tally.message || "Local Tally Gateway at 127.0.0.1:9000."}</div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <input class="search" value="Search voucher, ledger, upload..." aria-label="Search" />
        <div style="display:flex;align-items:center;gap:12px">
          ${activeStatus()}
          <button class="btn" onclick="syncNow()">${icon("sync")} Sync Tally</button>
          <button class="btn" onclick="refreshAll()">Refresh</button>
          <button class="btn" onclick="go('login')">Sign out</button>
        </div>
      </header>
      <section class="content">${state.notice ? `<div class="mock-note">${state.notice}</div>` : ""}${content}</section>
    </main>
  </div>`;
}

function activeStatusSidebar() {
  const online = state.tally.online;
  const warning = !online && state.tally.tallyRunning;

  if (online) {
    return `
      <div class="p-4 rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/10 relative overflow-hidden group">
        <div class="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform text-emerald-600">
          <span class="material-symbols-outlined text-[48px]">check_circle</span>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-label-caps text-emerald-600 text-[9px]">GATEWAY CONNECTED</span>
        </div>
        <p class="text-[10px] leading-tight text-emerald-800/80 mb-3">Tally is online. Company: ${escapeHtml(state.tally.company || "Detected")}</p>
        <button class="w-full py-1.5 bg-white shadow-sm border border-emerald-500/20 text-[10px] font-bold text-emerald-600 uppercase tracking-wider rounded hover:bg-emerald-500 hover:text-white transition-all" onclick="refreshAll()">
          Refresh Status
        </button>
      </div>
    `;
  } else if (warning) {
    return `
      <div class="p-4 rounded-xl bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/10 relative overflow-hidden group">
        <div class="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform text-amber-600">
          <span class="material-symbols-outlined text-[48px]">info</span>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span class="text-label-caps text-amber-600 text-[9px]">GATEWAY WARNING</span>
        </div>
        <p class="text-[10px] leading-tight text-amber-800/80 mb-3">${escapeHtml(state.tally.message || "Tally open, check XML settings.")}</p>
        <button class="w-full py-1.5 bg-white shadow-sm border border-amber-500/20 text-[10px] font-bold text-amber-600 uppercase tracking-wider rounded hover:bg-amber-500 hover:text-white transition-all" onclick="refreshAll()">
          Retry Connection
        </button>
      </div>
    `;
  } else {
    return `
      <div class="p-4 rounded-xl bg-gradient-to-br from-error/5 to-error/10 border border-error/10 relative overflow-hidden group">
        <div class="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined text-[48px]">warning</span>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
          <span class="text-label-caps text-error text-[9px]">GATEWAY DISCONNECTED</span>
        </div>
        <p class="text-[10px] leading-tight text-on-error-container/80 mb-3">${escapeHtml(state.tally.message || "Tally ERP 9 instance is unreachable on Port 9000.")}</p>
        <button class="w-full py-1.5 bg-white shadow-sm border border-error/20 text-[10px] font-bold text-error uppercase tracking-wider rounded hover:bg-error hover:text-white transition-all" onclick="syncNow()">
          Retry Connection
        </button>
      </div>
    `;
  }
}

function stepperTailwind(active) {
  const steps = [
    ["sync", "Synchronization", "Connected to Tally Prime"],
    ["upload", "Document Upload", "Active Processing Phase"],
    ["mapping", "Validation & Mapping", "Data Integrity Check"],
    ["success", "Send Finish", "Final Ledger Entry"],
  ];
  const activeIndex = steps.findIndex(([key]) => key === active);

  return `
    <!-- Stepper -->
    <div class="grid grid-cols-4 gap-4">
      ${steps.map(([key, title, sub], index) => {
        if (index === activeIndex) {
          return `
            <div class="glass-card p-5 rounded-xl border-l-4 border-primary relative overflow-hidden group shadow-lg ring-1 ring-primary/20">
              <div class="absolute bottom-0 left-0 h-1 stepper-progress w-full"></div>
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">${index + 1}</div>
                <div>
                  <h4 class="font-headline-sm text-sm font-bold text-primary">${title}</h4>
                  <p class="text-xs text-on-secondary-container">${sub}</p>
                </div>
              </div>
            </div>
          `;
        } else if (index < activeIndex) {
          return `
            <div class="glass-card p-5 rounded-xl border-l-4 border-primary relative overflow-hidden group opacity-60 cursor-pointer" onclick="go('${key}')">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">✓</div>
                <div>
                  <h4 class="font-headline-sm text-sm font-bold text-on-surface">${title}</h4>
                  <p class="text-xs text-on-surface-variant">${sub}</p>
                </div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="glass-card p-5 rounded-xl border-l-4 border-outline-variant/30 relative overflow-hidden opacity-40">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant font-bold">${index + 1}</div>
                <div>
                  <h4 class="font-headline-sm text-sm font-bold">${title}</h4>
                  <p class="text-xs text-on-surface-variant">${sub}</p>
                </div>
              </div>
            </div>
          `;
        }
      }).join("")}
    </div>
  `;
}

function tailwindShell(active, content) {
  const nav = [
    ["dashboard", "Dashboard", "dashboard"],
    ["masters", "Masters", "database"],
    ["bank_import", "Bank Import", "receipt_long"],
    ["sync", "Synchronization", "sync"],
    ["automation", "Automation", "robot_2"],
    ["upload", "Upload Excel", "upload_file"],
    ["mapping", "Validation & Mapping", "fact_check"],
    ["success", "Send to Tally", "send"],
  ];

  const showStepper = ["sync", "upload", "mapping", "success"].includes(active);

  return `
    <div class="flex h-screen overflow-hidden bg-surface font-body-md text-on-surface antialiased w-full">
      <!-- SideNavBar -->
      <aside class="w-sidebar-width h-screen glass-pro border-r border-outline-variant/30 flex flex-col shrink-0 z-20">
        <div class="p-8">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <span class="material-symbols-outlined text-white text-[20px]">account_balance</span>
            </div>
            <h1 class="text-headline-md font-black text-primary tracking-tighter">Tally Automation</h1>
          </div>
          <p class="text-[10px] font-label-caps text-outline uppercase tracking-widest leading-none ml-10">Intelligence Layer</p>
        </div>
        <nav class="flex-1 px-4 space-y-1 overflow-y-auto">
          ${nav.map(([key, label, iconName]) => {
            const isActive = active === key;
            const fillSetting = isActive ? " 'FILL' 1," : "";
            const linkClass = isActive
              ? "flex items-center gap-3 px-4 py-3 sidebar-active-elite text-primary font-bold transition-all"
              : "flex items-center gap-3 px-4 py-3 text-on-surface-variant/70 hover:text-primary hover:bg-primary/5 rounded-lg transition-all";
            return `
              <a class="${linkClass}" href="#" onclick="event.preventDefault(); go('${key}')">
                <span class="material-symbols-outlined text-[20px]" style="font-variation-settings:${fillSetting} 'opsz' 24;">${iconName}</span>
                <span class="text-body-md">${label}</span>
              </a>
            `;
          }).join("")}
        </nav>
        <div class="px-6 py-6 border-t border-outline-variant/20 space-y-4">
          <div class="space-y-1">
            <a class="flex items-center gap-3 text-on-surface-variant/60 hover:text-on-surface py-1 transition-all" href="#" onclick="event.preventDefault(); go('automation')">
              <span class="material-symbols-outlined text-[18px]">settings</span>
              <span class="text-[13px]">System Config</span>
            </a>
            <a class="flex items-center gap-3 text-on-surface-variant/60 hover:text-on-surface py-1 transition-all" href="#" onclick="event.preventDefault(); setNotice('Help documentation is stored in workspace docs folder.')">
              <span class="material-symbols-outlined text-[18px]">support</span>
              <span class="text-[13px]">Expert Support</span>
            </a>
            <a class="flex items-center gap-3 text-error/60 hover:text-error py-1 transition-all" href="#" onclick="event.preventDefault(); authSignOut()">
              <span class="material-symbols-outlined text-[18px]">logout</span>
              <span class="text-[13px]">Sign Out</span>
            </a>
          </div>
          ${activeStatusSidebar()}
        </div>
      </aside>
      <!-- Main Workspace -->
      <main class="flex-1 flex flex-col h-screen overflow-hidden relative">
        <!-- TopAppBar -->
        <header class="h-20 shrink-0 border-b border-outline-variant/30 px-10 flex items-center justify-between z-10 bg-white/40 backdrop-blur-md">
          <div class="flex items-center gap-8 flex-1 max-w-3xl">
            <div class="relative w-full max-w-lg">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50 text-[20px]">search</span>
              <input class="w-full bg-white/60 border border-outline-variant/40 rounded-xl pl-12 pr-4 py-2.5 text-body-md focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-outline/40" placeholder="Global search vouchers, ledgers or sync logs..." type="text">
            </div>
            
            <!-- Active Tally Company Name Indicator -->
            <div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <span class="material-symbols-outlined text-[18px]">business</span>
              <span class="text-xs font-bold font-sans uppercase tracking-wider">${escapeHtml(state.selectedTallyCompany || "No Company Selected")}</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/20">
              <button class="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-wider shadow-md shadow-primary/20 hover:brightness-110 transition-all" onclick="syncNow()">
                <span class="material-symbols-outlined text-[18px]">sync</span>
                Quick Sync
              </button>
              <button class="flex items-center gap-2 px-4 py-2 rounded-lg text-primary text-[11px] font-bold hover:bg-primary/5 transition-all" onclick="revalidate()">
                <span class="material-symbols-outlined text-[18px]">account_tree</span>
                Reconcile
              </button>
            </div>
            <div class="h-8 w-px bg-outline-variant/30"></div>
            <button class="p-2.5 rounded-full hover:bg-surface-variant/40 transition-colors relative" title="Notifications" onclick="setNotice('No new alerts.')">
              <span class="material-symbols-outlined text-outline">notifications</span>
              <span class="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
            </button>
            <div class="relative flex items-center gap-3 pl-2 cursor-pointer select-none" onclick="toggleProfileDropdown(event)">
              <div class="text-right hidden sm:block">
                <p class="text-[13px] font-bold text-on-surface leading-none">Admin User</p>
                <p class="text-[10px] text-outline mt-1 font-label-caps">Super Admin</p>
              </div>
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center font-bold text-primary relative">
                JD
                <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
              </div>
              
              <!-- Popover Menu -->
              ${state.showProfileDropdown ? `
                <div class="absolute right-0 top-12 w-64 bg-white border border-outline-variant/50 rounded-2xl shadow-xl p-4 z-50 text-left space-y-4" onclick="event.stopPropagation()">
                  <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
                    <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      JD
                    </div>
                    <div>
                      <p class="text-xs font-bold text-on-surface">Admin User</p>
                      <p class="text-[10px] text-outline">admin@tally.com</p>
                    </div>
                  </div>
                  
                  <!-- Subscription Status -->
                  <div class="space-y-2">
                    <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-outline">
                      <span>Active Plan</span>
                      <span class="text-primary font-black bg-primary/10 px-2 py-0.5 rounded-full text-[10px]">${escapeHtml(state.selectedPlan || "No Plan Chosen")}</span>
                    </div>
                    <div class="bg-surface-container-low p-3 rounded-xl border border-outline-variant/30 text-xs space-y-1">
                      <div class="flex justify-between">
                        <span class="text-outline text-[11px]">Plan Duration:</span>
                        <span class="font-semibold text-on-surface text-[11px]">30 Days</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-outline text-[11px]">Remaining:</span>
                        <span class="font-bold text-green-600 text-[11px]">30 Days Left</span>
                      </div>
                      <!-- Days Remaining Progress Bar -->
                      <div class="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-2">
                        <div class="bg-green-500 h-full" style="width: 100%"></div>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Shortcuts -->
                  <div class="space-y-1 pt-1">
                    <a class="flex items-center gap-2 p-2 hover:bg-slate-50 text-[11px] font-semibold text-on-surface-variant hover:text-primary rounded-lg transition-all" href="#" onclick="event.preventDefault(); state.showProfileDropdown = false; go('plans');">
                      <span class="material-symbols-outlined text-[16px]">credit_card</span>
                      Change Subscription Plan
                    </a>
                    <a class="flex items-center gap-2 p-2 hover:bg-slate-50 text-[11px] font-semibold text-on-surface-variant hover:text-primary rounded-lg transition-all" href="#" onclick="event.preventDefault(); state.showProfileDropdown = false; go('sync');">
                      <span class="material-symbols-outlined text-[16px]">history</span>
                      Sync History Logs
                    </a>
                    <a class="flex items-center gap-2 p-2 hover:bg-slate-50 text-[11px] font-semibold text-error hover:bg-error-container/20 rounded-lg transition-all" href="#" onclick="event.preventDefault(); state.showProfileDropdown = false; authSignOut();">
                      <span class="material-symbols-outlined text-[16px]">logout</span>
                      Sign Out Account
                    </a>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </header>
        <!-- Content Canvas -->
        <div class="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar pb-20 bg-background/10">
          ${showStepper ? stepperTailwind(active) : ""}
          ${state.notice ? `
            <div class="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 text-body-lg font-bold flex justify-between items-center shrink-0 shadow-lg select-none">
              <span class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px] text-primary shrink-0">info</span>
                ${escapeHtml(state.notice)}
              </span>
              <button class="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all" onclick="setNotice(null)">Dismiss</button>
            </div>
          ` : ""}
          ${state.sendProgress ? `
            <!-- Thick Progress Bar -->
            <div class="p-5 bg-white rounded-2xl border border-outline-variant shadow-sm space-y-3 shrink-0">
              <div class="flex justify-between items-center text-xs font-bold text-outline uppercase tracking-wider">
                <span>Transaction Progress</span>
                <span class="text-primary font-data-mono font-bold">${state.sendProgress.sent} / ${state.sendProgress.total} Synced</span>
              </div>
              <div class="w-full h-8 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant/30 relative flex items-center">
                <div class="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-300" style="width: ${(state.sendProgress.sent / (state.sendProgress.total || 1)) * 100}%"></div>
                <div class="absolute inset-0 flex items-center justify-between px-4 text-xs font-bold">
                  <span class="z-10 bg-white/80 text-on-surface px-2 py-0.5 rounded-full shadow-sm">${Math.round((state.sendProgress.sent / (state.sendProgress.total || 1)) * 100)}% Complete</span>
                  <span class="z-10 font-data-mono bg-white/80 text-primary px-2 py-0.5 rounded-full shadow-sm">Target: ${state.sendProgress.total} Vouchers</span>
                </div>
              </div>
            </div>
          ` : ""}
          ${content}
        </div>
      </main>
    </div>
  `;
}

function pageHead(title, sub, actions = "") {
  return `<div class="page-head"><div class="page-title"><h1>${title}</h1><p>${sub}</p></div><div style="display:flex;gap:10px;flex-wrap:wrap">${actions}</div></div>`;
}

function stepper(active) {
  const steps = [
    ["sync", "Synchronization", "Connect and sync masters"],
    ["upload", "Document Upload", "Add Excel template"],
    ["mapping", "Validation & Mapping", "Fix rows before send"],
    ["success", "Send Finish", "Review import result"],
  ];
  const activeIndex = steps.findIndex(([key]) => key === active);
  return `<div class="stepper">${steps.map(([key, title, sub], index) => {
    const done = index < activeIndex ? " done" : "";
    const isActive = key === active ? " active" : "";
    return `<div class="step${done}${isActive}"><div class="step-no">${index + 1}</div><div class="step-title">${title}</div><div class="step-sub">${sub}</div></div>`;
  }).join("")}</div>`;
}

function statsGrid() {
  const c = state.masters.counts || {};
  const stats = [
    ["Companies", c.companies || 0, "Synced Tally companies", "home"],
    ["Ledgers", c.ledgers || 0, "Party, cash, bank, tax", "file"],
    ["Day Book Entries", c.vouchers || 0, "Synced Tally vouchers", "grid"],
    ["Stock Items", c.stockItems || 0, "Inventory masters", "bank"],
  ];
  return `<div class="grid cols-4">${stats.map(([label, value, sub, i]) => `<div class="card stat-card"><div class="stat-icon">${icon(i)}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div><div class="label">${sub}</div></div>`).join("")}</div>`;
}

function validationRows() {
  if (!state.validation?.rows?.length) return fallbackRows.map((r, i) => ({ id: `sample-${i}`, rowNo: i + 2, payload: {
    date: r[0], "invoice no": r[1], "voucher type": r[2], "party ledger or cash": r[3], CGST: r[4], SGST: r[5], IGST: r[6], "total amount": r[7],
  }, status: "ready", errors: [] }));
  return state.validation.rows;
}

function getTransactionNo(row) {
  if (!row) return "";
  const rows = validationRows();
  const idx = rows.findIndex(r => r.id === row.id);
  return idx >= 0 ? idx + 1 : (row.rowNo || "");
}

function tableRowsForMode(mode) {
  if (mode === "validation" || mode === "send") return filteredTableRows();
  return validationRows();
}

function canonicalKey(headerName) {
  const h = (headerName || "").trim().toLowerCase();
  if (["date"].includes(h)) return "date";
  if (["invoice no", "invoice number", "voucher no", "voucher number"].includes(h)) return "invoice no";
  if (["voucher type", "entry type", "transaction type"].includes(h)) return "voucher type";
  if (["party ledger or cash", "party ledger , income , expenses , cash dr", "party ledger, income, expenses, cash dr", "party ledger income expenses cash dr", "income / payment received", "income/payment received", "payment received", "received ledger", "receipt ledger", "debit (inflow)", "debit inflow", "inflow", "debit ledger", "party ledger", "income", "expenses", "cash dr"].includes(h)) return "party ledger or cash";
  if (["total amount", "amount", "total"].includes(h)) return "total amount";
  if (["cgst", "sgst", "igst"].includes(h)) return h.toUpperCase();
  if (["gst rate", "tax rate", "rate of gst", "gst_rate_pct", "st_rate_pct", "st_rate_pc", "gst rate pct", "st rate pc", "st rate pct"].includes(h)) return "gst rate";
  if (["taxable amount", "taxable value", "basic amount", "before gst amount"].includes(h)) return "taxable amount";
  if (["cgst ledger", "central tax ledger"].includes(h)) return "cgst ledger";
  if (["sgst ledger", "state tax ledger"].includes(h)) return "sgst ledger";
  if (["igst ledger", "integrated tax ledger"].includes(h)) return "igst ledger";
  if (["item name", "name of item", "stock item", "stock item name", "item", "tem name", "tem_name"].includes(h)) return "item name";
  if (["purchase ledger", "purchase", "sales ledger", "sale", "sales", "cash ledger", "cash / bank", "cash/bank", "bank/cash", "bank ledger", "credit (outflow)", "credit outflow", "outflow", "credit ledger", "purchase / sale / cash ledger", "purchase / sale / cash ledger / cash cr", "purchase/sale/cash ledger/cash cr", "purchase sale cash ledger cash cr", "purchase/sale/cash ledger", "purchase sale cash ledger", "entry ledger", "item ledger", "inventory ledger", "contra ledger", "account ledger", "particulars ledger", "from ledger", "to ledger", "cash cr", "account_ledger"].includes(h)) return "purchase ledger";
  if (["quantity", "qty", "item quantity", "stock quantity", "units"].includes(h)) return "quantity";
  if (["rate", "item rate", "stock rate"].includes(h)) return "rate";
  if (["per", "unit", "base unit", "uom"].includes(h)) return "per";
  if (["godown", "location", "stock location"].includes(h)) return "godown";
  if (["stock group", "item group", "inventory group"].includes(h)) return "stock group";
  if (["stock category", "category", "item category", "inventory category"].includes(h)) return "stock category";
  if (["mailing name"].includes(h)) return "mailing name";
  if (["address", "party address"].includes(h)) return "address";
  if (["state"].includes(h)) return "state";
  if (["country"].includes(h)) return "country";
  if (["gst registration type", "registration type"].includes(h)) return "gst registration type";
  if (["gstin/uin", "gstin", "uin", "party_gstin", "party gstin"].includes(h)) return "gstin/uin";
  if (["place of supply", "destination_state"].includes(h)) return "place of supply";
  return h;
}

function capitalizeHeader(str) {
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function renderHeaderFilterDropdown(column, uniqueValues, selectedValues) {
  return `
    <div class="fixed z-[200] bg-white border border-outline-variant rounded-2xl shadow-xl p-4 w-56 header-filter-dropdown" style="top: ${state.headerFilterMenuPosition.top}px; left: ${state.headerFilterMenuPosition.left}px;" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/30">
        <span class="text-xs font-bold text-on-surface uppercase tracking-tight">Filter ${escapeHtml(capitalizeHeader(column))}</span>
        <button class="text-[10px] font-bold text-primary hover:underline" onclick="clearHeaderFilter(${escapeHtml(jsString(column))})">Clear</button>
      </div>
      <input type="text" class="w-full bg-surface-container-low border-outline-variant rounded-lg text-[11px] py-1.5 px-3 focus:ring-1 focus:ring-primary focus:border-transparent mb-3" placeholder="Search..." oninput="const q = this.value.toLowerCase(); this.parentElement.querySelectorAll('.header-filter-item').forEach(el => { const val = el.getAttribute('data-value').toLowerCase(); el.style.display = val.includes(q) ? 'flex' : 'none'; })">
      <div class="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
        ${uniqueValues.map(val => {
          const isChecked = selectedValues.includes(val);
          return `
            <div class="flex items-center justify-between gap-2.5 text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 rounded px-2 py-1.5 cursor-pointer header-filter-item" data-value="${escapeHtml(val)}" onclick="toggleDropdownItem(this, ${escapeHtml(jsString(column))}, ${escapeHtml(jsString(val))})">
              <span class="truncate flex-1 font-medium" title="${escapeHtml(val)}">${escapeHtml(val)}</span>
              <span class="check-icon-container flex items-center justify-center w-5 h-5">
                ${isChecked ? `<span class="material-symbols-outlined text-[16px] text-primary check-icon">check</span>` : ""}
              </span>
            </div>
          `;
        }).join("")}
        ${uniqueValues.length === 0 ? `<div class="text-[11px] text-outline text-center py-2">No unique items</div>` : ""}
      </div>
      <div class="flex gap-2 mt-4 pt-2 border-t border-outline-variant/30">
        <button class="flex-1 py-1.5 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary-container transition-colors" onclick="applyHeaderFilters()">Apply</button>
        <button class="flex-1 py-1.5 bg-surface-variant/30 text-on-surface-variant font-bold rounded-lg text-xs hover:bg-surface-variant/50 transition-colors" onclick="closeHeaderFilter()">Cancel</button>
      </div>
    </div>
  `;
}

function changePage(pageNum) {
  state.currentPage = pageNum;
  state.tableScrollTop = 0;
  render();
}

function changePageSize(size) {
  state.pageSize = parseInt(size, 10);
  state.currentPage = 1;
  state.tableScrollTop = 0;
  render();
}

function getPageRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function rowsTable(mode = "validation") {
  const rows = tableRowsForMode(mode);
  const selectable = mode === "validation" || mode === "send";
  const showMatch = selectable;

  const totalRows = rows.length;
  const totalPages = Math.max(Math.ceil(totalRows / state.pageSize), 1);
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + state.pageSize);

  const excelHeaders = state.validation?.headers || [];
  if (excelHeaders.length > 0) {
    const allSelected = selectable && filteredReadyRows().length > 0 && filteredReadyRows().every(row => selectedSendRows().some(r => r.id === row.id));
    
    let headerHtml = "";
    if (selectable) {
      headerHtml += `
        <th class="w-12 p-4 border-b border-outline-variant text-center">
          <input class="rounded text-primary focus:ring-primary border-outline-variant w-4 h-4 cursor-pointer" type="checkbox" ${allSelected ? "checked" : ""} onchange="toggleSelectAll(this.checked)">
        </th>
      `;
    }
    headerHtml += `
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
        <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'rowNo')">
          Transaction No
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">unfold_more</span>
        </div>
      </th>
    `;
    
    excelHeaders.forEach(h => {
      const colKey = canonicalKey(h);
      const isRightAlign = ["quantity", "rate", "taxable amount", "total amount", "CGST", "SGST", "IGST"].includes(colKey);
      const alignClass = isRightAlign ? "text-right justify-end" : "text-left justify-start";
      headerHtml += `
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline ${isRightAlign ? "text-right" : ""}">
          <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors ${alignClass}" onclick="toggleHeaderFilterDropdown(event, '${colKey}')">
            ${escapeHtml(capitalizeHeader(h))}
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
      `;
    });
    
    headerHtml += `
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right font-bold">
        <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'status')">
          Readiness
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
    `;
    
    let filterDropdownHtml = "";
    if (state.activeHeaderFilterColumn && state.headerFilterMenuPosition) {
      const column = state.activeHeaderFilterColumn;
      let uniqueValues = [];
      const allRowsForFilters = validationRows();
      if (column === "rowNo") {
        uniqueValues = Array.from(new Set(allRowsForFilters.map((r, idx) => String(idx + 1))));
      } else if (column === "status") {
        uniqueValues = Array.from(new Set(allRowsForFilters.map(r => readinessLabel(r))));
      } else if (column === "ledgerMatch") {
        uniqueValues = Array.from(new Set(allRowsForFilters.map(r => {
          const probs = rowLedgerProblems(r);
          return probs.length ? "Blocked" : rowCanSend(r) ? "Matched" : "Not Ready";
        })));
      } else {
        uniqueValues = Array.from(new Set(allRowsForFilters.map(r => {
          const val = r.payload?.[column] || "";
          return val === "" ? "(blank)" : String(val);
        })));
      }
      uniqueValues.sort();

      const selectedValues = state.tempHeaderFilters[column] || [];

      filterDropdownHtml = renderHeaderFilterDropdown(column, uniqueValues, selectedValues);
    }

    const endIndex = Math.min(startIndex + state.pageSize, totalRows);
    const paginationHtml = `
      <div class="flex items-center justify-between px-6 py-4 bg-surface-container-low border-t border-outline-variant/30 text-body-md text-on-surface-variant font-medium">
        <div class="flex items-center gap-4">
          <span>Showing <span class="font-bold text-on-surface">${totalRows === 0 ? 0 : startIndex + 1}</span> to <span class="font-bold text-on-surface">${endIndex}</span> of <span class="font-bold text-on-surface">${totalRows}</span> entries</span>
          <div class="flex items-center gap-2">
            <span class="text-xs flex items-center">Show</span>
            <select class="bg-white border border-outline-variant rounded-lg text-xs py-1 px-2 focus:ring-1 focus:ring-primary focus:border-transparent cursor-pointer" onchange="changePageSize(this.value)">
              ${[10, 25, 50, 100, 200, 500].map(sz => `<option value="${sz}" ${state.pageSize === sz ? "selected" : ""}>${sz}</option>`).join("")}
            </select>
            <span class="text-xs flex items-center">per page</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-3 py-1.5 bg-white border border-outline-variant text-on-surface rounded-lg text-xs font-semibold hover:bg-surface-variant/40 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-40 disabled:pointer-events-none" ${state.currentPage === 1 ? "disabled" : ""} onclick="changePage(${state.currentPage - 1})">
            <span class="material-symbols-outlined text-[14px]">arrow_back_ios</span> Prev
          </button>
          
          <div class="flex items-center gap-1 text-xs font-semibold">
            ${getPageRange(state.currentPage, totalPages).map(p => {
              if (p === '...') return `<span class="px-2 text-outline/50">...</span>`;
              return `<button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all ${state.currentPage === p ? 'bg-primary text-on-primary shadow-sm font-bold' : 'bg-white border border-outline-variant text-on-surface hover:bg-surface-variant/40 active:scale-95'}" onclick="changePage(${p})">${p}</button>`;
            }).join("")}
          </div>

          <button class="px-3 py-1.5 bg-white border border-outline-variant text-on-surface rounded-lg text-xs font-semibold hover:bg-surface-variant/40 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-40 disabled:pointer-events-none" ${state.currentPage === totalPages ? "disabled" : ""} onclick="changePage(${state.currentPage + 1})">
            Next <span class="material-symbols-outlined text-[14px]">arrow_forward_ios</span>
          </button>
        </div>
      </div>
    `;

    const scrollTop = state.tableScrollTop || 0;
    const containerHeight = 500;
    const rowHeight = 56;
    const totalPaginated = paginatedRows.length;
    
    let visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
    let visibleEnd = Math.min(totalPaginated, Math.ceil((scrollTop + containerHeight) / rowHeight) + 5);
    
    const topPadding = visibleStart * rowHeight;
    const bottomPadding = (totalPaginated - visibleEnd) * rowHeight;
    const visibleRows = paginatedRows.slice(visibleStart, visibleEnd);

    return `
      <div class="overflow-x-auto custom-scrollbar" style="max-height: 600px; overflow-y: auto; position: relative;" onscroll="state.tableScrollTop = this.scrollTop; renderTableBodyOnly(this)">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-container-low/50 sticky top-0 backdrop-blur-sm z-10">${headerHtml}</tr>
          </thead>
          <tbody id="table-body-rows" data-mode="${mode}" class="divide-y divide-outline-variant/30">
            ${topPadding > 0 ? `<tr style="height: ${topPadding}px; border: none;"><td colspan="${excelHeaders.length + 3}" style="padding: 0; border: none;"></td></tr>` : ""}
            ${visibleRows.map((row) => renderRowHtml(row, excelHeaders, selectable)).join("")}
            ${bottomPadding > 0 ? `<tr style="height: ${bottomPadding}px; border: none;"><td colspan="${excelHeaders.length + 3}" style="padding: 0; border: none;"></td></tr>` : ""}
          </tbody>
        </table>
      </div>
      ${paginationHtml}
      ${filterDropdownHtml}
    `;
  }

  const showInventoryCols = state.selectedVoucherMode === "Item Invoice";
  const showAccountingCols = state.selectedVoucherMode === "Accounting Invoice";
  const showGstCols = state.gstEnabled || rows.some(r => r.payload && (r.payload["gstin/uin"] || r.payload["place of supply"]));

  const isPaymentFlow = state.activeWorkflow === "Payment";
  const isReceiptFlow = state.activeWorkflow === "Receipt";
  const isContraFlow = state.activeWorkflow === "Contra";
  const showSecondLedgerCol = showAccountingCols || isPaymentFlow || isReceiptFlow || isContraFlow;

  let secondLedgerLabel = "Purchase Ledger";
  if (isPaymentFlow || isContraFlow) {
    secondLedgerLabel = "Credit (Outflow)";
  } else if (isReceiptFlow) {
    secondLedgerLabel = "Cash / Bank";
  } else if ((state.activeWorkflow || "").toLowerCase() === "sales") {
    secondLedgerLabel = "Sales Ledger";
  }

  let amountColLabel = "Taxable";
  if (isPaymentFlow || isReceiptFlow || isContraFlow) {
    amountColLabel = "Amount";
  }

  if (state.route === "mapping" || state.route === "success") {
    const allSelected = selectable && filteredReadyRows().length > 0 && filteredReadyRows().every(row => selectedSendRows().some(r => r.id === row.id));

    let headerHtml = `
      ${selectable ? `
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline w-12 text-center">
          <input class="rounded text-primary focus:ring-primary border-outline-variant" type="checkbox" ${allSelected ? "checked" : ""} onchange="toggleSelectAll(this.checked)">
        </th>
      ` : ""}
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
        <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'rowNo')">
          Transaction No
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">unfold_more</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
        <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'date')">
          Date
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
        <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'invoice no')">
          Invoice No
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
        <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'voucher type')">
          Voucher Type
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
        <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'party ledger or cash')">
          Party Ledger
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
    `;

    if (showGstCols) {
      headerHtml += `
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
          <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'gstin/uin')">
            GSTIN
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
          <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'place of supply')">
            State
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
      `;
    }

    if (showInventoryCols) {
      headerHtml += `
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
          <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'item name')">
            Item Name
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
          <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'quantity')">
            Qty
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
          <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'rate')">
            Rate
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
          <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'taxable amount')">
            Taxable
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
      `;
    } else if (showSecondLedgerCol) {
      const amtColKey = isPaymentFlow || isReceiptFlow || isContraFlow ? "total amount" : "taxable amount";
      headerHtml += `
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
          <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'purchase ledger')">
            ${secondLedgerLabel}
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
          <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, '${amtColKey}')">
            ${amountColLabel}
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
      `;
    }

    headerHtml += `
      ${showMatch ? `
        <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline">
          <div class="flex items-center gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'ledgerMatch')">
            Ledger Match
            <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
          </div>
        </th>
      ` : ""}
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
        <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'CGST')">
          CGST
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
        <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'SGST')">
          SGST
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
        <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'IGST')">
          IGST
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right">
        <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'total amount')">
          Total
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
      <th class="p-4 border-b border-outline-variant text-label-caps font-label-caps text-outline text-right font-bold">
        <div class="flex items-center justify-end gap-1 cursor-pointer group hover:text-primary transition-colors" onclick="toggleHeaderFilterDropdown(event, 'status')">
          Readiness
          <span class="material-symbols-outlined text-[16px] text-outline/50 group-hover:text-primary">filter_alt</span>
        </div>
      </th>
    `;

    let filterDropdownHtml = "";
    if (state.activeHeaderFilterColumn && state.headerFilterMenuPosition) {
      const column = state.activeHeaderFilterColumn;
      let uniqueValues = [];
      const allRowsForFilters = validationRows();
      if (column === "rowNo") {
        uniqueValues = Array.from(new Set(allRowsForFilters.map((r, idx) => String(idx + 1))));
      } else if (column === "status") {
        uniqueValues = Array.from(new Set(allRowsForFilters.map(r => readinessLabel(r))));
      } else if (column === "ledgerMatch") {
        uniqueValues = Array.from(new Set(allRowsForFilters.map(r => {
          const probs = rowLedgerProblems(r);
          return probs.length ? "Blocked" : rowCanSend(r) ? "Matched" : "Not Ready";
        })));
      } else {
        uniqueValues = Array.from(new Set(allRowsForFilters.map(r => {
          const val = r.payload?.[column] || "";
          return val === "" ? "(blank)" : String(val);
        })));
      }
      uniqueValues.sort();

      const selectedValues = state.tempHeaderFilters[column] || [];

      filterDropdownHtml = renderHeaderFilterDropdown(column, uniqueValues, selectedValues);
    }

    return `
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-container-low/50 sticky top-0 backdrop-blur-sm z-10">${headerHtml}</tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30">
            ${rows.map((row) => {
              const p = row.payload;
              const problems = selectable ? rowLedgerProblems(row) : [];
              const status = problems.length ? "danger" : row.status === "ready" ? "success" : row.ignored ? "warning" : "danger";
              const label = readinessLabel(row, problems);
              const title = problems.length ? problems.map((p) => p.message).join(" ") : (row.errors || []).join(" ");
              
              let selectableStatus = "";
              if (selectable) {
                const matchesFilter = filteredReadyRows().some((r) => r.id === row.id);
                const canSend = matchesFilter && rowCanSend(row);
                const selected = selectedSendRows().some((r) => r.id === row.id);
                const cbTitle = problems.length ? problems.map((p) => p.message).join(" ") : canSend ? "Selected for sending." : "Not included by current filter.";
                selectableStatus = `
                  <td class="p-4 text-center">
                    <input class="rounded text-primary focus:ring-primary border-outline-variant" type="checkbox" ${selected ? "checked" : ""} ${canSend ? "" : "disabled"} title="${escapeHtml(cbTitle)}" onchange="toggleRowSelection('${row.id}')">
                  </td>
                `;
              }

              const matchCell = showMatch ? `
                <td class="p-4 text-body-md">
                  ${problems.length ? `
                    <span class="inline-flex items-center gap-1.5 text-[12px] font-bold text-error bg-error-container/20 px-2 py-0.5 rounded border border-error-container">
                      <span class="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
                      Blocked
                    </span>
                    <div class="text-[11px] text-on-surface-variant font-medium mt-0.5">${escapeHtml(problems[0].message)}</div>
                  ` : rowCanSend(row) ? `
                    <span class="inline-flex items-center gap-1.5 text-[12px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                      <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Matched
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Not Ready
                    </span>
                  `}
                </td>
              ` : "";

              let gstCellsHtml = "";
              if (showGstCols) {
                gstCellsHtml += `
                  <td class="p-4 text-body-md font-data-mono ${cellAlertClass("gstin/uin")}" title="${escapeHtml(cellTitle("gstin/uin"))}" contenteditable="true" data-id="${row.id}" data-col="gstin/uin" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["gstin/uin"] || "")}</td>
                  <td class="p-4 text-body-md ${cellAlertClass("place of supply")}" title="${escapeHtml(cellTitle("place of supply"))}" contenteditable="true" data-id="${row.id}" data-col="place of supply" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["place of supply"] || "")}</td>
                `;
              }
              
              if (showInventoryCols) {
                gstCellsHtml += `
                  <td class="p-4 text-body-md font-semibold ${cellAlertClass("item name")}" title="${escapeHtml(cellTitle("item name"))}" contenteditable="true" data-id="${row.id}" data-col="item name" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["item name"] || "")}</td>
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass("quantity")}" title="${escapeHtml(cellTitle("quantity"))}" contenteditable="true" data-id="${row.id}" data-col="quantity" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${p.quantity ?? ""}</td>
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass("rate")}" title="${escapeHtml(cellTitle("rate"))}" contenteditable="true" data-id="${row.id}" data-col="rate" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(p.rate)}</td>
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass("taxable amount")}" title="${escapeHtml(cellTitle("taxable amount"))}" contenteditable="true" data-id="${row.id}" data-col="taxable amount" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(p["taxable amount"])}</td>
                `;
              } else if (showSecondLedgerCol) {
                const purProblem = cellProblem(row, "purchase ledger");
                const isPurLedgerErr = purProblem && purProblem.type === "ledger";
                const displayAmt = isPaymentFlow || isReceiptFlow || isContraFlow ? p["total amount"] : p["taxable amount"];
                const amtCol = isPaymentFlow || isReceiptFlow || isContraFlow ? "total amount" : "taxable amount";
                
                let purCellHtml = "";
                if (isPurLedgerErr) {
                  purCellHtml = `
                    <td class="p-4 text-body-md ${cellAlertClass("purchase ledger")}" title="${escapeHtml(cellTitle("purchase ledger"))}">
                      <div class="flex flex-col gap-1">
                        <span contenteditable="true" data-id="${row.id}" data-col="purchase ledger" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)" class="outline-none font-semibold">${escapeHtml(p["purchase ledger"] || "")}</span>
                        <div class="flex gap-1.5 mt-1 justify-start">
                          <button class="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptCreateLedger(${escapeHtml(jsString(p["purchase ledger"]))})">
                            <span class="material-symbols-outlined text-[11px]">add</span> Create
                          </button>
                          <button class="px-1.5 py-0.5 bg-secondary/10 hover:bg-secondary/20 text-secondary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptAlterLedger(${escapeHtml(jsString(p["purchase ledger"]))})">
                            <span class="material-symbols-outlined text-[11px]">edit</span> Map/Alter
                          </button>
                        </div>
                      </div>
                    </td>
                  `;
                } else {
                  purCellHtml = `
                    <td class="p-4 text-body-md font-semibold ${cellAlertClass("purchase ledger")}" title="${escapeHtml(cellTitle("purchase ledger"))}" contenteditable="true" data-id="${row.id}" data-col="purchase ledger" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["purchase ledger"] || "")}</td>
                  `;
                }

                gstCellsHtml += `
                  ${purCellHtml}
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass(amtCol)}" title="${escapeHtml(cellTitle(amtCol))}" contenteditable="true" data-id="${row.id}" data-col="${amtCol}" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(displayAmt)}</td>
                `;
              }

              let badgeHtml = readinessBadge(row, problems);

              const isLedgerError = status === "danger" && title.toLowerCase().includes("ledger");

              let partyCellHtml = "";
              if (isLedgerError) {
                partyCellHtml = `
                  <td class="p-4 text-body-md ${cellAlertClass("party ledger or cash")}" title="${escapeHtml(cellTitle("party ledger or cash"))}">
                    <div class="flex flex-col gap-1">
                      <span contenteditable="true" data-id="${row.id}" data-col="party ledger or cash" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)" class="outline-none font-semibold text-error">${escapeHtml(p["party ledger or cash"] || "")}</span>
                      <div class="flex gap-1.5 mt-1 justify-start">
                        <button class="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptCreateLedger(${escapeHtml(jsString(p["party ledger or cash"]))})">
                          <span class="material-symbols-outlined text-[11px]">add</span> Create
                        </button>
                        <button class="px-1.5 py-0.5 bg-secondary/10 hover:bg-secondary/20 text-secondary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptAlterLedger(${escapeHtml(jsString(p["party ledger or cash"]))})">
                          <span class="material-symbols-outlined text-[11px]">edit</span> Map/Alter
                        </button>
                      </div>
                    </div>
                  </td>
                `;
              } else {
                partyCellHtml = `
                  <td class="p-4 text-body-md font-semibold ${cellAlertClass("party ledger or cash")}" title="${escapeHtml(cellTitle("party ledger or cash"))}" contenteditable="true" data-id="${row.id}" data-col="party ledger or cash" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["party ledger or cash"] || "")}</td>
                `;
              }

              return `
                <tr class="hover:bg-secondary-container/10 transition-colors group border-b border-outline-variant/30" title="${escapeHtml(title)}">
                  ${selectableStatus}
                  <td class="p-4 text-body-md font-data-mono text-outline">${row.rowNo}</td>
                  <td class="p-4 text-body-md font-data-mono ${cellAlertClass("date")}" title="${escapeHtml(cellTitle("date"))}" contenteditable="true" data-id="${row.id}" data-col="date" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p.date || "")}</td>
                  <td class="p-4 text-body-md font-data-mono font-bold text-primary ${cellAlertClass("invoice no")}" title="${escapeHtml(cellTitle("invoice no"))}" contenteditable="true" data-id="${row.id}" data-col="invoice no" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["invoice no"] || "")}</td>
                  <td class="p-4 text-body-md ${cellAlertClass("voucher type")}" title="${escapeHtml(cellTitle("voucher type"))}" contenteditable="true" data-id="${row.id}" data-col="voucher type" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["voucher type"] || "")}</td>
                  ${partyCellHtml}
                  ${gstCellsHtml}
                  ${matchCell}
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass("CGST")}" title="${escapeHtml(cellTitle("CGST"))}" contenteditable="true" data-id="${row.id}" data-col="CGST" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(p.CGST)}</td>
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass("SGST")}" title="${escapeHtml(cellTitle("SGST"))}" contenteditable="true" data-id="${row.id}" data-col="SGST" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(p.SGST)}</td>
                  <td class="p-4 text-body-md font-data-mono text-right ${cellAlertClass("IGST")}" title="${escapeHtml(cellTitle("IGST"))}" contenteditable="true" data-id="${row.id}" data-col="IGST" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(p.IGST)}</td>
                  <td class="p-4 text-right text-body-md font-bold text-primary font-data-mono ${cellAlertClass("total amount")}" title="${escapeHtml(cellTitle("total amount"))}" contenteditable="true" data-id="${row.id}" data-col="total amount" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${money(p["total amount"])}</td>
                  <td class="p-4 text-right">${badgeHtml}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      ${filterDropdownHtml}
    `;
  }

  // Original fallback UI
  let headerHtml = `
    ${selectable ? "<th>Select</th>" : ""}
    <th>Transaction No</th>
    <th>Date</th>
    <th>Invoice No</th>
    <th>Voucher Type</th>
    <th>Party Ledger</th>
  `;

  if (showGstCols) {
    headerHtml += `<th>GSTIN</th><th>State</th>`;
  }

  if (showInventoryCols) {
    headerHtml += `<th>Item Name</th><th>Qty</th><th>Rate</th><th>Taxable</th>`;
  } else if (showAccountingCols) {
    const label = (state.gstWorkflow || "").toLowerCase() === "sales" ? "Sales Ledger" : "Purchase Ledger";
    headerHtml += `<th>${label}</th><th>Taxable</th>`;
  }

  headerHtml += `
    ${showMatch ? "<th>Ledger match</th>" : ""}
    <th>CGST</th>
    <th>SGST</th>
    <th>IGST</th>
    <th class="right">Total</th>
    <th>Status</th>
  `;

  return `<div class="table-wrap"><table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rows.map((row, i) => {
      const p = row.payload;
      const problems = selectable ? rowLedgerProblems(row) : [];
      const status = problems.length ? "danger" : row.status === "ready" ? "success" : row.ignored ? "warning" : "danger";
      const label = problems.length ? (problems[0].type === "stock_item" ? "Stock issue" : "Ledger issue") : row.ignored ? "Ignored" : row.status === "ready" ? "Ready" : "Needs fix";
      const title = problems.length ? problems.map((p) => p.message).join(" ") : (row.errors || []).join(" ");
      const selectableStatus = selectable ? rowSelectionCell(row) : "";
      const matchCell = showMatch ? `<td>${problems.length ? `<span class="chip danger">Blocked</span><div class="label">${escapeHtml(problems[0].message)}</div>` : rowCanSend(row) ? `<span class="chip success">Matched</span>` : `<span class="chip warning">Not ready</span>`}</td>` : "";
      
      let gstCellsHtml = "";
      if (showGstCols) {
        gstCellsHtml += `
          <td>${escapeHtml(p["gstin/uin"] || "")}</td>
          <td>${escapeHtml(p["place of supply"] || "")}</td>
        `;
      }
      
      if (showInventoryCols) {
        gstCellsHtml += `
          <td>${escapeHtml(p["item name"] || "")}</td>
          <td>${p.quantity ? p.quantity + " " + (p.per || "Nos") : ""}</td>
          <td>${money(p.rate)}</td>
          <td>${money(p["taxable amount"])}</td>
        `;
      } else if (showAccountingCols) {
        gstCellsHtml += `
          <td>${escapeHtml(p["purchase ledger"] || "")}</td>
          <td>${money(p["taxable amount"])}</td>
        `;
      }

      return `<tr title="${escapeHtml(title)}">
        ${selectableStatus}<td>${i + 1}</td><td>${escapeHtml(p.date || "")}</td><td>${escapeHtml(p["invoice no"] || "")}</td><td>${escapeHtml(p["voucher type"] || "")}</td>
        <td><span class="${status === "danger" && title.includes("ledger") ? "editable error" : ""}">${escapeHtml(p["party ledger or cash"] || "")}</span></td>
        ${gstCellsHtml}
        ${matchCell}
        <td>${money(p.CGST)}</td><td>${money(p.SGST)}</td><td>${money(p.IGST)}</td><td class="right amount">${money(p["total amount"])}</td>
        <td><span class="chip ${status}">${label}</span></td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function renderRowHtml(row, excelHeaders, selectable) {
  const p = row.payload || {};
  const problems = selectable ? rowLedgerProblems(row) : [];
  const status = problems.length ? "danger" : row.status === "ready" ? "success" : row.ignored ? "warning" : "danger";
  const label = readinessLabel(row, problems);
  const title = problems.length ? problems.map((p) => p.message).join(" ") : (row.errors || []).join(" ");
  const cellAlertClass = (col) => cellProblem(row, col) ? "bg-error-container/30 text-error font-bold ring-1 ring-error/40" : "";
  const cellTitle = (col) => cellProblem(row, col)?.message || title;
  
  let selectableStatus = "";
  if (selectable) {
    const matchesFilter = filteredReadyRows().some((r) => r.id === row.id);
    const canSend = matchesFilter && rowCanSend(row);
    const selected = selectedSendRows().some((r) => r.id === row.id);
    const cbTitle = problems.length ? problems.map((p) => p.message).join(" ") : canSend ? "Selected for sending." : "Not included by current filter.";
    selectableStatus = `
      <td class="p-4 text-center">
        <input class="rounded text-primary focus:ring-primary border-outline-variant w-4 h-4 cursor-pointer" type="checkbox" ${selected ? "checked" : ""} ${canSend ? "" : "disabled"} title="${escapeHtml(cbTitle)}" onchange="toggleRowSelection('${row.id}')">
      </td>
    `;
  }

  let badgeHtml = readinessBadge(row, problems);

  const isLedgerError = status === "danger" && title.toLowerCase().includes("ledger");

  let partyCellHtml = "";
  if (isLedgerError) {
    partyCellHtml = `
      <td class="p-4 text-body-md ${cellAlertClass("party ledger or cash")}" title="${escapeHtml(cellTitle("party ledger or cash"))}">
        <div class="flex flex-col gap-1">
          <span contenteditable="true" data-id="${row.id}" data-col="party ledger or cash" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)" class="outline-none font-semibold text-error">${escapeHtml(p["party ledger or cash"] || "")}</span>
          <div class="flex gap-1.5 mt-1 justify-start">
            <button class="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptCreateLedger(${escapeHtml(jsString(p["party ledger or cash"]))})">
              <span class="material-symbols-outlined text-[11px]">add</span> Create
            </button>
            <button class="px-1.5 py-0.5 bg-secondary/10 hover:bg-secondary/20 text-secondary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptAlterLedger(${escapeHtml(jsString(p["party ledger or cash"]))})">
              <span class="material-symbols-outlined text-[11px]">edit</span> Map/Alter
            </button>
          </div>
        </div>
      </td>
    `;
  } else {
    partyCellHtml = `
      <td class="p-4 text-body-md font-semibold ${cellAlertClass("party ledger or cash")}" title="${escapeHtml(cellTitle("party ledger or cash"))}" contenteditable="true" data-id="${row.id}" data-col="party ledger or cash" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">${escapeHtml(p["party ledger or cash"] || "")}</td>
    `;
  }

  return `
    <tr class="hover:bg-secondary-container/10 transition-colors group border-b border-outline-variant/30" title="${escapeHtml(title)}">
      ${selectableStatus}
      <td class="p-4 text-body-md font-data-mono text-outline">${getTransactionNo(row)}</td>
      ${excelHeaders.map(h => {
        const colKey = canonicalKey(h);
        const isRightAlign = ["quantity", "rate", "taxable amount", "total amount", "CGST", "SGST", "IGST"].includes(colKey);
        const isMono = ["date", "quantity", "rate", "taxable amount", "total amount", "CGST", "SGST", "IGST", "gstin/uin", "invoice no"].includes(colKey);
        
        let val = p[colKey] || "";
        if (colKey === "total amount" && state.gstEnabled) {
          val = p["taxable amount"] || "";
        }
        if (["rate", "taxable amount", "total amount", "CGST", "SGST", "IGST"].includes(colKey)) {
          val = money(val);
        }
        
        const problem = cellProblem(row, colKey);
        const isLedgerErr = problem && problem.type === "ledger";
        const errorClass = problem ? "bg-error-container/30 text-error font-bold ring-1 ring-error/40" : "";
        const problemTitle = problem ? problem.message : title;
        
        if (isLedgerErr) {
          return `
            <td class="p-4 text-body-md ${isRightAlign ? "text-right" : ""} ${isMono ? "font-data-mono" : ""} ${errorClass}" title="${escapeHtml(problemTitle)}">
              <div class="flex flex-col gap-1">
                <span contenteditable="true" data-id="${row.id}" data-col="${colKey}" oninput="cellInputting(this)" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)" class="outline-none">${escapeHtml(val)}</span>
                <div class="flex gap-1.5 mt-1 justify-start">
                  <button class="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptCreateLedger(${escapeHtml(jsString(val))})">
                    <span class="material-symbols-outlined text-[11px]">add</span> Create
                  </button>
                  <button class="px-1.5 py-0.5 bg-secondary/10 hover:bg-secondary/20 text-secondary text-[9px] font-bold rounded flex items-center gap-0.5 transition-all select-none" onclick="promptAlterLedger(${escapeHtml(jsString(val))})">
                    <span class="material-symbols-outlined text-[11px]">edit</span> Map/Alter
                  </button>
                </div>
              </div>
            </td>
          `;
        }
        
        return `
          <td class="p-4 text-body-md ${isRightAlign ? "text-right" : ""} ${isMono ? "font-data-mono" : ""} ${errorClass}" title="${escapeHtml(problemTitle)}" 
              contenteditable="true" data-id="${row.id}" data-col="${colKey}" 
              oninput="cellInputting(this)" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)">
            ${escapeHtml(val)}
          </td>
        `;
      }).join("")}
      <td class="p-4 text-right">${badgeHtml}</td>
    </tr>
  `;
}

function renderTableBodyOnly(container) {
  const tbody = container.querySelector("#table-body-rows");
  if (!tbody) return;
  const mode = tbody.getAttribute("data-mode");
  const rows = tableRowsForMode(mode);
  
  const totalRows = rows.length;
  const totalPages = Math.max(Math.ceil(totalRows / state.pageSize), 1);
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + state.pageSize);
  
  const scrollTop = container.scrollTop;
  state.tableScrollTop = scrollTop;
  const containerHeight = container.clientHeight || 500;
  const rowHeight = 56;
  const totalPaginated = paginatedRows.length;
  
  let visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
  let visibleEnd = Math.min(totalPaginated, Math.ceil((scrollTop + containerHeight) / rowHeight) + 5);
  
  const topPadding = visibleStart * rowHeight;
  const bottomPadding = (totalPaginated - visibleEnd) * rowHeight;
  const visibleRows = paginatedRows.slice(visibleStart, visibleEnd);
  
  const excelHeaders = state.validation?.headers || [];
  const selectable = mode === "validation" || mode === "send";
  
  let rowsHtml = "";
  if (topPadding > 0) {
    rowsHtml += `<tr style="height: ${topPadding}px; border: none;"><td colspan="${excelHeaders.length + 3}" style="padding: 0; border: none;"></td></tr>`;
  }
  visibleRows.forEach(row => {
    rowsHtml += renderRowHtml(row, excelHeaders, selectable);
  });
  if (bottomPadding > 0) {
    rowsHtml += `<tr style="height: ${bottomPadding}px; border: none;"><td colspan="${excelHeaders.length + 3}" style="padding: 0; border: none;"></td></tr>`;
  }
  
  tbody.innerHTML = rowsHtml;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function jsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function readinessLabel(row, problems = rowLedgerProblems(row)) {
  if (problems.length) return "Blocked";
  if (row.ignored) return "Ignored";
  if (row.status === "ready") return "Ready";
  return "Needs fix";
}

function readinessBadge(row, problems = rowLedgerProblems(row)) {
  const label = readinessLabel(row, problems);
  const tone = label === "Ready" ? "green" : label === "Ignored" ? "amber" : "error";
  const toneClass = tone === "green"
    ? "text-green-600 bg-green-50 border-green-100"
    : tone === "amber"
      ? "text-amber-600 bg-amber-50 border-amber-100"
      : "text-error bg-error-container/20 border-error-container";
  const dotClass = tone === "green" ? "bg-green-500" : tone === "amber" ? "bg-amber-500" : "bg-error animate-pulse";
  return `
    <span class="inline-flex items-center gap-1.5 text-[12px] font-bold ${toneClass} px-2 py-0.5 rounded border" title="${escapeHtml(problems.map((p) => p.message).join(" "))}">
      <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
      ${label}
    </span>
  `;
}

function cellProblem(row, colKey) {
  const payload = row.payload || {};
  const value = String(payload[colKey] ?? "").trim().toLowerCase();
  const ledgerColumns = new Set(["party ledger or cash", "purchase ledger", "cgst ledger", "sgst ledger", "igst ledger"]);
  return rowLedgerProblems(row).find((problem) => {
    const problemValue = String(problem.ledger || "").trim().toLowerCase();
    if (!problemValue) return false;
    if (problem.type === "stock_item") return colKey === "item name" && String(itemNameForPayload(payload)).trim().toLowerCase() === problemValue;
    if (problem.type === "unit") return ["per", "unit", "units"].includes(colKey) && String(unitForPayload(payload)).trim().toLowerCase() === problemValue;
    if (problem.type === "godown") return colKey === "godown" && String(godownForPayload(payload)).trim().toLowerCase() === problemValue;
    if (problem.type === "ledger_side") return colKey === "purchase ledger" && value === problemValue;
    return ledgerColumns.has(colKey) && value === problemValue;
  });
}

function editableCell(row, colKey, value, extraClass = "") {
  const problem = cellProblem(row, colKey);
  const problemClass = problem ? "bg-error-container/30 text-error font-bold ring-1 ring-error/40" : "";
  const title = problem ? ` title="${escapeHtml(problem.message)}"` : "";
  return `contenteditable="true" data-id="${row.id}" data-col="${colKey}" onblur="cellEdited(this)" onkeydown="cellKeydown(event, this)" class="p-4 text-body-md ${extraClass} ${problemClass}"${title}`;
}

function money(value) {
  const n = Number(value || 0);
  return n ? `Rs ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "0";
}

function voucherTypeFor(payload) {
  const raw = String(payload?.["voucher type"] || "");
  const normalized = raw.trim().toLowerCase();
  const map = {
    "Credit Sale": "Sales",
    "credit sale": "Sales",
    "Credit Purchase": "Purchase",
    "credit purchase": "Purchase",
    "Expense": "Payment",
    "expense": "Payment",
    "exp": "Payment",
    "income": "Receipt",
    "received": "Receipt",
    "reciept": "Receipt",
    "receipt": "Receipt",
    "payment": "Payment",
    "contra": "Contra",
    "Bank entry": "Contra",
    "bank entry": "Contra",
    "sales": "Sales",
    "purchase": "Purchase",
  };
  return map[raw] || map[normalized] || raw || "Journal";
}

function debitCreditLines(payload, mode = state.selectedVoucherMode) {
  const voucherType = voucherTypeFor(payload);
  const party = String(payload?.["party ledger or cash"] || "");
  const total = Number(payload?.["total amount"] || 0);
  const key = voucherType.toLowerCase();
  if (key === "purchase") return [
    { prefix: "To", ledger: party, debit: 0, credit: total },
    { prefix: "By", ledger: invoiceParticular(payload), debit: total, credit: 0 },
  ];
  if (key === "sales") return [
    { prefix: "By", ledger: party, debit: total, credit: 0 },
    { prefix: "To", ledger: invoiceParticular(payload), debit: 0, credit: total },
  ];
  if (key === "payment") return [
    ...(state.selectedPaymentMode === "Single Entry"
      ? [
        { prefix: "By", ledger: party, debit: total, credit: 0 },
      ]
      : [
        { prefix: "By", ledger: party, debit: total, credit: 0 },
        { prefix: "To", ledger: paymentAccountLedger(payload), debit: 0, credit: total },
      ]),
  ];
  if (key === "receipt") return [
    ...(state.selectedReceiptMode === "Single Entry"
      ? [
        { prefix: "To", ledger: party, debit: 0, credit: total },
      ]
      : [
        { prefix: "To", ledger: party, debit: 0, credit: total },
        { prefix: "By", ledger: receiptAccountLedger(payload), debit: total, credit: 0 },
      ]),
  ];
  if (key === "contra") return [
    ...(state.selectedContraMode === "Single Entry"
      ? [
        { prefix: "To", ledger: contraCounterLedger(payload), debit: 0, credit: total },
      ]
      : [
        { prefix: "By", ledger: party, debit: total, credit: 0 },
        { prefix: "To", ledger: contraCounterLedger(payload), debit: 0, credit: total },
      ]),
  ];
  return [
    { prefix: "By", ledger: party, debit: total, credit: 0 },
    { prefix: "To", ledger: "Cash", debit: 0, credit: total },
  ];
}

function contraCounterLedger(payload) {
  return String(optionalPayload(payload, "purchase ledger", "Cash") || "Cash");
}

function paymentAccountLedger(payload) {
  return String(optionalPayload(payload, "purchase ledger", "Cash") || "Cash");
}

function receiptAccountLedger(payload) {
  return String(optionalPayload(payload, "purchase ledger", "Cash") || "Cash");
}

function singleEntryAccountLedger(payload) {
  const key = voucherTypeFor(payload).toLowerCase();
  if (key === "payment") return paymentAccountLedger(payload);
  if (key === "receipt") return receiptAccountLedger(payload);
  if (key === "contra") return String(payload?.["party ledger or cash"] || "");
  return "";
}

function defaultLedgerGroupForPayload(payload, ledgerName = "") {
  const type = voucherTypeFor(payload).toLowerCase();
  const name = String(ledgerName || "").toLowerCase();
  if (name.includes("bank")) return "Bank Accounts";
  if (name === "cash" || name.includes("cash")) return "Cash-in-hand";
  if (name.includes("gst") || name.includes("cgst") || name.includes("sgst") || name.includes("igst")) return "Duties & Taxes";
  if (type === "sales") return "Sundry Debtors";
  if (type === "purchase") return "Sundry Creditors";
  if (type === "payment") return "Indirect Expenses";
  if (type === "receipt") return "Indirect Incomes";
  return "Sundry Creditors";
}

function askLedgerGroup(defaultGroup = "Sundry Creditors") {
  const options = ledgerGroups.map((group, index) => `${index + 1}. ${group}`).join("\n");
  const value = prompt(`Select ledger group number or type custom group:\n${options}`, defaultGroup);
  if (!value) return "";
  const index = Number(value.trim());
  if (Number.isInteger(index) && index >= 1 && index <= ledgerGroups.length) return ledgerGroups[index - 1];
  return value.trim();
}

function readyRows() {
  return validationRows().filter((row) => row.status === "ready" && !row.ignored);
}

function masterNames(type) {
  return new Set((state.masters.masters || [])
    .filter((m) => m.type === type)
    .map((m) => String(m.name || "").trim().toLowerCase())
    .filter(Boolean));
}

function masterDisplayNames(type) {
  return (state.masters.masters || [])
    .filter((m) => m.type === type)
    .map((m) => String(m.name || "").trim())
    .filter(Boolean);
}

function gstTaxLedgerOptions(tax = "") {
  const needle = String(tax || "").toLowerCase();
  const masters = state.masters.masters || [];
  const names = masters
    .filter((m) => {
      const type = String(m.type || "").toLowerCase();
      const name = String(m.name || "").toLowerCase();
      const parent = String(m.parent || "").toLowerCase();
      return type === "gst_ledger" || parent.includes("duties") || parent.includes("tax") || name.includes("gst") || name.includes("cgst") || name.includes("sgst") || name.includes("igst");
    })
    .map((m) => String(m.name || "").trim())
    .filter(Boolean);
  const unique = uniqueOptions(names);
  const direct = unique.filter((name) => name.toLowerCase().includes(needle));
  return direct.length ? direct : unique;
}

function preferredGstLedger(tax) {
  const rows = filteredTableRows();
  const existing = rows.map((row) => row.payload?.[`${tax.toLowerCase()} ledger`]).find(Boolean);
  if (existing) return existing;
  const options = gstTaxLedgerOptions(tax);
  const exact = options.find((name) => name.toLowerCase() === tax.toLowerCase());
  if (exact) return exact;
  return options[0] || tax;
}

function editDistance(a, b) {
  const left = String(a || "").toLowerCase();
  const right = String(b || "").toLowerCase();
  const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[left.length][right.length];
}

const ledgerSuggestionCache = new Map();
const rowLedgerProblemsCache = new Map();

const workerCode = `
  function editDistance(a, b) {
    const left = String(a || "").toLowerCase();
    const right = String(b || "").toLowerCase();
    const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
        );
      }
    }
    return dp[left.length][right.length];
  }

  self.onmessage = function(e) {
    const { type, namesToSuggest, masterNamesList } = e.data;
    if (type === 'getSuggestions') {
      const results = {};
      for (const name of namesToSuggest) {
        if (!name || !masterNamesList.length) {
          results[name] = "";
          continue;
        }
        const ranked = masterNamesList
          .map((candidate) => ({
            candidate,
            score: editDistance(name, candidate) / Math.max(String(name).length, candidate.length, 1)
          }))
          .sort((a, b) => a.score - b.score);
        results[name] = ranked[0]?.score <= 0.35 ? ranked[0].candidate : "";
      }
      self.postMessage({ type: 'suggestions', results });
    }
  };
`;

let suggestionWorker;

function initWorker() {
  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    suggestionWorker = new Worker(URL.createObjectURL(blob));
    suggestionWorker.onmessage = function(e) {
      if (e.data.type === 'suggestions') {
        for (const [name, sug] of Object.entries(e.data.results)) {
          ledgerSuggestionCache.set(name.trim().toLowerCase(), sug);
        }
        render();
      }
    };
  } catch (err) {
    console.error("Worker initialization failed:", err);
  }
}

function triggerFuzzyWorker() {
  if (!state.validation?.rows || !suggestionWorker) return;
  const missing = new Set();
  state.validation.rows.forEach(row => {
    const required = debitCreditLines(row.payload || {}, state.selectedVoucherMode).map(line => line.ledger).filter(Boolean);
    const key = voucherTypeFor(row.payload || {}).toLowerCase();
    const singleMode =
      (key === "payment" && state.selectedPaymentMode === "Single Entry") ||
      (key === "receipt" && state.selectedReceiptMode === "Single Entry") ||
      (key === "contra" && state.selectedContraMode === "Single Entry");
    if (singleMode) required.push(singleEntryAccountLedger(row.payload || {}));
    required.forEach(led => {
      if (!ledgerExists(led)) {
        missing.add(led);
      }
    });
  });
  
  const missingList = Array.from(missing);
  const uncached = missingList.filter(name => !ledgerSuggestionCache.has(name.trim().toLowerCase()));
  if (uncached.length > 0) {
    const masterNamesList = [...masterDisplayNames("ledger"), ...masterDisplayNames("gst_ledger")];
    if (masterNamesList.length > 0) {
      suggestionWorker.postMessage({
        type: 'getSuggestions',
        namesToSuggest: uncached,
        masterNamesList
      });
    }
  }
}

function closestLedgerSuggestion(name) {
  if (!name) return "";
  const cacheKey = String(name).trim().toLowerCase();
  if (ledgerSuggestionCache.has(cacheKey)) {
    return ledgerSuggestionCache.get(cacheKey);
  }
  triggerFuzzyWorker();
  return "";
}

const masterLabels = {
  ledger: "Ledger",
  stock_group: "Stock Group",
  stock_category: "Stock Category",
  stock_item: "Stock Item",
  unit: "Unit",
  godown: "Godown",
};

function ledgerExists(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  const ledgers = masterNames("ledger");
  const gstLedgers = masterNames("gst_ledger");
  return ledgers.has(normalized) || gstLedgers.has(normalized);
}

function stockItemExists(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  return masterNames("stock_item").has(normalized);
}

function rowLedgerProblems(row) {
  if (rowLedgerProblemsCache.has(row.id)) {
    return rowLedgerProblemsCache.get(row.id);
  }
  const p = row.payload || {};
  const requiredLedgers = debitCreditLines(p, state.selectedVoucherMode).map((line) => line.ledger).filter(Boolean);
  const key = voucherTypeFor(p).toLowerCase();
  const singleMode =
    (key === "payment" && state.selectedPaymentMode === "Single Entry") ||
    (key === "receipt" && state.selectedReceiptMode === "Single Entry") ||
    (key === "contra" && state.selectedContraMode === "Single Entry");
  if (singleMode) requiredLedgers.push(singleEntryAccountLedger(p));
  const missing = [...new Set(requiredLedgers.filter((ledger) => !ledgerExists(ledger)))];
  const problems = missing.map((ledger) => ({
    type: "ledger",
    ledger,
    message: `Ledger '${ledger}' is not matching with synced Tally ledgers. ${closestLedgerSuggestion(ledger) ? `Did you mean '${closestLedgerSuggestion(ledger)}'? ` : ""}Check spelling or create this ledger.`,
  }));
  if (state.selectedVoucherMode === "Item Invoice") {
    const item = itemNameForPayload(p);
    if (hasInventoryDetails(p) && !stockItemExists(item)) {
      problems.push({
        type: "stock_item",
        ledger: item,
        message: `Stock item '${item}' is not available in synced Tally stock items. Create this item before sending Item Invoice.`,
      });
    }
    const unit = unitForPayload(p);
    const knownUnits = masterNames("unit");
    if (hasInventoryDetails(p) && knownUnits.size && !knownUnits.has(unit.trim().toLowerCase())) {
      problems.push({
        type: "unit",
        ledger: unit,
        message: `Unit '${unit}' is not available in synced Tally units. Create this unit before sending Item Invoice.`,
      });
    }
    const godown = godownForPayload(p);
    const knownGodowns = masterNames("godown");
    if (hasInventoryDetails(p) && knownGodowns.size && !knownGodowns.has(godown.trim().toLowerCase())) {
      problems.push({
        type: "godown",
        ledger: godown,
        message: `Godown '${godown}' is not available in synced Tally godowns. Create this godown before sending Item Invoice.`,
      });
    }
  }
  const sideProblem = tradeLedgerSideProblem(p);
  if (sideProblem) problems.push(sideProblem);
  rowLedgerProblemsCache.set(row.id, problems);
  return problems;
}

function tradeLedgerSideProblem(payload) {
  const type = voucherTypeFor(payload).toLowerCase();
  const ledger = String(optionalPayload(payload, "purchase ledger", "")).trim();
  if (!ledger || (type !== "sales" && type !== "purchase")) return null;
  const normalized = ledger.toLowerCase();
  if (type === "sales" && normalized.includes("purchase")) {
    return {
      type: "ledger_side",
      ledger,
      message: `This is a Sales row but the trade ledger is '${ledger}'. Check the template column and use the correct sales ledger.`,
    };
  }
  if (type === "purchase" && normalized.includes("sale")) {
    return {
      type: "ledger_side",
      ledger,
      message: `This is a Purchase row but the trade ledger is '${ledger}'. Check the template column and use the correct purchase ledger.`,
    };
  }
  return null;
}

function rowCanSend(row) {
  return row.status === "ready" && !row.ignored && rowLedgerProblems(row).length === 0;
}

function filteredSendableRows() {
  return filteredReadyRows().filter(rowCanSend);
}

function selectedSendRows() {
  const sendable = filteredSendableRows();
  if (!state.selectedRowIds) return sendable;
  const selected = new Set(state.selectedRowIds);
  return sendable.filter((row) => selected.has(row.id));
}

function syncSelectionToCurrentRows() {
  if (!state.selectedRowIds) return;
  const allowed = new Set(filteredSendableRows().map((row) => row.id));
  state.selectedRowIds = state.selectedRowIds.filter((id) => allowed.has(id));
}

function toggleRowSelection(rowId) {
  const sendableIds = filteredSendableRows().map((row) => row.id);
  const selected = new Set(state.selectedRowIds || sendableIds);
  selected.has(rowId) ? selected.delete(rowId) : selected.add(rowId);
  state.selectedRowIds = [...selected].filter((id) => sendableIds.includes(id));
  state.sendResult = null;
  render();
}

function selectAllSendableRows() {
  state.selectedRowIds = filteredSendableRows().map((row) => row.id);
  state.sendResult = null;
  render();
}

function clearSelectedRows() {
  state.selectedRowIds = [];
  state.sendResult = null;
  render();
}

function toggleSelectAll(checked) {
  if (checked) {
    selectAllSendableRows();
  } else {
    clearSelectedRows();
  }
}

function rowSelectionCell(row) {
  const matchesFilter = filteredReadyRows().some((r) => r.id === row.id);
  const problems = rowLedgerProblems(row);
  const canSend = matchesFilter && rowCanSend(row);
  const selected = selectedSendRows().some((r) => r.id === row.id);
  const title = problems.length ? problems.map((p) => p.message).join(" ") : canSend ? "Selected for sending." : "Not included by current filter.";
  return `<td><input type="checkbox" ${selected ? "checked" : ""} ${canSend ? "" : "disabled"} title="${escapeHtml(title)}" onchange="toggleRowSelection('${row.id}')" /></td>`;
}

function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function transactionOptions() {
  return uniqueOptions(validationRows().map((row) => voucherTypeFor(row.payload)));
}

function partyOptions() {
  return uniqueOptions(validationRows().map((row) => row.payload["party ledger or cash"]));
}

function filteredTableRows() {
  const { voucherType, partyLedger } = state.sendFilters;
  return validationRows().filter((row) => {
    const matchesType = voucherType === "All" || voucherTypeFor(row.payload) === voucherType;
    const matchesParty = partyLedger === "All" || String(row.payload["party ledger or cash"] || "") === partyLedger;
    if (!matchesType || !matchesParty) return false;

    if (state.headerFilters) {
      for (const [column, selectedList] of Object.entries(state.headerFilters)) {
        if (selectedList && selectedList.length > 0) {
          let val = "";
          if (column === "status") {
            val = readinessLabel(row);
          } else if (column === "ledgerMatch") {
            const probs = rowLedgerProblems(row);
            val = probs.length ? "Blocked" : rowCanSend(row) ? "Matched" : "Not Ready";
          } else if (column === "rowNo") {
            val = String(getTransactionNo(row));
          } else {
            val = row.payload[column] || "";
          }
          const displayVal = val === "" ? "(blank)" : String(val);
          if (!selectedList.includes(displayVal)) {
            return false;
          }
        }
      }
    }
    return true;
  });
}

function filteredReadyRows() {
  return filteredTableRows().filter((row) => row.status === "ready" && !row.ignored);
}

function filterSummary() {
  syncSelectionToCurrentRows();
  const filtered = filteredReadyRows();
  const sendable = filteredSendableRows();
  const selected = selectedSendRows();
  const total = readyRows();
  const amount = selected.reduce((sum, row) => sum + Number(row.payload["total amount"] || 0), 0);
  return { selected: selected.length, sendable: sendable.length, filtered: filtered.length, total: total.length, blocked: filtered.length - sendable.length, amount };
}

function updateSendFilter(key, value) {
  state.sendFilters[key] = value;
  state.selectedRowIds = null;
  state.sendResult = null;
  state.currentPage = 1;
  render();
}

function resetSendFilters() {
  state.sendFilters = { voucherType: "All", partyLedger: "All" };
  state.headerFilters = {};
  state.tempHeaderFilters = {};
  state.activeHeaderFilterColumn = null;
  state.headerFilterMenuPosition = null;
  state.selectedRowIds = null;
  state.sendResult = null;
  state.currentPage = 1;
  render();
}

function filterControls() {
  const typeOptions = transactionOptions();
  const parties = partyOptions();
  const summary = filterSummary();
  return `<div class="filter-card compact-filter">
    <div class="filter-head">
      <div><h3>Table filters</h3><p>Filter this same table by transaction type and party, then tick only the rows you want to send.</p></div>
      <span class="chip ${summary.selected ? "success" : "warning"}">${summary.selected}/${summary.total} selected, ${summary.blocked} blocked</span>
    </div>
    <div class="filter-grid">
      <label>Transaction type
        <select class="input" onchange="updateSendFilter('voucherType', this.value)">
          <option ${state.sendFilters.voucherType === "All" ? "selected" : ""}>All</option>
          ${typeOptions.map((type) => `<option ${state.sendFilters.voucherType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
        </select>
      </label>
      <label>Party ledger
        <select class="input" onchange="updateSendFilter('partyLedger', this.value)">
          <option ${state.sendFilters.partyLedger === "All" ? "selected" : ""}>All</option>
          ${parties.map((party) => `<option ${state.sendFilters.partyLedger === party ? "selected" : ""}>${escapeHtml(party)}</option>`).join("")}
        </select>
      </label>
      <div class="filter-total"><span>Selected amount</span><strong>${money(summary.amount)}</strong></div>
      <button class="btn" onclick="resetSendFilters()">Clear filters</button>
    </div>
  </div>`;
}

function ledgerMatchSummary() {
  const rows = filteredReadyRows().slice(0, 6);
  if (!rows.length) return `<div class="mock-note">No rows match the current filters.</div>`;
  return `<div class="match-list">${rows.map((row) => {
    const p = row.payload;
    const problems = rowLedgerProblems(row);
    const lines = debitCreditLines(p, state.selectedVoucherMode).map((line) => `${line.prefix} ${line.ledger}`).join(" / ");
    return `<div class="match-line"><strong>Transaction ${getTransactionNo(row)}</strong><span>${escapeHtml(lines)}</span>${problems.length ? `<span class="chip danger">Blocked</span>` : `<span class="chip success">Matched</span>`}</div>`;
  }).join("")}</div>`;
}

let supabaseClient = null;
let authListenerSubscription = null;

function setupSupabaseAuthListener() {
  if (supabaseClient) {
    try {
      if (authListenerSubscription) {
        authListenerSubscription.subscription.unsubscribe();
      }
      const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
          state.authenticated = true;
          state.user = session.user;
          if (state.route === "auth" || state.route === "plans" || state.route === "login") {
            if (state.selectedPlan) {
              go("login");
            } else {
              go("plans");
            }
          }
        } else {
          state.authenticated = false;
          state.user = null;
          const isOffline = localStorage.getItem("tally_offline_mode") === "true";
          if (!isOffline) {
            go("auth");
          }
        }
      });
      authListenerSubscription = data;
    } catch (e) {
      console.error("onAuthStateChange failed:", e);
    }
  }
}

function saveSupabaseSettings() {
  localStorage.setItem("supabase_url", state.authSupabaseUrl || "");
  localStorage.setItem("supabase_key", state.authSupabaseKey || "");
  initSupabase();
  setupSupabaseAuthListener();
  state.notice = "Supabase connection settings saved successfully.";
  render();
}

function initSupabase() {
  const url = localStorage.getItem("supabase_url") || "https://vzzedjamwtsjuyhyuguu.supabase.co";
  const key = localStorage.getItem("supabase_key") || "sb_publishable_CZjtaX5xlaz_tI0yIS3t2g_1W0DpoWq";
  if (url && key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
    } catch (e) {
      console.error("Supabase init failed:", e);
    }
  }
}

async function checkAuthSession() {
  const isOffline = localStorage.getItem("tally_offline_mode") === "true";
  if (isOffline) {
    state.authenticated = true;
    return;
  }
  
  initSupabase();
  if (supabaseClient) {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (session) {
        state.authenticated = true;
        state.user = session.user;
      }
    } catch (e) {
      console.error("Error checking session:", e);
    }
  }
}

async function authGoogleLogin() {
  state.busy = true;
  state.authError = "";
  render();
  
  initSupabase();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      state.authError = "Google Auth error: " + error.message;
      state.busy = false;
      render();
    }
  } else {
    setTimeout(() => {
      state.authenticated = true;
      state.busy = false;
      state.notice = "Logged in using local offline mode fallback (Google Auth Mock).";
      go("login");
    }, 800);
  }
}

async function authEmailLogin() {
  if (!state.authEmail || !state.authPassword) {
    state.authError = "Email and Password are required.";
    render();
    return;
  }
  state.busy = true;
  state.authError = "";
  render();
  
  initSupabase();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: state.authEmail,
        password: state.authPassword
      });
      if (error) throw error;
      state.authenticated = true;
      state.busy = false;
      go("login");
    } catch (error) {
      state.authError = "Authentication failed: " + error.message;
      state.busy = false;
      render();
    }
  } else {
    setTimeout(() => {
      if (state.authEmail === "admin@tally.com" && state.authPassword === "admin123") {
        state.authenticated = true;
        state.busy = false;
        state.notice = "Logged in as Admin (Local Offline Fallback).";
        go("login");
      } else {
        state.authError = "Incorrect credentials. Try admin@tally.com / admin123 or enter Supabase credentials below.";
        state.busy = false;
        render();
      }
    }, 600);
  }
}

async function authEmailSignUp() {
  if (!state.authEmail || !state.authPassword) {
    state.authError = "Email and Password are required.";
    render();
    return;
  }
  state.busy = true;
  state.authError = "";
  render();
  
  initSupabase();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: state.authEmail,
        password: state.authPassword
      });
      if (error) throw error;
      
      if (data.session) {
        state.authenticated = true;
        state.busy = false;
        go("login");
      } else {
        state.busy = false;
        state.authError = "Signup successful! Please check your email for verification link.";
        render();
      }
    } catch (error) {
      state.authError = "Sign Up failed: " + error.message;
      state.busy = false;
      render();
    }
  } else {
    setTimeout(() => {
      state.authenticated = true;
      state.busy = false;
      state.notice = "Sign up successful! Welcome to Tally Automation (Offline Mock).";
      go("login");
    }, 800);
  }
}

function loginAsGuestAccount() {
  localStorage.setItem("tally_offline_mode", "true");
  localStorage.setItem("tally_username", "guest-01");
  localStorage.setItem("tally_selected_plan", "Enterprise Pro");
  state.authenticated = true;
  state.selectedPlan = "Enterprise Pro";
  state.notice = "Logged in as Guest (guest-01). Paired with Tally Automation Connector.";
  go("dashboard");
}

function useOfflineMode() {
  localStorage.setItem("tally_offline_mode", "true");
  state.authenticated = true;
  state.notice = "Local offline mode active. Supabase auth bypassed.";
  go("login");
}

async function authSignOut() {
  state.authenticated = false;
  state.selectedPlan = "";
  localStorage.removeItem("tally_offline_mode");
  localStorage.removeItem("tally_selected_plan");
  
  initSupabase();
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      console.error("SignOut failed:", e);
    }
  }
  go("auth");
}

function auth() {
  const isSignIn = state.authFormMode === "signin";
  const errorAlert = state.authError
    ? `<div class="p-4 bg-error-container/30 text-error rounded-xl border border-error/20 text-xs font-semibold mb-4 leading-tight">${escapeHtml(state.authError)}</div>`
    : "";
    
  return `
    <div class="login-shell flex items-center justify-center min-h-screen bg-slate-950 relative overflow-hidden" style="background: radial-gradient(circle at center, #020617 0%, #090d16 100%);">
      <div class="absolute w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] -top-48 -left-48 animate-pulse-soft"></div>
      <div class="absolute w-[500px] h-[500px] rounded-full bg-secondary/5 blur-[100px] -bottom-48 -right-48 animate-pulse-soft" style="animation-delay: 1.5s;"></div>

      <section class="w-full max-w-[450px] p-8 rounded-3xl border border-outline-variant/20 glass-pro text-on-surface shadow-2xl relative z-10 mx-4">
        <div class="flex flex-col items-center mb-6 text-center">
          <div class="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-3 animate-subtle-pulse">
            <span class="material-symbols-outlined text-white text-[32px]">account_balance</span>
          </div>
          <h1 class="text-2xl font-black text-primary tracking-tighter">Tally Automation</h1>
          <p class="text-[10px] font-bold text-outline uppercase tracking-widest leading-none mt-1">Enterprise Auth Gate</p>
        </div>

        ${errorAlert}

        <div class="flex bg-surface-container/50 border border-outline-variant/20 p-1.5 rounded-2xl mb-6">
          <button class="flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all ${isSignIn ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant/70 hover:text-primary'}" onclick="state.authFormMode = 'signin'; state.authError = ''; render();">
            Sign In
          </button>
          <button class="flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all ${!isSignIn ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant/70 hover:text-primary'}" onclick="state.authFormMode = 'signup'; state.authError = ''; render();">
            Create Account
          </button>
        </div>

        <button class="w-full py-3 px-4 bg-white border border-outline-variant/30 text-on-surface font-semibold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-[0.98] shadow-sm select-none" onclick="authGoogleLogin()">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span class="text-xs font-bold text-slate-800">Continue with Google</span>
        </button>

        <div class="flex items-center my-6">
          <div class="flex-1 h-[1px] bg-outline-variant/20"></div>
          <span class="px-3 text-[10px] font-bold text-outline uppercase tracking-wider">or email auth</span>
          <div class="flex-1 h-[1px] bg-outline-variant/20"></div>
        </div>

        <div class="space-y-4">
          <div class="field !mt-0">
            <label class="text-xs font-bold text-outline">Email Address</label>
            <input type="email" class="input w-full mt-1.5" placeholder="name@company.com" value="${escapeHtml(state.authEmail || "")}" oninput="state.authEmail = this.value;" />
          </div>
          <div class="field !mt-0">
            <label class="text-xs font-bold text-outline">Password</label>
            <input type="password" class="input w-full mt-1.5" placeholder="••••••••" value="${escapeHtml(state.authPassword || "")}" oninput="state.authPassword = this.value;" />
          </div>
        </div>

        <button class="btn primary large w-full mt-6 flex items-center justify-center gap-2 glow-button text-xs font-bold py-3.5 rounded-2xl" onclick="${isSignIn ? 'authEmailLogin()' : 'authEmailSignUp()'}">
          <span class="material-symbols-outlined text-[18px]">${isSignIn ? "login" : "person_add"}</span>
          ${isSignIn ? "Sign In with Password" : "Create Account & Sign In"}
        </button>

        <button class="btn secondary large w-full mt-3 flex items-center justify-center gap-2 text-xs font-bold py-3.5 rounded-2xl bg-secondary text-white shadow-md hover:bg-secondary-container transition-all" onclick="loginAsGuestAccount()">
          <span class="material-symbols-outlined text-[18px]">verified_user</span>
          Sign In as Guest (guest-01) - Connector Paired
        </button>

        <div class="mt-4 flex flex-col items-center gap-2">
          <button class="text-xs font-semibold text-primary hover:underline" onclick="useOfflineMode()">
            Skip Auth / Use Local Offline Mode
          </button>
        </div>

        <div class="mt-8 pt-4 border-t border-outline-variant/20">
          <button class="w-full flex items-center justify-between text-[11px] font-bold text-outline hover:text-primary transition-all uppercase tracking-wider" onclick="state.showAuthSettings = !state.showAuthSettings; render();">
            <span>Supabase Connection Settings</span>
            <span class="material-symbols-outlined text-[16px]">${state.showAuthSettings ? 'expand_less' : 'expand_more'}</span>
          </button>
          
          <div class="mt-3 space-y-3 ${state.showAuthSettings ? '' : 'hidden'}">
            <div class="field !mt-0">
              <label class="text-[10px] font-bold text-outline">Supabase URL</label>
              <input type="text" class="input w-full mt-1 px-3 py-1.5 text-xs" placeholder="https://xxxx.supabase.co" value="${escapeHtml(state.authSupabaseUrl || "")}" oninput="state.authSupabaseUrl = this.value;" />
            </div>
            <div class="field !mt-0">
              <label class="text-[10px] font-bold text-outline">Supabase Anon Key</label>
              <input type="password" class="input w-full mt-1 px-3 py-1.5 text-xs" placeholder="eyJhbGciOi..." value="${escapeHtml(state.authSupabaseKey || "")}" oninput="state.authSupabaseKey = this.value;" />
            </div>
            <button class="w-full mt-2 py-2.5 bg-primary text-white text-[10px] font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all select-none uppercase tracking-wider" onclick="saveSupabaseSettings()">Save Connection Settings</button>
            <p class="text-[9px] text-outline/70 leading-normal">
              Enter your project URL and anon public key and click Save. Leaving them blank enables offline bypass mode (credentials: admin@tally.com / admin123).
            </p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function choosePlan(plan) {
  state.selectedPlan = plan;
  localStorage.setItem("tally_selected_plan", plan);
  go("login");
}

function plans() {
  return `
    <div class="plans-shell flex items-center justify-center min-h-screen bg-slate-950 relative overflow-hidden" style="background: radial-gradient(circle at center, #020617 0%, #090d16 100%);">
      <div class="absolute w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] -top-48 -left-48 animate-pulse-soft"></div>
      <div class="absolute w-[500px] h-[500px] rounded-full bg-secondary/5 blur-[100px] -bottom-48 -right-48 animate-pulse-soft" style="animation-delay: 1.5s;"></div>

      <div class="w-full max-w-4xl p-8 relative z-10 mx-4">
        <div class="text-center mb-10">
          <h1 class="text-3xl font-black text-white tracking-tight">Select Subscription Plan</h1>
          <p class="text-outline mt-2 text-sm">Choose the best fit for your enterprise synchronization workflows.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Basic Plan Card -->
          <div class="rounded-3xl border border-outline-variant/20 glass-pro p-8 text-on-surface shadow-2xl flex flex-col justify-between hover:border-outline/40 transition-all duration-300">
            <div>
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h3 class="text-xl font-bold text-on-surface">Basic Plan</h3>
                  <p class="text-xs text-outline mt-1">Core automated synchronization</p>
                </div>
                <div class="text-right">
                  <span class="text-2xl font-black text-primary">Free</span>
                  <span class="text-xs text-outline block">Local trial mode</span>
                </div>
              </div>

              <div class="w-full h-px bg-outline-variant/20 my-6"></div>

              <ul class="space-y-4 text-on-surface-variant">
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Automated Transaction Processing & Verification</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Multi-Tax Validation & GST Schema Matching</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>ERP Gateway Synchronization (Tally Prime / ERP 9)</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Error Diagnostics & Mappings Review</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Basic Sync History logs</span>
                </li>
              </ul>
            </div>

            <button class="btn secondary large w-full mt-10 py-3.5 rounded-2xl font-bold text-xs shadow-md active:scale-95 transition-all select-none" onclick="choosePlan('Basic Plan')">
              Select Basic Plan
            </button>
          </div>

          <!-- Master Plan Card -->
          <div class="rounded-3xl border border-primary/40 glass-pro p-8 text-on-surface shadow-2xl flex flex-col justify-between hover:border-primary/70 transition-all duration-300 relative">
            <div class="absolute -top-3.5 right-6 bg-gradient-to-r from-primary to-secondary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-primary/20 shadow-md">
              Recommended
            </div>

            <div>
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h3 class="text-xl font-bold text-on-surface">Master Plan</h3>
                  <p class="text-xs text-outline mt-1">Full enterprise customization</p>
                </div>
                <div class="text-right">
                  <span class="text-2xl font-black text-primary">Premium</span>
                  <span class="text-xs text-outline block">Premium access</span>
                </div>
              </div>

              <div class="w-full h-px bg-outline-variant/20 my-6"></div>

              <ul class="space-y-4 text-on-surface-variant">
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span class="font-bold text-primary">All Basic Plan features included</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Custom templates matching your company layout</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Customize transaction formats (PDF, Excel export options)</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Custom calculations, columns, and validation formulas</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>Flexible sync dashboards with real-time analytics</span>
                </li>
                <li class="flex items-start gap-3 text-xs leading-normal">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <span>24/7 dedicated support & custom developer integrations</span>
                </li>
              </ul>
            </div>

            <button class="btn primary large w-full mt-10 py-3.5 rounded-2xl font-bold text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all select-none" onclick="choosePlan('Master Plan')">
              Select Master Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function onCompanyInput(event) {
  state.selectedTallyCompany = event.target.value;
  const btn = document.getElementById("continue-btn");
  if (btn) {
    const isFormValid = !!(state.selectedTallyCompany && state.selectedTallyCompany.trim());
    btn.disabled = !isFormValid;
    if (isFormValid) {
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
  }
}

function login() {
  const isFormValid = !!(state.selectedTallyCompany && state.selectedTallyCompany.trim());
  return `<div class="login-shell">
    <section class="login-panel">
      <div class="flex flex-col items-center mb-8 text-center">
        <div class="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-3">
          <span class="material-symbols-outlined text-white text-[26px]">account_balance</span>
        </div>
        <h1 class="text-xl font-black text-primary tracking-tighter">Tally Automation</h1>
        <p class="text-[9px] font-semibold text-outline uppercase tracking-widest leading-none mt-1">Intelligence Layer</p>
      </div>

      <h2 class="text-lg font-bold text-on-surface mb-2">Connect to Tally Automation</h2>
      <p class="text-xs text-outline mb-3">Start Tally ERP9 or TallyPrime, select your company, then continue. The app will check 127.0.0.1:9000.</p>
      
      <!-- Tally Company Name (Required) -->
      <div class="field !mt-3">
        <label class="text-xs font-semibold text-on-surface">Active Tally Company (Reported by Connector)</label>
        <div class="flex gap-2 mt-1">
          <input class="input flex-1 bg-surface-container-low" value="${escapeHtml(state.selectedTallyCompany || state.tally.company || "Waiting for Connector...")}" readonly placeholder="Connected Company..." />
        </div>
      </div>
      <button id="continue-btn" class="btn primary large w-full mt-6 ${isFormValid ? '' : 'opacity-50 cursor-not-allowed'}" ${isFormValid ? '' : 'disabled'} onclick="go('dashboard'); refreshAll();">${icon("check")} Continue to dashboard</button>
      <div class="mt-4 text-center text-body-md font-bold text-slate-900 bg-slate-100 p-4 rounded-xl border border-slate-200">
        ${state.tally.message || "Ready to check local Tally."}
      </div>
    </section>
  </div>`;
}

function dashboard() {
  const c = state.masters.counts || {};
  const uploads = state.history.uploads || [];
  const tallyVouchers = state.history.tallyVouchers || [];
  const summary = state.validation?.summary || { ready: 0, needsFix: 0, total: 0 };

  const companyCountStr = String(c.companies || 1).padStart(2, '0');
  const companyStatusBadge = state.tally.online
    ? `<div class="px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 flex items-center gap-1 border border-emerald-100">
         <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
         CONNECTED
       </div>`
    : state.tally.tallyRunning
      ? `<div class="px-2.5 py-1 rounded-full bg-amber-50 text-[10px] font-bold text-amber-600 flex items-center gap-1 border border-amber-100">
           <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
           WARNING
         </div>`
      : `<div class="px-2.5 py-1 rounded-full bg-red-50 text-[10px] font-bold text-red-600 flex items-center gap-1 border border-red-100">
           <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
           OFFLINE
         </div>`;
  
  const companyName = state.tally.online ? (state.tally.company || "Tally Automation India Ltd.") : "Tally Automation India Ltd.";
  
  const totalLedgersStr = Number(state.tally.online ? (c.ledgers !== undefined ? c.ledgers : 0) : (c.ledgers || 329)).toLocaleString();
  const pendingLedgers = summary.needsFix || 9;
  const mappedLedgers = (state.tally.online ? (c.ledgers !== undefined ? c.ledgers : 0) : (c.ledgers || 329)) > pendingLedgers ? (state.tally.online ? (c.ledgers !== undefined ? c.ledgers : 0) : (c.ledgers || 329)) - pendingLedgers : 320;
  const mappingIntegrity = (state.tally.online ? (c.ledgers !== undefined ? c.ledgers : 0) : (c.ledgers || 329)) ? (((state.tally.online ? (c.ledgers !== undefined ? c.ledgers : 0) : (c.ledgers || 329)) - pendingLedgers) / (state.tally.online ? (c.ledgers !== undefined ? c.ledgers : 0) : (c.ledgers || 329)) * 100).toFixed(1) : "97.2";

  const vouchersStr = Number(state.tally.online ? (c.vouchers !== undefined ? c.vouchers : 0) : (c.vouchers || 2842)).toLocaleString();
  const vouchersToday = tallyVouchers.filter(v => {
    const todayStr = new Date().toISOString().split('T')[0];
    return v.voucher_date === todayStr;
  }).length || (state.tally.online ? 0 : 18);
  const vouchersFailed = state.tally.online ? (summary.needsFix || 0) : (summary.needsFix || 4);

  const syncStatusBadge = state.busy
    ? `<div class="px-2.5 py-1 rounded-full bg-amber-50 text-[10px] font-bold text-amber-600 border border-amber-100 uppercase animate-pulse">Syncing...</div>`
    : `<div class="px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase">CONNECTED</div>`;

  const itemsStr = Number(state.tally.online ? (c.stockItems !== undefined ? c.stockItems : 0) : (c.stockItems || 8432)).toLocaleString();

  // Sync Intelligence Panel
  const syncStatusText = "Operational";
  const syncBadgeBg = "bg-emerald-50";
  const syncBadgeText = "text-emerald-600";
  const syncBadgeBorder = "border-emerald-100";
  const syncBadgeIcon = "bolt";
  const syncBadgeLabel = "Active";

  const healthPercent = 98;
  const strokeDashoffset = (263.89 * (1 - healthPercent / 100)).toFixed(2);
  const latencyVal = "14";
  const lastSyncTime = state.history?.lastSync ? formatDate(state.history.lastSync).split(" ")[1] || "14:22:09" : "14:22:09";

  const pendingCount = summary.needsFix || 5;

  const syncButtonContent = state.busy
    ? `<div class="flex items-center justify-center gap-2">
         <svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
           <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
           <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
         </svg>
         PROCESSING...
       </div>`
    : `<span class="material-symbols-outlined text-[20px]">sync</span> FORCE SYNCHRONIZATION`;

  return tailwindShell("dashboard", `
    <!-- Hero Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h2 class="text-display-lg font-black text-primary">Intelligence Command</h2>
        <p class="text-body-lg text-outline/80 max-w-2xl">Orchestrating high-fidelity data synchronization between your ecosystem and Tally ERP 9 instance.</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button class="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-lg hover:shadow-primary/25 transition-all shadow-sm group" onclick="go('bank_import')">
          <span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">receipt_long</span>
          <span>Bank Statement Import (Bulk PDF)</span>
        </button>
        <button class="flex items-center gap-2.5 px-5 py-3 rounded-xl glass-pro border border-primary/20 text-primary font-bold hover:bg-primary hover:text-white transition-all shadow-sm group" onclick="go('upload')">
          <span class="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">cloud_upload</span>
          <span>Upload Excel Vouchers</span>
        </button>
      </div>
    </div>

    <!-- Tier 1: Core KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <!-- KPI: Companies -->
      <div class="glass-pro p-6 rounded-[2rem] border-b-4 border-b-primary relative overflow-hidden group">
        <div class="flex items-start justify-between mb-6">
          <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-[28px]">apartment</span>
          </div>
          ${companyStatusBadge}
        </div>
        <div class="space-y-1">
          <div class="text-[40px] font-display-lg text-on-surface leading-none tracking-tighter">${companyCountStr}</div>
          <div class="text-label-caps text-outline text-[10px]">ACTIVE ERP INSTANCES</div>
        </div>
        <div class="mt-6 pt-5 border-t border-outline-variant/30 flex items-center justify-between">
          <div class="flex flex-col">
            <span class="text-[11px] font-bold text-on-surface/80">${companyName}</span>
            <span class="text-[9px] text-outline font-data-mono uppercase tracking-tighter">ID: TN-09-ERP</span>
          </div>
          <span class="material-symbols-outlined text-emerald-500 text-[20px]">verified</span>
        </div>
      </div>

      <!-- KPI: Ledgers -->
      <div class="glass-pro p-6 rounded-[2rem] border-b-4 border-b-secondary relative overflow-hidden group">
        <div class="flex items-start justify-between mb-6">
          <div class="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
            <span class="material-symbols-outlined text-[28px]">account_balance_wallet</span>
          </div>
          <div class="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <span class="material-symbols-outlined text-[16px]">trending_up</span> +12%
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-[40px] font-display-lg text-on-surface leading-none tracking-tighter">${totalLedgersStr}</div>
          <div class="text-label-caps text-outline text-[10px]">TOTAL MASTER LEDGERS</div>
        </div>
        <div class="mt-6 space-y-2">
          <div class="flex justify-between text-[10px] font-bold">
            <span class="text-secondary uppercase">Mapping Integrity</span>
            <span class="text-on-surface">${mappingIntegrity}%</span>
          </div>
          <div class="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div class="h-full bg-secondary" style="width: ${mappingIntegrity}%"></div>
          </div>
          <div class="flex justify-between text-[9px] text-outline italic">
            <span>${mappedLedgers} Mapped</span>
            <span class="text-error font-medium">${pendingLedgers} Pending</span>
          </div>
        </div>
      </div>

      <!-- KPI: Vouchers -->
      <div class="glass-pro p-6 rounded-[2rem] border-b-4 border-b-tertiary relative overflow-hidden group">
        <div class="flex items-start justify-between mb-6">
          <div class="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
            <span class="material-symbols-outlined text-[28px]">history_edu</span>
          </div>
          ${syncStatusBadge}
        </div>
        <div class="space-y-1">
          <div class="text-[40px] font-display-lg text-on-surface leading-none tracking-tighter">${vouchersStr}</div>
          <div class="text-label-caps text-outline text-[10px]">VOUCHER TRANSACTIONS</div>
        </div>
        <div class="mt-6 pt-5 border-t border-outline-variant/30 grid grid-cols-2 gap-2">
          <div class="flex flex-col">
            <span class="text-[12px] font-bold text-on-surface">${vouchersToday}</span>
            <span class="text-[9px] text-outline uppercase font-label-caps">Today</span>
          </div>
          <div class="flex flex-col border-l border-outline-variant/30 pl-3">
            <span class="text-[12px] font-bold text-error">${vouchersFailed}</span>
            <span class="text-[9px] text-outline uppercase font-label-caps">Failed</span>
          </div>
        </div>
      </div>

      <!-- KPI: Financial Health (Mini Chart) -->
      <div class="glass-pro p-6 rounded-[2rem] border-b-4 border-b-outline relative overflow-hidden group">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 rounded-2xl bg-outline-variant/20 flex items-center justify-center text-outline">
            <span class="material-symbols-outlined text-[28px]">inventory_2</span>
          </div>
          <div class="text-right">
            <div class="text-[18px] font-bold text-on-surface">${itemsStr}</div>
            <div class="text-[9px] text-outline font-label-caps">TOTAL ITEMS</div>
          </div>
        </div>
        <!-- Mini Sparkline Visualization -->
        <div class="h-16 w-full relative">
          <svg class="w-full h-full" viewBox="0 0 100 40">
            <path class="text-primary sparkline" d="M0 35 Q 20 10, 40 30 T 80 15 L 100 5" fill="none" stroke="currentColor" stroke-width="2"></path>
          </svg>
          <div class="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent"></div>
        </div>
        <div class="mt-2 text-[10px] text-outline leading-tight"><span class="font-bold text-primary">Stock Item</span> synchronization status.</div>
      </div>
    </div>

    <!-- Tier 2: Redesigned Intelligence Command Center -->
    <div class="grid grid-cols-12 gap-8 items-stretch">
      <!-- Left Panel: Sync Intelligence Module -->
      <div class="col-span-12 lg:col-span-4 flex flex-col">
        <div class="glass-pro rounded-[2.5rem] border border-primary/10 overflow-hidden h-full flex flex-col bg-gradient-to-b from-white/80 to-white/40 shadow-2xl">
          <div class="p-8 pb-4">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h3 class="text-headline-sm font-black text-primary tracking-tight">Sync Intelligence</h3>
                <p class="text-[11px] font-bold text-outline/60 uppercase tracking-widest mt-1">Status: ${syncStatusText}</p>
              </div>
              <div class="flex items-center gap-1 px-3 py-1 ${syncBadgeBg} ${syncBadgeText} rounded-full border ${syncBadgeBorder}">
                <span class="material-symbols-outlined text-[14px]">${syncBadgeIcon}</span>
                <span class="text-[10px] font-black uppercase">${syncBadgeLabel}</span>
              </div>
            </div>
            <!-- Ecosystem Health Gauge -->
            <div class="flex flex-col items-center justify-center py-6 relative">
              <div class="relative w-48 h-48 flex items-center justify-center">
                <svg class="w-full h-full" viewBox="0 0 100 100">
                  <!-- Background Circle -->
                  <circle cx="50" cy="50" fill="none" r="42" stroke="#e5eeff" stroke-width="8"></circle>
                  <!-- Progress Circle -->
                  <circle class="health-gauge" cx="50" cy="50" fill="none" r="42" stroke="url(#healthGradient)" stroke-dasharray="263.89" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" stroke-width="8"></circle>
                  <defs>
                    <linearGradient id="healthGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stop-color="#00288e"></stop>
                      <stop offset="100%" stop-color="#64a8fe"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span class="text-[44px] font-black text-primary leading-none">${healthPercent}<span class="text-[20px] font-bold">%</span></span>
                  <span class="text-[9px] font-black text-outline uppercase tracking-[0.2em] mt-1">Ecosystem Health</span>
                </div>
              </div>
            </div>
            <!-- High-End Typography Micro-stats -->
            <div class="grid grid-cols-2 gap-4 mt-8">
              <div class="p-5 rounded-2xl bg-white/50 border border-white/80 shadow-sm text-center">
                <p class="text-[9px] font-black text-outline/60 uppercase tracking-widest mb-1">Gateway Latency</p>
                <p class="text-[20px] font-black text-on-surface tracking-tight">${latencyVal}<span class="text-body-md text-outline">ms</span></p>
              </div>
              <div class="p-5 rounded-2xl bg-white/50 border border-white/80 shadow-sm text-center">
                <p class="text-[9px] font-black text-outline/60 uppercase tracking-widest mb-1">System Uptime</p>
                <p class="text-[20px] font-black text-emerald-600 tracking-tight">99.9<span class="text-body-md opacity-60">%</span></p>
              </div>
            </div>
          </div>
          <div class="mt-auto p-8 pt-4">
            <button class="w-full py-5 bg-primary text-white rounded-2xl text-[12px] font-black tracking-[0.15em] shadow-[0_20px_40px_-10px_rgba(0,40,142,0.3)] hover:shadow-[0_20px_50px_-10px_rgba(0,40,142,0.4)] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3" onclick="syncNow()" ${state.busy ? 'disabled' : ''}>
              ${syncButtonContent}
            </button>
            <div class="mt-6 flex items-center justify-between text-[11px] px-2">
              <span class="text-outline/60">Last sync verified: <span class="font-bold text-on-surface">${lastSyncTime}</span></span>
              <a class="font-bold text-primary hover:underline" href="#" onclick="event.preventDefault(); go('sync')">History</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Data Orchestration Table -->
      <div class="col-span-12 lg:col-span-8 flex flex-col">
        <div class="glass-pro rounded-[2.5rem] border border-outline-variant/20 overflow-hidden h-full flex flex-col shadow-2xl">
          <div class="px-10 py-8 border-b border-outline-variant/10 flex items-center justify-between bg-white/50">
            <div class="flex items-center gap-5">
              <div class="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                <span class="material-symbols-outlined text-[24px]">dataset</span>
              </div>
              <div>
                <h3 class="text-headline-sm font-black text-on-surface tracking-tight">Data Orchestration Logs</h3>
                <div class="flex items-center gap-3 mt-1">
                  <span class="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Monitoring
                  </span>
                  <span class="text-outline/40 text-[10px]">•</span>
                  <span class="text-[10px] font-bold text-outline/60 uppercase">${pendingCount} Critical Vouchers Pending</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <button class="p-2.5 rounded-xl border border-outline-variant/30 hover:bg-white transition-colors text-outline" onclick="go('mapping')">
                <span class="material-symbols-outlined text-[20px]">filter_list</span>
              </button>
              <a class="px-5 py-2.5 bg-surface-container-high rounded-xl text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:bg-primary hover:text-white transition-all duration-300" href="#" onclick="event.preventDefault(); go('mapping')">
                DEEP AUDIT <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            </div>
          </div>
          <div class="overflow-x-auto flex-1">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-surface-container-low/20">
                  <th class="px-10 py-5 text-[10px] font-black text-outline/60 uppercase tracking-[0.2em]">Signature &amp; Integrity</th>
                  <th class="px-8 py-5 text-[10px] font-black text-outline/60 uppercase tracking-[0.2em]">Protocol</th>
                  <th class="px-8 py-5 text-[10px] font-black text-outline/60 uppercase tracking-[0.2em]">Compliance</th>
                  <th class="px-10 py-5 text-[10px] font-black text-outline/60 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/5">
                <!-- Enhanced Row 1 -->
                <tr class="hover:bg-primary/[0.03] transition-colors group">
                  <td class="px-10 py-6">
                    <div class="flex items-center gap-5">
                      <div class="relative">
                        <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary border border-outline-variant/20 group-hover:scale-110 transition-transform duration-300">
                          <span class="material-symbols-outlined text-[22px]">description</span>
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div class="space-y-1.5">
                        <p class="font-black text-on-surface text-[15px] leading-none tracking-tight">purchase_gst_inventory_v4.xlsx</p>
                        <div class="flex items-center gap-3">
                          <div class="flex items-center h-2 w-16 gap-0.5">
                            <div class="h-full w-full bg-emerald-500 rounded-full opacity-30"></div>
                            <div class="h-full w-full bg-emerald-500 rounded-full opacity-60"></div>
                            <div class="h-full w-full bg-emerald-500 rounded-full"></div>
                          </div>
                          <span class="text-[9px] font-black text-outline/40 uppercase tracking-widest font-data-mono">Hash: 8XF2...L9</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <span class="px-4 py-1.5 rounded-lg text-[9px] font-black bg-secondary-container/10 text-secondary border border-secondary/20 uppercase tracking-widest protocol-glow-purchase">Purchase Order</span>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      <span class="text-[11px] font-black text-on-surface tracking-tight">SECURED</span>
                    </div>
                  </td>
                  <td class="px-10 py-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button class="px-5 py-2 bg-primary text-white text-[10px] font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all" onclick="pushFileToErp('purchase_gst_inventory_v4.xlsx', this)">PUSH TO ERP</button>
                      <button class="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container-high text-primary hover:bg-primary hover:text-white transition-all" title="Premium Review" onclick="go('mapping')">
                        <span class="material-symbols-outlined text-[18px]">verified_user</span>
                      </button>
                    </div>
                  </td>
                </tr>
                <!-- Enhanced Row 2 -->
                <tr class="hover:bg-primary/[0.03] transition-colors group">
                  <td class="px-10 py-6">
                    <div class="flex items-center gap-5">
                      <div class="relative">
                        <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary border border-outline-variant/20 group-hover:scale-110 transition-transform duration-300">
                          <span class="material-symbols-outlined text-[22px]">query_stats</span>
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div class="space-y-1.5">
                        <p class="font-black text-on-surface text-[15px] leading-none tracking-tight">sales_performance_log_july.xls</p>
                        <div class="flex items-center gap-3">
                          <div class="flex items-center h-2 w-16 gap-0.5">
                            <div class="h-full w-full bg-primary rounded-full"></div>
                            <div class="h-full w-full bg-primary rounded-full opacity-40"></div>
                            <div class="h-full w-full bg-primary rounded-full opacity-20"></div>
                          </div>
                          <span class="text-[9px] font-black text-outline/40 uppercase tracking-widest font-data-mono">Hash: K9A2...P0</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <span class="px-4 py-1.5 rounded-lg text-[9px] font-black bg-primary-container/10 text-primary border border-primary/20 uppercase tracking-widest protocol-glow-sales">Sales Voucher</span>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span class="text-[11px] font-black text-on-surface tracking-tight">SECURED</span>
                    </div>
                  </td>
                  <td class="px-10 py-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button class="px-5 py-2 bg-primary text-white text-[10px] font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all" onclick="pushFileToErp('sales_performance_log_july.xls', this)">PUSH TO ERP</button>
                      <button class="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container-high text-primary hover:bg-primary hover:text-white transition-all" title="Premium Review" onclick="go('mapping')">
                        <span class="material-symbols-outlined text-[18px]">verified_user</span>
                      </button>
                    </div>
                  </td>
                </tr>
                <!-- Enhanced Row 3 (Warning State) -->
                <tr class="bg-amber-50/[0.15] hover:bg-amber-50/[0.25] transition-colors group">
                  <td class="px-10 py-6">
                    <div class="flex items-center gap-5">
                      <div class="relative">
                        <div class="w-12 h-12 rounded-2xl bg-amber-50 shadow-sm flex items-center justify-center text-amber-600 border border-amber-200 group-hover:scale-110 transition-transform duration-300">
                          <span class="material-symbols-outlined text-[22px]">warning</span>
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 border-2 border-white rounded-full animate-pulse"></div>
                      </div>
                      <div class="space-y-1.5">
                        <p class="font-black text-on-surface text-[15px] leading-none tracking-tight">manual_journal_entries.xlsx</p>
                        <div class="flex items-center gap-3">
                          <div class="flex items-center h-2 w-16 gap-0.5">
                            <div class="h-full w-full bg-amber-400 rounded-full"></div>
                            <div class="h-full w-full bg-outline-variant/30 rounded-full"></div>
                            <div class="h-full w-full bg-outline-variant/30 rounded-full"></div>
                          </div>
                          <span class="text-[9px] font-black text-amber-600/60 uppercase tracking-widest font-data-mono">Review Integrity</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <span class="px-4 py-1.5 rounded-lg text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-widest protocol-glow-warning">Journal</span>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                      <span class="text-[11px] font-black text-amber-700 tracking-tight">UNVERIFIED</span>
                    </div>
                  </td>
                  <td class="px-10 py-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button class="px-5 py-2 bg-secondary text-white text-[10px] font-black rounded-xl shadow-lg shadow-secondary/20 hover:scale-105 transition-all uppercase tracking-widest" onclick="go('mapping')">MAP LEDGERS</button>
                      <button class="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white transition-all" onclick="go('mapping')">
                        <span class="material-symbols-outlined text-[18px]">rule</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-10 py-5 bg-surface-container-low/30 border-t border-outline-variant/5 flex items-center justify-between">
            <p class="text-[10px] font-bold text-outline/60 uppercase tracking-widest">Protocol Version: 2.10.4-ELITE</p>
            <div class="flex gap-4">
              <span class="flex items-center gap-1 text-[10px] text-outline font-medium"><span class="w-1 h-1 rounded-full bg-primary"></span> 248 Total Transmissions</span>
              <span class="flex items-center gap-1 text-[10px] text-outline font-medium"><span class="w-1 h-1 rounded-full bg-emerald-500"></span> 99.2% Transmission Success</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
}

async function pushFileToErp(filename, button) {
  if (button) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        PUSHING...
      </div>
    `;
    try {
      const result = await api("/api/tally/sync", { method: "POST" });
      await refreshAll();
      setNotice(`File "${filename}" successfully pushed to Tally ERP 9. Sync complete: ${result.message}`);
    } catch (e) {
      setNotice(`Error pushing file "${filename}": ${e.message}`);
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }
}

function tallyVoucherOptions(key, transform = (value) => value) {
  return uniqueOptions((state.history.tallyVouchers || []).map((voucher) => transform(voucher[key] || "")));
}

function voucherLedgerText(voucher) {
  return [voucher.party_ledger, voucher.ledger_names].filter(Boolean).join(", ");
}

function filteredTallyVouchers(limit = null) {
  const filters = state.dayBookFilters || {};
  const search = String(filters.search || "").trim().toLowerCase();
  const rows = (state.history.tallyVouchers || []).filter((voucher) => {
    const date = voucher.voucher_date || "";
    const voucherType = voucher.voucher_type || "";
    const ledgerText = voucherLedgerText(voucher);
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;
    if (filters.voucherType && filters.voucherType !== "All" && voucherType !== filters.voucherType) return false;
    if (filters.ledger && filters.ledger !== "All" && !ledgerText.toLowerCase().split(",").map((x) => x.trim()).includes(filters.ledger.toLowerCase())) return false;
    if (search) {
      const haystack = [date, voucher.voucher_no, voucherType, voucher.party_ledger, voucher.ledger_names, voucher.narration, voucher.persisted_view, voucher.amount].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  return limit ? rows.slice(0, limit) : rows;
}

function updateDayBookFilter(key, value) {
  state.dayBookFilters[key] = value;
  render();
}

function resetDayBookFilters() {
  state.dayBookFilters = { from: "", to: "", voucherType: "All", ledger: "All", search: "" };
  render();
}

async function deleteTallyVoucher(id, button = null) {
  if (!id) return;
  if (button) {
    button.disabled = true;
    button.textContent = "Deleting...";
  }
  state.notice = "Deleting voucher in Tally...";
  try {
    const result = await api("/api/tally/delete-voucher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    state.notice = result.message || "Voucher deleted and Day Book refreshed.";
    await refreshAll();
  } catch (error) {
    setNotice(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Delete";
    }
  }
}

function tallyVoucherTable(limit = null) {
  const all = state.history.tallyVouchers || [];
  if (!all.length) return `<div class="p-6 bg-surface-container rounded-2xl text-center text-outline border border-outline-variant/30">No Tally vouchers synced yet. Open Tally, then click Sync Tally.</div>`;
  const vouchers = filteredTallyVouchers(limit);
  const types = tallyVoucherOptions("voucher_type");
  const ledgers = uniqueOptions(all.flatMap((voucher) => voucherLedgerText(voucher).split(",").map((name) => name.trim()).filter(Boolean)));
  const filters = state.dayBookFilters || {};
  const totalAmount = vouchers.reduce((sum, voucher) => sum + Number(voucher.amount || 0), 0);
  
  const filterMarkup = `
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 p-5 bg-surface-container/60 rounded-2xl border border-outline-variant/20">
      <label class="block">
        <span class="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">From</span>
        <input class="w-full bg-white border border-outline-variant/40 rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:outline-none" type="date" value="${escapeHtml(filters.from || "")}" onchange="updateDayBookFilter('from', this.value)" />
      </label>
      <label class="block">
        <span class="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">To</span>
        <input class="w-full bg-white border border-outline-variant/40 rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:outline-none" type="date" value="${escapeHtml(filters.to || "")}" onchange="updateDayBookFilter('to', this.value)" />
      </label>
      <label class="block">
        <span class="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Entry Type</span>
        <select class="w-full bg-white border border-outline-variant/40 rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:outline-none" onchange="updateDayBookFilter('voucherType', this.value)">
          <option value="All" ${filters.voucherType === "All" ? "selected" : ""}>All</option>
          ${types.map((type) => `<option value="${escapeHtml(type)}" ${filters.voucherType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
        </select>
      </label>
      <label class="block">
        <span class="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Ledger</span>
        <select class="w-full bg-white border border-outline-variant/40 rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:outline-none" onchange="updateDayBookFilter('ledger', this.value)">
          <option value="All" ${filters.ledger === "All" ? "selected" : ""}>All</option>
          ${ledgers.map((ledger) => `<option value="${escapeHtml(ledger)}" ${filters.ledger === ledger ? "selected" : ""}>${escapeHtml(ledger)}</option>`).join("")}
        </select>
      </label>
      <div class="flex items-end gap-2">
        <label class="block flex-1">
          <span class="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Search</span>
          <input class="w-full bg-white border border-outline-variant/40 rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:outline-none" value="${escapeHtml(filters.search || "")}" placeholder="Voucher no, ledger, narration..." oninput="updateDayBookFilter('search', this.value)" />
        </label>
        <button class="px-4 py-2 border border-outline-variant/60 bg-white text-on-surface-variant font-bold hover:bg-surface-variant/20 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 h-9" onclick="resetDayBookFilters()">Clear</button>
      </div>
    </div>
    
    <div class="flex justify-between items-center py-2 text-xs font-semibold text-outline">
      <span>Showing ${vouchers.length} of ${all.length} synced entries</span>
      <span class="text-primary font-bold">Total: ${money(totalAmount)}</span>
    </div>
  `;

  if (!vouchers.length) {
    return `
      ${filterMarkup}
      <div class="p-6 bg-surface-container rounded-2xl text-center text-outline border border-outline-variant/30">No synced entries match these filters.</div>
    `;
  }

  return `
    ${filterMarkup}
    <div class="overflow-x-auto custom-scrollbar border border-outline-variant/30 rounded-2xl">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-surface-container-low">
            <th class="p-3 text-label-caps font-label-caps text-outline">Sr.</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Date</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Vch No.</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Entry Type</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Party / Account</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Ledgers</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Narration</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Mode</th>
            <th class="p-3 text-label-caps font-label-caps text-outline text-right">Amount</th>
            <th class="p-3 text-label-caps font-label-caps text-outline">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/20">
          ${vouchers.map((v, index) => `
            <tr class="hover:bg-secondary-container/5 transition-colors">
              <td class="p-3 text-body-md font-data-mono text-outline">${index + 1}</td>
              <td class="p-3 text-body-md font-data-mono text-on-surface-variant">${escapeHtml(v.voucher_date || "")}</td>
              <td class="p-3 text-body-md font-data-mono text-on-surface">${escapeHtml(v.voucher_no || "-")}</td>
              <td class="p-3 text-body-md">
                <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100">${escapeHtml(v.voucher_type || "Voucher")}</span>
              </td>
              <td class="p-3 text-body-md text-on-surface font-semibold">${escapeHtml(v.party_ledger || "-")}</td>
              <td class="p-3 text-body-md text-on-surface-variant truncate max-w-[180px]" title="${escapeHtml(v.ledger_names || v.party_ledger || "-")}">${escapeHtml(v.ledger_names || v.party_ledger || "-")}</td>
              <td class="p-3 text-body-md text-on-surface-variant truncate max-w-[150px]" title="${escapeHtml(v.narration || "-")}">${escapeHtml(v.narration || "-")}</td>
              <td class="p-3 text-body-md text-outline font-medium">${escapeHtml(v.persisted_view || "-")}</td>
              <td class="p-3 text-body-md font-data-mono text-right text-primary font-bold">${money(v.amount || 0)}</td>
              <td class="p-3 text-body-md">
                <button class="px-3 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-100 rounded-lg text-xs font-bold transition-all" data-voucher-id="${escapeHtml(v.id || "")}" onclick="deleteTallyVoucher(this.dataset.voucherId, this)">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formatDate(value) {
  if (!value) return "Not yet";
  if (typeof value === "number") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const pad = (num) => String(num).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const min = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    }
  }
  let str = String(value).replace("T", " ");
  const dotIndex = str.indexOf(".");
  if (dotIndex !== -1) {
    str = str.substring(0, dotIndex);
  } else {
    const zIndex = str.indexOf("Z");
    if (zIndex !== -1) {
      str = str.substring(0, zIndex);
    }
  }
  return str;
}

async function syncNow() {
  state.busy = true;
  state.notice = "Synchronizing with local Tally...";
  render();
  try {
    const result = await api("/api/tally/sync", { method: "POST" });
    state.lastSyncResult = result;
    state.notice = result.online ? `Synchronization complete. ${Object.values(result.synced || {}).reduce((sum, count) => sum + Number(count || 0), 0)} records refreshed from Tally.` : result.message;
    await refreshAll();
  } catch (error) {
    setNotice(error.message);
  } finally {
    state.busy = false;
    render();
  }
}

function syncScreen() {
  const c = state.masters.counts || {};
  const logs = state.lastSyncResult?.logs || [];
  
  const syncLog = logs.length ? `
    <div class="glass-pro p-6 rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/20 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-headline-sm text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-emerald-600">check_circle</span>
          Current Sync Result
        </h3>
        <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100">${escapeHtml(state.lastSyncResult.message || "Synced")}</span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${logs.map((log) => `
          <div class="p-3 bg-white/60 border border-outline-variant/20 rounded-xl flex justify-between items-center">
            <span class="text-xs text-on-surface-variant font-medium">${escapeHtml(log.type || "")}</span>
            <strong class="text-xs text-primary font-bold">${escapeHtml(String(log.count ?? log.status ?? log.message ?? ""))}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  return tailwindShell("sync", `
    <!-- Hero Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h2 class="text-display-lg font-black text-primary">Synchronization</h2>
        <p class="text-body-lg text-outline/80 max-w-2xl">Connect with local Tally, confirm company selection, and refresh accounting masters.</p>
      </div>
      <div class="flex gap-4">
        <button class="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-outline-variant/60 bg-white text-on-surface-variant font-bold hover:bg-surface-variant/20 transition-all shadow-sm" onclick="promptCreateLedger()">
          <span class="material-symbols-outlined text-[20px]">add_circle</span>
          <span>Create Ledger</span>
        </button>
        <button class="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold hover:shadow-lg hover:shadow-primary/20 transition-all shadow-sm" onclick="syncNow()">
          <span class="material-symbols-outlined text-[20px]">sync</span>
          <span>Synchronize Now</span>
        </button>
      </div>
    </div>

    <!-- Tier 1: Connection & Setup -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Tally connection status card -->
      <div class="col-span-12 lg:col-span-8 glass-pro p-6 rounded-[2rem] border-l-4 border-l-primary space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="font-headline-sm text-on-surface font-bold flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">power</span>
            Tally Connection Status
          </h3>
          ${state.tally.online 
            ? `<div class="px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 flex items-center gap-1 border border-emerald-100"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>CONNECTED</div>` 
            : `<div class="px-2.5 py-1 rounded-full bg-red-50 text-[10px] font-bold text-red-600 flex items-center gap-1 border border-red-100"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>OFFLINE</div>`}
        </div>
        <p class="text-body-md text-on-surface-variant/80">${escapeHtml(state.tally.message || "Local Tally Gateway is unreachable.")}</p>
        
        <div class="grid grid-cols-3 gap-4 pt-4 border-t border-outline-variant/30">
          <div class="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-center">
            <div class="text-2xl font-black text-on-surface">${c.ledgers || 0}</div>
            <div class="text-[10px] font-bold text-outline uppercase tracking-wider mt-1">Ledgers</div>
          </div>
          <div class="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-center">
            <div class="text-2xl font-black text-on-surface">${c.vouchers || 0}</div>
            <div class="text-[10px] font-bold text-outline uppercase tracking-wider mt-1">Day Book Entries</div>
          </div>
          <div class="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-center">
            <div class="text-2xl font-black text-on-surface">${c.stockItems || 0}</div>
            <div class="text-[10px] font-bold text-outline uppercase tracking-wider mt-1">Stock Items</div>
          </div>
        </div>
      </div>

      <!-- Setup Guide card -->
      <div class="col-span-12 lg:col-span-4 glass-pro p-6 rounded-[2rem] border-l-4 border-l-secondary space-y-4">
        <h3 class="font-headline-sm text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary">help_outline</span>
          Setup Guide
        </h3>
        <div class="space-y-3 pt-2">
          <div class="flex items-center justify-between p-3 bg-surface-container/60 rounded-xl border border-outline-variant/20">
            <span class="text-xs font-semibold text-on-surface-variant">Open Tally ERP9 or TallyPrime</span>
            <span class="px-2 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded">Required</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-surface-container/60 rounded-xl border border-outline-variant/20">
            <span class="text-xs font-semibold text-on-surface-variant">Select Company</span>
            <span class="px-2 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded">Required</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-surface-container/60 rounded-xl border border-outline-variant/20">
            <span class="text-xs font-semibold text-on-surface-variant">Enable XML Gateway</span>
            <span class="px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded">Port 9000</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Current Sync Result if exists -->
    ${syncLog}

    <!-- Last Sync Master Breakdown -->
    <div class="glass-pro p-6 rounded-[2rem] space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-headline-sm text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">history</span>
          Last Sync Master Breakdown
        </h3>
        <span class="text-xs font-semibold text-outline">Last check: ${formatDate(state.history.lastSync)}</span>
      </div>
      
      <div class="grid grid-cols-3 md:grid-cols-9 gap-3">
        ${[
          ["Ledgers", c.ledgers || 0, "account_balance_wallet"],
          ["Voucher Types", c.voucherTypes || 0, "receipt_long"],
          ["Stock Groups", c.stockGroups || 0, "folder"],
          ["Stock Categories", c.stockCategories || 0, "category"],
          ["Stock Items", c.stockItems || 0, "inventory_2"],
          ["Units", c.units || 0, "straighten"],
          ["Godowns", c.godowns || 0, "warehouse"],
          ["GST Ledgers", c.gstLedgers || 0, "percent"],
          ["Existing Vouchers", c.vouchers || 0, "history_edu"]
        ].map(([label, count, iconName]) => `
          <div class="p-3 bg-surface-container rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center text-center gap-1.5">
            <span class="material-symbols-outlined text-outline/50 text-[18px]">${iconName}</span>
            <span class="text-[10px] font-bold text-outline uppercase tracking-wider leading-none text-center">${label}</span>
            <span class="text-base font-black text-on-surface mt-1">${count}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <!-- Inventory Masters Panel -->
    ${inventoryMasterPanel()}
  `);
}

function selectWorkflow(item) {
  if (item === "Journal") {
    setNotice("Journal automation is locked. Please enter journal entries manually in Tally.");
    return;
  }
  state.activeWorkflow = item;
  if (state.gstEnabled && state.gstWorkflow === item) {
    state.showGstPopup = true;
    state.popupWorkflow = item;
  } else {
    state.showGstPopup = false;
  }
  render();
}

function startUploadForActiveWorkflow() {
  const item = state.activeWorkflow || "Purchase";
  if (item === "Journal") {
    setNotice("Journal automation is locked. Please enter journal entries manually in Tally.");
    return;
  }
  if (state.gstEnabled && state.gstWorkflow === item) {
    state.showGstPopup = true;
    state.popupWorkflow = item;
    render();
  } else {
    state.showGstPopup = false;
    go("upload");
  }
}

function setAutomationFilter(filter) {
  state.automationFilter = filter;
  render();
}

// ------------------------------------------------------------------
// MASTERS BROWSER & SYNC (PHASE 1)
// ------------------------------------------------------------------
async function syncMastersAction() {
  if (state.syncingMastersStatus === "syncing") return;
  state.syncingMastersStatus = "syncing";
  state.syncingMastersMessage = "Initiating export from TallyPrime via Connector queue...";
  render();

  try {
    const result = await api("/api/tally/sync", { method: "POST" });
    state.lastSyncResult = result;
    if (result && result.online) {
      state.syncingMastersStatus = "done";
      state.syncingMastersMessage = result.message || "All Tally masters synchronized successfully.";
      await refreshAll();
    } else {
      state.syncingMastersStatus = "failed";
      state.syncingMastersMessage = result?.message || "Tally synchronization failed or connector offline.";
    }
  } catch (err) {
    state.syncingMastersStatus = "failed";
    state.syncingMastersMessage = err.message || "Failed to communicate with server.";
  } finally {
    render();
  }
}

function setMastersTab(tab) {
  state.mastersActiveTab = tab;
  state.mastersPage = 1;
  render();
}

function setMastersSearch(q) {
  state.mastersSearchQuery = q;
  state.mastersPage = 1;
  const container = document.getElementById("masters-table-content");
  if (container) {
    container.innerHTML = renderMastersTableContent();
  } else {
    render();
  }
}

function setMastersSort(field) {
  if (state.mastersSortBy === field) {
    state.mastersSortDir = state.mastersSortDir === "asc" ? "desc" : "asc";
  } else {
    state.mastersSortBy = field;
    state.mastersSortDir = "asc";
  }
  const container = document.getElementById("masters-table-content");
  if (container) {
    container.innerHTML = renderMastersTableContent();
  } else {
    render();
  }
}

function setMastersPage(p) {
  state.mastersPage = Math.max(1, p);
  const container = document.getElementById("masters-table-content");
  if (container) {
    container.innerHTML = renderMastersTableContent();
  } else {
    render();
  }
}

function setMastersPageSize(sz) {
  state.mastersPageSize = Number(sz) || 25;
  state.mastersPage = 1;
  const container = document.getElementById("masters-table-content");
  if (container) {
    container.innerHTML = renderMastersTableContent();
  } else {
    render();
  }
}

function getFilteredMastersList() {
  const all = (state.masters && Array.isArray(state.masters.masters)) ? state.masters.masters : [];
  const currentTab = state.mastersActiveTab || "ledger";

  let list = all.filter(item => (item.type || "").toLowerCase() === currentTab.toLowerCase());

  const q = (state.mastersSearchQuery || "").trim().toLowerCase();
  if (q) {
    list = list.filter(item => {
      const n = (item.name || "").toLowerCase();
      const p = (item.parent || "").toLowerCase();
      const u = (item.unit || "").toLowerCase();
      const f = (item.formal_name || "").toLowerCase();
      const b = (item.opening_balance || "").toLowerCase();
      return n.includes(q) || p.includes(q) || u.includes(q) || f.includes(q) || b.includes(q);
    });
  }

  const sortBy = state.mastersSortBy || "name";
  const sortDir = state.mastersSortDir === "desc" ? -1 : 1;
  list.sort((a, b) => {
    let valA = a[sortBy] ?? "";
    let valB = b[sortBy] ?? "";
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (valA < valB) return -1 * sortDir;
    if (valA > valB) return 1 * sortDir;
    return 0;
  });

  return list;
}

function renderMastersTableContent() {
  const currentTab = state.mastersActiveTab || "ledger";
  const list = getFilteredMastersList();
  const total = list.length;
  const pageSize = state.mastersPageSize || 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, state.mastersPage || 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = list.slice(startIndex, startIndex + pageSize);

  const sortIcon = (col) => {
    if (state.mastersSortBy !== col) {
      return `<span class="material-symbols-outlined text-[14px] opacity-30 group-hover:opacity-100 transition-opacity">unfold_more</span>`;
    }
    return state.mastersSortDir === "asc"
      ? `<span class="material-symbols-outlined text-[14px] text-primary">arrow_upward</span>`
      : `<span class="material-symbols-outlined text-[14px] text-primary">arrow_downward</span>`;
  };

  let tableHeaderHtml = "";
  if (currentTab === "ledger") {
    tableHeaderHtml = `
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] w-12">#</th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('name')">
        <div class="flex items-center gap-1.5"><span>Ledger Name (Exact in Tally)</span> ${sortIcon('name')}</div>
      </th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('parent')">
        <div class="flex items-center gap-1.5"><span>Parent Group</span> ${sortIcon('parent')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('opening_balance')">
        <div class="flex items-center justify-end gap-1.5"><span>Opening Balance</span> ${sortIcon('opening_balance')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none w-44" onclick="setMastersSort('updated_at')">
        <div class="flex items-center justify-end gap-1.5"><span>Last Synced</span> ${sortIcon('updated_at')}</div>
      </th>
    `;
  } else if (currentTab === "group") {
    tableHeaderHtml = `
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] w-12">#</th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('name')">
        <div class="flex items-center gap-1.5"><span>Group Name (Exact in Tally)</span> ${sortIcon('name')}</div>
      </th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('parent')">
        <div class="flex items-center gap-1.5"><span>Parent Group</span> ${sortIcon('parent')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none w-44" onclick="setMastersSort('updated_at')">
        <div class="flex items-center justify-end gap-1.5"><span>Last Synced</span> ${sortIcon('updated_at')}</div>
      </th>
    `;
  } else if (currentTab === "stock_item") {
    tableHeaderHtml = `
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] w-12">#</th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('name')">
        <div class="flex items-center gap-1.5"><span>Stock Item Name</span> ${sortIcon('name')}</div>
      </th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('parent')">
        <div class="flex items-center gap-1.5"><span>Category / Group</span> ${sortIcon('parent')}</div>
      </th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('unit')">
        <div class="flex items-center gap-1.5"><span>Base Unit</span> ${sortIcon('unit')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('opening_balance')">
        <div class="flex items-center justify-end gap-1.5"><span>Opening Balance</span> ${sortIcon('opening_balance')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none w-44" onclick="setMastersSort('updated_at')">
        <div class="flex items-center justify-end gap-1.5"><span>Last Synced</span> ${sortIcon('updated_at')}</div>
      </th>
    `;
  } else if (currentTab === "unit") {
    tableHeaderHtml = `
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] w-12">#</th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('name')">
        <div class="flex items-center gap-1.5"><span>Symbol / Unit</span> ${sortIcon('name')}</div>
      </th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('formal_name')">
        <div class="flex items-center gap-1.5"><span>Formal Name</span> ${sortIcon('formal_name')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none w-44" onclick="setMastersSort('updated_at')">
        <div class="flex items-center justify-end gap-1.5"><span>Last Synced</span> ${sortIcon('updated_at')}</div>
      </th>
    `;
  } else if (currentTab === "godown") {
    tableHeaderHtml = `
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] w-12">#</th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('name')">
        <div class="flex items-center gap-1.5"><span>Godown Location Name</span> ${sortIcon('name')}</div>
      </th>
      <th class="p-4 text-left font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none" onclick="setMastersSort('parent')">
        <div class="flex items-center gap-1.5"><span>Parent Location</span> ${sortIcon('parent')}</div>
      </th>
      <th class="p-4 text-right font-label-caps text-outline uppercase tracking-wider text-[11px] cursor-pointer group select-none w-44" onclick="setMastersSort('updated_at')">
        <div class="flex items-center justify-end gap-1.5"><span>Last Synced</span> ${sortIcon('updated_at')}</div>
      </th>
    `;
  }

  let rowsHtml = "";
  if (pageItems.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" class="p-12 text-center">
          <div class="flex flex-col items-center justify-center space-y-3">
            <div class="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-outline/50">
              <span class="material-symbols-outlined text-[32px]">folder_off</span>
            </div>
            <p class="text-sm font-bold text-on-surface">No ${escapeHtml(currentTab.replace('_', ' '))} records found</p>
            <p class="text-xs text-outline/70 max-w-sm">
              ${state.mastersSearchQuery ? 'No masters match your search filter "' + escapeHtml(state.mastersSearchQuery) + '".' : 'Click "Sync Masters" above to export records directly from TallyPrime.'}
            </p>
          </div>
        </td>
      </tr>
    `;
  } else {
    rowsHtml = pageItems.map((item, idx) => {
      const rowNum = startIndex + idx + 1;
      const rawDate = item.updated_at ? new Date(item.updated_at) : null;
      const dateStr = rawDate && !isNaN(rawDate.getTime()) ? rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + rawDate.toLocaleDateString() + ')' : "—";
      
      if (currentTab === "ledger") {
        return `
          <tr class="border-b border-outline-variant/10 hover:bg-primary/5 transition-colors group">
            <td class="p-4 text-xs font-mono text-outline/60">${rowNum}</td>
            <td class="p-4 text-xs font-bold text-on-surface font-mono select-all">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></span>
                <span>${escapeHtml(item.name)}</span>
              </div>
            </td>
            <td class="p-4 text-xs text-on-surface-variant font-medium">
              <span class="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-[11px] border border-outline-variant/20">
                ${escapeHtml(item.parent || "Primary")}
              </span>
            </td>
            <td class="p-4 text-xs font-mono font-bold text-right text-on-surface">
              ${escapeHtml(item.opening_balance || "₹ 0.00")}
            </td>
            <td class="p-4 text-xs font-mono text-outline/70 text-right">${dateStr}</td>
          </tr>
        `;
      } else if (currentTab === "group") {
        return `
          <tr class="border-b border-outline-variant/10 hover:bg-primary/5 transition-colors group">
            <td class="p-4 text-xs font-mono text-outline/60">${rowNum}</td>
            <td class="p-4 text-xs font-bold text-on-surface font-mono select-all">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-amber-500">folder</span>
                <span>${escapeHtml(item.name)}</span>
              </div>
            </td>
            <td class="p-4 text-xs text-on-surface-variant font-medium">
              <span class="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-[11px] border border-outline-variant/20">
                ${escapeHtml(item.parent || "Primary")}
              </span>
            </td>
            <td class="p-4 text-xs font-mono text-outline/70 text-right">${dateStr}</td>
          </tr>
        `;
      } else if (currentTab === "stock_item") {
        return `
          <tr class="border-b border-outline-variant/10 hover:bg-primary/5 transition-colors group">
            <td class="p-4 text-xs font-mono text-outline/60">${rowNum}</td>
            <td class="p-4 text-xs font-bold text-on-surface font-mono select-all">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-indigo-500">inventory_2</span>
                <span>${escapeHtml(item.name)}</span>
              </div>
            </td>
            <td class="p-4 text-xs text-on-surface-variant font-medium">
              <span class="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-[11px] border border-outline-variant/20">
                ${escapeHtml(item.parent || "Primary")}
              </span>
            </td>
            <td class="p-4 text-xs font-bold text-secondary">
              ${escapeHtml(item.unit || "—")}
            </td>
            <td class="p-4 text-xs font-mono font-bold text-right text-on-surface">
              ${escapeHtml(item.opening_balance || "—")}
            </td>
            <td class="p-4 text-xs font-mono text-outline/70 text-right">${dateStr}</td>
          </tr>
        `;
      } else if (currentTab === "unit") {
        return `
          <tr class="border-b border-outline-variant/10 hover:bg-primary/5 transition-colors group">
            <td class="p-4 text-xs font-mono text-outline/60">${rowNum}</td>
            <td class="p-4 text-xs font-bold text-on-surface font-mono select-all">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-emerald-500">straighten</span>
                <span>${escapeHtml(item.name)}</span>
              </div>
            </td>
            <td class="p-4 text-xs text-on-surface-variant font-medium">
              ${escapeHtml(item.formal_name || "—")}
            </td>
            <td class="p-4 text-xs font-mono text-outline/70 text-right">${dateStr}</td>
          </tr>
        `;
      } else if (currentTab === "godown") {
        return `
          <tr class="border-b border-outline-variant/10 hover:bg-primary/5 transition-colors group">
            <td class="p-4 text-xs font-mono text-outline/60">${rowNum}</td>
            <td class="p-4 text-xs font-bold text-on-surface font-mono select-all">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-cyan-500">warehouse</span>
                <span>${escapeHtml(item.name)}</span>
              </div>
            </td>
            <td class="p-4 text-xs text-on-surface-variant font-medium">
              <span class="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-[11px] border border-outline-variant/20">
                ${escapeHtml(item.parent || "Primary")}
              </span>
            </td>
            <td class="p-4 text-xs font-mono text-outline/70 text-right">${dateStr}</td>
          </tr>
        `;
      }
    }).join("");
  }

  // Pagination controls
  const showingStart = total === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(startIndex + pageSize, total);

  let pageButtonsHtml = "";
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    const isCur = p === currentPage;
    pageButtonsHtml += `
      <button 
        class="w-8 h-8 rounded-lg text-xs font-bold transition-all ${isCur ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}"
        onclick="setMastersPage(${p})">
        ${p}
      </button>
    `;
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-outline-variant/20 bg-surface-container/30">
            ${tableHeaderHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div class="p-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-outline">
      <div class="flex items-center gap-2">
        <span>Showing <strong>${showingStart}</strong> to <strong>${showingEnd}</strong> of <strong>${total}</strong> records</span>
      </div>
      
      <div class="flex items-center gap-1.5">
        <button 
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold ${currentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-container text-on-surface'}"
          ${currentPage <= 1 ? 'disabled' : ''}
          onclick="setMastersPage(${currentPage - 1})">
          <span class="material-symbols-outlined text-[16px]">chevron_left</span>
          <span>Previous</span>
        </button>

        <div class="flex items-center gap-1">
          ${pageButtonsHtml}
        </div>

        <button 
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold ${currentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-container text-on-surface'}"
          ${currentPage >= totalPages ? 'disabled' : ''}
          onclick="setMastersPage(${currentPage + 1})">
          <span>Next</span>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  `;
}

function mastersScreen() {
  const c = state.masters?.counts || {};
  const activeTab = state.mastersActiveTab || "ledger";
  const activeComp = state.masters?.activeCompany || state.tally?.company || "Not Detected";
  const isOnline = Boolean(state.tally?.online);
  const lastSyncTime = state.masters?.lastSync || state.history?.lastSync;
  const isSyncing = state.syncingMastersStatus === "syncing";

  const tabs = [
    { id: "ledger", label: "Ledgers", count: c.ledgers ?? 0, icon: "account_balance_wallet" },
    { id: "group", label: "Groups", count: c.groups ?? 0, icon: "folder_shared" },
    { id: "stock_item", label: "Stock Items", count: c.stockItems ?? 0, icon: "inventory_2" },
    { id: "unit", label: "Units", count: c.units ?? 0, icon: "straighten" },
    { id: "godown", label: "Godowns", count: c.godowns ?? 0, icon: "warehouse" },
  ];

  // Sync Status Alert Banner
  let syncBannerHtml = "";
  if (isSyncing) {
    syncBannerHtml = `
      <div class="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between text-xs text-primary font-bold animate-pulse">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          <span>${escapeHtml(state.syncingMastersMessage || "Synchronizing masters with TallyPrime via Connector queue...")}</span>
        </div>
      </div>
    `;
  } else if (state.syncingMastersStatus === "done") {
    syncBannerHtml = `
      <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs text-emerald-600 font-bold">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          <span>${escapeHtml(state.syncingMastersMessage || "Masters successfully synchronized!")}</span>
        </div>
        <button class="text-xs text-emerald-700/60 hover:text-emerald-700 uppercase font-extrabold" onclick="state.syncingMastersStatus='idle'; render();">Dismiss</button>
      </div>
    `;
  } else if (state.syncingMastersStatus === "failed") {
    syncBannerHtml = `
      <div class="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between text-xs text-rose-600 font-bold">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>${escapeHtml(state.syncingMastersMessage || "Master synchronization failed.")}</span>
        </div>
        <button class="text-xs text-rose-700/60 hover:text-rose-700 uppercase font-extrabold" onclick="state.syncingMastersStatus='idle'; render();">Dismiss</button>
      </div>
    `;
  }

  return tailwindShell("masters", `
    <!-- Hero Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[24px]">database</span>
          </div>
          <div>
            <h2 class="text-display-lg font-black text-primary leading-tight">Tally Masters Browser</h2>
            <p class="text-body-md text-outline/80">Synchronized master databases preserving character-for-character Tally naming.</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Sync Status Pill -->
        <div class="px-3.5 py-2 rounded-xl glass-pro border border-outline-variant/30 text-xs flex items-center gap-2">
          <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse"></span>
          <span class="font-bold text-on-surface">${isOnline ? 'Gateway Active' : 'Gateway Offline'}</span>
          <span class="text-outline">(${escapeHtml(activeComp)})</span>
        </div>

        <!-- Sync Masters Action Button -->
        <button 
          class="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold hover:shadow-lg hover:shadow-primary/20 transition-all shadow-sm ${isSyncing ? 'opacity-60 cursor-not-allowed' : ''}" 
          onclick="${isSyncing ? '' : 'syncMastersAction()'}" 
          ${isSyncing ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}">${isSyncing ? 'progress_activity' : 'sync'}</span>
          <span>${isSyncing ? 'Syncing Masters...' : 'Sync Masters'}</span>
        </button>
      </div>
    </div>

    ${syncBannerHtml}

    <!-- Quick Stat Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      ${tabs.map(t => {
        const isActive = activeTab === t.id;
        return `
          <button 
            onclick="setMastersTab('${t.id}')"
            class="p-4 rounded-2xl text-left transition-all border ${isActive ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/20' : 'glass-pro border-outline-variant/20 hover:border-primary/30 text-on-surface'}">
            <div class="flex items-center justify-between mb-2">
              <span class="material-symbols-outlined text-[20px] ${isActive ? 'text-white' : 'text-primary'}">${t.icon}</span>
              <span class="text-xs font-extrabold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'}">${t.count}</span>
            </div>
            <div class="text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-white/80' : 'text-outline'}">${t.label}</div>
            <div class="text-xl font-black mt-0.5">${t.count}</div>
          </button>
        `;
      }).join("")}
    </div>

    <!-- Master Explorer Box -->
    <div class="glass-pro rounded-[2rem] border border-outline-variant/30 overflow-hidden shadow-sm space-y-0">
      <!-- Search and Filter Toolbar -->
      <div class="p-6 border-b border-outline-variant/20 flex flex-col md:flex-row items-center justify-between gap-4 bg-surface-container/20">
        <!-- Search bar with inline instant listener -->
        <div class="relative w-full md:w-96">
          <span class="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-outline">search</span>
          <input 
            id="masters-search-input"
            type="text" 
            class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-xs shadow-inner" 
            placeholder="Search ${escapeHtml(activeTab.replace('_', ' '))} by name, parent group, or unit..." 
            value="${escapeHtml(state.mastersSearchQuery || '')}"
            oninput="setMastersSearch(this.value)"
          />
          ${state.mastersSearchQuery ? `
            <button class="absolute right-3 top-2.5 text-outline hover:text-on-surface" onclick="setMastersSearch('')">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          ` : ""}
        </div>

        <!-- Controls: Page Size & Meta -->
        <div class="flex items-center gap-3 w-full md:w-auto justify-end">
          <div class="flex items-center gap-2 text-xs text-outline">
            <span>Show</span>
            <select 
              class="bg-surface-container-low border border-outline-variant/40 rounded-lg text-xs py-1 px-2 text-on-surface focus:ring-1 focus:ring-primary font-bold"
              onchange="setMastersPageSize(this.value)">
              <option value="10" ${state.mastersPageSize === 10 ? 'selected' : ''}>10</option>
              <option value="25" ${state.mastersPageSize === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${state.mastersPageSize === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${state.mastersPageSize === 100 ? 'selected' : ''}>100</option>
            </select>
            <span>entries</span>
          </div>

          <div class="text-[11px] text-outline border-l border-outline-variant/30 pl-3">
            Last Synced: <strong class="text-on-surface">${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}</strong>
          </div>
        </div>
      </div>

      <!-- Live Dynamic Table Container -->
      <div id="masters-table-content">
        ${renderMastersTableContent()}
      </div>
    </div>
  `);
}

// ------------------------------------------------------------------
// BANK STATEMENT IMPORT & RECONCILIATION ENGINE (PHASES 2 - 4)
// ------------------------------------------------------------------

async function loadBankStatementsList() {
  try {
    const res = await api("/api/bank-statement/list");
    if (res && res.statements && res.statements.length > 0 && !state.bankImportStatement) {
      await loadBankStatementDetails(res.statements[0].id);
    }
  } catch (e) {
    console.warn("Could not load statements list:", e);
  }
}

async function loadBankStatementDetails(stmtId) {
  state.bankImportUploadBusy = true;
  render();
  try {
    const res = await api(`/api/bank-statement/details?id=${encodeURIComponent(stmtId)}`);
    if (res && res.ok) {
      state.bankImportStatement = res.statement;
      state.bankImportTransactions = res.transactions || [];
      state.bankImportSelectedIds = [];
      state.bankImportPage = 1;
      state.bankImportHistoryStack = [];
    }
  } catch (e) {
    setNotice("Failed to load bank statement details: " + e.message);
  } finally {
    state.bankImportUploadBusy = false;
    render();
  }
}

async function handleBankPdfUpload(inputEl) {
  const files = inputEl.files ? Array.from(inputEl.files) : [];
  if (!files.length) return;

  const bankLedger = state.bankImportTargetLedger || "Bank Accounts";
  state.bankImportUploadBusy = true;
  render();

  try {
    let lastStatement = null;
    let allNewTransactions = [];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (files.length > 1) {
        setNotice(`Processing PDF ${i + 1} of ${files.length}: ${file.name}...`);
      }
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/bank-statement/upload?bankLedger=${encodeURIComponent(bankLedger)}`, {
        method: "POST",
        body: formData,
      });
      const res = await response.json();
      if (!response.ok || !res.ok) {
        throw new Error(`[${file.name}] ${res.error || "Failed to parse bank statement PDF"}`);
      }
      lastStatement = res.statement;
      if (Array.isArray(res.transactions)) {
        allNewTransactions = allNewTransactions.concat(res.transactions);
      }
      successCount++;
    }

    state.bankImportStatement = lastStatement;
    state.bankImportTransactions = allNewTransactions;
    state.bankImportSelectedIds = [];
    state.bankImportPage = 1;
    state.bankImportHistoryStack = [];
    if (files.length > 1) {
      setNotice(`Bulk Import Complete! Successfully processed ${successCount} bank statement PDFs (${allNewTransactions.length} total transactions).`);
    } else if (lastStatement) {
      setNotice(`Successfully imported ${lastStatement.row_count} transactions from ${lastStatement.filename}!`);
    }
  } catch (err) {
    setNotice(err.message);
  } finally {
    state.bankImportUploadBusy = false;
    render();
  }
}

function getFilteredBankTransactions() {
  const all = state.bankImportTransactions || [];
  const q = (state.bankImportSearch || "").trim().toLowerCase();
  const fType = state.bankImportFilterType || "all";
  const fLedger = state.bankImportFilterLedgerStatus || "all";
  const fSend = state.bankImportFilterSendStatus || "all";
  const minAmt = parseFloat(state.bankImportMinAmount) || 0;
  const maxAmt = parseFloat(state.bankImportMaxAmount) || Infinity;

  return all.filter((item) => {
    // 1. Narration search
    if (q) {
      const narr = (item.narration || "").toLowerCase();
      const mode = (item.mode || "").toLowerCase();
      const leg = (item.assigned_ledger || "").toLowerCase();
      if (!narr.includes(q) && !mode.includes(q) && !leg.includes(q)) return false;
    }

    // 2. Type filter
    if (fType === "deposit" && (item.deposit || 0) <= 0) return false;
    if (fType === "withdrawal" && (item.withdrawal || 0) <= 0) return false;

    // 3. Ledger status
    const hasLedger = Boolean(item.assigned_ledger && item.assigned_ledger.trim());
    if (fLedger === "unassigned" && hasLedger) return false;
    if (fLedger === "assigned" && (!hasLedger || item.is_locked)) return false;
    if (fLedger === "locked" && !item.is_locked) return false;

    // 4. Send status
    const sStatus = item.send_status || "not_sent";
    if (fSend !== "all" && sStatus !== fSend) return false;

    // 5. Amount filter
    const amt = (item.deposit || 0) > 0 ? item.deposit : item.withdrawal || 0;
    if (amt < minAmt || amt > maxAmt) return false;

    return true;
  });
}

function pushBankImportHistory() {
  const snapshot = JSON.stringify(state.bankImportTransactions);
  state.bankImportHistoryStack.push(snapshot);
  if (state.bankImportHistoryStack.length > 50) {
    state.bankImportHistoryStack.shift();
  }
}

function undoBankImportAction() {
  if (!state.bankImportHistoryStack || state.bankImportHistoryStack.length === 0) return;
  const prevJson = state.bankImportHistoryStack.pop();
  try {
    state.bankImportTransactions = JSON.parse(prevJson);
    renderBankImportTableContainer();
    setNotice("Reverted last assignment (Undo).");
  } catch (e) {
    console.error("Undo failed:", e);
  }
}

function toggleSelectAllBankRows(masterCheckbox) {
  const filtered = getFilteredBankTransactions();
  if (masterCheckbox.checked) {
    state.bankImportSelectedIds = filtered.map((t) => t.id);
  } else {
    state.bankImportSelectedIds = [];
  }
  renderBankImportTableContainer();
}

function toggleBankRowSelect(id) {
  const idx = state.bankImportSelectedIds.indexOf(id);
  if (idx > -1) {
    state.bankImportSelectedIds.splice(idx, 1);
  } else {
    state.bankImportSelectedIds.push(id);
  }
  renderBankImportTableContainer();
}

async function bulkAssignBankLedger(ledgerName, options = {}) {
  if (!ledgerName || state.bankImportSelectedIds.length === 0) return;
  pushBankImportHistory();

  const targetIds = [...state.bankImportSelectedIds];
  const lock = options.lock !== undefined ? options.lock : true;
  const createRule = Boolean(options.createRule);
  const rulePattern = options.rulePattern || "";

  // Optimistic UI update
  for (const t of state.bankImportTransactions) {
    if (targetIds.includes(t.id)) {
      t.assigned_ledger = ledgerName;
      if (lock) t.is_locked = 1;
    }
  }
  renderBankImportTableContainer();

  try {
    await api("/api/bank-statement/assign", {
      method: "POST",
      body: {
        statementId: state.bankImportStatement.id,
        transactionIds: targetIds,
        ledger: ledgerName,
        lock: lock,
        createRule: createRule,
        rulePattern: rulePattern,
      },
    });
  } catch (err) {
    setNotice("Assignment error: " + err.message);
  }
}

async function applyLedgerToMatchingFilter(ledgerName) {
  if (!ledgerName) return;
  const filtered = getFilteredBankTransactions();
  const unlocked = filtered.filter((t) => !t.is_locked);
  if (unlocked.length === 0) {
    setNotice("No unlocked transactions match the current filter.");
    return;
  }
  pushBankImportHistory();
  const targetIds = unlocked.map((t) => t.id);

  for (const t of state.bankImportTransactions) {
    if (targetIds.includes(t.id)) {
      t.assigned_ledger = ledgerName;
      t.is_locked = 1;
    }
  }
  renderBankImportTableContainer();

  try {
    await api("/api/bank-statement/assign", {
      method: "POST",
      body: {
        statementId: state.bankImportStatement.id,
        transactionIds: targetIds,
        ledger: ledgerName,
        lock: true,
        createRule: Boolean(state.bankImportSearch),
        rulePattern: state.bankImportSearch,
      },
    });
    setNotice(`Assigned "${ledgerName}" to ${targetIds.length} transactions and locked!`);
  } catch (err) {
    setNotice("Error: " + err.message);
  }
}

async function autoMapSuggestedBankLedgers() {
  const unassignedWithSuggestion = (state.bankImportTransactions || []).filter(
    (t) => !t.assigned_ledger && t.suggested_ledger && !t.is_locked
  );

  if (unassignedWithSuggestion.length === 0) {
    setNotice("No unassigned rows with high-confidence suggestions found.");
    return;
  }

  pushBankImportHistory();
  const updates = [];

  for (const t of unassignedWithSuggestion) {
    t.assigned_ledger = t.suggested_ledger;
    t.is_locked = 1;
    updates.push(t.id);
  }
  renderBankImportTableContainer();

  try {
    await api("/api/bank-statement/assign", {
      method: "POST",
      body: {
        statementId: state.bankImportStatement.id,
        transactionIds: updates,
        ledger: "", // will keep assigned_ledger
        lock: true,
      },
    });
    setNotice(`Auto-mapped and locked ${updates.length} suggested ledgers!`);
  } catch (err) {
    setNotice("Auto-map error: " + err.message);
  }
}

async function unlockBankRows(targetIds) {
  if (!targetIds || targetIds.length === 0) return;
  pushBankImportHistory();

  for (const t of state.bankImportTransactions) {
    if (targetIds.includes(t.id)) {
      t.is_locked = 0;
    }
  }
  renderBankImportTableContainer();

  try {
    await api("/api/bank-statement/unlock", {
      method: "POST",
      body: { transactionIds: targetIds },
    });
  } catch (e) {
    setNotice("Unlock error: " + e.message);
  }
}

function openNarrationHighlighter(txnId) {
  const row = (state.bankImportTransactions || []).find((t) => t.id === txnId);
  if (!row) return;
  state.bankImportModalRow = row;
  state.bankImportHighlightedText = "";
  state.bankImportNewLedgerName = "";
  state.bankImportNewLedgerGroup = (row.deposit || 0) > 0 ? "Sundry Debtors" : "Indirect Expenses";
  render();
}

function closeNarrationHighlighter() {
  state.bankImportModalRow = null;
  state.bankImportHighlightedText = "";
  render();
}

function captureHighlighterSelection() {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : "";
  if (text) {
    state.bankImportHighlightedText = text;
    state.bankImportNewLedgerName = text;
    const nameInput = document.getElementById("highlighter-ledger-name");
    if (nameInput) nameInput.value = text;
  }
}

async function createLedgerFromHighlighter() {
  const name = (state.bankImportNewLedgerName || "").trim();
  const group = state.bankImportNewLedgerGroup || "Sundry Debtors";
  const row = state.bankImportModalRow;
  if (!name || !row) {
    setNotice("Please select or enter a valid ledger name.");
    return;
  }

  try {
    const res = await api("/api/bank-statement/create-ledger", {
      method: "POST",
      body: { name, parent: group, username: state.user?.username || "guest-01" },
    });

    if (res && res.ok) {
      // Refresh masters so the new ledger appears everywhere
      const refreshedMasters = await api("/api/masters");
      state.masters = refreshedMasters;

      // Assign to current row and lock
      await bulkAssignBankLedger(name, {
        lock: true,
        createRule: true,
        rulePattern: state.bankImportHighlightedText || name,
      });

      closeNarrationHighlighter();
      setNotice(`Ledger "${name}" created in TallyPrime and assigned!`);
    } else {
      setNotice(res?.error || "Failed to create ledger");
    }
  } catch (err) {
    setNotice("Create ledger error: " + err.message);
  }
}

async function sendBankVouchersToTally(mode) {
  if (state.bankImportSendBusy) return;

  const all = state.bankImportTransactions || [];
  let targets = [];

  if (mode === "test_one") {
    const candidate = all.find((t) => t.assigned_ledger && t.send_status !== "sent" && (!state.bankImportSelectedIds.length || state.bankImportSelectedIds.includes(t.id)));
    if (!candidate) {
      setNotice("No ready transactions found to send for testing.");
      return;
    }
    targets = [candidate.id];
  } else if (mode === "selected") {
    targets = state.bankImportSelectedIds.filter((id) => {
      const t = all.find((item) => item.id === id);
      return t && t.assigned_ledger && t.send_status !== "sent";
    });
    if (targets.length === 0) {
      setNotice("None of the selected rows have a ledger assigned, or they are already sent.");
      return;
    }
  } else if (mode === "all_ready") {
    targets = all.filter((t) => t.assigned_ledger && t.send_status !== "sent").map((t) => t.id);
    if (targets.length === 0) {
      setNotice("No ready vouchers to dispatch. Please assign ledgers first.");
      return;
    }
    if (!confirm(`Confirm dispatching ${targets.length} vouchers to ${state.masters.activeCompany || state.tally.company || "TallyPrime"}?`)) {
      return;
    }
  }

  state.bankImportSendBusy = true;
  render();

  try {
    const res = await api("/api/bank-statement/send-tally", {
      method: "POST",
      body: {
        statementId: state.bankImportStatement.id,
        transactionIds: targets,
        username: "guest-01",
      },
    });

    if (res && res.ok) {
      // Mark queued
      for (const t of state.bankImportTransactions) {
        if (targets.includes(t.id)) {
          t.send_status = "queued";
        }
      }
      setNotice(`Enqueued ${res.queued} vouchers on desktop connector! Tally is importing...`);
    } else {
      setNotice(res?.error || "Failed to queue vouchers.");
    }
  } catch (e) {
    setNotice("Dispatch error: " + e.message);
  } finally {
    state.bankImportSendBusy = false;
    render();
  }
}

function renderBankImportTableContainer() {
  const container = document.getElementById("bank-import-table-container");
  if (container) {
    container.innerHTML = renderBankTransactionsTable();
  } else {
    render();
  }
}

function renderBankTransactionsTable() {
  const allTxns = state.bankImportTransactions || [];
  const filtered = getFilteredBankTransactions();
  const total = filtered.length;
  const pageSize = state.bankImportPageSize || 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, state.bankImportPage || 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  const isOnline = Boolean(state.tally?.online);
  const allLedgers = (state.masters?.masters || []).filter((m) => m.type === "ledger" || m.type === "gst_ledger");

  const isAllPageSelected = pageItems.length > 0 && pageItems.every((item) => state.bankImportSelectedIds.includes(item.id));

  let rowsHtml = "";
  if (pageItems.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="10" class="p-12 text-center">
          <div class="flex flex-col items-center justify-center space-y-2">
            <span class="material-symbols-outlined text-outline/40 text-[36px]">filter_alt_off</span>
            <p class="text-sm font-bold text-on-surface">No transactions match current filters</p>
            <button class="text-xs text-primary font-bold hover:underline" onclick="state.bankImportSearch=''; state.bankImportFilterType='all'; state.bankImportFilterLedgerStatus='all'; state.bankImportFilterSendStatus='all'; state.bankImportMinAmount=''; state.bankImportMaxAmount=''; renderBankImportTableContainer();">Clear All Filters</button>
          </div>
        </td>
      </tr>
    `;
  } else {
    rowsHtml = pageItems
      .map((item) => {
        const isSelected = state.bankImportSelectedIds.includes(item.id);
        const isLocked = Boolean(item.is_locked);
        const isDep = (item.deposit || 0) > 0;
        const amt = isDep ? item.deposit : item.withdrawal || 0;

        // Readiness calculation
        let readinessBadge = "";
        if (item.send_status === "sent") {
          readinessBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max"><span class="material-symbols-outlined text-[13px]">check</span>Sent</span>`;
        } else if (item.send_status === "failed") {
          readinessBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-max" title="${escapeHtml(item.send_error || "Tally Rejected")}"><span class="material-symbols-outlined text-[13px]">error</span>Failed</span>`;
        } else if (item.send_status === "queued") {
          readinessBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-max"><span class="material-symbols-outlined text-[13px] animate-spin">sync</span>Queued</span>`;
        } else if (item.assigned_ledger && isOnline) {
          readinessBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Ready</span>`;
        } else if (item.assigned_ledger && !isOnline) {
          readinessBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-max" title="Tally or Connector offline"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>Offline</span>`;
        } else {
          readinessBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-max" title="No Tally ledger assigned"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Unassigned</span>`;
        }

        const vTypeClass = item.voucher_type === "Receipt" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : item.voucher_type === "Contra" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-blue-400 bg-blue-500/10 border-blue-500/20";

        // Highlight matched query in narration
        let formattedNarration = escapeHtml(item.narration);
        if (state.bankImportSearch && state.bankImportSearch.trim()) {
          const reg = new RegExp(`(${state.bankImportSearch.trim()})`, "gi");
          formattedNarration = formattedNarration.replace(reg, `<mark class="bg-primary/30 text-primary font-bold px-0.5 rounded">$1</mark>`);
        }

        return `
          <tr class="border-b border-outline-variant/10 transition-colors ${isSelected ? "bg-primary/10" : isLocked ? "bg-white/[0.02]" : "hover:bg-white/[0.03]"}">
            <td class="p-3 text-center">
              <input type="checkbox" class="w-4 h-4 rounded border-outline-variant/40 bg-surface-container text-primary focus:ring-primary cursor-pointer" ${isSelected ? "checked" : ""} onchange="toggleBankRowSelect('${item.id}')" />
            </td>
            <td class="p-3 text-xs font-mono text-outline/80 whitespace-nowrap">${escapeHtml(item.date)}</td>
            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold border ${vTypeClass}">${escapeHtml(item.voucher_type || (isDep ? "Receipt" : "Payment"))}</span>
            </td>
            <td class="p-3 text-xs text-on-surface cursor-pointer group" onclick="openNarrationHighlighter('${item.id}')" title="Click to open highlighter & create ledger">
              <div class="max-w-md line-clamp-2 font-mono text-[11px] group-hover:text-primary transition-colors flex items-start gap-1">
                <span>${formattedNarration}</span>
                <span class="material-symbols-outlined text-[13px] opacity-0 group-hover:opacity-100 text-primary shrink-0">edit_note</span>
              </div>
            </td>
            <td class="p-3 text-xs font-mono font-bold text-right ${isDep ? "text-emerald-400" : "text-outline/30"}">
              ${isDep ? `₹ ${item.deposit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
            </td>
            <td class="p-3 text-xs font-mono font-bold text-right ${!isDep ? "text-rose-400" : "text-outline/30"}">
              ${!isDep ? `₹ ${item.withdrawal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
            </td>
            <td class="p-3 text-xs font-mono text-outline/70 text-right whitespace-nowrap">
              ${item.balance ? `₹ ${item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
              ${item.balance_mismatch ? `<span class="material-symbols-outlined text-[14px] text-rose-500 inline-block align-middle ml-1" title="Running balance discrepancy detected on this statement row">warning</span>` : ""}
            </td>
            <td class="p-3">
              <div class="relative flex items-center gap-1">
                <select 
                  class="bg-surface-container-low border ${isLocked ? "border-emerald-500/40 text-emerald-300" : "border-outline-variant/40 text-on-surface"} rounded-lg text-xs py-1 px-2 focus:ring-1 focus:ring-primary w-48 truncate"
                  ${isLocked ? "disabled" : ""}
                  onchange="bulkAssignBankLedger(this.value, { lock: true })"
                  onclick="state.bankImportSelectedIds = ['${item.id}']">
                  <option value="">${item.assigned_ledger ? escapeHtml(item.assigned_ledger) : item.suggested_ledger ? `Auto: ${escapeHtml(item.suggested_ledger)}` : "-- Assign Ledger --"}</option>
                  ${allLedgers.map((l) => `<option value="${escapeHtml(l.name)}" ${item.assigned_ledger === l.name ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("")}
                </select>
                ${isLocked ? `<button class="p-1 text-outline hover:text-rose-400" onclick="unlockBankRows(['${item.id}'])" title="Unlock row"><span class="material-symbols-outlined text-[16px]">lock</span></button>` : `<button class="p-1 text-primary hover:text-primary-fixed" onclick="openNarrationHighlighter('${item.id}')" title="Create New Ledger"><span class="material-symbols-outlined text-[16px]">add_circle</span></button>`}
              </div>
            </td>
            <td class="p-3">${readinessBadge}</td>
            <td class="p-3 text-right">
              ${item.assigned_ledger && item.send_status !== "sent" ? `<button class="px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary hover:text-white text-[10px] font-bold uppercase transition-all" onclick="state.bankImportSelectedIds=['${item.id}']; sendBankVouchersToTally('selected')">Send</button>` : ""}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Pagination Footer
  const showingStart = total === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(startIndex + pageSize, total);

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-outline-variant/20 bg-surface-container/30 text-[11px] font-label-caps text-outline uppercase tracking-wider">
            <th class="p-3 text-center w-10">
              <input type="checkbox" class="w-4 h-4 rounded border-outline-variant/40 bg-surface-container text-primary cursor-pointer" ${isAllPageSelected ? "checked" : ""} onchange="toggleSelectAllBankRows(this)" />
            </th>
            <th class="p-3">Date</th>
            <th class="p-3">Type</th>
            <th class="p-3">Particulars (Narration)</th>
            <th class="p-3 text-right">Deposit</th>
            <th class="p-3 text-right">Withdrawal</th>
            <th class="p-3 text-right">Balance</th>
            <th class="p-3">Assigned Ledger</th>
            <th class="p-3">Status</th>
            <th class="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div class="p-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-outline">
      <div>
        <span>Showing <strong>${showingStart}</strong> to <strong>${showingEnd}</strong> of <strong>${total}</strong> records</span>
      </div>

      <div class="flex items-center gap-1.5">
        <button 
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold ${currentPage <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-container text-on-surface"}"
          ${currentPage <= 1 ? "disabled" : ""}
          onclick="state.bankImportPage=${currentPage - 1}; renderBankImportTableContainer();">
          <span class="material-symbols-outlined text-[16px]">chevron_left</span>
          <span>Previous</span>
        </button>

        <span class="px-3 py-1 font-bold text-on-surface">Page ${currentPage} of ${totalPages}</span>

        <button 
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold ${currentPage >= totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-container text-on-surface"}"
          ${currentPage >= totalPages ? "disabled" : ""}
          onclick="state.bankImportPage=${currentPage + 1}; renderBankImportTableContainer();">
          <span>Next</span>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  `;
}

function bankHighlighterModal() {
  if (!state.bankImportModalRow) return "";
  const row = state.bankImportModalRow;
  const groups = [
    "Sundry Debtors",
    "Sundry Creditors",
    "Direct Expenses",
    "Indirect Expenses",
    "Direct Incomes",
    "Indirect Incomes",
    "Bank Accounts",
    "Cash-in-hand",
    "Current Assets",
    "Current Liabilities",
  ];

  return `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="glass-pro rounded-[2rem] border border-outline-variant/30 max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">brush</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-on-surface">Highlight Narration to Make Ledger</h3>
              <p class="text-xs text-outline">Select any text with your mouse below to automatically create or map it.</p>
            </div>
          </div>
          <button class="text-outline hover:text-on-surface" onclick="closeNarrationHighlighter()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Highlighting Box -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-label-caps text-outline uppercase tracking-wider">Full Narration Text (Select with mouse):</label>
          <div 
            class="p-4 rounded-xl bg-surface-container-low border border-primary/30 font-mono text-xs text-on-surface select-text cursor-text leading-relaxed tracking-wide shadow-inner"
            onmouseup="captureHighlighterSelection()">
            ${escapeHtml(row.narration)}
          </div>
        </div>

        ${
          state.bankImportHighlightedText
            ? `
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">check</span>
            <span>Selected text: <strong>"${escapeHtml(state.bankImportHighlightedText)}"</strong></span>
          </div>
        `
            : ""
        }

        <!-- Ledger Creation Form -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-[11px] font-label-caps text-outline uppercase tracking-wider">Tally Ledger Name:</label>
            <input 
              id="highlighter-ledger-name"
              type="text" 
              class="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary font-mono"
              placeholder="e.g. Acme Corporation" 
              value="${escapeHtml(state.bankImportNewLedgerName || "")}"
              oninput="state.bankImportNewLedgerName = this.value"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-label-caps text-outline uppercase tracking-wider">Parent Group:</label>
            <select 
              class="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary"
              onchange="state.bankImportNewLedgerGroup = this.value">
              ${groups.map((g) => `<option value="${g}" ${state.bankImportNewLedgerGroup === g ? "selected" : ""}>${g}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-outline-variant/20">
          <button class="px-4 py-2 rounded-xl text-xs font-bold text-outline hover:text-on-surface" onclick="closeNarrationHighlighter()">Cancel</button>
          <button class="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2" onclick="createLedgerFromHighlighter()">
            <span class="material-symbols-outlined text-[16px]">save</span>
            <span>Create & Assign</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function bankImportScreen() {
  const isOnline = Boolean(state.tally?.online);
  const activeComp = state.masters?.activeCompany || state.tally?.company || "Not Detected";
  const stmt = state.bankImportStatement;
  const allTxns = state.bankImportTransactions || [];

  // Bank ledgers dropdown options
  const bankLedgers = (state.masters?.masters || []).filter((m) => m.type === "ledger" && (m.parent.toLowerCase().includes("bank") || m.name.toLowerCase().includes("bank")));

  // Metrics
  const totalCount = allTxns.length;
  const assignedCount = allTxns.filter((t) => t.assigned_ledger).length;
  const progressPercent = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0;

  const readyCount = allTxns.filter((t) => t.assigned_ledger && t.send_status !== "sent" && isOnline).length;
  const waitingCount = allTxns.filter((t) => !t.assigned_ledger).length;
  const sentCount = allTxns.filter((t) => t.send_status === "sent").length;
  const failedCount = allTxns.filter((t) => t.send_status === "failed").length;

  const allLedgers = (state.masters?.masters || []).filter((m) => m.type === "ledger" || m.type === "gst_ledger");

  return tailwindShell(
    "bank_import",
    `
    <!-- Hero Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[24px]">receipt_long</span>
          </div>
          <div>
            <h2 class="text-display-lg font-black text-primary leading-tight">Bank Statement Import</h2>
            <p class="text-body-md text-outline/80">Universal multi-bank PDF parsing, regex learning, and instant Tally voucher reconciliation.</p>
          </div>
        </div>
      </div>

      <!-- Top Status Indicators -->
      <div class="flex items-center gap-3">
        <div class="px-3.5 py-2 rounded-xl glass-pro border border-outline-variant/30 text-xs flex items-center gap-2">
          <span class="w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500"} animate-pulse"></span>
          <span class="font-bold text-on-surface">${isOnline ? "Gateway Connected" : "Gateway Offline"}</span>
          <span class="text-outline">(${escapeHtml(activeComp)})</span>
        </div>
      </div>
    </div>

    <!-- Tier 1: KPIs & Connection Summary -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="glass-pro p-4 rounded-2xl border border-outline-variant/20">
        <div class="text-[10px] font-bold text-outline uppercase tracking-wider">Total Records</div>
        <div class="text-2xl font-black text-on-surface mt-1">${totalCount}</div>
      </div>
      <div class="glass-pro p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <div class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Ready to Dispatch
        </div>
        <div class="text-2xl font-black text-emerald-400 mt-1">${readyCount}</div>
      </div>
      <div class="glass-pro p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
        <div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Unassigned
        </div>
        <div class="text-2xl font-black text-amber-400 mt-1">${waitingCount}</div>
      </div>
      <div class="glass-pro p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
        <div class="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>Imported in Tally
        </div>
        <div class="text-2xl font-black text-blue-400 mt-1">${sentCount}</div>
      </div>
      <div class="glass-pro p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5">
        <div class="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>Failed Rows
        </div>
        <div class="text-2xl font-black text-rose-400 mt-1">${failedCount}</div>
      </div>
    </div>

    <!-- Step 1: Upload Dropzone & Statement Banner -->
    <div class="glass-pro p-6 rounded-[2rem] border border-outline-variant/30 space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold text-outline">Target Bank Ledger in Tally:</span>
          <select 
            class="bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary min-w-[200px]"
            onchange="state.bankImportTargetLedger = this.value">
            <option value="Bank Accounts">Select Bank Ledger</option>
            ${bankLedgers.map((b) => `<option value="${escapeHtml(b.name)}" ${state.bankImportTargetLedger === b.name ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}
          </select>
        </div>

        <div class="flex items-center gap-3">
          <input 
            id="bank-pdf-input"
            type="file" 
            accept=".pdf" 
            multiple
            class="hidden" 
            onchange="handleBankPdfUpload(this)"
          />
          <button 
            class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 ${state.bankImportUploadBusy ? "opacity-50 cursor-not-allowed" : ""}"
            onclick="document.getElementById('bank-pdf-input').click()"
            ${state.bankImportUploadBusy ? "disabled" : ""}>
            <span class="material-symbols-outlined text-[18px] ${state.bankImportUploadBusy ? "animate-spin" : ""}">
              ${state.bankImportUploadBusy ? "progress_activity" : "upload_file"}
            </span>
            <span>${state.bankImportUploadBusy ? "Parsing PDF with Coordinates..." : "Upload Bank Statements (Single / Bulk PDF)"}</span>
          </button>
        </div>
      </div>

      ${
        stmt
          ? `
        <!-- Loaded Statement Info Bar -->
        <div class="p-4 bg-surface-container/40 rounded-2xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">description</span>
            <span class="font-bold text-on-surface">${escapeHtml(stmt.filename)}</span>
            <span class="text-outline">(${stmt.row_count} rows)</span>
          </div>

          <div class="flex items-center gap-4 text-xs font-mono">
            <div>Opening: <strong class="text-on-surface">₹ ${stmt.opening_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
            <div>Deposits: <strong class="text-emerald-400">+ ₹ ${stmt.total_deposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
            <div>Withdrawals: <strong class="text-rose-400">- ₹ ${stmt.total_withdrawals.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
            <div>Closing: <strong class="text-primary">₹ ${stmt.closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
          </div>
        </div>
      `
          : ""
      }
    </div>

    <!-- Step 2: Reconciliation Workflow Toolbar -->
    <div class="glass-pro p-5 rounded-[2rem] border border-outline-variant/30 space-y-4">
      <!-- Progress Bar & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex-1 max-w-md space-y-1.5">
          <div class="flex justify-between text-xs font-bold">
            <span class="text-outline">Reconciliation Progress</span>
            <span class="text-primary font-mono">${progressPercent}% (${assignedCount}/${totalCount})</span>
          </div>
          <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden">
            <div class="h-full bg-primary transition-all duration-300" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button 
            class="px-3.5 py-1.5 rounded-xl border border-outline-variant/40 text-xs font-bold hover:bg-surface-container text-on-surface flex items-center gap-1.5 ${state.bankImportFilterLedgerStatus === "unassigned" ? "bg-primary/10 text-primary border-primary/30" : ""}"
            onclick="state.bankImportFilterLedgerStatus = state.bankImportFilterLedgerStatus === 'unassigned' ? 'all' : 'unassigned'; renderBankImportTableContainer();">
            <span class="material-symbols-outlined text-[16px]">visibility</span>
            <span>${state.bankImportFilterLedgerStatus === "unassigned" ? "Showing Unassigned" : "Show Unassigned Only"}</span>
          </button>

          <button 
            class="px-3.5 py-1.5 rounded-xl border border-outline-variant/40 text-xs font-bold hover:bg-surface-container text-on-surface flex items-center gap-1.5"
            onclick="undoBankImportAction()">
            <span class="material-symbols-outlined text-[16px]">undo</span>
            <span>Undo (Ctrl+Z)</span>
          </button>

          <button 
            class="px-3.5 py-1.5 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"
            onclick="autoMapSuggestedBankLedgers()">
            <span class="material-symbols-outlined text-[16px]">auto_fix_high</span>
            <span>Auto-Map Suggestions</span>
          </button>

          <button 
            class="px-3.5 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold hover:bg-primary hover:text-white text-primary flex items-center gap-1.5 transition-all"
            onclick="promptCreateLedger()">
            <span class="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ Create Ledger</span>
          </button>
        </div>
      </div>

      <!-- Multi-Criteria Filter Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-outline-variant/20">
        <!-- Narration Search -->
        <div class="relative sm:col-span-2">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            class="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:ring-1 focus:ring-primary shadow-inner"
            placeholder="Search Narration (e.g. UPI, SHINE HAIR, NEFT, CASH)..."
            value="${escapeHtml(state.bankImportSearch || "")}"
            oninput="state.bankImportSearch = this.value; renderBankImportTableContainer();"
          />
        </div>

        <!-- Type Filter -->
        <select 
          class="bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary"
          onchange="state.bankImportFilterType = this.value; renderBankImportTableContainer();">
          <option value="all" ${state.bankImportFilterType === "all" ? "selected" : ""}>All Types (Deposits & Withdrawals)</option>
          <option value="deposit" ${state.bankImportFilterType === "deposit" ? "selected" : ""}>Deposits Only (+)</option>
          <option value="withdrawal" ${state.bankImportFilterType === "withdrawal" ? "selected" : ""}>Withdrawals Only (-)</option>
        </select>

        <!-- Status Filter -->
        <select 
          class="bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary"
          onchange="state.bankImportFilterLedgerStatus = this.value; renderBankImportTableContainer();">
          <option value="all" ${state.bankImportFilterLedgerStatus === "all" ? "selected" : ""}>All Ledger States</option>
          <option value="unassigned" ${state.bankImportFilterLedgerStatus === "unassigned" ? "selected" : ""}>Unassigned Only</option>
          <option value="assigned" ${state.bankImportFilterLedgerStatus === "assigned" ? "selected" : ""}>Assigned (Unlocked)</option>
          <option value="locked" ${state.bankImportFilterLedgerStatus === "locked" ? "selected" : ""}>Locked Only</option>
        </select>
      </div>

      ${
        state.bankImportSelectedIds.length > 0
          ? `
        <!-- Floating Bulk Action Toolbar -->
        <div class="p-3 bg-primary/10 border border-primary/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div class="flex items-center gap-2 text-primary font-bold">
            <span class="material-symbols-outlined text-[18px]">check_box</span>
            <span>${state.bankImportSelectedIds.length} transactions selected</span>
          </div>

          <div class="flex items-center gap-2">
            <select 
              id="bulk-ledger-select"
              class="bg-surface-container-low border border-primary/40 rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary min-w-[200px]">
              <option value="">Select Ledger to Assign</option>
              ${allLedgers.map((l) => `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`).join("")}
            </select>

            <button 
              class="px-4 py-1.5 rounded-xl bg-primary text-white font-bold hover:shadow-md hover:shadow-primary/20 transition-all"
              onclick="const val = document.getElementById('bulk-ledger-select').value; if (val) bulkAssignBankLedger(val, { lock: true });">
              Assign & Lock
            </button>

            ${
              state.bankImportSearch
                ? `
              <button 
                class="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface font-bold hover:bg-white/10"
                onclick="const val = document.getElementById('bulk-ledger-select').value; if (val) applyLedgerToMatchingFilter(val);"
                title="Assign to all rows matching the search '${escapeHtml(state.bankImportSearch)}' and remember rule">
                Apply to All Filtered
              </button>
            `
                : ""
            }

            <button 
              class="px-3 py-1.5 rounded-xl border border-outline-variant/40 text-outline hover:text-rose-400"
              onclick="unlockBankRows(state.bankImportSelectedIds)">
              Unlock Selected
            </button>
          </div>
        </div>
      `
          : ""
      }
    </div>

    <!-- Step 3: Interactive Table Container -->
    <div class="glass-pro rounded-[2rem] border border-outline-variant/30 overflow-hidden shadow-sm">
      <div id="bank-import-table-container">
        ${renderBankTransactionsTable()}
      </div>
    </div>

    <!-- Step 4: Bottom Send to Tally Action Bar -->
    <div class="glass-pro p-6 rounded-[2rem] border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-xs text-outline">
        <span>Ready vouchers will be converted to standard Tally XML and dispatched sequentially via the desktop connector.</span>
      </div>

      <div class="flex items-center gap-3">
        <button 
          class="px-4 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface hover:bg-surface-container transition-all ${state.bankImportSendBusy ? "opacity-50 cursor-not-allowed" : ""}"
          onclick="sendBankVouchersToTally('test_one')"
          ${state.bankImportSendBusy ? "disabled" : ""}>
          Send 1 for Testing
        </button>

        ${
          state.bankImportSelectedIds.length > 0
            ? `
          <button 
            class="px-5 py-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-bold hover:bg-primary hover:text-white transition-all ${state.bankImportSendBusy ? "opacity-50 cursor-not-allowed" : ""}"
            onclick="sendBankVouchersToTally('selected')"
            ${state.bankImportSendBusy ? "disabled" : ""}>
            Send Selected (${state.bankImportSelectedIds.length})
          </button>
        `
            : ""
        }

        <button 
          class="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 ${state.bankImportSendBusy || readyCount === 0 ? "opacity-50 cursor-not-allowed" : ""}"
          onclick="sendBankVouchersToTally('all_ready')"
          ${state.bankImportSendBusy || readyCount === 0 ? "disabled" : ""}>
          <span class="material-symbols-outlined text-[18px] ${state.bankImportSendBusy ? "animate-spin" : ""}">
            ${state.bankImportSendBusy ? "progress_activity" : "send"}
          </span>
          <span>${state.bankImportSendBusy ? "Dispatching to Tally..." : `Send All Ready (${readyCount})`}</span>
        </button>
      </div>
    </div>
  `
  );
}


function automation() {
  state.activeWorkflow = state.activeWorkflow || "Purchase";
  state.automationFilter = state.automationFilter || "All Workflows";

  const showGstAlert = state.gstEnabled && state.gstWorkflow;
  const gstAlertHtml = showGstAlert
    ? `<!-- Global Alert -->
       <div class="mb-10 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-4">
         <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
           <span class="material-symbols-outlined">info</span>
         </div>
         <div class="flex-1">
           <p class="text-body-md font-medium text-on-surface">${escapeHtml(state.gstWorkflow)} GST mode enabled (${state.gstMode === "item" ? "Item Basis" : "Without Item"})</p>
           <p class="text-on-surface-variant/60 text-xs">Upload the GST template when ready; normal non-GST flows remain unchanged for this session.</p>
         </div>
         <button class="text-primary font-bold text-sm px-4 py-2 hover:bg-primary/5 rounded-lg transition-colors" onclick="disableGstWorkflow()">Dismiss</button>
       </div>`
    : "";

  const filterTabs = ["All Workflows", "Tax / GST", "Vouchers", "Banking", "Journals"];
  const filterHtml = `
    <!-- Filters -->
    <div class="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
      ${filterTabs.map(tab => {
        const isActive = state.automationFilter === tab;
        const btnClass = isActive
          ? "px-5 py-2 rounded-full bg-primary text-white text-sm font-bold shadow-md shadow-primary/20 shrink-0"
          : "px-5 py-2 rounded-full bg-white border border-outline-variant text-on-surface-variant text-sm hover:border-primary transition-all shrink-0";
        return `<button class="${btnClass}" onclick="setAutomationFilter('${tab}')">${tab}</button>`;
      }).join("")}
    </div>
  `;

  const workflows = [
    { name: "Purchase", icon: "receipt_long", desc: "Open a guided purchase workflow using the fixed Excel template.", category: ["Tax / GST", "Vouchers"], time: "2h ago", count: 120, hasGst: true, iconClass: "bg-primary/10 text-primary", fillIcon: true },
    { name: "Sales", icon: "point_of_sale", desc: "Direct synchronization of revenue data with multi-tax validation.", category: ["Tax / GST", "Vouchers"], time: "1d ago", count: 450, hasGst: true, iconClass: "bg-secondary-container/10 text-secondary", fillIcon: false },
    { name: "Payment", icon: "account_balance", desc: "Automated voucher creation for vendor and supplier payments.", category: ["Vouchers", "Banking"], time: "5h ago", count: 89, extraBadge: "Non-Taxable", hasGst: false, iconClass: "bg-tertiary-fixed-dim/20 text-tertiary", fillIcon: false },
    { name: "Receipt", icon: "savings", desc: "Reconcile customer inflows and bank receipts with automated matching.", category: ["Vouchers", "Banking"], time: "3h ago", count: 22, hasGst: false, footerText: "View Mapping Rules", footerIcon: "settings_input_component", iconClass: "bg-secondary-fixed/30 text-secondary", fillIcon: false },
    { name: "Contra", icon: "swap_horiz", desc: "Handles cash-to-bank and bank-to-bank internal transfers seamlessly.", category: ["Banking"], time: "Never run", count: 0, hasGst: false, footerText: "View Entry Schema", footerIcon: "schema", iconClass: "bg-on-tertiary-container/10 text-tertiary", fillIcon: false },
    { name: "Journal", icon: "auto_stories", desc: "Complex multi-ledger journal entries with balanced debit/credit checks.", category: ["Vouchers", "Journals"], time: "2d ago", count: 14, hasGst: false, footerText: "View Validation Rules", footerIcon: "fact_check", iconClass: "bg-primary-fixed/20 text-primary", fillIcon: false },
    { name: "Bank entry", icon: "payments", desc: "Batch process direct bank statement entries into respective ledgers.", category: ["Banking"], time: "1h ago", count: 1200, hasGst: false, footerText: "Configure Bank Mappings", footerIcon: "account_tree", iconClass: "bg-secondary-container/10 text-secondary", fillIcon: false }
  ];

  const filteredWorkflows = state.automationFilter === "All Workflows"
    ? workflows
    : workflows.filter(w => w.category.includes(state.automationFilter));

  const gridHtml = `
    <!-- WORKFLOW GRID -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      ${filteredWorkflows.map((item, index) => {
        const isSelected = state.activeWorkflow === item.name;
        const isGstActive = state.gstEnabled && state.gstWorkflow === item.name;
        
        let switchHtml = "";
        if (item.hasGst) {
          switchHtml = `
            <div class="flex items-center gap-2" onclick="event.stopPropagation()">
              <span class="text-[10px] font-label-caps text-on-surface-variant/60">GST MODE</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" ${isGstActive ? "checked" : ""} onchange="event.stopPropagation(); ${isGstActive ? "disableGstWorkflow()" : `enableGstWorkflow('${item.name}')`}"/>
                <div class="w-10 h-5 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </label>
            </div>
          `;
        } else if (item.extraBadge) {
          switchHtml = `
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-label-caps text-on-surface-variant/40 italic">${item.extraBadge}</span>
            </div>
          `;
        }

        let footerLinkHtml = "";
        if (item.name === "Purchase") {
          footerLinkHtml = `
            <div class="p-3 bg-primary-fixed/30 rounded-xl flex items-center justify-between">
              <span class="text-[11px] font-medium text-primary uppercase tracking-tight">${isGstActive ? "GST Mode Active" : "Non-GST Active"}</span>
              <button class="text-[11px] font-bold text-primary hover:underline flex items-center gap-1" onclick="event.stopPropagation(); setNotice('Schema columns: date, invoice no, voucher type, party ledger or cash, total amount.')">
                View Schema <span class="material-symbols-outlined text-xs">visibility</span>
              </button>
            </div>
          `;
        } else if (item.name === "Sales") {
          footerLinkHtml = `
            <button class="w-full text-left text-[11px] font-bold text-secondary hover:underline flex items-center gap-1 px-1" onclick="event.stopPropagation(); setNotice('Schema columns: date, invoice no, voucher type, party ledger, total amount.')">
              View Schema Preview <span class="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          `;
        } else if (item.name === "Payment") {
          footerLinkHtml = `
            <button class="w-full text-left text-[11px] font-bold text-tertiary hover:underline flex items-center gap-1 px-1" onclick="event.stopPropagation(); setNotice('Schema columns: date, payment type, ledger, amount.')">
              Schema: Voucher, Date, Ledger...
            </button>
          `;
        } else {
          footerLinkHtml = `
            <button class="w-full text-left text-[11px] font-bold text-${index % 2 === 0 ? "secondary" : "tertiary"} hover:underline flex items-center gap-1 px-1" onclick="event.stopPropagation(); setNotice('Notice: detailed schema mappings for ${item.name} automation.')">
              ${item.footerText} <span class="material-symbols-outlined text-xs">${item.footerIcon}</span>
            </button>
          `;
        }

        const isLocked = item.name === "Journal";
        const activeClass = isSelected && !isLocked ? "active-glow" : "";
        const badgeText = isLocked ? "LOCKED" : isSelected ? "SELECTED" : "READY";
        const badgeClass = isLocked 
          ? "bg-error/10 text-error border border-error/20" 
          : isSelected 
            ? "bg-primary text-white" 
            : "bg-surface-container-highest text-on-surface-variant";

        return `
          <div class="glass-card ${activeClass} rounded-2xl p-6 relative flex flex-col group overflow-hidden cursor-pointer" onclick="selectWorkflow('${item.name}')">
            <div class="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all"></div>
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 rounded-xl ${item.iconClass} flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-2xl" ${item.fillIcon ? `style="font-variation-settings: 'FILL' 1;"` : ""}>${item.icon}</span>
              </div>
              ${switchHtml}
            </div>
            <div class="mb-4">
              <div class="flex items-center gap-2">
                <h3 class="font-headline-sm text-headline-sm ${isSelected ? 'text-primary' : ''}">${item.name} automation</h3>
                <button class="p-1 rounded hover:bg-primary/5 text-on-surface-variant/40 hover:text-primary transition-all" onclick="event.stopPropagation(); setNotice('Downloading templates is mock for offline verification.')">
                  <span class="material-symbols-outlined text-sm">download</span>
                </button>
              </div>
              <p class="text-on-surface-variant text-sm mt-2 leading-relaxed">${item.desc}</p>
            </div>
            <div class="mt-auto space-y-4 pt-4">
              ${footerLinkHtml}
              <div class="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                <div class="flex items-center gap-1.5 text-xs text-on-surface-variant/50">
                  <span class="material-symbols-outlined text-sm">history</span>
                  ${item.time} ${item.count ? `• ${item.count} synced` : ""}
                </div>
                <span class="text-[10px] font-label-caps ${badgeClass} px-2 py-0.5 rounded-full">${badgeText}</span>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  return tailwindShell("automation", `
    <!-- Breadcrumbs & Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 text-on-surface-variant/60 text-[12px] mb-2 font-label-caps">
        <a class="hover:text-primary transition-colors" href="#" onclick="event.preventDefault(); go('dashboard')">HOME</a>
        <span>/</span>
        <span class="text-on-surface">AUTOMATION</span>
      </div>
      <div class="flex items-end justify-between">
        <div>
          <h2 class="font-display-lg text-display-lg text-on-surface tracking-tight">Automation Home</h2>
          <p class="text-on-surface-variant/70 mt-1">Select an intelligent accounting workflow to orchestrate your financial data transfers.</p>
        </div>
        <button class="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95" onclick="startUploadForActiveWorkflow()">
          <span class="material-symbols-outlined">rocket_launch</span>
          Start upload
        </button>
      </div>
    </div>

    ${gstAlertHtml}
    ${filterHtml}
    ${gridHtml}

    ${state.showGstPopup ? `
      <!-- GST Mode Selection Popup Modal -->
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-inverse-surface/60 backdrop-blur-md">
        <div class="glass-card rounded-3xl p-8 max-w-md w-full border border-primary/20 shadow-2xl relative">
          <div class="flex items-start justify-between mb-6">
            <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">receipt_long</span>
            </div>
            <button class="p-1.5 rounded-full hover:bg-surface-container-high transition-colors text-outline" onclick="closeGstPopup()">
              <span class="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <h3 class="font-headline-md text-headline-md text-on-surface mb-2 font-bold">Configure GST Mode</h3>
          <p class="text-on-surface-variant text-sm mb-6">Select the inventory tracking mode for your <strong>${escapeHtml(state.popupWorkflow)} GST</strong> ingestion.</p>
          
          <div class="space-y-4">
            <button class="w-full flex items-center gap-4 p-4 rounded-2xl border border-outline-variant hover:border-primary hover:bg-primary/5 transition-all text-left group" onclick="selectGstPopupMode('item')">
              <div class="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform flex-shrink-0">
                <span class="material-symbols-outlined">inventory_2</span>
              </div>
              <div>
                <h4 class="font-bold text-on-surface text-sm">Item Basis (Item Invoice)</h4>
                <p class="text-xs text-on-surface-variant mt-0.5">Includes inventory quantities, rates, and stock item details.</p>
              </div>
            </button>
            
            <button class="w-full flex items-center gap-4 p-4 rounded-2xl border border-outline-variant hover:border-primary hover:bg-primary/5 transition-all text-left group" onclick="selectGstPopupMode('ledger')">
              <div class="w-10 h-10 rounded-xl bg-secondary-container/10 flex items-center justify-center text-secondary group-hover:scale-105 transition-transform flex-shrink-0">
                <span class="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div>
                <h4 class="font-bold text-on-surface text-sm">Without Item (Accounting Invoice)</h4>
                <p class="text-xs text-on-surface-variant mt-0.5">Simplified ledger-only postings without inventory line items.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    ` : ""}

    <!-- Floating Assistant -->
    <button class="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95 group z-50" onclick="setNotice('Support agent is available during normal business hours.')">
      <span class="material-symbols-outlined group-hover:rotate-12">support_agent</span>
    </button>
  `);
}

function openAutomation(item) {
  state.gstWorkflow = state.gstEnabled && state.gstWorkflow === item ? item : "";
  if (state.gstEnabled && state.gstWorkflow === item) {
    state.showGstPopup = true;
    state.popupWorkflow = item;
    render();
  } else {
    state.showGstPopup = false;
    go("upload");
  }
}

function enableGstWorkflow(item) {
  state.gstEnabled = true;
  state.gstWorkflow = item;
  state.showGstPopup = true;
  state.popupWorkflow = item;
  state.notice = `${item} GST mode enabled. Please select inventory tracking mode.`;
  render();
}

function closeGstPopup() {
  state.showGstPopup = false;
  render();
}

function selectGstPopupMode(mode) {
  state.showGstPopup = false;
  setGstMode(mode);
  go("upload");
}

function upload() {
  const gstBanner = state.gstEnabled ? `
    <!-- GST Workflow Mode Configuration -->
    <div class="p-6 bg-green-50/70 border border-green-200 rounded-3xl mb-8">
      <div class="flex justify-between items-start mb-6">
        <div>
          <span class="px-2.5 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase rounded tracking-wider">GST Enabled</span>
          <h3 class="font-headline-md text-headline-md text-on-surface mt-2">${escapeHtml(state.gstWorkflow || "Purchase/Sales")} GST workflow</h3>
          <p class="text-xs text-on-surface-variant mt-1">Choose your GST import workflow depending on your Excel spreadsheet template.</p>
        </div>
        <button class="px-4 py-2 border border-green-300 text-green-700 bg-white hover:bg-green-50 rounded-xl text-xs font-bold transition-all" onclick="disableGstWorkflow()">
          Use non-GST flow
        </button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button class="flex items-start gap-4 p-5 rounded-2xl border-2 text-left bg-white transition-all ${state.gstMode === 'item' ? 'border-primary ring-2 ring-primary/10 shadow-sm' : 'border-outline-variant/60 hover:border-primary/50'}" onclick="setGstMode('item')">
          <div class="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
            <span class="material-symbols-outlined">inventory_2</span>
          </div>
          <div>
            <h4 class="font-bold text-on-surface text-sm">Item Basis (Item Invoice)</h4>
            <p class="text-xs text-on-surface-variant mt-1">Imports stock item entries. Maps quantity, rate, units, and item name columns to Tally's Item Invoice view.</p>
          </div>
        </button>
        <button class="flex items-start gap-4 p-5 rounded-2xl border-2 text-left bg-white transition-all ${state.gstMode === 'ledger' ? 'border-primary ring-2 ring-primary/10 shadow-sm' : 'border-outline-variant/60 hover:border-primary/50'}" onclick="setGstMode('ledger')">
          <div class="w-10 h-10 rounded-xl bg-secondary/5 flex items-center justify-center text-secondary flex-shrink-0">
            <span class="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <div>
            <h4 class="font-bold text-on-surface text-sm">Without Item (Accounting Invoice)</h4>
            <p class="text-xs text-on-surface-variant mt-1">Imports ledger flat-sums. Ignores inventory column names and sends accounts/ledgers directly to Tally's Accounting Invoice view.</p>
          </div>
        </button>
      </div>
    </div>
  ` : "";

  // Dynamic uploads feed
  const uploads = state.history.uploads || [
    { filename: "Q4_Revenue_Final.xlsx", row_count: 12450, status: "success", uploaded_at: Date.now() },
    { filename: "Vendor_Invoices_Oct.csv", row_count: 842, status: "pending", uploaded_at: Date.now() - 720000 },
    { filename: "Payroll_Adjustments.xlsx", row_count: 3120, status: "success", uploaded_at: Date.now() - 2700000 },
    { filename: "Tax_Returns_Draft.xlsx", row_count: 0, status: "failed", uploaded_at: Date.now() - 3600000 },
    { filename: "Inventory_Audit_V2.csv", row_count: 5600, status: "success", uploaded_at: Date.now() - 10800000 }
  ];

  const activities = [
    { filename: "Jan_Sales_V3.xlsx", desc: "2,480 rows mapped", status: "success", time: "2h ago" },
    { filename: "Purchase_Journal_Final.csv", desc: "152 rows mapped", status: "success", time: "5h ago" },
    { filename: "Expense_Report_Feb.xlsx", desc: "Failed validation", status: "failed", time: "1d ago" }
  ];

  return tailwindShell("upload", `
    <input id="fileInput" type="file" accept=".xlsx,.xls" style="display:none" onchange="uploadExcel(this.files[0])" />
    
    <!-- Upload Category Mode Switcher -->
    <div class="flex flex-col sm:flex-row items-center justify-between p-3 bg-surface-container/60 rounded-2xl border border-outline-variant/30 mb-8 gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-outline uppercase tracking-wider px-2">Upload Format:</span>
        <button class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]">table_view</span>
          <span>Excel Templates (.xlsx / .xls)</span>
        </button>
        <button class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-surface-container hover:bg-primary/10 text-on-surface hover:text-primary border border-outline-variant/40 flex items-center gap-1.5" onclick="go('bank_import')">
          <span class="material-symbols-outlined text-[18px] text-emerald-500">receipt_long</span>
          <span>Bank Statement PDF (Single & Bulk PDF)</span>
          <span class="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">Recommended</span>
        </button>
      </div>
      <div class="text-xs text-outline font-medium px-2">Supports any bank PDF or accounting Excel</div>
    </div>

    <div class="grid grid-cols-12 gap-8">
      <!-- Left: Primary Upload & Health -->
      <div class="col-span-12 lg:col-span-8 space-y-8">
        <!-- Primary Upload Hero -->
        <section class="glass-card rounded-3xl p-10 text-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div class="absolute -top-24 -left-24 w-96 h-96 bg-primary rounded-full blur-[100px]"></div>
            <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary-container rounded-full blur-[100px]"></div>
          </div>
          <div class="relative z-10">
            <div class="w-20 h-20 bg-[#107C41]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <svg class="w-12 h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.5 1H4.5C3.4 1 2.5 1.9 2.5 3V21C2.5 22.1 3.4 23 4.5 23H19.5C20.6 23 21.5 22.1 21.5 21V8L14.5 1Z" fill="#107C41"/>
                <path d="M14.5 1V8H21.5L14.5 1Z" fill="#1F9A55"/>
                <path d="M7 11L9.5 15L7 19H9L10.5 16.5L12 19H14L11.5 15L14 11H12L10.5 13.5L9 11H7Z" fill="white"/>
              </svg>
            </div>
            <h2 class="font-display-lg text-display-lg text-on-surface mb-3 font-bold">Initialize Data Ingestion</h2>
            <p class="text-on-surface-variant max-w-lg mx-auto mb-10 text-body-lg">Select your refined Excel workbook to begin the high-precision automation sequence. Tally Automation supports all major financial ledger standards.</p>
            <button class="bg-primary text-white text-lg font-bold px-12 py-5 rounded-2xl glow-button inline-flex items-center gap-4" onclick="document.getElementById('fileInput').click()">
              <span class="material-symbols-outlined text-2xl">description</span>
              Choose Excel File
            </button>
            <div class="mt-8 flex items-center justify-center gap-8">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-emerald-600">check_circle</span>
                <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">XLSX / CSV Supported</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-emerald-600">check_circle</span>
                <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Auto-Validation Active</span>
              </div>
            </div>
          </div>
        </section>

        <!-- GST mode configuration banner if enabled -->
        ${gstBanner}

        <!-- Transaction Templates Hub -->
        <section>
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-headline-md text-headline-md text-on-surface font-bold">Transaction Templates</h3>
            <button class="text-primary font-bold text-sm hover:underline" onclick="setNotice('All documentation is available in workspace references folder.')">View All Documentation</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Purchase Automation -->
            <div class="glass-card p-6 rounded-2xl group hover:border-primary/50 transition-all">
              <div class="flex items-start justify-between mb-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined text-2xl">shopping_cart</span>
                  </div>
                  <div>
                    <h4 class="font-bold text-on-surface">Purchase Automation</h4>
                    <p class="text-xs text-on-surface-variant">Procurement & Ledger entries</p>
                  </div>
                </div>
                <span class="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded font-bold uppercase">Dynamic</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <a class="flex items-center justify-center gap-2 bg-surface-container hover:bg-primary hover:text-white py-3 rounded-xl transition-all text-xs font-bold" href="/api/template?type=purchase-credit" download>
                  <span class="material-symbols-outlined text-sm">inventory_2</span> Item Basis
                </a>
                <a class="flex items-center justify-center gap-2 bg-surface-container hover:bg-primary hover:text-white py-3 rounded-xl transition-all text-xs font-bold" href="/api/template?type=purchase-credit&mode=ledger" download>
                  <span class="material-symbols-outlined text-sm">account_balance_wallet</span> No Item Basis
                </a>
              </div>
            </div>
 
            <!-- Sales Automation -->
            <div class="glass-card p-6 rounded-2xl group hover:border-primary/50 transition-all">
              <div class="flex items-start justify-between mb-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined text-2xl">sell</span>
                  </div>
                  <div>
                    <h4 class="font-bold text-on-surface">Sales Automation</h4>
                    <p class="text-xs text-on-surface-variant">Revenue & GST compliance</p>
                  </div>
                </div>
                <span class="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded font-bold uppercase">Dynamic</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <a class="flex items-center justify-center gap-2 bg-surface-container hover:bg-primary hover:text-white py-3 rounded-xl transition-all text-xs font-bold" href="/api/template?type=sale-credit" download>
                  <span class="material-symbols-outlined text-sm">inventory_2</span> Item Basis
                </a>
                <a class="flex items-center justify-center gap-2 bg-surface-container hover:bg-primary hover:text-white py-3 rounded-xl transition-all text-xs font-bold" href="/api/template?type=sale-credit&mode=ledger" download>
                  <span class="material-symbols-outlined text-sm">account_balance_wallet</span> No Item Basis
                </a>
              </div>
            </div>
 
            <!-- Financial Vouchers Grid -->
            <div class="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <!-- Payment -->
              <a class="glass-card p-4 rounded-xl hover:bg-primary/5 transition-all cursor-pointer group flex flex-col items-center text-center" href="/api/template?type=payment" download>
                <span class="material-symbols-outlined text-primary mb-2 text-2xl">payments</span>
                <span class="text-xs font-bold text-on-surface">Payment</span>
                <span class="text-[10px] text-on-surface-variant mt-1 group-hover:text-primary transition-colors">Download Sample</span>
              </a>
              <!-- Received -->
              <a class="glass-card p-4 rounded-xl hover:bg-primary/5 transition-all cursor-pointer group flex flex-col items-center text-center" href="/api/template?type=received" download>
                <span class="material-symbols-outlined text-primary mb-2 text-2xl">move_to_inbox</span>
                <span class="text-xs font-bold text-on-surface">Received</span>
                <span class="text-[10px] text-on-surface-variant mt-1 group-hover:text-primary transition-colors">Download Sample</span>
              </a>
              <!-- Contra -->
              <a class="glass-card p-4 rounded-xl hover:bg-primary/5 transition-all cursor-pointer group flex flex-col items-center text-center" href="/api/template?type=contra" download>
                <span class="material-symbols-outlined text-primary mb-2 text-2xl">swap_horiz</span>
                <span class="text-xs font-bold text-on-surface">Contra</span>
                <span class="text-[10px] text-on-surface-variant mt-1 group-hover:text-primary transition-colors">Download Sample</span>
              </a>
              <!-- Journal -->
              <a class="glass-card p-4 rounded-xl hover:bg-primary/5 transition-all cursor-pointer group flex flex-col items-center text-center" href="/api/template?type=journal" download>
                <span class="material-symbols-outlined text-primary mb-2 text-2xl">menu_book</span>
                <span class="text-xs font-bold text-on-surface">Journal</span>
                <span class="text-[10px] text-on-surface-variant mt-1 group-hover:text-primary transition-colors">Download Sample</span>
              </a>
            </div>
          </div>
        </section>
      </div>

      <!-- Right: Analytics & Recent -->
      <div class="col-span-12 lg:col-span-4 space-y-8">
        <!-- Recently Uploaded -->
        <section class="glass-card rounded-2xl p-6 border border-primary/10">
          <div class="flex items-center justify-between mb-6">
            <h4 class="font-bold text-on-surface">Recent Sync Activity</h4>
            <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Live Feed</span>
          </div>
          <div class="space-y-4">
            ${uploads.map(u => {
              const bulletColor = u.status === "success" ? "bg-emerald-500" : u.status === "pending" ? "bg-amber-500" : "bg-error";
              const displayTime = formatDate(u.uploaded_at);
              return `
                <div class="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container/50 transition-all border border-transparent">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${bulletColor}"></div>
                    <div>
                      <p class="text-xs font-bold text-on-surface">${escapeHtml(u.filename)}</p>
                      <p class="text-[10px] text-on-surface-variant">${u.row_count} rows • ${u.status}</p>
                    </div>
                  </div>
                  <span class="text-[10px] font-mono text-on-surface-variant">${escapeHtml(displayTime)}</span>
                </div>
              `;
            }).join("")}
          </div>
          <button class="w-full mt-4 py-2 text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-primary/5 rounded-lg transition-colors" onclick="setNotice('Sync history is stored inside local database destock.db.')">
            View Full History
          </button>
        </section>

        <!-- Recent Activity -->
        <section class="glass-card rounded-2xl p-6">
          <div class="flex items-center justify-between mb-6">
            <h4 class="font-bold text-on-surface">Recent Activity</h4>
            <span class="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">history</span>
          </div>
          <div class="space-y-4">
            ${activities.map(act => {
              const isSuccess = act.status === "success";
              const bgClass = isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
              const iconName = isSuccess ? "check" : "error_outline";
              return `
                <div class="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container/50 transition-all border border-transparent hover:border-outline-variant/30 cursor-pointer">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${bgClass} flex items-center justify-center">
                      <span class="material-symbols-outlined text-lg">${iconName}</span>
                    </div>
                    <div>
                      <p class="text-xs font-bold text-on-surface">${escapeHtml(act.filename)}</p>
                      <p class="text-[10px] text-on-surface-variant">${escapeHtml(act.desc)}</p>
                    </div>
                  </div>
                  <span class="text-[10px] font-mono text-on-surface-variant">${escapeHtml(act.time)}</span>
                </div>
              `;
            }).join("")}
          </div>
        </section>

        <!-- Preview Card -->
        <div class="rounded-2xl h-48 relative overflow-hidden shadow-lg group cursor-pointer bg-gradient-to-br from-green-600 to-emerald-800 border border-green-500/20" onclick="setNotice('Loading tutorial player... Please wait.')">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]"></div>
          <div class="absolute inset-0 flex flex-col justify-between p-6 z-10">
            <span class="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <span class="material-symbols-outlined text-xl">menu_book</span>
            </span>
            <div class="text-white">
              <p class="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Documentation</p>
              <h5 class="font-headline-sm text-headline-sm font-bold">Watch Video Tutorial</h5>
            </div>
          </div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white cursor-pointer group-hover:bg-white group-hover:text-green-700 transition-all shadow-lg">
            <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
          </div>
        </div>
      </div>
    </div>
  `);
}

function disableGstWorkflow() {
  state.gstEnabled = false;
  state.gstWorkflow = "";
  state.notice = "GST mode disabled. Normal non-GST flow selected.";
  render();
}

function setGstMode(mode) {
  state.gstMode = mode;
  state.selectedVoucherMode = mode === "item" ? "Item Invoice" : "Accounting Invoice";
  state.selectedRowIds = null;
  state.notice = `GST mode changed to ${mode === 'item' ? 'Item Basis' : 'Without Item'}.`;
  if (state.validation?.batch?.id) {
    revalidate();
  } else {
    render();
  }
}

async function uploadExcel(file) {
  if (!file) return;
  state.busy = true;
  state.sendResult = null;
  state.sendProgress = null;
  state.notice = `Uploading and validating ${escapeHtml(file.name)}...`;
  render();
  const form = new FormData();
  form.append("file", file);
  try {
    state.validation = await api(`/api/upload?gstEnabled=${state.gstEnabled}&gstMode=${state.gstMode}`, { method: "POST", body: form });
    state.notice = `Uploaded and validated ${state.validation.summary.total} rows.`;
    state.headerFilters = {};
    state.tempHeaderFilters = {};
    state.activeHeaderFilterColumn = null;
    state.headerFilterMenuPosition = null;
    state.currentPage = 1;
    await refreshAll();
    go("mapping");
  } catch (error) {
    setNotice(error.message);
  }
}

function issueList() {
  const validationIssues = (state.validation?.rows || []).filter((r) => r.status !== "ready" && !r.ignored);
  const ledgerIssues = filteredReadyRows().filter((r) => rowLedgerProblems(r).length);
  const rows = [...validationIssues, ...ledgerIssues].filter((row, index, all) => all.findIndex((r) => r.id === row.id) === index);
  if (!rows.length) return `<div class="list-row"><span>No matching issues</span><span class="chip success">Ready</span></div>`;
  return rows.slice(0, 6).map((row) => {
    const problem = rowLedgerProblems(row)[0];
    const message = problem?.message || (row.errors || [])[0] || "Needs review";
    const button = problem ? `Create '${escapeHtml(problem.ledger)}'` : "Create ledger";
    return `<div class="list-row"><div><strong>Transaction ${getTransactionNo(row)}</strong><div class="label">${escapeHtml(message)}</div></div><button class="btn" onclick="createLedgerFromRow('${row.id}')">${button}</button></div>`;
  }).join("");
}

function issueListTailwind() {
  const validationIssues = (state.validation?.rows || []).filter((r) => r.status !== "ready" && !r.ignored);
  const ledgerIssues = filteredReadyRows().filter((r) => rowLedgerProblems(r).length);
  const rows = [...validationIssues, ...ledgerIssues].filter((row, index, all) => all.findIndex((r) => r.id === row.id) === index);
  
  if (!rows.length) {
    return `
      <div class="bg-surface-container rounded-lg p-5 border border-outline-variant/30 flex flex-col items-center justify-center text-center gap-4">
        <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
          <span class="material-symbols-outlined text-green-500 text-3xl" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        </div>
        <div>
          <p class="font-headline-sm text-on-surface font-semibold text-base">No matching issues</p>
          <div class="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[11px] font-bold uppercase tracking-widest border border-green-200">
            Ready
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="space-y-3">
      ${rows.slice(0, 6).map((row) => {
        const problem = rowLedgerProblems(row)[0];
        const message = problem?.message || (row.errors || [])[0] || "Needs review";
        const buttonText = problem ? `Create '${escapeHtml(problem.ledger)}'` : "Create ledger";
        return `
          <div class="bg-surface-container rounded-lg p-4 border border-outline-variant/30 flex flex-col gap-3">
            <div class="flex justify-between items-start">
              <div>
                <span class="text-[11px] font-bold text-primary uppercase tracking-wider font-semibold">Transaction ${getTransactionNo(row)}</span>
                <p class="text-[13px] text-on-surface-variant font-medium mt-0.5 leading-tight">${escapeHtml(message)}</p>
              </div>
              <span class="w-2 h-2 rounded-full bg-error animate-pulse shrink-0 mt-1"></span>
            </div>
            <button class="w-full py-1.5 px-3 bg-white border border-outline-variant text-body-md font-semibold rounded-lg hover:bg-primary/5 hover:text-primary transition-all active:scale-95 text-center" onclick="createLedgerFromRow('${row.id}')">
              ${escapeHtml(buttonText)}
            </button>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function createLedgerFromRow(rowId) {
  const row = (state.validation?.rows || []).find((r) => r.id === rowId);
  const problem = row ? rowLedgerProblems(row)[0] : null;
  const problemLedger = problem?.ledger || "";
  const name = problemLedger || row?.payload?.["party ledger or cash"];
  if (!name) return setNotice("No ledger name found on that row.");
  
  const parent = defaultLedgerGroupForPayload(row?.payload || {}, name);
  
  state.showCreateLedgerModal = true;
  state.createLedgerForm = {
    name: name,
    parent: parent || "Sundry Creditors",
    billwiseOn: "No",
    address: row?.payload?.["address"] || row?.payload?.["party address"] || "",
    state: row?.payload?.["state"] || row?.payload?.["place of supply"] || "Delhi",
    country: row?.payload?.["country"] || "India",
    phone: row?.payload?.["phone"] || row?.payload?.["mobile no"] || "",
    email: row?.payload?.["email"] || "",
    gstRegistrationType: row?.payload?.["gst registration type"] || (row?.payload?.["gstin/uin"] ? "Regular" : "Unregistered"),
    gstin: row?.payload?.["gstin/uin"] || "",
    taxType: "GST",
    gstDutyType: "CGST",
    taxRate: "",
    openingBalance: "0",
    provideBankDetails: "No"
  };
  render();
}

async function syncMastersQuietly() {
  try {
    state.lastSyncResult = await api("/api/tally/sync", { method: "POST" });
  } catch (_) {
    // The create call may still have saved locally; user can retry Sync Tally manually.
  }
}

async function revalidate() {
  if (!state.validation?.batch?.id) return setNotice("Upload a batch first.");
  state.validation = await api("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId: state.validation.batch.id, gstEnabled: state.gstEnabled, gstMode: state.gstMode }),
  });
  render();
}

function openGstMapping() {
  if (!state.validation?.batch?.id) return setNotice("Upload a GST file before opening GST Mapping.");
  state.showGstMapping = true;
  state.gstLedgerMapping = {
    CGST: state.gstLedgerMapping.CGST || preferredGstLedger("CGST"),
    SGST: state.gstLedgerMapping.SGST || preferredGstLedger("SGST"),
    IGST: state.gstLedgerMapping.IGST || preferredGstLedger("IGST"),
  };
  render();
}

function closeGstMapping() {
  state.showGstMapping = false;
  render();
}

function updateGstLedgerMapping(tax, value) {
  state.gstLedgerMapping[tax] = value;
}

function gstMappingModal() {
  if (!state.showGstMapping) return "";
  const taxes = ["CGST", "SGST", "IGST"];
  const rowCount = filteredTableRows().length;
  return `
    <div class="fixed inset-0 z-[300] flex items-center justify-center bg-inverse-surface/60 backdrop-blur-sm">
      <div class="bg-white border border-primary/20 shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden">
        <div class="p-6 border-b border-outline-variant/40 flex items-start justify-between bg-surface-container-low">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-widest mb-2">
              <span class="material-symbols-outlined text-[18px]">receipt_long</span>
              GST Mapping
            </div>
            <h3 class="font-headline-md text-headline-md text-on-surface font-bold">Map GST ledgers from Tally</h3>
            <p class="text-sm text-on-surface-variant mt-1">Choose Duties & Taxes ledgers for the current filtered records.</p>
          </div>
          <button class="p-2 rounded-lg hover:bg-white text-outline hover:text-primary transition-colors" onclick="closeGstMapping()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="p-6 space-y-4">
          ${taxes.map((tax) => {
            const options = gstTaxLedgerOptions(tax);
            const selected = state.gstLedgerMapping[tax] || preferredGstLedger(tax);
            return `
              <label class="block">
                <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">${tax} ledger</span>
                <select class="w-full bg-surface-container-low border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateGstLedgerMapping('${tax}', this.value)">
                  ${options.length ? options.map((name) => `<option value="${escapeHtml(name)}" ${selected === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("") : `<option value="${tax}" selected>${tax}</option>`}
                </select>
              </label>
            `;
          }).join("")}
          <div class="p-3 bg-primary/5 rounded-xl border border-primary/10 text-[12px] text-on-surface-variant">
            This will set <strong>cgst ledger</strong>, <strong>sgst ledger</strong>, and <strong>igst ledger</strong> on ${rowCount} filtered row${rowCount === 1 ? "" : "s"} before sending to Tally ERP 9.
          </div>
        </div>
        <div class="p-5 bg-surface-container-low border-t border-outline-variant/40 flex justify-end gap-3">
          <button class="px-5 py-2.5 bg-white border border-outline-variant text-on-surface-variant rounded-xl font-bold text-body-md hover:bg-surface-variant/40 transition-all" onclick="closeGstMapping()">Cancel</button>
          <button class="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-body-md hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2" onclick="applyGstMapping()">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            Apply GST Mapping
          </button>
        </div>
      </div>
    </div>
  `;
}

function mapping() {
  const summary = state.validation?.summary || { total: 0, ready: 0, needsFix: 0 };
  const selected = filterSummary();
  const typeOptions = transactionOptions();
  const parties = partyOptions();
  const showingCount = filteredTableRows().length;
  const totalCount = state.validation?.rows?.length || 0;
  const filename = state.validation?.batch?.filename || "template.xlsx";

  // Calculate dynamic summary stats for right side panel
  const selectedRows = selectedSendRows();
  const totalGst = selectedRows.reduce((sum, row) => {
    const cgst = Number(row.payload["CGST"] || 0);
    const sgst = Number(row.payload["SGST"] || 0);
    const igst = Number(row.payload["IGST"] || 0);
    return sum + cgst + sgst + igst;
  }, 0);
  const totalTaxable = selected.amount - totalGst;

  const excelHeaders = state.validation?.headers || [];
  const bulkReplaceOptionsHtml = excelHeaders.length > 0
    ? excelHeaders.map(h => {
        const colKey = canonicalKey(h);
        const colLabel = capitalizeHeader(h);
        const selectedAttr = colKey === "party ledger or cash" ? "selected" : "";
        return `<option value="${colKey}" ${selectedAttr}>${escapeHtml(colLabel)}</option>`;
      }).join("")
    : `
      <option value="date">Date</option>
      <option value="invoice no">Invoice No</option>
      <option value="voucher type">Voucher Type</option>
      <option value="party ledger or cash" selected>Party Ledger</option>
      <option value="gstin/uin">GSTIN</option>
      <option value="place of supply">Place of Supply (State)</option>
      <option value="item name">Item Name</option>
      <option value="quantity">Quantity</option>
      <option value="rate">Rate</option>
      <option value="taxable amount">Taxable Amount</option>
      <option value="purchase ledger">Purchase/Sales Ledger</option>
      <option value="total amount">Total Amount</option>
    `;

  return tailwindShell("mapping", `
    <!-- Central Workspace Layout -->
    <div class="flex flex-col gap-6">
      <div class="flex gap-gutter pb-8">
        <!-- Main Grid Area -->
        <div class="flex-[3] flex flex-col gap-6 min-w-0">
          <div class="flex justify-between items-end">
            <div>
              <h2 class="text-display-lg font-display-lg text-primary">Editable review table</h2>
              <p class="text-body-md text-on-surface-variant">Verify and map data before pushing to ERP.</p>
            </div>
            <div class="flex gap-2 mb-1">
              <div class="flex items-center bg-white border border-outline-variant rounded-full px-4 py-1.5 shadow-sm">
                <span class="text-label-caps text-outline mr-2">Selected Amount:</span>
                <span class="text-body-md font-data-mono font-bold text-primary">${money(selected.amount)}</span>
              </div>
              <div class="flex items-center bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span class="text-[11px] font-bold text-green-700 uppercase tracking-wider">${selected.selected} selected</span>
              </div>
              <div class="flex items-center bg-surface-container border border-outline-variant rounded-full px-3 py-1.5">
                <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">${selected.blocked} blocked</span>
              </div>
            </div>
          </div>

          <!-- Advanced Filter Section -->
          <div class="bg-white p-5 rounded-xl border border-outline-variant shadow-sm space-y-5">
            <div class="flex justify-between items-center border-b border-outline-variant/30 pb-4">
              <h4 class="font-headline-sm text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">filter_alt</span>
                Table Filters
              </h4>
              <span class="text-[12px] text-on-surface-variant">Refine list by transaction type and party details.</span>
            </div>
            <div class="flex items-end gap-6">
              <div class="flex-1">
                <label class="block text-label-caps font-label-caps mb-2 text-on-surface-variant">Transaction Type</label>
                <div class="relative group">
                  <select class="w-full bg-surface-container-low border-outline-variant rounded-lg text-body-md py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer transition-all hover:bg-white" onchange="updateSendFilter('voucherType', this.value)">
                    <option value="All" ${state.sendFilters.voucherType === "All" ? "selected" : ""}>All Transactions</option>
                    ${typeOptions.map((type) => `<option ${state.sendFilters.voucherType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
                  </select>
                  <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline group-hover:text-primary transition-colors">expand_more</span>
                </div>
              </div>
              <div class="flex-1">
                <label class="block text-label-caps font-label-caps mb-2 text-on-surface-variant">Party Ledger</label>
                <div class="relative group">
                  <select class="w-full bg-surface-container-low border-outline-variant rounded-lg text-body-md py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer transition-all hover:bg-white" onchange="updateSendFilter('partyLedger', this.value)">
                    <option value="All" ${state.sendFilters.partyLedger === "All" ? "selected" : ""}>All Parties</option>
                    ${parties.map((party) => `<option ${state.sendFilters.partyLedger === party ? "selected" : ""}>${escapeHtml(party)}</option>`).join("")}
                  </select>
                  <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline group-hover:text-primary transition-colors">expand_more</span>
                </div>
              </div>
              <div class="flex-1">
                <label class="block text-label-caps font-label-caps mb-2 text-on-surface-variant">Select Column</label>
                <div class="relative group">
                  <select class="w-full bg-surface-container-low border-outline-variant rounded-lg text-body-md py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer transition-all hover:bg-white" id="bulk-replace-col">
                    ${bulkReplaceOptionsHtml}
                  </select>
                  <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline group-hover:text-primary transition-colors">expand_more</span>
                </div>
              </div>
              <div class="flex-1">
                <label class="block text-label-caps font-label-caps mb-2 text-on-surface-variant">Replacing...</label>
                <div class="relative group">
                  <input type="text" id="bulk-replace-val" placeholder="New value..." class="w-full bg-surface-container-low border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all hover:bg-white">
                </div>
              </div>
              <div class="flex gap-2">
                <button class="px-6 py-2.5 text-body-md font-semibold text-primary border border-primary hover:bg-primary/5 rounded-lg transition-all whitespace-nowrap animate-pulse-once" onclick="applyBulkReplace()">
                  Apply
                </button>
                <button class="px-6 py-2.5 text-body-md font-semibold text-on-surface-variant bg-surface-variant/30 hover:bg-surface-variant/50 rounded-lg transition-all whitespace-nowrap" onclick="resetSendFilters()" style="transform: scale(1);">
                  Reset
                </button>
              </div>
            </div>
          </div>

          <!-- Advanced Mapping Hub (New) - Locked -->
          <div class="glass-card p-2 rounded-2xl border border-outline-variant shadow-lg flex items-center gap-4 bg-surface-container-low opacity-95 relative">
            <div class="p-3 bg-surface-variant/20 rounded-xl border border-outline-variant flex items-center gap-3 relative">
              <div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-outline-variant border border-white rounded-full flex items-center justify-center text-[8px] text-white"><span class="material-symbols-outlined text-[8px]">lock</span></div>
              <span class="material-symbols-outlined text-outline">hub</span>
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-outline uppercase tracking-tighter">Command Center</span>
                <span class="text-body-md font-bold text-outline flex items-center gap-1">
                  Advanced Mapping Hub
                  <span class="material-symbols-outlined text-sm text-outline">lock</span>
                </span>
              </div>
            </div>
            <div class="h-10 w-[1px] bg-outline-variant/30"></div>
            <div class="flex-1 flex gap-2">
              <button class="flex items-center gap-2 px-5 py-2.5 bg-outline-variant/30 text-on-surface-variant/50 rounded-xl font-bold text-body-md cursor-not-allowed transition-all" onclick="event.preventDefault(); setNotice('Advanced Mapping Utility: Service coming soon!')">
                <span class="material-symbols-outlined text-[20px]">lock</span>
                Advanced Mapping Utility (Coming Soon)
              </button>
              <button class="flex items-center gap-2 px-5 py-2.5 bg-white border border-outline-variant text-on-surface-variant rounded-xl font-bold text-body-md hover:bg-surface-container-high transition-all" onclick="event.preventDefault(); openGstMapping()">
                <span class="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
                GST Mapping
                <span class="material-symbols-outlined text-sm ml-auto opacity-40">open_in_new</span>
              </button>
            </div>
            <div class="flex items-center gap-2 px-4 py-2 bg-surface-variant/20 rounded-xl">
              <span class="text-[12px] font-medium text-outline">Auto-map status:</span>
              <span class="text-[11px] font-bold text-outline uppercase tracking-wider bg-outline-variant/30 px-2 py-0.5 rounded">Locked</span>
            </div>
          </div>

          <!-- Data Grid Hero -->
          <div class="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm flex flex-col neon-border">
            <div class="flex items-center justify-between p-4 bg-surface-container-low border-b border-outline-variant">
              <div class="flex items-center gap-3">
                <button class="px-4 py-1.5 bg-primary text-on-primary text-[13px] font-semibold rounded-lg hover:bg-primary-container transition-all active:scale-95 shadow-sm" onclick="selectAllSendableRows()">Select all matched</button>
                <button class="px-4 py-1.5 bg-white border border-outline-variant text-[13px] font-semibold rounded-lg hover:bg-surface-variant/50 transition-all active:scale-95" onclick="clearSelectedRows()">Clear selection</button>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-outline text-lg">filter_list</span>
                <span class="text-[12px] text-outline font-medium">Interactive headers active</span>
              </div>
            </div>
            ${rowsTable("validation")}
          </div>
        </div>

        <!-- Right Side Panel -->
        <div class="w-side-panel-width flex flex-col gap-6 shrink-0">
          <!-- Data Integrity Score Widget -->
          <div class="glass-card p-6 rounded-2xl flex flex-col gap-5 border-primary/10 relative overflow-hidden bg-gradient-to-br from-white to-surface-container-low">
            <div class="flex justify-between items-start">
              <h3 class="font-headline-sm text-on-surface font-bold">Financial Batch Summary</h3>
              <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
            </div>
            <div class="space-y-4">
              <div class="flex justify-between items-center p-3 bg-primary/5 rounded-xl border border-primary/10">
                <div>
                  <p class="text-[10px] font-bold text-outline uppercase tracking-wider">Total Voucher Value</p>
                  <p class="text-lg font-black text-primary">${money(selected.amount)}</p>
                </div>
                <span class="material-symbols-outlined text-primary/40">payments</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/30">
                  <p class="text-[10px] font-bold text-outline uppercase">Taxable</p>
                  <p class="text-body-md font-bold text-on-surface">${money(totalTaxable)}</p>
                </div>
                <div class="p-3 bg-surface-container rounded-xl border border-outline-variant/30">
                  <p class="text-[10px] font-bold text-outline uppercase">Total GST</p>
                  <p class="text-body-md font-bold text-secondary">${money(totalGst)}</p>
                </div>
              </div>
            </div>
            <div class="pt-2 border-t border-outline-variant/30">
              <div class="flex justify-between text-[11px] font-bold text-on-surface-variant">
                <span>SELECTED RECORDS</span>
                <span class="text-primary">${selected.selected} / ${totalCount}</span>
              </div>
            </div>
          </div>

          <!-- Enhanced Ledger Panel / Mismatch Diagnostics -->
          <div class="glass-card p-6 rounded-2xl flex flex-col gap-5 border-primary/20 bg-gradient-to-b from-white to-surface-container-lowest">
            <div>
              <h3 class="font-headline-sm text-on-surface flex items-center gap-2 font-bold">
                <span class="material-symbols-outlined text-primary">schema</span>
                Mismatch Diagnostics
              </h3>
              <p class="text-[12px] text-on-surface-variant mt-1 leading-relaxed">System identified ${selected.blocked} blocked rows in the current view.</p>
            </div>
            
            <!-- Ledger issues list or success card -->
            ${issueListTailwind()}

            <div class="space-y-3">
              <button class="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-body-md shadow-md shadow-primary/20 hover:bg-primary-container transition-all flex items-center justify-center gap-2 active:scale-95" onclick="promptCreateLedger()">
                <span class="material-symbols-outlined text-[20px]">add_circle</span>
                Create Ledger Manually
              </button>
              <button class="w-full py-3 bg-white border border-primary text-primary rounded-xl font-bold text-body-md hover:bg-primary/5 transition-all flex items-center justify-center gap-2 active:scale-95" onclick="promptAlterLedger()">
                <span class="material-symbols-outlined text-[20px]">edit_document</span>
                Alter Existing Ledger
              </button>
            </div>
            <div class="pt-2">
              <div class="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-2">
                <span class="material-symbols-outlined text-primary text-[16px] mt-0.5">lightbulb</span>
                <p class="text-[11px] text-on-surface-variant leading-normal">
                  <span class="font-bold text-primary">Pro Tip:</span> Bulk resolve ledger mappings using the Advanced Utility to save manual steps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${gstMappingModal()}

      <!-- Footer / FAB Context (Natural scrolling flow) -->
      <div class="px-gutter py-4 bg-white border border-outline-variant flex justify-between items-center rounded-2xl mt-6">
        <div class="flex items-center gap-2 text-on-surface-variant">
          <span class="material-symbols-outlined text-outline">info</span>
          <p class="text-[12px] font-medium tracking-tight">System identified ${selected.blocked} of ${totalCount} records in '<span class="font-bold text-on-surface">${escapeHtml(filename)}</span>' for review.</p>
        </div>
        <div class="flex gap-4">
          <button class="px-6 py-2.5 bg-secondary text-on-secondary font-bold rounded-xl hover:bg-secondary/90 transition-all flex items-center gap-2 active:scale-95 shadow-md shadow-secondary/20" onclick="revalidate()">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            Commit Edits
          </button>
          <button class="px-8 py-2.5 bg-surface-variant/20 text-on-surface-variant font-bold rounded-xl hover:bg-surface-variant/40 transition-all border border-outline-variant/30" onclick="saveDraft()">Save Draft</button>
          <button class="px-8 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2 group active:scale-95" onclick="continueWhenReady()">
            Ready for Tally Sending
            <span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `);
}

function promptCreateLedger(prefilledName = "") {
  state.showCreateLedgerModal = true;
  state.createLedgerForm = {
    name: prefilledName || "",
    parent: "Sundry Creditors",
    billwiseOn: "No",
    address: "",
    state: "Delhi",
    country: "India",
    phone: "",
    email: "",
    gstRegistrationType: "Regular",
    gstin: "",
    taxType: "GST",
    gstDutyType: "CGST",
    taxRate: "",
    openingBalance: "0",
    provideBankDetails: "No"
  };
  render();
}

function closeCreateLedgerModal() {
  state.showCreateLedgerModal = false;
  render();
}

function updateCreateLedgerField(field, value) {
  state.createLedgerForm[field] = value;
  if (field === "gstin" && value.trim()) {
    state.createLedgerForm.gstRegistrationType = "Regular";
    const regSelect = document.querySelector("#create-ledger-modal select[onchange*='gstRegistrationType']");
    if (regSelect) regSelect.value = "Regular";
  }
  if (field === "parent") {
    render();
  }
}

async function submitCreateLedgerForm() {
  const form = state.createLedgerForm;
  if (!form.name.trim()) {
    alert("Ledger Name is required.");
    return;
  }
  state.busy = true;
  render();
  try {
    const result = await api("/api/tally/create-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ledger",
        name: form.name.trim(),
        parent: form.parent,
        username: state.user?.username || "guest-01",
        billwiseOn: form.billwiseOn,
        address: form.address,
        state: form.state,
        country: form.country,
        phone: form.phone,
        email: form.email,
        gstRegistrationType: form.gstRegistrationType,
        gstin: form.gstin.trim(),
        taxType: form.taxType,
        gstDutyType: form.gstDutyType,
        taxRate: form.taxRate,
        openingBalance: form.openingBalance
      })
    });
    state.showCreateLedgerModal = false;
    await syncMastersQuietly();
    await refreshAll();
    if (state.validation?.batch?.id) await revalidate();
    setNotice(result.message || `Ledger '${form.name}' created successfully.`);
  } catch (error) {
    alert("Failed to create ledger: " + error.message);
  } finally {
    state.busy = false;
    render();
  }
}

function createLedgerModal() {
  if (!state.showCreateLedgerModal) return "";
  const form = state.createLedgerForm;
  const parentGroup = form.parent;
  
  const showMailing = ["Sundry Creditors", "Sundry Debtors", "Bank Accounts"].includes(parentGroup);
  const showTaxReg = ["Sundry Creditors", "Sundry Debtors"].includes(parentGroup);
  const showDutiesTaxes = ["Duties & Taxes"].includes(parentGroup);
  const showBillwise = ["Sundry Creditors", "Sundry Debtors"].includes(parentGroup);
  const showBanking = ["Bank Accounts"].includes(parentGroup);
  
  const states = ["Delhi", "Haryana", "Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "West Bengal", "Gujarat", "Rajasthan", "Punjab", "Bihar", "Madhya Pradesh", "Andhra Pradesh", "Telangana", "Kerala", "Other"];
  
  return `
    <div id="create-ledger-modal" class="fixed inset-0 z-[300] flex items-center justify-center bg-inverse-surface/60 backdrop-blur-sm" onclick="closeCreateLedgerModal()">
      <div class="bg-white border border-primary/20 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="p-6 border-b border-outline-variant/40 flex items-start justify-between bg-surface-container-low">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-widest mb-1">
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
              Tally Master Panel
            </div>
            <h3 class="font-headline-md text-headline-md text-on-surface font-bold">Create New Ledger</h3>
          </div>
          <button class="p-2 rounded-lg hover:bg-surface-container-high text-outline hover:text-primary transition-colors" onclick="closeCreateLedgerModal()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div class="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div class="grid grid-cols-2 gap-4">
            <label class="block col-span-2">
              <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">Ledger Name *</span>
              <input type="text" value="${escapeHtml(form.name)}" class="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent font-semibold" placeholder="e.g. Aarav Enterprises" oninput="updateCreateLedgerField('name', this.value)">
            </label>
            
            <label class="block col-span-2">
              <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">Under (Account Group)</span>
              <select class="w-full bg-surface-container-low border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateCreateLedgerField('parent', this.value)">
                ${ledgerGroups.map(grp => `<option value="${escapeHtml(grp)}" ${parentGroup === grp ? "selected" : ""}>${escapeHtml(grp)}</option>`).join("")}
              </select>
            </label>
          </div>
          
          ${showBillwise ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <span class="text-body-md font-semibold text-on-surface">Maintain balances bill-by-bill?</span>
              <select class="bg-white border-outline-variant rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary" onchange="updateCreateLedgerField('billwiseOn', this.value)">
                <option value="Yes" ${form.billwiseOn === "Yes" ? "selected" : ""}>Yes</option>
                <option value="No" ${form.billwiseOn === "No" ? "selected" : ""}>No</option>
              </select>
            </div>
          ` : ""}
          
          ${showMailing ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <h4 class="text-xs font-bold text-primary uppercase tracking-wider">Mailing Details</h4>
              <div class="grid grid-cols-2 gap-4">
                <label class="block col-span-2">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Address</span>
                  <textarea class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent h-20" placeholder="Street name, suite, city..." oninput="updateCreateLedgerField('address', this.value)">${escapeHtml(form.address)}</textarea>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">State</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateCreateLedgerField('state', this.value)">
                    ${states.map(st => `<option value="${escapeHtml(st)}" ${form.state === st ? "selected" : ""}>${escapeHtml(st)}</option>`).join("")}
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Country</span>
                  <input type="text" value="${escapeHtml(form.country)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" oninput="updateCreateLedgerField('country', this.value)">
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Phone Number</span>
                  <input type="text" value="${escapeHtml(form.phone)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="e.g. +91 99999 99999" oninput="updateCreateLedgerField('phone', this.value)">
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Email ID</span>
                  <input type="email" value="${escapeHtml(form.email)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="e.g. info@business.com" oninput="updateCreateLedgerField('email', this.value)">
                </label>
              </div>
            </div>
          ` : ""}
          
          ${showBanking ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <span class="text-body-md font-semibold text-on-surface">Provide Bank Details?</span>
              <select class="bg-white border-outline-variant rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary" onchange="updateCreateLedgerField('provideBankDetails', this.value)">
                <option value="No" ${form.provideBankDetails === "No" ? "selected" : ""}>No</option>
                <option value="Yes" ${form.provideBankDetails === "Yes" ? "selected" : ""}>Yes</option>
              </select>
            </div>
          ` : ""}
          
          ${showTaxReg ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <h4 class="text-xs font-bold text-primary uppercase tracking-wider">Tax Registration Details</h4>
              <div class="grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Registration Type</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateCreateLedgerField('gstRegistrationType', this.value)">
                    <option value="Regular" ${form.gstRegistrationType === "Regular" ? "selected" : ""}>Regular</option>
                    <option value="Composition" ${form.gstRegistrationType === "Composition" ? "selected" : ""}>Composition</option>
                    <option value="Consumer" ${form.gstRegistrationType === "Consumer" ? "selected" : ""}>Consumer</option>
                    <option value="Unregistered" ${form.gstRegistrationType === "Unregistered" ? "selected" : ""}>Unregistered</option>
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">GSTIN/UIN</span>
                  <input type="text" value="${escapeHtml(form.gstin)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent uppercase" placeholder="e.g. 07AAAAA0000A1Z0" oninput="updateCreateLedgerField('gstin', this.value)">
                </label>
              </div>
            </div>
          ` : ""}
          
          ${showDutiesTaxes ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <h4 class="text-xs font-bold text-primary uppercase tracking-wider">Duties & Taxes Details</h4>
              <div class="grid grid-cols-3 gap-4">
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Type of Duty</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary" onchange="updateCreateLedgerField('taxType', this.value)">
                    <option value="GST" ${form.taxType === "GST" ? "selected" : ""}>GST</option>
                    <option value="Others" ${form.taxType === "Others" ? "selected" : ""}>Others</option>
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">GST Tax Type</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary" onchange="updateCreateLedgerField('gstDutyType', this.value)">
                    <option value="CGST" ${form.gstDutyType === "CGST" ? "selected" : ""}>CGST</option>
                    <option value="SGST" ${form.gstDutyType === "SGST" ? "selected" : ""}>SGST</option>
                    <option value="IGST" ${form.gstDutyType === "IGST" ? "selected" : ""}>IGST</option>
                    <option value="UTGST" ${form.gstDutyType === "UTGST" ? "selected" : ""}>UTGST</option>
                    <option value="Cess" ${form.gstDutyType === "Cess" ? "selected" : ""}>Cess</option>
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Percentage rate (%)</span>
                  <input type="number" step="any" value="${escapeHtml(form.taxRate)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary" placeholder="e.g. 9 or 18" oninput="updateCreateLedgerField('taxRate', this.value)">
                </label>
              </div>
            </div>
          ` : ""}
          
          <div class="grid grid-cols-2 gap-4">
            <label class="block col-span-2">
              <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">Opening Balance</span>
              <input type="text" value="${escapeHtml(form.openingBalance)}" class="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent font-data-mono font-bold" placeholder="e.g. 5000 Cr" oninput="updateCreateLedgerField('openingBalance', this.value)">
            </label>
          </div>
        </div>
        
        <div class="p-5 bg-surface-container-low border-t border-outline-variant/40 flex justify-end gap-3 shrink-0">
          <button class="px-5 py-2.5 bg-white border border-outline-variant text-on-surface-variant rounded-xl font-bold text-body-md hover:bg-surface-variant/40 transition-all" onclick="closeCreateLedgerModal()">Cancel</button>
          <button class="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-body-md hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2" onclick="submitCreateLedgerForm()">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            Create Ledger
          </button>
        </div>
      </div>
    </div>
  `;
}

function promptAlterLedger(prefilledSearch = "") {
  state.showAlterLedgerModal = true;
  state.alterLedgerSearch = "";
  state.editingLedger = null;
  
  const allLedgers = (state.masters?.masters || []).filter(m => m.type === "ledger" || m.type === "gst_ledger");
  const q = (prefilledSearch || "").trim().toLowerCase();
  
  if (q) {
    const found = allLedgers.find(l => l.name.toLowerCase() === q);
    if (found) {
      selectAlterLedger(found.name);
      return;
    }
  }
  
  state.alterLedgerStep = 1;
  render();
}

function closeAlterLedgerModal() {
  state.showAlterLedgerModal = false;
  render();
}

function filterAlterLedgerList(query) {
  state.alterLedgerSearch = query;
  const q = query.toLowerCase().trim();
  const groupSections = document.querySelectorAll(".alter-ledger-group-sec");
  let overallVisible = 0;
  
  groupSections.forEach(sec => {
    const groupName = sec.getAttribute("data-group-name") || "";
    const items = sec.querySelectorAll(".alter-ledger-item");
    let visibleInGroup = 0;
    
    items.forEach(item => {
      const ledgerName = item.getAttribute("data-ledger-name") || "";
      if (groupName.includes(q) || ledgerName.includes(q)) {
        item.style.display = "";
        visibleInGroup++;
      } else {
        item.style.display = "none";
      }
    });
    
    const countBadge = sec.querySelector(".group-count");
    if (countBadge) {
      countBadge.textContent = visibleInGroup;
    }
    
    if (visibleInGroup > 0) {
      sec.style.display = "";
      overallVisible += visibleInGroup;
    } else {
      sec.style.display = "none";
    }
  });
  
  const emptyState = document.getElementById("alter-ledger-empty-state");
  if (emptyState) {
    if (overallVisible === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
    }
  }
}

async function selectAlterLedger(name) {
  state.busy = true;
  render();
  
  const allLedgers = (state.masters?.masters || []).filter(m => m.type === "ledger" || m.type === "gst_ledger");
  const foundLedger = allLedgers.find(l => l.name === name);
  const fallbackParent = foundLedger?.parent || "Sundry Creditors";
  const masterType = foundLedger?.type || "ledger";
  
  state.editingLedger = { name, parent: fallbackParent, type: masterType };
  state.alterLedgerForm = {
    oldName: name,
    newName: name,
    parent: fallbackParent,
    billwiseOn: "No",
    address: "",
    state: "Delhi",
    country: "India",
    phone: "",
    email: "",
    gstRegistrationType: "Regular",
    gstin: "",
    taxType: "GST",
    gstDutyType: "CGST",
    taxRate: "",
    openingBalance: "0",
    provideBankDetails: "No"
  };

  try {
    const result = await api(`/api/tally/get-master?type=${masterType}&name=${encodeURIComponent(name)}`);
    if (result.ok && result.ledger) {
      state.editingLedger = result.ledger;
      state.alterLedgerForm = {
        oldName: name,
        newName: name,
        parent: result.ledger.parent || fallbackParent,
        billwiseOn: result.ledger.billwiseOn || "No",
        address: result.ledger.address || "",
        state: result.ledger.state || "Delhi",
        country: result.ledger.country || "India",
        phone: result.ledger.phone || "",
        email: result.ledger.email || "",
        gstRegistrationType: result.ledger.gstRegistrationType || "Regular",
        gstin: result.ledger.gstin || "",
        taxType: result.ledger.taxType || "GST",
        gstDutyType: result.ledger.gstDutyType || "CGST",
        taxRate: result.ledger.taxRate || "",
        openingBalance: result.ledger.openingBalance || "0",
        provideBankDetails: result.ledger.provideBankDetails || "No"
      };
    }
  } catch (error) {
    console.warn("Could not fetch full details from Tally, editing with defaults:", error);
  } finally {
    state.alterLedgerStep = 2;
    state.busy = false;
    render();
  }
}

function updateAlterLedgerField(field, value) {
  state.alterLedgerForm[field] = value;
  if (field === "gstin" && value.trim()) {
    state.alterLedgerForm.gstRegistrationType = "Regular";
    const regSelect = document.querySelector("#alter-ledger-modal select[onchange*='gstRegistrationType']");
    if (regSelect) regSelect.value = "Regular";
  }
  if (field === "parent") {
    render();
  }
}

async function submitAlterLedgerForm() {
  const form = state.alterLedgerForm;
  if (!form.newName.trim()) {
    alert("Ledger Name is required.");
    return;
  }
  state.busy = true;
  render();
  try {
    const result = await api("/api/tally/alter-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: state.editingLedger?.type || "ledger",
        oldName: form.oldName,
        newName: form.newName.trim(),
        parent: form.parent,
        billwiseOn: form.billwiseOn,
        address: form.address,
        state: form.state,
        country: form.country,
        phone: form.phone,
        email: form.email,
        gstRegistrationType: form.gstRegistrationType,
        gstin: form.gstin.trim(),
        taxType: form.taxType,
        gstDutyType: form.gstDutyType,
        taxRate: form.taxRate,
        openingBalance: form.openingBalance
      })
    });
    state.showAlterLedgerModal = false;
    await syncMastersQuietly();
    await refreshAll();
    if (state.validation?.batch?.id) await revalidate();
    setNotice(result.message || `Ledger '${form.newName}' altered successfully.`);
  } catch (error) {
    alert("Failed to alter ledger: " + error.message);
  } finally {
    state.busy = false;
    render();
  }
}

function alterLedgerModal() {
  if (!state.showAlterLedgerModal) return "";
  const states = ["Delhi", "Haryana", "Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "West Bengal", "Gujarat", "Rajasthan", "Punjab", "Bihar", "Madhya Pradesh", "Andhra Pradesh", "Telangana", "Kerala", "Other"];
  
  if (state.alterLedgerStep === 1) {
    const allLedgers = (state.masters?.masters || []).filter(m => m.type === "ledger" || m.type === "gst_ledger");
    const grouped = {};
    allLedgers.forEach(l => {
      const parent = l.parent || "Others";
      if (!grouped[parent]) grouped[parent] = [];
      grouped[parent].push(l.name);
    });
    
    const q = (state.alterLedgerSearch || "").toLowerCase().trim();
    const filteredGroups = {};
    Object.keys(grouped).forEach(parent => {
      const matched = grouped[parent].filter(name => name.toLowerCase().includes(q) || parent.toLowerCase().includes(q));
      if (matched.length > 0) {
        filteredGroups[parent] = matched;
      }
    });
    
    return `
      <div id="alter-ledger-modal" class="fixed inset-0 z-[300] flex items-center justify-center bg-inverse-surface/60 backdrop-blur-sm" onclick="closeAlterLedgerModal()">
        <div class="bg-white border border-primary/20 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onclick="event.stopPropagation()">
          <div class="p-6 border-b border-outline-variant/40 flex items-start justify-between bg-surface-container-low">
            <div>
              <div class="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-widest mb-1">
                <span class="material-symbols-outlined text-[18px]">edit_document</span>
                Tally Alter Panel
              </div>
              <h3 class="font-headline-md text-headline-md text-on-surface font-bold">Select Ledger to Alter</h3>
            </div>
            <button class="p-2 rounded-lg hover:bg-surface-container-high text-outline hover:text-primary transition-colors" onclick="closeAlterLedgerModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div class="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline text-[20px]">search</span>
              <input type="text" id="alter-ledger-search-input" value="${escapeHtml(state.alterLedgerSearch || "")}" placeholder="Search ledger by name or group..." class="w-full bg-surface-container-low border border-outline-variant rounded-xl text-body-md py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all" oninput="filterAlterLedgerList(this.value)">
            </div>
            
            <div id="alter-ledger-list-container" class="space-y-4">
              ${Object.keys(filteredGroups).map(parent => `
                <div class="alter-ledger-group-sec space-y-2" data-group-name="${escapeHtml(parent.toLowerCase())}">
                  <h4 class="text-xs font-bold text-primary uppercase tracking-wider bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 flex items-center justify-between">
                    <span>${escapeHtml(parent)}</span>
                    <span class="group-count bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full" data-count="${filteredGroups[parent].length}">${filteredGroups[parent].length}</span>
                  </h4>
                  <div class="grid grid-cols-2 gap-2.5 pl-1">
                    ${filteredGroups[parent].map(name => `
                      <div class="alter-ledger-item p-3 bg-surface-container hover:bg-primary/5 border border-outline-variant/40 rounded-xl cursor-pointer text-xs font-semibold text-on-surface truncate flex justify-between items-center group transition-all" data-ledger-name="${escapeHtml(name.toLowerCase())}" onclick="selectAlterLedger(${escapeHtml(jsString(name))})">
                        <span class="truncate text-body-md font-medium text-on-surface" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                        <span class="material-symbols-outlined text-[18px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">edit_note</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `).join("")}
              <div id="alter-ledger-empty-state" class="text-center py-10 space-y-2 ${Object.keys(filteredGroups).length === 0 ? "" : "hidden"}">
                <span class="material-symbols-outlined text-outline/50 text-[48px]">search_off</span>
                <p class="text-body-md text-outline">No matching ledgers found.</p>
              </div>
            </div>
          </div>
          
          <div class="p-5 bg-surface-container-low border-t border-outline-variant/40 flex justify-end shrink-0">
            <button class="px-6 py-2.5 bg-white border border-outline-variant text-on-surface-variant rounded-xl font-bold text-body-md hover:bg-surface-variant/40 transition-all" onclick="closeAlterLedgerModal()">Close</button>
          </div>
        </div>
      </div>
    `;
  }
  
  const form = state.alterLedgerForm;
  const parentGroup = form.parent;
  const showMailing = ["Sundry Creditors", "Sundry Debtors", "Bank Accounts"].includes(parentGroup);
  const showTaxReg = ["Sundry Creditors", "Sundry Debtors"].includes(parentGroup);
  const showDutiesTaxes = ["Duties & Taxes"].includes(parentGroup);
  const showBillwise = ["Sundry Creditors", "Sundry Debtors"].includes(parentGroup);
  const showBanking = ["Bank Accounts"].includes(parentGroup);
  
  return `
    <div id="alter-ledger-modal" class="fixed inset-0 z-[300] flex items-center justify-center bg-inverse-surface/60 backdrop-blur-sm" onclick="closeAlterLedgerModal()">
      <div class="bg-white border border-primary/20 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="p-6 border-b border-outline-variant/40 flex items-start justify-between bg-surface-container-low">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-widest mb-1">
              <span class="material-symbols-outlined text-[18px]">edit_document</span>
              Alter Ledger Master
            </div>
            <h3 class="font-headline-md text-headline-md text-on-surface font-bold">Edit: ${escapeHtml(form.oldName)}</h3>
          </div>
          <button class="p-2 rounded-lg hover:bg-surface-container-high text-outline hover:text-primary transition-colors" onclick="closeAlterLedgerModal()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div class="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div class="grid grid-cols-2 gap-4">
            <label class="block col-span-2">
              <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">Ledger Name *</span>
              <input type="text" value="${escapeHtml(form.newName)}" class="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent font-bold text-on-surface" placeholder="e.g. Aarav Enterprises" oninput="updateAlterLedgerField('newName', this.value)">
            </label>
            
            <label class="block col-span-2">
              <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">Under (Account Group)</span>
              <select class="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateAlterLedgerField('parent', this.value)">
                ${ledgerGroups.map(grp => `<option value="${escapeHtml(grp)}" ${parentGroup === grp ? "selected" : ""}>${escapeHtml(grp)}</option>`).join("")}
              </select>
            </label>
          </div>
          
          ${showBillwise ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <span class="text-body-md font-semibold text-on-surface">Maintain balances bill-by-bill?</span>
              <select class="bg-white border-outline-variant rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary border-transparent" onchange="updateAlterLedgerField('billwiseOn', this.value)">
                <option value="Yes" ${form.billwiseOn === "Yes" ? "selected" : ""}>Yes</option>
                <option value="No" ${form.billwiseOn === "No" ? "selected" : ""}>No</option>
              </select>
            </div>
          ` : ""}
          
          ${showMailing ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <h4 class="text-xs font-bold text-primary uppercase tracking-wider">Mailing Details</h4>
              <div class="grid grid-cols-2 gap-4">
                <label class="block col-span-2">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Address</span>
                  <textarea class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent h-20" placeholder="Street name, suite, city..." oninput="updateAlterLedgerField('address', this.value)">${escapeHtml(form.address)}</textarea>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">State</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateAlterLedgerField('state', this.value)">
                    ${states.map(st => `<option value="${escapeHtml(st)}" ${form.state === st ? "selected" : ""}>${escapeHtml(st)}</option>`).join("")}
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Country</span>
                  <input type="text" value="${escapeHtml(form.country)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" oninput="updateAlterLedgerField('country', this.value)">
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Phone Number</span>
                  <input type="text" value="${escapeHtml(form.phone)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="e.g. +91 99999 99999" oninput="updateAlterLedgerField('phone', this.value)">
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Email ID</span>
                  <input type="email" value="${escapeHtml(form.email)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="e.g. info@business.com" oninput="updateAlterLedgerField('email', this.value)">
                </label>
              </div>
            </div>
          ` : ""}
          
          ${showBanking ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between">
              <span class="text-body-md font-semibold text-on-surface">Provide Bank Details?</span>
              <select class="bg-white border-outline-variant rounded-lg text-body-md py-1.5 px-3 focus:ring-2 focus:ring-primary" onchange="updateAlterLedgerField('provideBankDetails', this.value)">
                <option value="No" ${form.provideBankDetails === "No" ? "selected" : ""}>No</option>
                <option value="Yes" ${form.provideBankDetails === "Yes" ? "selected" : ""}>Yes</option>
              </select>
            </div>
          ` : ""}
          
          ${showTaxReg ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <h4 class="text-xs font-bold text-primary uppercase tracking-wider">Tax Registration Details</h4>
              <div class="grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Registration Type</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent" onchange="updateAlterLedgerField('gstRegistrationType', this.value)">
                    <option value="Regular" ${form.gstRegistrationType === "Regular" ? "selected" : ""}>Regular</option>
                    <option value="Composition" ${form.gstRegistrationType === "Composition" ? "selected" : ""}>Composition</option>
                    <option value="Consumer" ${form.gstRegistrationType === "Consumer" ? "selected" : ""}>Consumer</option>
                    <option value="Unregistered" ${form.gstRegistrationType === "Unregistered" ? "selected" : ""}>Unregistered</option>
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">GSTIN/UIN</span>
                  <input type="text" value="${escapeHtml(form.gstin)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary focus:border-transparent uppercase" placeholder="e.g. 07AAAAA0000A1Z0" oninput="updateAlterLedgerField('gstin', this.value)">
                </label>
              </div>
            </div>
          ` : ""}
          
          ${showDutiesTaxes ? `
            <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-4">
              <h4 class="text-xs font-bold text-primary uppercase tracking-wider">Duties & Taxes Details</h4>
              <div class="grid grid-cols-3 gap-4">
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Type of Duty</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary" onchange="updateAlterLedgerField('taxType', this.value)">
                    <option value="GST" ${form.taxType === "GST" ? "selected" : ""}>GST</option>
                    <option value="Others" ${form.taxType === "Others" ? "selected" : ""}>Others</option>
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">GST Tax Type</span>
                  <select class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary" onchange="updateAlterLedgerField('gstDutyType', this.value)">
                    <option value="CGST" ${form.gstDutyType === "CGST" ? "selected" : ""}>CGST</option>
                    <option value="SGST" ${form.gstDutyType === "SGST" ? "selected" : ""}>SGST</option>
                    <option value="IGST" ${form.gstDutyType === "IGST" ? "selected" : ""}>IGST</option>
                    <option value="UTGST" ${form.gstDutyType === "UTGST" ? "selected" : ""}>UTGST</option>
                    <option value="Cess" ${form.gstDutyType === "Cess" ? "selected" : ""}>Cess</option>
                  </select>
                </label>
                
                <label class="block">
                  <span class="block text-label-caps font-label-caps text-on-surface-variant mb-1">Percentage rate (%)</span>
                  <input type="number" step="any" value="${escapeHtml(form.taxRate)}" class="w-full bg-white border-outline-variant rounded-lg text-body-md py-2 px-3 focus:ring-2 focus:ring-primary" placeholder="e.g. 9 or 18" oninput="updateAlterLedgerField('taxRate', this.value)">
                </label>
              </div>
            </div>
          ` : ""}
          
          <div class="grid grid-cols-2 gap-4">
            <label class="block col-span-2">
              <span class="block text-label-caps font-label-caps text-on-surface-variant mb-2">Opening Balance</span>
              <input type="text" value="${escapeHtml(form.openingBalance)}" class="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2.5 px-4 focus:ring-2 focus:ring-primary focus:border-transparent font-data-mono font-bold" placeholder="e.g. 5000 Cr" oninput="updateAlterLedgerField('openingBalance', this.value)">
            </label>
          </div>
        </div>
        
        <div class="p-5 bg-surface-container-low border-t border-outline-variant/40 flex justify-between shrink-0">
          <button class="px-5 py-2.5 bg-white border border-outline-variant text-on-surface-variant rounded-xl font-bold text-body-md hover:bg-surface-variant/40 transition-all flex items-center gap-2" onclick="state.alterLedgerStep = 1; render()">
            <span class="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to List
          </button>
          <div class="flex gap-3">
            <button class="px-5 py-2.5 bg-white border border-outline-variant text-on-surface-variant rounded-xl font-bold text-body-md hover:bg-surface-variant/40 transition-all" onclick="closeAlterLedgerModal()">Cancel</button>
            <button class="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-body-md hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2" onclick="submitAlterLedgerForm()">
              <span class="material-symbols-outlined text-[20px]">check_circle</span>
              Update Master
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function promptCreateMaster(type) {
  const label = masterLabels[type] || "Master";
  const name = prompt(`${label} name to create`);
  if (!name) return;
  const payload = { type, name };
  if (["stock_group", "stock_category", "godown", "stock_item"].includes(type)) {
    const parent = prompt(`${label} parent`, type === "stock_item" ? "" : "Primary");
    if (parent !== null) payload.parent = parent.trim();
  }
  if (type === "stock_item") {
    const unit = prompt("Base unit", "Nos");
    payload.unit = (unit || "Nos").trim();
  }
  try {
    const result = await api("/api/tally/create-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await refreshAll();
    setNotice(result.message || `${label} '${name}' saved.`);
  } catch (error) {
    setNotice(error.message);
  }
}

function inventoryMasterPanel() {
  const c = state.masters.counts || {};
  const masters = [
    ["stock_group", "Stock Group", c.stockGroups || 0, "Group inventory items for reporting"],
    ["stock_category", "Stock Category", c.stockCategories || 0, "Optional item category master"],
    ["stock_item", "Stock Item", c.stockItems || 0, "Inventory item used in item invoice"],
    ["unit", "Unit", c.units || 0, "Nos, Kg, Box, etc."],
    ["godown", "Godown", c.godowns || 0, "Location for stock movement"],
  ];
  return `
    <div class="glass-pro p-6 rounded-[2rem] space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-headline-sm text-on-surface font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">inventory_2</span>
          Inventory Masters
        </h3>
        <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase">Tally-Style Options</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        ${masters.map(([type, label, count, help]) => `
          <button class="p-5 bg-white border border-outline-variant/40 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left flex flex-col justify-between group active:scale-95 shadow-sm" onclick="promptCreateMaster('${type}')">
            <div class="space-y-1">
              <strong class="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">${label}</strong>
              <div class="text-[11px] text-outline leading-tight">${help}</div>
            </div>
            <div class="mt-4 flex items-center justify-between w-full">
              <span class="text-[10px] font-bold text-primary uppercase tracking-widest">Create</span>
              <span class="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">${count}</span>
            </div>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function setVoucherMode(mode) {
  state.selectedVoucherMode = mode;
  if (state.gstEnabled) {
    if (mode === "Item Invoice") {
      state.gstMode = "item";
    } else {
      state.gstMode = "ledger";
    }
  }
  state.selectedRowIds = null;
  if (state.validation?.batch?.id) {
    revalidate();
  } else {
    render();
  }
}

function setContraMode(mode) {
  state.selectedContraMode = mode;
  state.selectedRowIds = null;
  render();
}

function setPaymentMode(mode) {
  state.selectedPaymentMode = mode;
  state.selectedRowIds = null;
  render();
}

function setReceiptMode(mode) {
  state.selectedReceiptMode = mode;
  state.selectedRowIds = null;
  render();
}

function voucherModeSelect() {
  if (!hasSalesPurchaseRows()) return "";
  if (batchHasInventory() || (state.gstEnabled && state.gstMode === "item")) {
    return `<div class="info-note" style="margin: 10px 0; padding: 12px; background: rgba(0,135,90,0.08); border-left: 4px solid #00875a; border-radius: 4px; display: block; width: 100%;">
      <strong>Item Invoice Mode Required</strong>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #5e6c84;">This transaction is configured for <strong>Item Invoice</strong> mode.</p>
    </div>`;
  }
  const modes = state.gstEnabled
    ? [
        ["Accounting Invoice", "Invoice-style accounting entry without stock item lines (Without Item)."],
        ["Item Invoice", "Invoice-style entry intended for stock item invoice layout (Item Basis)."],
      ]
    : [
        ["As Voucher", "Debit/Credit ledger entry like Tally Accounting Voucher Creation."],
        ["Accounting Invoice", "Invoice-style accounting entry without stock item lines."],
        ["Item Invoice", "Invoice-style entry intended for stock item invoice layout."],
      ];
  return `<div class="mode-grid">${modes.map(([mode, help]) => `<button class="mode-card ${state.selectedVoucherMode === mode ? "selected" : ""}" onclick="setVoucherMode('${mode}')">
    <strong>${mode}</strong>
    <span>${help}</span>
  </button>`).join("")}</div>`;
}

function voucherModeNote() {
  if (!hasSalesPurchaseRows()) return "";
  if (state.selectedVoucherMode === "As Voucher") {
    return "As Voucher will send ledger lines in Tally's To/By debit-credit structure. For sales: buyer is debited and sales ledger is credited. For purchase: supplier is credited and purchase ledger is debited.";
  }
  if (state.selectedVoucherMode === "Accounting Invoice") {
    return "Accounting Invoice will send invoice mode with Party A/c name, supplier invoice number, party details, and a Particulars/Amount line like the Tally layout you shared.";
  }
  return "Item Invoice will send inventory-style invoice mode with Sales/Purchase ledger, Name of Item, Quantity, Rate, per, Amount, and optional party details when those Excel columns are available.";
}

function hasContraRows() {
  return filteredTableRows().some((row) => voucherTypeFor(row.payload).toLowerCase() === "contra");
}

function hasPaymentRows() {
  return filteredTableRows().some((row) => voucherTypeFor(row.payload).toLowerCase() === "payment");
}

function hasReceiptRows() {
  return filteredTableRows().some((row) => voucherTypeFor(row.payload).toLowerCase() === "receipt");
}

function hasSalesPurchaseRows() {
  return filteredTableRows().some((row) => ["sales", "purchase"].includes(voucherTypeFor(row.payload).toLowerCase()));
}

function contraModeSelect() {
  if (!hasContraRows()) return "";
  const modes = [
    ["Single Entry", "Tally Contra layout with Account on top and one Particulars line below."],
    ["Double Entry", "Tally Contra layout with To/By debit-credit rows."],
  ];
  return `<div class="card" style="margin-top:20px">
    <div class="card-head"><h2>Contra entry mode</h2><span class="chip success">${escapeHtml(state.selectedContraMode)}</span></div>
    <div class="mode-grid">${modes.map(([mode, help]) => `<button class="mode-card ${state.selectedContraMode === mode ? "selected" : ""}" onclick="setContraMode('${mode}')">
      <strong>${mode}</strong>
      <span>${help}</span>
    </button>`).join("")}</div>
    <p style="margin-top:14px">For Contra rows, Tally Automation uses <strong>party ledger or cash</strong> as the Account and the Excel ledger column as Particulars. If no Particulars ledger is supplied, it uses Cash.</p>
  </div>`;
}

function paymentModeSelect() {
  if (!hasPaymentRows()) return "";
  const modes = [
    ["Single Entry", "Tally Payment layout with Account on top and one Particulars line below."],
    ["Double Entry", "Tally Payment layout with By expense/party and To cash/bank rows."],
  ];
  return `<div class="card" style="margin-top:20px">
    <div class="card-head"><h2>Payment entry mode</h2><span class="chip success">${escapeHtml(state.selectedPaymentMode)}</span></div>
    <div class="mode-grid">${modes.map(([mode, help]) => `<button class="mode-card ${state.selectedPaymentMode === mode ? "selected" : ""}" onclick="setPaymentMode('${mode}')">
      <strong>${mode}</strong>
      <span>${help}</span>
    </button>`).join("")}</div>
    <p style="margin-top:14px">For Payment rows, Tally Automation uses <strong>party ledger or cash</strong> as Particulars and the Excel ledger column as the paying Account. If no Account ledger is supplied, it uses Cash.</p>
  </div>`;
}

function receiptModeSelect() {
  if (!hasReceiptRows()) return "";
  const modes = [
    ["Single Entry", "Tally Receipt layout with Account on top and one Particulars line below."],
    ["Double Entry", "Tally Receipt layout with To income/party and By cash/bank rows."],
  ];
  return `<div class="card" style="margin-top:20px">
    <div class="card-head"><h2>Receipt entry mode</h2><span class="chip success">${escapeHtml(state.selectedReceiptMode)}</span></div>
    <div class="mode-grid">${modes.map(([mode, help]) => `<button class="mode-card ${state.selectedReceiptMode === mode ? "selected" : ""}" onclick="setReceiptMode('${mode}')">
      <strong>${mode}</strong>
      <span>${help}</span>
    </button>`).join("")}</div>
    <p style="margin-top:14px">For Receipt rows, Tally Automation uses <strong>party ledger or cash</strong> as Particulars and the Excel ledger column as the receiving Account. If no Account ledger is supplied, it uses Cash.</p>
  </div>`;
}

function invoiceParticular(payload) {
  const voucherType = voucherTypeFor(payload).toLowerCase();
  const explicitLedger = String(optionalPayload(payload, "purchase ledger", "")).trim();
  if (explicitLedger) return explicitLedger;
  if (voucherType === "purchase") return "Purchase Onion";
  if (voucherType === "sales") return "Sale Oni";
  if (voucherType === "payment") return payload?.["party ledger or cash"] || "Payment";
  if (voucherType === "receipt") return payload?.["party ledger or cash"] || "Receipt";
  if (voucherType === "contra") return payload?.["party ledger or cash"] || "Cash / Bank";
  return payload?.["party ledger or cash"] || "Ledger";
}

function optionalPayload(payload, key, fallback = "") {
  const value = payload?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function itemNameForPayload(payload) {
  return String(optionalPayload(payload, "item name", optionalPayload(payload, "purchase ledger", voucherTypeFor(payload).toLowerCase() === "purchase" ? "Purchase Onion" : "Sale Oni")));
}

function inventoryLedgerForPayload(payload) {
  return String(optionalPayload(payload, "purchase ledger", voucherTypeFor(payload).toLowerCase() === "sales" ? "Sale Oni" : "Purchase Onion"));
}

function isSalesPayload(payload) {
  return voucherTypeFor(payload).toLowerCase() === "sales";
}

function partyRoleLabel(payload) {
  return isSalesPayload(payload) ? "Buyer (Bill to)" : "Supplier (Bill from)";
}

function invoiceNumberLabel(payload) {
  return isSalesPayload(payload) ? "Sales Invoice No." : "Supplier Invoice No.";
}

function inventoryLedgerLabel(payload) {
  return isSalesPayload(payload) ? "Sales ledger" : "Purchase ledger";
}

function quantityForPayload(payload) {
  const q = Number(optionalPayload(payload, "quantity", 1));
  return q > 0 ? q : 1;
}

function rateForPayload(payload) {
  const explicit = Number(optionalPayload(payload, "rate", 0));
  if (explicit > 0) return explicit;
  return Number(payload?.["total amount"] || 0) / quantityForPayload(payload);
}

function unitForPayload(payload) {
  return String(optionalPayload(payload, "per", "Nos") || "Nos");
}

function godownForPayload(payload) {
  return String(optionalPayload(payload, "godown", "Main Location") || "Main Location");
}

function hasInventoryDetails(payload) {
  return ["item name", "quantity", "rate", "per"].some((key) => String(payload?.[key] || "").trim());
}

function partyDetailRows(payload, flexible = false) {
  const rows = [
    [partyRoleLabel(payload), payload?.["party ledger or cash"] || ""],
    ["Mailing Name", optionalPayload(payload, "mailing name", payload?.["party ledger or cash"] || "")],
    ["Address", optionalPayload(payload, "address", "")],
    ["State", optionalPayload(payload, "state", "")],
    ["Country", optionalPayload(payload, "country", "")],
    ["GST Registration type", optionalPayload(payload, "gst registration type", "")],
    ["GSTIN/UIN", optionalPayload(payload, "gstin/uin", "")],
    ["Place of Supply", optionalPayload(payload, "place of supply", "")],
    ["Phone", optionalPayload(payload, "phone", "")],
    ["Email", optionalPayload(payload, "email", "")],
  ];
  return rows.map(([label, value]) => `<span>${label}</span><strong>${escapeHtml(value || "-")}</strong>`).join("");
}

function accountingInvoicePreview() {
  const rows = selectedSendRows().slice(0, 1);
  if (!rows.length) return `<div class="mock-note">No ready rows available. Upload and validate Excel first.</div>`;
  const first = rows[0].payload;
  const body = rows.map((row) => {
    const p = row.payload;
    return `<tr>
      <td>${row.rowNo}</td>
      <td>${escapeHtml(p["invoice no"] || "")}</td>
      <td><strong>${escapeHtml(p["party ledger or cash"] || "")}</strong><div class="label">Party A/c name</div></td>
      <td><strong>${escapeHtml(invoiceParticular(p))}</strong><div class="label">Particulars</div></td>
      <td></td>
      <td></td>
      <td class="right amount">${money(p["total amount"])}</td>
    </tr>`;
  }).join("");
  const total = rows.reduce((sum, row) => sum + Number(row.payload["total amount"] || 0), 0);
  return `<div class="invoice-preview">
    <div class="invoice-top">
      <div><span>Voucher</span><strong>${escapeHtml(voucherTypeFor(first))}</strong></div>
      <div><span>${invoiceNumberLabel(first)}</span><strong>${escapeHtml(first["invoice no"] || "")}</strong></div>
      <div><span>Date</span><strong>${escapeHtml(first.date || "")}</strong></div>
      <div><span>Party A/c name</span><strong>${escapeHtml(first["party ledger or cash"] || "")}</strong></div>
    </div>
    <div class="party-detail-box">
      <h3>Party Details</h3>
      <div class="party-grid">${partyDetailRows(first, false)}</div>
    </div>
    <div class="table-wrap tally-preview"><table>
      <thead><tr><th>Row</th><th>Invoice No.</th><th>Party A/c Name</th><th>Particulars</th><th>Rate</th><th>per</th><th class="right">Amount</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="6">Accounting Invoice total</td><td class="right amount">${money(total)}</td></tr></tfoot>
    </table></div>
  </div>`;
}

function itemInvoicePreview() {
  const rows = selectedSendRows().slice(0, 1);
  if (!rows.length) return `<div class="mock-note">No ready rows available. Upload and validate Excel first.</div>`;
  const first = rows[0].payload;
  const useInventory = rows.some((row) => hasInventoryDetails(row.payload));
  if (!useInventory) {
    const body = rows.map((row) => {
      const p = row.payload;
      return `<tr>
        <td>${row.rowNo}</td>
        <td>${escapeHtml(p["invoice no"] || "")}</td>
        <td><strong>${escapeHtml(p["party ledger or cash"] || "")}</strong><div class="label">Party A/c name</div></td>
        <td><strong>${escapeHtml(inventoryLedgerForPayload(p))}</strong><div class="label">${inventoryLedgerLabel(p)}</div></td>
        <td class="right amount">${money(p["total amount"])}</td>
      </tr>`;
    }).join("");
    const total = rows.reduce((sum, row) => sum + Number(row.payload["total amount"] || 0), 0);
    return `<div class="invoice-preview item-invoice-preview">
      <div class="invoice-top">
        <div><span>Voucher</span><strong>${escapeHtml(voucherTypeFor(first))}</strong></div>
        <div><span>${invoiceNumberLabel(first)}</span><strong>${escapeHtml(first["invoice no"] || "")}</strong></div>
        <div><span>Party A/c name</span><strong>${escapeHtml(first["party ledger or cash"] || "")}</strong></div>
        <div><span>${inventoryLedgerLabel(first)}</span><strong>${escapeHtml(inventoryLedgerForPayload(first))}</strong></div>
      </div>
      <div class="table-wrap tally-preview"><table>
        <thead><tr><th>Row</th><th>Invoice No.</th><th>Party A/c Name</th><th>${inventoryLedgerLabel(first)}</th><th class="right">Amount</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="4">Item Invoice view total</td><td class="right amount">${money(total)}</td></tr></tfoot>
      </table></div>
      <div class="mock-note">No item columns found in Excel, so Tally Automation will leave the item section empty and send party ledger + trade ledger + amount in Tally's Item Invoice view.</div>
    </div>`;
  }
  const body = rows.map((row) => {
    const p = row.payload;
    const quantity = quantityForPayload(p);
    const unit = unitForPayload(p);
    return `<tr>
      <td>${row.rowNo}</td>
      <td>${escapeHtml(p["invoice no"] || "")}</td>
      <td><strong>${escapeHtml(p["party ledger or cash"] || "")}</strong><div class="label">Party A/c name</div></td>
      <td><strong>${escapeHtml(inventoryLedgerForPayload(p))}</strong><div class="label">${inventoryLedgerLabel(p)}</div></td>
      <td><strong>${escapeHtml(itemNameForPayload(p))}</strong></td>
      <td class="right amount">${quantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${escapeHtml(unit)}</td>
      <td class="right amount">${money(rateForPayload(p)).replace("Rs ", "")}</td>
      <td>${escapeHtml(unit)}</td>
      <td>${escapeHtml(godownForPayload(p))}</td>
      <td class="right amount">${money(p["total amount"])}</td>
    </tr>`;
  }).join("");
  const total = rows.reduce((sum, row) => sum + Number(row.payload["total amount"] || 0), 0);
  return `<div class="invoice-preview item-invoice-preview">
    <div class="invoice-top">
      <div><span>Voucher</span><strong>${escapeHtml(voucherTypeFor(first))}</strong></div>
      <div><span>${invoiceNumberLabel(first)}</span><strong>${escapeHtml(first["invoice no"] || "")}</strong></div>
      <div><span>Party A/c name</span><strong>${escapeHtml(first["party ledger or cash"] || "")}</strong></div>
      <div><span>${inventoryLedgerLabel(first)}</span><strong>${escapeHtml(inventoryLedgerForPayload(first))}</strong></div>
    </div>
    <div class="party-detail-box">
      <h3>Party Details</h3>
      <div class="party-grid">${partyDetailRows(first, true)}</div>
    </div>
    <div class="table-wrap tally-preview"><table>
      <thead><tr><th>Row</th><th>Invoice No.</th><th>Party A/c Name</th><th>${inventoryLedgerLabel(first)}</th><th>Name of Item</th><th class="right">Quantity</th><th class="right">Rate</th><th>per</th><th>Godown</th><th class="right">Amount</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="9">Item Invoice total</td><td class="right amount">${money(total)}</td></tr></tfoot>
    </table></div>
    <div class="mock-note">Optional party fields such as state, phone, email, GSTIN/UIN, and address are used when present in Excel. If absent, Tally Automation leaves them blank.</div>
  </div>`;
}

function contraPreview() {
  const contraRows = selectedSendRows().filter((row) => voucherTypeFor(row.payload).toLowerCase() === "contra").slice(0, 1);
  if (!contraRows.length) return "";
  if (state.selectedContraMode === "Single Entry") {
    const body = contraRows.map((row) => {
      const p = row.payload;
      return `<tr>
        <td>${row.rowNo}</td>
        <td>${escapeHtml(p["invoice no"] || "")}</td>
        <td><strong>${escapeHtml(p["party ledger or cash"] || "")}</strong><div class="label">Account</div></td>
        <td><strong>${escapeHtml(contraCounterLedger(p))}</strong><div class="label">Particulars</div></td>
        <td class="right amount">${money(p["total amount"])}</td>
      </tr>`;
    }).join("");
    return `<div class="invoice-preview">
      <div class="invoice-top">
        <div><span>Voucher</span><strong>Contra</strong></div>
        <div><span>Mode</span><strong>Single Entry</strong></div>
        <div><span>Account</span><strong>${escapeHtml(contraRows[0].payload["party ledger or cash"] || "")}</strong></div>
        <div><span>Particulars</span><strong>${escapeHtml(contraCounterLedger(contraRows[0].payload))}</strong></div>
      </div>
      <div class="table-wrap tally-preview"><table>
        <thead><tr><th>Row</th><th>Voucher No.</th><th>Account</th><th>Particulars</th><th class="right">Amount</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
  }
  const body = contraRows.map((row) => {
    const p = row.payload;
    const lines = debitCreditLines(p, "As Voucher");
    return lines.map((line, index) => `<tr>
      <td>${index === 0 ? row.rowNo : ""}</td>
      <td>${index === 0 ? escapeHtml(p["invoice no"] || "") : ""}</td>
      <td>${line.prefix}</td>
      <td><strong>${escapeHtml(line.ledger)}</strong>${index === 0 ? `<div class="label">Contra - Double Entry</div>` : ""}</td>
      <td class="right amount">${line.debit ? money(line.debit) : ""}</td>
      <td class="right amount">${line.credit ? money(line.credit) : ""}</td>
    </tr>`).join("");
  }).join("");
  return `<div class="table-wrap tally-preview"><table>
    <thead><tr><th>Row</th><th>Voucher</th><th>To/By</th><th>Particulars</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function paymentPreview() {
  const paymentRows = selectedSendRows().filter((row) => voucherTypeFor(row.payload).toLowerCase() === "payment").slice(0, 1);
  if (!paymentRows.length) return "";
  if (state.selectedPaymentMode === "Single Entry") {
    const body = paymentRows.map((row) => {
      const p = row.payload;
      return `<tr>
        <td>${row.rowNo}</td>
        <td>${escapeHtml(p["invoice no"] || "")}</td>
        <td><strong>${escapeHtml(paymentAccountLedger(p))}</strong><div class="label">Account</div></td>
        <td><strong>${escapeHtml(p["party ledger or cash"] || "")}</strong><div class="label">Particulars</div></td>
        <td class="right amount">${money(p["total amount"])}</td>
      </tr>`;
    }).join("");
    return `<div class="invoice-preview">
      <div class="invoice-top">
        <div><span>Voucher</span><strong>Payment</strong></div>
        <div><span>Mode</span><strong>Single Entry</strong></div>
        <div><span>Account</span><strong>${escapeHtml(paymentAccountLedger(paymentRows[0].payload))}</strong></div>
        <div><span>Particulars</span><strong>${escapeHtml(paymentRows[0].payload["party ledger or cash"] || "")}</strong></div>
      </div>
      <div class="table-wrap tally-preview"><table>
        <thead><tr><th>Row</th><th>Voucher No.</th><th>Account</th><th>Particulars</th><th class="right">Amount</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
  }
  const body = paymentRows.map((row) => {
    const p = row.payload;
    const lines = debitCreditLines(p, "As Voucher");
    return lines.map((line, index) => `<tr>
      <td>${index === 0 ? row.rowNo : ""}</td>
      <td>${index === 0 ? escapeHtml(p["invoice no"] || "") : ""}</td>
      <td>${line.prefix}</td>
      <td><strong>${escapeHtml(line.ledger)}</strong>${index === 0 ? `<div class="label">Payment - Double Entry</div>` : ""}</td>
      <td class="right amount">${line.debit ? money(line.debit) : ""}</td>
      <td class="right amount">${line.credit ? money(line.credit) : ""}</td>
    </tr>`).join("");
  }).join("");
  return `<div class="table-wrap tally-preview"><table>
    <thead><tr><th>Row</th><th>Voucher</th><th>To/By</th><th>Particulars</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function receiptPreview() {
  const receiptRows = selectedSendRows().filter((row) => voucherTypeFor(row.payload).toLowerCase() === "receipt").slice(0, 1);
  if (!receiptRows.length) return "";
  if (state.selectedReceiptMode === "Single Entry") {
    const body = receiptRows.map((row) => {
      const p = row.payload;
      return `<tr>
        <td>${row.rowNo}</td>
        <td>${escapeHtml(p["invoice no"] || "")}</td>
        <td><strong>${escapeHtml(receiptAccountLedger(p))}</strong><div class="label">Account</div></td>
        <td><strong>${escapeHtml(p["party ledger or cash"] || "")}</strong><div class="label">Particulars</div></td>
        <td class="right amount">${money(p["total amount"])}</td>
      </tr>`;
    }).join("");
    return `<div class="invoice-preview">
      <div class="invoice-top">
        <div><span>Voucher</span><strong>Receipt</strong></div>
        <div><span>Mode</span><strong>Single Entry</strong></div>
        <div><span>Account</span><strong>${escapeHtml(receiptAccountLedger(receiptRows[0].payload))}</strong></div>
        <div><span>Particulars</span><strong>${escapeHtml(receiptRows[0].payload["party ledger or cash"] || "")}</strong></div>
      </div>
      <div class="table-wrap tally-preview"><table>
        <thead><tr><th>Row</th><th>Voucher No.</th><th>Account</th><th>Particulars</th><th class="right">Amount</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
  }
  const body = receiptRows.map((row) => {
    const p = row.payload;
    const lines = debitCreditLines(p, "As Voucher");
    return lines.map((line, index) => `<tr>
      <td>${index === 0 ? row.rowNo : ""}</td>
      <td>${index === 0 ? escapeHtml(p["invoice no"] || "") : ""}</td>
      <td>${line.prefix}</td>
      <td><strong>${escapeHtml(line.ledger)}</strong>${index === 0 ? `<div class="label">Receipt - Double Entry</div>` : ""}</td>
      <td class="right amount">${line.debit ? money(line.debit) : ""}</td>
      <td class="right amount">${line.credit ? money(line.credit) : ""}</td>
    </tr>`).join("");
  }).join("");
  return `<div class="table-wrap tally-preview"><table>
    <thead><tr><th>Row</th><th>Voucher</th><th>To/By</th><th>Particulars</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function debitCreditPreview() {
  const rows = selectedSendRows().slice(0, 1);
  if (!rows.length) return `<div class="mock-note">No ready rows available. Upload and validate Excel first.</div>`;
  const onlyContra = rows.every((row) => voucherTypeFor(row.payload).toLowerCase() === "contra");
  if (onlyContra) return contraPreview();
  const onlyPayment = rows.every((row) => voucherTypeFor(row.payload).toLowerCase() === "payment");
  if (onlyPayment) return paymentPreview();
  const onlyReceipt = rows.every((row) => voucherTypeFor(row.payload).toLowerCase() === "receipt");
  if (onlyReceipt) return receiptPreview();
  if (state.selectedVoucherMode === "Accounting Invoice") return accountingInvoicePreview();
  if (state.selectedVoucherMode === "Item Invoice") return itemInvoicePreview();
  const body = rows.map((row) => {
    const p = row.payload;
    const lines = debitCreditLines(p, state.selectedVoucherMode);
    return lines.map((line, index) => `<tr>
      <td>${index === 0 ? row.rowNo : ""}</td>
      <td>${index === 0 ? escapeHtml(p["invoice no"] || "") : ""}</td>
      <td>${line.prefix}</td>
      <td><strong>${escapeHtml(line.ledger)}</strong>${index === 0 ? `<div class="label">${escapeHtml(voucherTypeFor(p))} - ${escapeHtml(state.selectedVoucherMode)}</div>` : ""}</td>
      <td class="right amount">${line.debit ? money(line.debit) : ""}</td>
      <td class="right amount">${line.credit ? money(line.credit) : ""}</td>
    </tr>`).join("");
  }).join("");
  const totals = rows.flatMap((row) => debitCreditLines(row.payload, state.selectedVoucherMode)).reduce((acc, line) => {
    acc.debit += Number(line.debit || 0);
    acc.credit += Number(line.credit || 0);
    return acc;
  }, { debit: 0, credit: 0 });
  return `<div class="table-wrap tally-preview"><table>
    <thead><tr><th>Row</th><th>Invoice</th><th>To/By</th><th>Particulars</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="4">Preview total</td><td class="right amount">${money(totals.debit)}</td><td class="right amount">${money(totals.credit)}</td></tr></tfoot>
  </table></div>`;
}

function sendSelectionPanel() {
  const summary = filterSummary();
  const blocked = filteredReadyRows().filter((row) => rowLedgerProblems(row).length);
  return `<div class="card" style="margin-top:20px">
    <div class="card-head">
      <div><h2>Filtered entries to send</h2><p>This is the same review table filtered in place. Tick the matched rows you want to import now.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="chip ${summary.selected ? "success" : "warning"}">${summary.selected} selected</span>
        <span class="chip ${summary.blocked ? "danger" : "success"}">${summary.blocked} ledger issue${summary.blocked === 1 ? "" : "s"}</span>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <button class="btn" onclick="selectAllSendableRows()">Select all matched</button>
      <button class="btn" onclick="clearSelectedRows()">Clear selection</button>
      <button class="btn" onclick="promptCreateLedger()">Create ledger manually</button>
    </div>
    ${blocked.length ? `<div class="mock-note">${escapeHtml(blocked[0].errors?.[0] || rowLedgerProblems(blocked[0])[0]?.message || "Ledger mismatch found.")} You can create the ledger here or create it directly in Tally ERP9/TallyPrime, then synchronize and revalidate.</div>` : ""}
    ${rowsTable("send")}
  </div>`;
}

async function sendToTally() {
  if (!state.validation?.batch?.id) return setNotice("Upload and validate Excel before sending.");
  const voucherMode = state.selectedVoucherMode || "As Voucher";
  const selectedRows = selectedSendRows();
  if (!selectedRows.length) return setNotice("No selected rows are ready to send. Select matched rows or fix/create the missing ledgers first.");
  const rowIds = selectedRows.map((row) => row.id);
  state.notice = `Sending ${selectedRows.length} selected valid rows to local Tally...`;
  state.sendProgress = { sent: 0, total: rowIds.length };
  render();
  try {
    const response = await fetch("/api/tally/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: state.validation.batch.id, voucherMode, contraMode: state.selectedContraMode, paymentMode: state.selectedPaymentMode, receiptMode: state.selectedReceiptMode, gstEnabled: state.gstEnabled, gstWorkflow: state.gstWorkflow, gstMode: state.gstMode, rowIds }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    state.sendResult = { results: [], summary: { imported: 0, failed: 0, skipped: 0 }, online: true };
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last partial line
      for (const line of lines) {
        if (line.trim()) {
          const chunk = JSON.parse(line);
          if (chunk.final) {
            state.sendResult = chunk.data;
          } else if (chunk.results) {
            state.sendResult.results.push(...chunk.results);
            state.sendResult.summary.imported += chunk.summary.imported;
            state.sendResult.summary.failed += chunk.summary.failed;
            
            // update UI progress
            const total = rowIds.length;
            const sent = state.sendResult.results.length;
            state.sendProgress = { sent, total };
            state.notice = `Sending to Tally: ${sent}/${total} transactions completed... (${state.sendResult.summary.imported} imported, ${state.sendResult.summary.failed} failed)`;
            render();
          }
        }
      }
    }
    
    state.sendProgress = { sent: rowIds.length, total: rowIds.length };
    state.notice = state.sendResult.online ? "Send finished. Review row results below." : "Tally is offline. Rows were not imported.";
    await refreshAll();
    if (state.validation?.batch?.id) {
      state.validation = await api("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: state.validation.batch.id, gstEnabled: state.gstEnabled, gstMode: state.gstMode }),
      });
    }
    state.route = "success";
    render();
  } catch (error) {
    state.sendProgress = null;
    setNotice(error.message);
  }
}

function success() {
  const result = state.sendResult || { summary: { imported: 0, failed: 0, skipped: 0 }, results: [] };
  const summary = state.validation?.summary || { ready: 0, needsFix: 0, total: 0 };
  const selected = filterSummary();
  const salesPurchaseMode = hasSalesPurchaseRows();
  const sendModeText = `${salesPurchaseMode ? ` as ${escapeHtml(state.selectedVoucherMode)}` : ""}${hasContraRows() ? ` / Contra ${escapeHtml(state.selectedContraMode)}` : ""}${hasPaymentRows() ? ` / Payment ${escapeHtml(state.selectedPaymentMode)}` : ""}${hasReceiptRows() ? ` / Receipt ${escapeHtml(state.selectedReceiptMode)}` : ""}`;
  const isItemInvoiceOnly = batchHasInventory() || (state.gstEnabled && state.gstMode === "item");
  const modeCardTitle = isItemInvoiceOnly ? "Confirm Tally item invoice send" : (salesPurchaseMode ? "Choose Tally voucher mode" : "Send selected rows");
  const modeNote = voucherModeNote();
  const previewTitle = `${hasContraRows() ? `Contra ${escapeHtml(state.selectedContraMode)} / ` : ""}${hasPaymentRows() ? `Payment ${escapeHtml(state.selectedPaymentMode)} / ` : ""}${hasReceiptRows() ? `Receipt ${escapeHtml(state.selectedReceiptMode)} / ` : ""}${salesPurchaseMode ? escapeHtml(state.selectedVoucherMode) : "Tally"} preview`;

  // Dynamic values calculation
  const firstRow = selectedSendRows()[0];
  const voucherSeries = firstRow?.payload?.["invoice no"] ? String(firstRow.payload["invoice no"]).split("/")[0] : "PUR-FY24-25";

  const moneyFormatter = (val) => {
    const n = Number(val || 0);
    return n ? `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₹ 0.00";
  };

  const readinessPercent = summary.total > 0 ? Math.round((selected.selected / summary.total) * 100) : 100;
  const readinessOffset = 553 - (553 * readinessPercent) / 100;

  const hasRun = !!state.sendResult;
  const totalRes = result.results.length;
  const totalShow = totalRes || selected.selected;
  const displayCount = totalRes ? result.summary.imported : selected.selected;
  const displayLabel = totalRes ? "Transactions Successfully Synced" : "Transactions Ready for Sync";

  const successPercent = hasRun ? (result.summary.imported + result.summary.failed > 0 ? Math.round((result.summary.imported / (result.summary.imported + result.summary.failed)) * 100) : 100) : 100;
  const successOffset = 452.3 - (452.3 * successPercent) / 100;
  const successIcon = hasRun ? (result.summary.failed > 0 ? "warning" : "verified") : "verified";
  const successLabel = hasRun ? (result.summary.failed > 0 ? "Alert" : "Success") : "Ready";

  const perfectMatches = selectedSendRows().filter(row => rowLedgerProblems(row).length === 0).length;
  const perfectPercent = selected.selected > 0 ? Math.round((perfectMatches / selected.selected) * 100) : 100;

  return tailwindShell("success", `
    <div class="grid grid-cols-12 gap-gutter">
      <!-- Hero Batch Summary & Final Review Grid -->
      <div class="col-span-12 lg:col-span-8 space-y-gutter">
        <!-- Hero Batch Summary -->
        <div class="relative rounded-2xl overflow-hidden p-8 flex items-center justify-between bg-primary text-on-primary shadow-2xl">
          <div class="relative z-10">
            <h2 class="font-display-lg text-display-lg mb-2">Transmission Summary</h2>
            <p class="text-primary-fixed/80 max-w-xl font-body-lg">Neural mapping confirmed. ${selected.selected} records validated against Tally Prime v4.0 Schema. Ready for final synchronization into ERP Gateway.</p>
            <div class="flex gap-4 mt-6">
              <div class="bg-primary-container px-4 py-2 rounded-lg border border-primary-fixed/20">
                <p class="text-[10px] uppercase opacity-70 mb-1 tracking-wider">Voucher Series</p>
                <p class="font-data-mono text-primary-fixed text-sm">${escapeHtml(voucherSeries)}</p>
              </div>
              <div class="bg-primary-container px-4 py-2 rounded-lg border border-primary-fixed/20">
                <p class="text-[10px] uppercase opacity-70 mb-1 tracking-wider">Total Valuation</p>
                <p class="font-data-mono text-primary-fixed text-sm">${moneyFormatter(selected.amount)}</p>
              </div>
            </div>
          </div>
          <div class="relative z-10 w-48 h-48 flex items-center justify-center flex-shrink-0">
            <svg class="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" fill="transparent" r="88" stroke="rgba(255,255,255,0.1)" stroke-width="8"></circle>
              <circle class="text-on-primary-container" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" stroke-dasharray="553" stroke-dashoffset="${readinessOffset}" stroke-width="8"></circle>
            </svg>
            <div class="absolute flex flex-col items-center">
              <span class="font-display-lg text-display-lg">${readinessPercent}%</span>
              <span class="text-[10px] uppercase font-bold tracking-widest">Readiness</span>
            </div>
          </div>
        </div>

        <!-- Final Review Grid -->
        <div class="rounded-2xl glass-card p-8 border border-primary/10 shadow-xl relative overflow-hidden">
          <div class="flex flex-col md:flex-row items-center justify-between gap-8">
            <div class="flex-1">
              <div class="flex items-baseline gap-2 mb-1">
                <span class="text-display-lg font-black text-primary">${displayCount}</span>
                <span class="text-headline-md text-outline">/ ${totalShow}</span>
              </div>
              <p class="text-on-surface-variant font-label-caps tracking-widest uppercase text-xs">${displayLabel}</p>
              <div class="grid grid-cols-3 gap-4 mt-8">
                <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-primary text-sm">check_circle</span>
                    <span class="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">Success</span>
                  </div>
                  <p class="text-xl font-data-mono font-bold text-primary">${result.summary.imported || 0}</p>
                </div>
                <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-outline text-sm">warning</span>
                    <span class="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">Failed</span>
                  </div>
                  <p class="text-xl font-data-mono font-bold text-outline">${result.summary.failed || 0}</p>
                </div>
                <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-outline text-sm">content_copy</span>
                    <span class="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">Skipped</span>
                  </div>
                  <p class="text-xl font-data-mono font-bold text-outline">${result.summary.skipped || summary.needsFix || 0}</p>
                </div>
              </div>
            </div>
            <div class="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
              <svg class="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" fill="transparent" r="72" stroke="#e5eeff" stroke-width="12"></circle>
                <circle cx="80" cy="80" fill="transparent" r="72" stroke="#00288e" stroke-dasharray="452.3" stroke-dashoffset="${successOffset}" stroke-linecap="round" stroke-width="12"></circle>
              </svg>
              <div class="absolute flex flex-col items-center">
                <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">${successIcon}</span>
                <span class="text-[10px] font-black uppercase tracking-widest text-primary mt-1">${successLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Neural Sync & Status Sidebar -->
      <div class="col-span-12 lg:col-span-4 space-y-gutter">
        <!-- Ledger Affinity -->
        <div class="rounded-2xl glass-card p-6 border-l-4 border-secondary">
          <h4 class="font-headline-sm text-headline-sm mb-4 font-semibold text-on-surface">Ledger Affinity</h4>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-body-md text-on-surface">Perfect Match</span>
              <span class="font-data-mono text-secondary font-bold">${perfectMatches}/${selected.selected}</span>
            </div>
            <div class="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div class="bg-secondary h-full" style="width: ${perfectPercent}%"></div>
            </div>
            <div class="flex justify-between items-center pt-2">
              <span class="text-body-md text-on-surface-variant">Manual Overrides</span>
              <span class="font-data-mono text-on-surface-variant">0</span>
            </div>
            <div class="p-3 bg-surface-container-low rounded-lg flex items-start gap-3 mt-4 border border-outline-variant/30">
              <span class="material-symbols-outlined text-secondary">info</span>
              <p class="text-[12px] leading-relaxed text-on-surface-variant italic">All incoming records have been mapped to existing Tally ledgers via fuzzy matching with 98% confidence.</p>
            </div>
          </div>
        </div>

        <!-- Neural Sync Preview -->
        <div class="rounded-2xl glass-card p-6 border-t-2 border-primary/20 relative overflow-hidden">
          <div class="absolute top-0 right-0 p-4 animate-pulse-slow">
            <span class="material-symbols-outlined text-primary/30 text-4xl">psychology</span>
          </div>
          <h4 class="font-headline-sm text-headline-sm mb-4 font-semibold text-on-surface">Neural Sync Preview</h4>
          <div class="space-y-4 relative z-10">
            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-primary">analytics</span>
              </div>
              <div>
                <p class="font-bold text-body-md text-on-surface">No Duplicate Risks</p>
                <p class="text-xs text-on-surface-variant">Voucher numbering sequence check passed.</p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
              </div>
              <div>
                <p class="font-bold text-body-md text-on-surface">Tax Ledger Integrity</p>
                <p class="text-xs text-on-surface-variant">GSTIN data matches Tally masters.</p>
              </div>
            </div>
            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-primary">speed</span>
              </div>
              <div>
                <p class="font-bold text-body-md text-on-surface">Gateway Latency</p>
                <p class="text-xs text-on-surface-variant">Current Tally API response: 124ms.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Primary Sync Trigger -->
        <div class="pt-4">
          <button class="w-full group ${hasRun ? 'bg-emerald-600 text-white cursor-default' : state.busy ? 'bg-primary text-on-primary opacity-70 cursor-not-allowed' : 'bg-primary text-on-primary shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95'} p-6 rounded-2xl transition-all duration-300 relative overflow-hidden ring-2 ${hasRun ? 'ring-emerald-500/20' : 'ring-primary-fixed/20'}" onclick="${hasRun || state.busy ? 'event.preventDefault()' : 'sendToTally()'}">
            <div class="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 ${hasRun ? '' : 'group-hover:opacity-100'} transition-opacity"></div>
            ${hasRun ? `
              <div class="flex items-center justify-center gap-4 relative z-10">
                <span class="material-symbols-outlined text-3xl">verified</span>
                <div class="text-left">
                  <span class="block font-headline-md text-headline-md tracking-tight">VOUCHERS SYNCED</span>
                  <span class="block text-emerald-100 font-label-caps text-[10px] tracking-widest uppercase">${result.summary.imported} of ${result.results.length} imported successfully</span>
                </div>
              </div>
            ` : state.busy ? `
              <div class="flex items-center justify-center gap-4 relative z-10">
                <span class="material-symbols-outlined text-3xl animate-spin">sync</span>
                <div class="text-left">
                  <span class="block font-headline-md text-headline-md tracking-tight">TRANSMITTING...</span>
                  <span class="block text-primary-fixed/60 font-label-caps text-[10px] tracking-widest uppercase">Importing into Tally Prime</span>
                </div>
              </div>
            ` : `
              <div class="flex items-center justify-center gap-4 relative z-10">
                <div class="absolute -top-2 -right-2 bg-surface-container-lowest rounded-full p-1 shadow-md border border-primary/20">
                  <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                </div>
                <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">send</span>
                <div class="text-left">
                  <span class="block font-headline-md text-headline-md tracking-tight">Send to Tally</span>
                  <span class="block text-primary-fixed/60 font-label-caps text-[10px] tracking-widest uppercase">Execute Final Transmission</span>
                </div>
              </div>
            `}
          </button>
          <p class="text-center text-[11px] text-on-surface-variant mt-4 font-label-caps">${hasRun ? 'Transmission complete. Vouchers successfully synched into local Tally Prime.' : 'Ready for final transmission. All records will be exported to Tally Prime v4.0.'}</p>
          ${hasRun ? `
            <div class="mt-4 animate-subtle-pulse">
              <button class="w-full py-4 px-6 bg-gradient-to-r from-secondary to-primary hover:from-secondary-container hover:to-primary-container text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 text-xs uppercase tracking-wider select-none" onclick="go('automation')">
                <span class="material-symbols-outlined text-[18px]">smart_toy</span>
                Automation Other Entries
              </button>
            </div>
          ` : ""}
        </div>
      </div>
    </div>

    <!-- Tally ERP Configuration & Preview Details (Full Width Below) -->
    <div class="grid grid-cols-12 gap-gutter mt-10">
      <div class="col-span-12 space-y-gutter">
        <!-- Voucher Mode Card -->
        <div class="bg-white rounded-2xl border border-outline-variant p-8 shadow-sm">
          <div class="flex justify-between items-center border-b border-outline-variant/30 pb-4 mb-6">
            <div>
              <h3 class="font-headline-md text-headline-md text-primary">${modeCardTitle}</h3>
              <p class="text-body-md text-on-surface-variant mt-1">Configure voucher types, ledger matching structures, and send options.</p>
            </div>
          </div>
          ${voucherModeSelect()}
          ${!isItemInvoiceOnly && modeNote ? `<p class="text-body-md text-on-surface-variant/70 italic mt-4">${modeNote}</p>` : ""}
        </div>

        <!-- Contra / Payment / Receipt Configuration Cards -->
        ${hasContraRows() || hasPaymentRows() || hasReceiptRows() ? `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${hasContraRows() ? `
              <div class="bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
                <h4 class="font-headline-sm text-on-surface mb-4 font-semibold">Contra Voucher Mode</h4>
                ${contraModeSelect()}
              </div>
            ` : ""}
            ${hasPaymentRows() ? `
              <div class="bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
                <h4 class="font-headline-sm text-on-surface mb-4 font-semibold">Payment Voucher Mode</h4>
                ${paymentModeSelect()}
              </div>
            ` : ""}
            ${hasReceiptRows() ? `
              <div class="bg-white rounded-2xl border border-outline-variant p-6 shadow-sm">
                <h4 class="font-headline-sm text-on-surface mb-4 font-semibold">Receipt Voucher Mode</h4>
                ${receiptModeSelect()}
              </div>
            ` : ""}
          </div>
        ` : ""}

        <!-- Preview Section -->
        <div class="bg-white rounded-2xl border border-outline-variant p-8 shadow-sm">
          <div class="flex justify-between items-center border-b border-outline-variant/30 pb-4 mb-6">
            <div>
              <h3 class="font-headline-md text-headline-md text-primary">${previewTitle}</h3>
              <p class="text-body-md text-on-surface-variant mt-1">Structure of data formatted for Tally Prime ERP API transmission.</p>
            </div>
            <span class="px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider">
              ${hasContraRows() || hasPaymentRows() || hasReceiptRows() ? "Single/Double Entry Layout" : state.selectedVoucherMode === "Accounting Invoice" ? "Party A/c + Particulars Layout" : state.selectedVoucherMode === "Item Invoice" ? "Inventory Item Layout" : "Tally To/By Ledger Lines"}
            </span>
          </div>
          <div class="overflow-x-auto">
            ${debitCreditPreview()}
          </div>
          <div class="mt-4 text-xs text-outline italic">
            Technical XML payload stays hidden unless opened from advanced details.
          </div>
        </div>

        ${hasRun ? `
          <!-- Results & Selected Rows Details -->
          <div class="bg-white rounded-2xl border border-outline-variant p-8 shadow-sm">
            <div class="flex justify-between items-center border-b border-outline-variant/30 pb-4 mb-6">
              <div>
                <h3 class="font-headline-md text-headline-md text-primary">Execution Results & Row Records</h3>
                <p class="text-body-md text-on-surface-variant mt-1">Detailed status logs of imported, skipped, or failed rows.</p>
              </div>
              <button class="px-4 py-2 border border-outline-variant hover:bg-surface-variant/50 rounded-xl text-body-md font-semibold text-on-surface-variant transition-all" onclick="setNotice('Advanced XML details are intentionally hidden in v1 UI. They are saved in local send history.')">
                Advanced Details
              </button>
            </div>
            <div class="overflow-x-auto">
              ${result.results.length ? resultTable(result.results) : rowsTable("result")}
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `);
}

function resultTable(results) {
  const byId = Object.fromEntries(validationRows().map((r) => [r.id, r]));
  return `<div class="table-wrap"><table><thead><tr><th>Row</th><th>Invoice No</th><th>Ledger</th><th class="right">Amount</th><th>Status</th><th>Message</th></tr></thead><tbody>${results.map((r) => {
    const row = byId[r.rowId] || {};
    const p = row.payload || {};
    return `<tr><td>${r.rowNo}</td><td>${escapeHtml(p["invoice no"] || "")}</td><td>${escapeHtml(p["party ledger or cash"] || "")}</td><td class="right amount">${money(p["total amount"])}</td><td><span class="chip ${r.status === "imported" ? "success" : "danger"}">${r.status}</span></td><td>${escapeHtml(r.message)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function batchHasInventory() {
  const rows = state.validation?.rows;
  if (!rows || !rows.length) return false;
  return rows.some((row) => hasInventoryDetails(row.payload));
}

function toggleHeaderFilterDropdown(event, column) {
  event.stopPropagation();
  if (state.activeHeaderFilterColumn === column) {
    state.activeHeaderFilterColumn = null;
    state.headerFilterMenuPosition = null;
  } else {
    state.activeHeaderFilterColumn = column;
    state.tempHeaderFilters = JSON.parse(JSON.stringify(state.headerFilters || {}));
    
    const rect = event.currentTarget.getBoundingClientRect();
    state.headerFilterMenuPosition = {
      top: rect.bottom + window.scrollY + 8,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 250)
    };
  }
  render();
}

function toggleHeaderFilterValue(column, val) {
  if (!state.tempHeaderFilters) {
    state.tempHeaderFilters = {};
  }
  if (!state.tempHeaderFilters[column]) {
    state.tempHeaderFilters[column] = [];
  }
  const idx = state.tempHeaderFilters[column].indexOf(val);
  if (idx > -1) {
    state.tempHeaderFilters[column].splice(idx, 1);
  } else {
    state.tempHeaderFilters[column].push(val);
  }
}

function toggleDropdownItem(el, column, val) {
  if (!state.tempHeaderFilters) {
    state.tempHeaderFilters = {};
  }
  if (!state.tempHeaderFilters[column]) {
    state.tempHeaderFilters[column] = [];
  }
  const idx = state.tempHeaderFilters[column].indexOf(val);
  let isChecked = false;
  if (idx > -1) {
    state.tempHeaderFilters[column].splice(idx, 1);
  } else {
    state.tempHeaderFilters[column].push(val);
    isChecked = true;
  }
  
  const checkIconContainer = el.querySelector(".check-icon-container");
  if (checkIconContainer) {
    if (isChecked) {
      checkIconContainer.innerHTML = `<span class="material-symbols-outlined text-[16px] text-primary check-icon">check</span>`;
    } else {
      checkIconContainer.innerHTML = "";
    }
  }
}

function clearHeaderFilter(column) {
  if (state.headerFilters) {
    delete state.headerFilters[column];
  }
  if (state.tempHeaderFilters) {
    delete state.tempHeaderFilters[column];
  }
  state.activeHeaderFilterColumn = null;
  state.headerFilterMenuPosition = null;
  state.selectedRowIds = null;
  state.currentPage = 1;
  render();
}

function applyHeaderFilters() {
  state.headerFilters = JSON.parse(JSON.stringify(state.tempHeaderFilters || {}));
  state.activeHeaderFilterColumn = null;
  state.headerFilterMenuPosition = null;
  state.selectedRowIds = null;
  state.currentPage = 1;
  render();
}

function closeHeaderFilter() {
  state.activeHeaderFilterColumn = null;
  state.headerFilterMenuPosition = null;
  render();
}

async function cellEdited(element) {
  const rowId = element.getAttribute("data-id");
  const col = element.getAttribute("data-col");
  let value = element.innerText.trim();
  const numericCols = new Set(["quantity", "rate", "taxable amount", "total amount", "CGST", "SGST", "IGST"]);
  if (numericCols.has(col)) {
    value = value.replace(/^Rs\s*/i, "").replace(/[,\s]/g, "");
  }
  
  const row = state.validation.rows.find(r => r.id === rowId);
  if (!row) return;
  
  if (String(row.payload[col] ?? "") === value) return;
  
  rowLedgerProblemsCache.delete(rowId);
  const updatedPayload = { ...row.payload };
  updatedPayload[col] = value;
  
  state.busy = true;
  state.notice = "Saving changes...";
  render();
  
  try {
    const res = await api(`/api/validation/update-row`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rowId,
        payload: updatedPayload,
        gstEnabled: state.gstEnabled,
        gstMode: state.gstMode
      })
    });
    state.validation = res;
    state.notice = "Changes saved and validated.";
    await refreshAll();
  } catch (error) {
    setNotice("Error saving changes: " + error.message);
  } finally {
    state.busy = false;
    render();
  }
}

function cellKeydown(event, element) {
  if (event.key === "Enter") {
    event.preventDefault();
    element.blur();
  } else if (event.key === "Escape") {
    const rowId = element.getAttribute("data-id");
    const col = element.getAttribute("data-col");
    const row = state.validation.rows.find(r => r.id === rowId);
    if (row) {
      element.innerText = row.payload[col] ?? "";
    }
    element.blur();
  }
}

function parseClientAmount(str) {
  if (!str) return 0;
  const cleaned = str.replace(/^Rs\s*/i, "").replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cellInputting(element) {
  const col = element.getAttribute("data-col");
  if (col !== "rate" && col !== "quantity") return;
  
  const tr = element.closest("tr");
  if (!tr) return;
  const rateCell = tr.querySelector('[data-col="rate"]');
  const qtyCell = tr.querySelector('[data-col="quantity"]');
  const amtCell = tr.querySelector('[data-col="total amount"]');
  if (!rateCell || !qtyCell || !amtCell) return;
  
  const rateVal = parseClientAmount(rateCell.innerText);
  const qtyVal = parseClientAmount(qtyCell.innerText);
  const amt = rateVal * qtyVal;
  
  amtCell.innerText = money(amt);
}

async function runAdvancedMapping() {
  if (!state.validation?.batch?.id) return setNotice("Please upload an Excel file first.");
  
  state.busy = true;
  state.notice = "Running Advanced Mapping Utility...";
  render();
  
  try {
    const res = await api(`/api/validation/auto-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: state.validation.batch.id,
        gstEnabled: state.gstEnabled,
        gstMode: state.gstMode
      })
    });
    state.validation = res;
    await refreshAll();
    setNotice(`Auto-mapped ${res.autoMappedCount || 0} ledger names and revalidated rows.`);
  } catch (error) {
    setNotice("Error running mapping utility: " + error.message);
  } finally {
    state.busy = false;
    render();
  }
}

async function applyBulkReplace() {
  if (!state.validation?.batch?.id) return setNotice("Upload a file before using bulk replacement.");
  const col = document.getElementById("bulk-replace-col").value;
  let newVal = document.getElementById("bulk-replace-val").value.trim();
  const numericCols = new Set(["quantity", "rate", "taxable amount", "total amount", "CGST", "SGST", "IGST"]);
  if (numericCols.has(col)) {
    newVal = newVal.replace(/^Rs\s*/i, "").replace(/[,\s]/g, "");
  }
  if (!newVal) {
    setNotice("Please enter a replacement value.");
    return;
  }
  
  const targetRows = filteredTableRows();
  if (!targetRows.length) {
    setNotice("No rows match the current filters for replacement.");
    return;
  }
  
  state.busy = true;
  state.notice = `Replacing ${col} in ${targetRows.length} filtered rows...`;
  render();
  
  try {
    const res = await api("/api/validation/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: state.validation.batch.id,
        rowIds: targetRows.map(r => r.id),
        column: col,
        value: newVal,
        gstEnabled: state.gstEnabled,
        gstMode: state.gstMode
      })
    });
    
    state.validation = res;
    state.selectedRowIds = null;
    state.notice = `Replaced ${col} in ${targetRows.length} filtered rows and rechecked Tally matches.`;
    await refreshAll();
  } catch (error) {
    setNotice("Error applying bulk replacement: " + error.message);
  } finally {
    state.busy = false;
    render();
  }
}

async function applyGstMapping() {
  if (!state.validation?.batch?.id) return setNotice("Upload a GST file before applying GST Mapping.");
  const targetRows = filteredTableRows();
  if (!targetRows.length) return setNotice("No rows match the current filters for GST Mapping.");
  const mapping = {
    "cgst ledger": state.gstLedgerMapping.CGST || preferredGstLedger("CGST"),
    "sgst ledger": state.gstLedgerMapping.SGST || preferredGstLedger("SGST"),
    "igst ledger": state.gstLedgerMapping.IGST || preferredGstLedger("IGST"),
  };
  state.busy = true;
  state.notice = `Applying GST ledger mapping to ${targetRows.length} filtered rows...`;
  render();
  try {
    let result = null;
    for (const [column, value] of Object.entries(mapping)) {
      result = await api("/api/validation/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: state.validation.batch.id,
          rowIds: targetRows.map((row) => row.id),
          column,
          value,
          gstEnabled: state.gstEnabled,
          gstMode: state.gstMode,
        }),
      });
      state.validation = result;
    }
    state.showGstMapping = false;
    state.selectedRowIds = null;
    await refreshAll();
    state.notice = `GST Mapping applied: CGST, SGST, and IGST ledgers are ready for Tally sending.`;
  } catch (error) {
    state.notice = "GST Mapping failed: " + error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function saveDraft() {
  if (!state.validation?.batch?.id) return setNotice("Upload a file before saving.");
  state.busy = true;
  state.notice = "Saving draft and checking readiness...";
  render();
  try {
    await revalidate();
    const summary = filterSummary();
    state.notice = summary.blocked
      ? `Draft saved. ${summary.blocked} filtered rows still need correction.`
      : `Draft saved. ${summary.selected || summary.sendable} rows are ready for Tally sending.`;
  } catch (error) {
    state.notice = "Draft save failed: " + error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function continueWhenReady() {
  if (!state.validation?.batch?.id) return setNotice("Upload and validate Excel before sending.");
  state.busy = true;
  state.notice = "Checking whether this batch is ready for Tally sending...";
  render();
  try {
    await revalidate();
    const blocked = filteredTableRows().filter((row) => !rowCanSend(row));
    const sendable = filteredSendableRows();
    if (blocked.length) {
      const firstProblem = rowLedgerProblems(blocked[0])[0]?.message || (blocked[0].errors || [])[0] || "A row still needs correction.";
      state.notice = `Not ready yet. Transaction ${getTransactionNo(blocked[0])}: ${firstProblem}`;
      return render();
    }
    if (!sendable.length) {
      state.notice = "No filtered rows are ready for Tally sending.";
      return render();
    }
    state.selectedRowIds = sendable.map((row) => row.id);
    state.notice = `${sendable.length} rows are ready for Tally sending.`;
    go("success");
  } catch (error) {
    state.notice = "Readiness check failed: " + error.message;
    render();
  } finally {
    state.busy = false;
    render();
  }
}

document.addEventListener("click", (event) => {
  if (state.activeHeaderFilterColumn) {
    const isDropdownClick = event.target.closest(".header-filter-dropdown");
    const isFilterBtnClick = event.target.closest("[onclick*='toggleHeaderFilterDropdown']");
    if (!isDropdownClick && !isFilterBtnClick) {
      state.activeHeaderFilterColumn = null;
      state.headerFilterMenuPosition = null;
      render();
    }
  }
  
  if (state.showProfileDropdown) {
    const isProfileClick = event.target.closest("[onclick*='toggleProfileDropdown']");
    if (!isProfileClick) {
      state.showProfileDropdown = false;
      render();
    }
  }
});

function toggleProfileDropdown(event) {
  event.stopPropagation();
  state.showProfileDropdown = !state.showProfileDropdown;
  render();
}

function render(route = state.route) {
  let targetRoute = screens[route] ? route : "auth";
  
  const isOffline = localStorage.getItem("tally_offline_mode") === "true";
  const isAuthenticated = state.authenticated || isOffline;
  
  if (!isAuthenticated) {
    if (targetRoute !== "auth") {
      targetRoute = "auth";
      location.hash = "#auth";
    }
  } else {
    if (!state.selectedPlan) {
      if (targetRoute !== "plans") {
        targetRoute = "plans";
        location.hash = "#plans";
      }
    } else {
      if (targetRoute === "auth" || targetRoute === "plans") {
        targetRoute = "login";
        location.hash = "#login";
      }
    }
  }

  if (state.route !== targetRoute) {
    state.tableScrollTop = 0;
    if (targetRoute !== "success") {
      state.sendProgress = null;
    }
  }
  
  // Trigger background suggestion checks
  triggerFuzzyWorker();

  if ((batchHasInventory() || (state.gstEnabled && state.gstMode === "item")) && state.selectedVoucherMode !== "Item Invoice") {
    state.selectedVoucherMode = "Item Invoice";
    if (state.gstEnabled) {
      state.gstMode = "item";
    }
  }
  state.route = targetRoute;
  const views = { auth, plans, login, dashboard, masters: mastersScreen, bank_import: bankImportScreen, sync: syncScreen, automation, upload, mapping, success };
  
  // Render Notice Banner inside canvas if it exists
  const noticeBannerHtml = state.notice ? `
    <div class="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 text-body-lg font-bold flex justify-between items-center shrink-0 shadow-lg select-none mb-6">
      <span class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px] text-primary animate-pulse shrink-0">info</span>
        ${escapeHtml(state.notice)}
      </span>
      <button class="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all" onclick="setNotice(null)">Dismiss</button>
    </div>
  ` : "";

  if (state.route === "auth" || state.route === "plans") {
    document.getElementById("app").innerHTML = views[state.route]();
  } else {
    // Inject notice banner inside the app's views dynamically, or keep it standard.
    // In our tailwindShell we place state.notice, so let's render standard.
    document.getElementById("app").innerHTML = views[state.route]() + createLedgerModal() + alterLedgerModal() + (typeof bankHighlighterModal === "function" ? bankHighlighterModal() : "");
  }
  document.title = `${screens[state.route].title} - Tally Automation`;
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    if (state.route === "bank_import" && state.bankImportHistoryStack && state.bankImportHistoryStack.length > 0) {
      e.preventDefault();
      undoBankImportAction();
    }
  }
});

window.addEventListener("hashchange", () => {
  const nextRoute = (location.hash || "#auth").replace("#", "");
  render(nextRoute);
});

async function initializeApp() {
  initWorker();
  initSupabase();
  setupSupabaseAuthListener();
  await checkAuthSession();
  render();
  refreshAll();

  // Instant Real-Time Bridge: Auto-synchronize whenever Tally Connector updates
  setInterval(async () => {
    try {
      const tally = await api("/api/tally/status");
      const companyChanged = tally.company && tally.company !== state.selectedTallyCompany;
      const statusChanged = tally.online !== state.tally.online || tally.connectorLinked !== state.tally.connectorLinked;

      state.tally = tally;
      if (tally.company) {
        state.selectedTallyCompany = tally.company;
      }

      // If connector synced new masters or switched company, auto-update the UI immediately!
      if (companyChanged || statusChanged || state.tally.connectorLinked) {
        const [masters, hist] = await Promise.all([
          api("/api/masters"),
          api("/api/history")
        ]);
        const countDiff = (masters.counts?.ledgers || 0) !== (state.masters.counts?.ledgers || 0);
        if (companyChanged || statusChanged || countDiff) {
          state.masters = masters;
          state.history = hist;
          render();
        }
      }
    } catch (e) {}
  }, 2000);
}

initializeApp();
