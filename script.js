/* ============================================================
       FORMATTERS
       ============================================================ */
class Formatters {
  static currency(amount) {
    if (amount === undefined || amount === null || isNaN(amount))
      return "₱0.00";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  static masked(amount) {
    return Formatters.currency(amount).replace(/\d/g, "*");
  }

  static currencyShort(amount) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
    return Formatters.currency(amount);
  }

  static date(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  static dateShort(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }

  static monthYear(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
  }

  static todayISO() {
    return new Date().toISOString().split("T")[0];
  }

  static nowISO() {
    return new Date().toISOString();
  }

  static timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }
}

/* ============================================================
       DATA MODELS
       ============================================================ */
class Category {
  constructor(id, name, emoji, builtIn = false) {
    this.id = id;
    this.name = name;
    this.emoji = emoji;
    this.builtIn = builtIn;
  }
}

class Account {
  constructor(id, name, bank, startingBalance, type = "wallet") {
    this.id = id;
    this.name = name;
    this.bank = bank;
    this.startingBalance = startingBalance;
    this.type = type; // wallet, savings, cash, credit
  }

  static bankList = [
    "BDO",
    "BPI",
    "GCash",
    "MariBank",
    "Maya",
    "GoTyme",
    "Metrobank",
    "Landbank",
    "UnionBank",
    "SecurityBank",
    "RCBC",
    "PNB",
    "CIMB",
    "Cash (No Bank)",
    "Other",
  ];

  static bankAbbr(bank) {
    const map = {
      BDO: "BD",
      BPI: "BP",
      GCash: "GC",
      Maya: "MY",
      GoTyme: "GT",
      Metrobank: "MB",
      Landbank: "LB",
      UnionBank: "UB",
      SecurityBank: "SB",
      RCBC: "RC",
      PNB: "PN",
      CIMB: "CI",
      ING: "IN",
      Other: "OT",
    };
    return map[bank] || bank.substring(0, 2).toUpperCase();
  }

  static LOGO_BASE = "logos/";

  static logos = {
    BDO: "bdo.webp",
    GCash: "gcash.webp",
    GoTyme: "gotyme.webp",
    MariBank: "maribank.webp",
    RCBC: "rcbc.webp",
    BPI: "bpi.webp",
    Maya: "maya.webp",
    Metrobank: "metrobank.png",
    Landbank: "landbank.webp",
    UnionBank: "unionbank.jpg",
    SecurityBank: "security-bank.png",
    PNB: "pnb.png",
    CIMB: "cimb.png",
    CASH: "dollar.png",
  };

  static badgeHTML(bank, style = "") {
    const abbr = Account.bankAbbr(bank);
    const logo = Account.logos[bank];
    const styleAttr = style ? ` style="${style}"` : "";

    if (!logo) {
      return `<div class="bank-badge" data-bank="${bank}"${styleAttr}>${abbr}</div>`;
    }
    return `<div class="bank-badge has-logo" data-bank="${bank}" data-abbr="${abbr}"${styleAttr}>
            <img src="${Account.LOGO_BASE}${logo}" alt="${bank}" loading="lazy" decoding="async">
          </div>`;
  }
}

class Transaction {
  constructor(
    id,
    accountId,
    description,
    amount,
    categoryId,
    date,
    type = "expense",
  ) {
    this.id = id;
    this.accountId = accountId;
    this.description = description;
    this.amount = Math.abs(amount);
    this.categoryId = categoryId;
    this.date = date || Formatters.nowISO();
    this.type = type; // 'income' or 'expense'
  }

  get signedAmount() {
    return this.type === "income" ? this.amount : -this.amount;
  }
}

class Budget {
  constructor(categoryId, limit) {
    this.categoryId = categoryId;
    this.limit = limit;
  }
}

class Goal {
  constructor(id, name, targetAmount, currentAmount = 0, targetDate = null) {
    this.id = id;
    this.name = name;
    this.targetAmount = targetAmount;
    this.currentAmount = currentAmount;
    this.targetDate = targetDate;
  }

  get progress() {
    if (this.targetAmount <= 0) return 0;
    return Math.min(100, (this.currentAmount / this.targetAmount) * 100);
  }
}

/* ============================================================
       WALLET STORE (persistence + business logic)
       ============================================================ */
class WalletStore {
  constructor() {
    this.STORAGE_KEY = "wallet_app_v1";
    this.VERSION = 1;

    this.accounts = [];
    this.transactions = [];
    this.categories = [];
    this.budgets = [];
    this.goals = [];

    this.hideBalance = false;

    this.load();
  }

  // --- Defaults ---
  static defaultCategories() {
    return [
      new Category("food", "Food", "🍔", true),
      new Category("transport", "Transportation", "🚌", true),
      new Category("bills", "Bills", "🧾", true),
      new Category("shopping", "Shopping", "🛍️", true),
      new Category("entertainment", "Entertainment", "🎬", true),
      new Category("income", "Income", "💰", true),
      new Category("transfer", "Transfer", "🔄", true),
      new Category("others", "Others", "📦", true),
    ];
  }

  // --- Load / Save ---
  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        this.seedDefaults();
        return;
      }
      const data = JSON.parse(raw);
      this.migrate(data);
    } catch (e) {
      console.warn("Failed to load data, seeding defaults.", e);
      this.seedDefaults();
    }
  }

  migrate(data) {
    const version = data.version || 0;

    // Future migrations can be added here
    if (version < 1) {
      // Legacy shape handling (if any)
    }

    this.accounts = (data.accounts || []).map((a) =>
      Object.assign(new Account(), a),
    );
    this.transactions = (data.transactions || []).map((t) =>
      Object.assign(new Transaction(), t),
    );
    this.categories =
      data.categories && data.categories.length
        ? data.categories.map((c) => Object.assign(new Category(), c))
        : WalletStore.defaultCategories();
    this.budgets = (data.budgets || []).map((b) =>
      Object.assign(new Budget(), b),
    );
    this.goals = (data.goals || []).map((g) => Object.assign(new Goal(), g));
    this.hideBalance = data.hideBalance || false;

    // Ensure built-in categories exist
    const builtIns = WalletStore.defaultCategories();
    for (const bi of builtIns) {
      if (!this.categories.find((c) => c.id === bi.id)) {
        this.categories.push(bi);
      }
    }
  }

  seedDefaults() {
    this.accounts = [];
    this.transactions = [];
    this.categories = WalletStore.defaultCategories();
    this.budgets = [];
    this.goals = [];
    this.hideBalance = false;
    this.save();
  }

  save() {
    const data = {
      version: this.VERSION,
      accounts: this.accounts,
      transactions: this.transactions,
      categories: this.categories,
      budgets: this.budgets,
      goals: this.goals,
      hideBalance: this.hideBalance,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // --- Helpers ---
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  getAccount(id) {
    return this.accounts.find((a) => a.id === id);
  }

  getCategory(id) {
    return (
      this.categories.find((c) => c.id === id) ||
      this.categories.find((c) => c.id === "others")
    );
  }

  // --- Account CRUD ---
  addAccount(name, bank, startingBalance, type) {
    const acc = new Account(
      this.generateId(),
      name,
      bank,
      parseFloat(startingBalance) || 0,
      type,
    );
    this.accounts.push(acc);
    this.save();
    return acc;
  }

  updateAccount(id, updates) {
    const acc = this.getAccount(id);
    if (!acc) return null;
    Object.assign(acc, updates);
    this.save();
    return acc;
  }

  deleteAccount(id) {
    this.accounts = this.accounts.filter((a) => a.id !== id);
    this.transactions = this.transactions.filter((t) => t.accountId !== id);
    this.save();
  }

  accountBalance(accountId) {
    const acc = this.getAccount(accountId);
    if (!acc) return 0;
    const txSum = this.transactions
      .filter((t) => t.accountId === accountId)
      .reduce((sum, t) => sum + t.signedAmount, 0);
    return acc.startingBalance + txSum;
  }

  totalNetWorth() {
    return this.accounts.reduce((sum, a) => sum + this.accountBalance(a.id), 0);
  }

  totalIncome() {
    return this.transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
  }

  totalExpense() {
    return this.transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // --- Transaction CRUD ---
  addTransaction(accountId, description, amount, categoryId, date, type) {
    const tx = new Transaction(
      this.generateId(),
      accountId,
      description,
      parseFloat(amount) || 0,
      categoryId,
      date,
      type,
    );
    this.transactions.push(tx);
    this.save();
    return tx;
  }

  updateTransaction(id, updates) {
    const tx = this.transactions.find((t) => t.id === id);
    if (!tx) return null;
    Object.assign(tx, updates);
    if (updates.amount !== undefined)
      tx.amount = Math.abs(parseFloat(updates.amount) || 0);
    this.save();
    return tx;
  }

  deleteTransaction(id) {
    this.transactions = this.transactions.filter((t) => t.id !== id);
    this.save();
  }

  getRecentTransactions(limit = 8) {
    return [...this.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  getAccountTransactions(accountId) {
    return this.transactions
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // --- Budget ---
  setBudget(categoryId, limit) {
    const existing = this.budgets.find((b) => b.categoryId === categoryId);
    if (existing) {
      existing.limit = parseFloat(limit) || 0;
    } else {
      this.budgets.push(new Budget(categoryId, parseFloat(limit) || 0));
    }
    this.save();
  }

  removeBudget(categoryId) {
    this.budgets = this.budgets.filter((b) => b.categoryId !== categoryId);
    this.save();
  }

  getBudgetSpent(categoryId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    return this.transactions
      .filter((t) => t.categoryId === categoryId && t.type === "expense")
      .filter((t) => {
        const d = new Date(t.date);
        return d >= startOfMonth && d <= endOfMonth;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // --- Goals ---
  addGoal(name, targetAmount, currentAmount, targetDate) {
    const goal = new Goal(
      this.generateId(),
      name,
      parseFloat(targetAmount) || 0,
      parseFloat(currentAmount) || 0,
      targetDate || null,
    );
    this.goals.push(goal);
    this.save();
    return goal;
  }

  updateGoal(id, updates) {
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) return null;
    Object.assign(goal, updates);
    this.save();
    return goal;
  }

  deleteGoal(id) {
    this.goals = this.goals.filter((g) => g.id !== id);
    this.save();
  }

  addFundsToGoal(id, amount) {
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) return null;
    goal.currentAmount += parseFloat(amount) || 0;
    this.save();
    return goal;
  }

  // --- Category CRUD ---
  addCategory(name, emoji) {
    const id = "custom_" + this.generateId();
    const cat = new Category(id, name, emoji, false);
    this.categories.push(cat);
    this.save();
    return cat;
  }

  updateCategory(id, updates) {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) return null;
    if (cat.builtIn && (updates.name || updates.emoji)) {
      // Allow editing name/emoji for built-in too
    }
    Object.assign(cat, updates);
    this.save();
    return cat;
  }

  deleteCategory(id) {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat || cat.builtIn) return false;

    // Reassign transactions to 'others'
    const others = this.categories.find((c) => c.id === "others");
    if (others) {
      this.transactions.forEach((t) => {
        if (t.categoryId === id) t.categoryId = "others";
      });
      this.budgets = this.budgets.filter((b) => b.categoryId !== id);
    }

    this.categories = this.categories.filter((c) => c.id !== id);
    this.save();
    return true;
  }

  // --- Data management ---
  exportData() {
    return JSON.stringify(
      {
        version: this.VERSION,
        exportedAt: Formatters.nowISO(),
        accounts: this.accounts,
        transactions: this.transactions,
        categories: this.categories,
        budgets: this.budgets,
        goals: this.goals,
      },
      null,
      2,
    );
  }

  importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.accounts || !data.transactions || !data.categories) {
      throw new Error("Invalid data format: missing required fields");
    }

    this.accounts = (data.accounts || []).map((a) =>
      Object.assign(new Account(), a),
    );
    this.transactions = (data.transactions || []).map((t) =>
      Object.assign(new Transaction(), t),
    );
    this.categories =
      data.categories && data.categories.length
        ? data.categories.map((c) => Object.assign(new Category(), c))
        : WalletStore.defaultCategories();
    this.budgets = (data.budgets || []).map((b) =>
      Object.assign(new Budget(), b),
    );
    this.goals = (data.goals || []).map((g) => Object.assign(new Goal(), g));

    this.save();
  }

  clearAll() {
    this.accounts = [];
    this.transactions = [];
    this.categories = WalletStore.defaultCategories();
    this.budgets = [];
    this.goals = [];
    this.hideBalance = false;
    this.save();
  }

  // --- Insights data ---
  getMonthlyTotals(monthsBack = 6) {
    const result = [];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();

      const monthTx = this.transactions.filter((t) => {
        const td = new Date(t.date);
        return td.getFullYear() === year && td.getMonth() === month;
      });

      const income = monthTx
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const expense = monthTx
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);

      result.push({
        label: d.toLocaleDateString("en-PH", { month: "short" }),
        year,
        month,
        income,
        expense,
        net: income - expense,
      });
    }
    return result;
  }

  getBalanceHistory(monthsBack = 6) {
    // Compute cumulative balance at end of each month
    const result = [];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
      ); // end of month
      const year = d.getFullYear();
      const month = d.getMonth();

      const total = this.accounts.reduce((sum, acc) => {
        const startBal = acc.startingBalance;
        const txSum = this.transactions
          .filter((t) => t.accountId === acc.id)
          .filter((t) => new Date(t.date) <= d)
          .reduce((s, t) => s + t.signedAmount, 0);
        return sum + startBal + txSum;
      }, 0);

      result.push({
        label: new Date(year, month).toLocaleDateString("en-PH", {
          month: "short",
        }),
        balance: total,
      });
    }
    return result;
  }

  getSpendingByCategory() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    const monthExpenses = this.transactions.filter(
      (t) =>
        t.type === "expense" &&
        new Date(t.date) >= startOfMonth &&
        new Date(t.date) <= endOfMonth,
    );

    const total = monthExpenses.reduce((s, t) => s + t.amount, 0);
    const byCat = {};
    monthExpenses.forEach((t) => {
      if (!byCat[t.categoryId]) byCat[t.categoryId] = 0;
      byCat[t.categoryId] += t.amount;
    });

    return Object.entries(byCat)
      .map(([catId, amount]) => {
        const cat = this.getCategory(catId);
        return {
          category: cat,
          amount,
          percent: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }
}

/* ============================================================
       WALLET UI
       ============================================================ */
class WalletUI {
  constructor(store) {
    this.store = store;
    this.currentView = "home";
    this.editingTransactionId = null;
    this.editingAccountId = null;
    this.editingGoalId = null;
    this.editingBudgetCategoryId = null;

    this.initElements();
    this.bindEvents();
    this.applyTheme();
    this.renderAll();
  }

  initElements() {
    // Views
    this.views = {
      home: document.getElementById("view-home"),
      accounts: document.getElementById("view-accounts"),
      budget: document.getElementById("view-budget"),
      goals: document.getElementById("view-goals"),
      insights: document.getElementById("view-insights"),
      settings: document.getElementById("view-settings"),
    };

    // Nav — now includes bottom tabs with settings
    this.navItems = document.querySelectorAll(".nav-item, .tab-item");
    this.drawer = document.getElementById("drawer");
    this.drawerOverlay = document.getElementById("drawerOverlay");
    this.drawerTitle = document.getElementById("drawerTitle");
    this.drawerBody = document.getElementById("drawerBody");

    // Toast
    this.toastContainer = document.getElementById("toastContainer");

    // Confirm modal
    this.confirmModal = document.getElementById("confirmModal");
    this.confirmTitle = document.getElementById("confirmTitle");
    this.confirmMessage = document.getElementById("confirmMessage");
    this.confirmOk = document.getElementById("confirmOk");
    this.confirmCancel = document.getElementById("confirmCancel");

    // Theme
    this.themeToggleDesktop = document.getElementById("themeToggleDesktop");
    this.themeToggleSettings = document.getElementById("themeToggleSettings");
    this.themeIconDesktop = document.getElementById("themeIconDesktop");
    this.themeLabelDesktop = document.getElementById("themeLabelDesktop");

    // Buttons
    this.addAccountBtnDesktop = document.getElementById("addAccountBtnDesktop");
    this.addAccountBtnView = document.getElementById("addAccountBtnView");
    this.addBudgetBtn = document.getElementById("addBudgetBtn");
    this.addGoalBtn = document.getElementById("addGoalBtn");
    this.addCategoryBtn = document.getElementById("addCategoryBtn");
    this.quickAddHome = document.getElementById("quickAddHome");
    this.hideBalanceToggle = document.getElementById("hideBalanceToggle");
    this.exportDataBtn = document.getElementById("exportDataBtn");
    this.importDataBtn = document.getElementById("importDataBtn");
    this.importFileInput = document.getElementById("importFileInput");
    this.clearDataBtn = document.getElementById("clearDataBtn");
  }

  bindEvents() {
    // Navigation
    this.navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const view = item.dataset.view;
        if (view) this.switchView(view);
      });
    });

    // See all links
    document.querySelectorAll("[data-view-link]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchView(link.dataset.viewLink);
      });
    });

    // Theme toggles
    this.themeToggleDesktop.addEventListener("click", () => this.toggleTheme());
    this.themeToggleSettings.addEventListener("click", () =>
      this.toggleTheme(),
    );

    // Hide balance
    this.hideBalanceToggle.addEventListener("click", () => {
      this.store.hideBalance = !this.store.hideBalance;
      this.store.save();
      this.renderHome();
    });

    // Add account
    this.addAccountBtnDesktop.addEventListener("click", () =>
      this.openAccountForm(),
    );
    this.addAccountBtnView.addEventListener("click", () =>
      this.openAccountForm(),
    );

    // Add budget
    this.addBudgetBtn.addEventListener("click", () => this.openBudgetForm());

    // Add goal
    this.addGoalBtn.addEventListener("click", () => this.openGoalForm());

    // Add category
    this.addCategoryBtn.addEventListener("click", () =>
      this.openCategoryForm(),
    );

    // Quick add transaction
    this.quickAddHome.addEventListener("click", () => {
      if (this.store.accounts.length === 0) {
        this.toast("Create an account first 🏦");
        this.switchView("accounts");
        return;
      }
      this.openTransactionForm();
    });

    // Drawer close
    document
      .getElementById("drawerClose")
      .addEventListener("click", () => this.closeDrawer());
    this.drawerOverlay.addEventListener("click", () => this.closeDrawer());

    // Export
    this.exportDataBtn.addEventListener("click", () => this.exportData());

    // Import
    this.importDataBtn.addEventListener("click", () =>
      this.importFileInput.click(),
    );
    this.importFileInput.addEventListener("change", (e) => this.importData(e));

    // Clear all
    this.clearDataBtn.addEventListener("click", () => {
      this.confirm(
        "Clear all data?",
        "This will delete all accounts, transactions, budgets, and goals. Categories will reset to defaults.",
        () => {
          this.store.clearAll();
          this.renderAll();
          this.toast("All data cleared 🧹");
        },
      );
    });

    // Confirm modal
    this.confirmCancel.addEventListener("click", () => this.closeConfirm());
    this.confirmModal.addEventListener("click", (e) => {
      if (e.target === this.confirmModal) this.closeConfirm();
    });

    // Logo failed to load → revert to abbreviation badge
    document.addEventListener(
      "error",
      (e) => {
        if (!(e.target instanceof HTMLImageElement)) return;
        const badge = e.target.closest(".bank-badge.has-logo");
        if (!badge) return;
        badge.classList.remove("has-logo");
        badge.textContent = badge.dataset.abbr;
      },
      true,
    );
  }

  // --- Theme ---
  applyTheme() {
    const saved = localStorage.getItem("wallet_theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    this.updateThemeUI(saved);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("wallet_theme", next);
    this.updateThemeUI(next);
  }

  updateThemeUI(theme) {
    const isDark = theme === "dark";
    this.themeIconDesktop.textContent = isDark ? "☀️" : "🌙";
    this.themeLabelDesktop.textContent = isDark ? "Light mode" : "Dark mode";
  }

  // --- View switching ---
  switchView(viewName) {
    if (!this.views[viewName]) return;
    this.currentView = viewName;

    Object.values(this.views).forEach((v) => v.classList.remove("active"));
    this.views[viewName].classList.add("active");

    this.navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });

    // Render view-specific data
    if (viewName === "home") this.renderHome();
    if (viewName === "accounts") this.renderAccounts();
    if (viewName === "budget") this.renderBudget();
    if (viewName === "goals") this.renderGoals();
    if (viewName === "insights") this.renderInsights();
    if (viewName === "settings") this.renderSettings();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- Render all ---
  renderAll() {
    this.renderHome();
    this.renderAccounts();
    this.renderBudget();
    this.renderGoals();
    this.renderInsights();
    this.renderSettings();
  }

  // ============================================================
  // HOME VIEW
  // ============================================================
  renderHome() {
    const store = this.store;

    // Date
    document.getElementById("homeDate").textContent =
      new Date().toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    // Net worth
    const netWorth = store.totalNetWorth();
    const heroAmount = document.getElementById("heroNetWorth");
    heroAmount.textContent = store.hideBalance
      ? Formatters.masked(netWorth)
      : Formatters.currency(netWorth);

    // Account count
    document.getElementById("heroAccountCount").textContent =
      store.accounts.length;

    // Total in/out
    document.getElementById("heroTotalIn").textContent = Formatters.currency(
      store.totalIncome(),
    );
    document.getElementById("heroTotalOut").textContent = Formatters.currency(
      store.totalExpense(),
    );

    // Hide balance toggle icon
    this.hideBalanceToggle.textContent = store.hideBalance ? "🙈" : "👁️";

    // Current month summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    const monthTx = store.transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= startOfMonth && d <= endOfMonth;
    });
    const monthIncome = monthTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const monthNet = monthIncome - monthExpense;

    document.getElementById("monthIncome").textContent =
      Formatters.currency(monthIncome);
    document.getElementById("monthExpense").textContent =
      Formatters.currency(monthExpense);
    const netEl = document.getElementById("monthNet");
    netEl.textContent = Formatters.currency(monthNet);
    netEl.style.color = monthNet >= 0 ? "var(--success)" : "var(--danger)";

    // Account strip
    this.renderHomeAccountStrip();

    // Recent transactions
    this.renderHomeRecentTx();
  }

  renderHomeAccountStrip() {
    const container = document.getElementById("homeAccountStrip");
    const accounts = this.store.accounts;

    if (accounts.length === 0) {
      container.innerHTML = `
            <div class="empty-state" style="min-width:100%;">
              <span class="emoji">🏦</span>
              <p>No accounts yet. Add your first account to get started!</p>
            </div>`;
      return;
    }

    container.innerHTML = accounts
      .map((acc) => {
        const balance = this.store.accountBalance(acc.id);
        return `
            <div class="account-card" data-account-id="${acc.id}">
              ${Account.badgeHTML(acc.bank)}
              <div class="acc-name">${this.escapeHtml(acc.name)}</div>
              <div class="acc-type">${acc.type} · ${acc.bank}</div>
              <div class="acc-balance">${Formatters.currency(balance)}</div>
            </div>`;
      })
      .join("");

    container.querySelectorAll(".account-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.openAccountDetail(card.dataset.accountId);
      });
    });
  }

  renderHomeRecentTx() {
    const container = document.getElementById("homeRecentTx");
    const txs = this.store.getRecentTransactions(8);

    if (txs.length === 0) {
      container.innerHTML = `
            <div class="empty-state">
              <span class="emoji">📭</span>
              <p>No transactions yet. Add your first income or expense!</p>
            </div>`;
      return;
    }

    container.innerHTML = txs
      .map((tx) => {
        const cat = this.store.getCategory(tx.categoryId);
        const acc = this.store.getAccount(tx.accountId);
        const sign = tx.type === "income" ? "+" : "−";
        return `
            <div class="tx-row">
              <div class="tx-icon">${cat ? cat.emoji : "📦"}</div>
              <div class="tx-info">
                <div class="tx-desc">${this.escapeHtml(tx.description)}</div>
                <div class="tx-meta">
                  <span>${cat ? cat.name : "Others"}</span>
                  <span>·</span>
                  <span>${acc ? this.escapeHtml(acc.name) : "Unknown"}</span>
                  <span>·</span>
                  <span>${Formatters.dateShort(tx.date)}</span>
                </div>
              </div>
              <div class="tx-amount ${tx.type}">${sign} ${Formatters.currency(tx.amount)}</div>
            </div>`;
      })
      .join("");
  }

  // ============================================================
  // ACCOUNTS VIEW
  // ============================================================
  renderAccounts() {
    const grid = document.getElementById("accountsGrid");
    const accounts = this.store.accounts;

    if (accounts.length === 0) {
      grid.innerHTML = `
            <div class="card" style="grid-column:1/-1;">
              <div class="empty-state">
                <span class="emoji">🏦</span>
                <p>No accounts yet. Tap "Add Account" to create your first wallet, bank account, or cash stash.</p>
              </div>
            </div>`;
      return;
    }

    grid.innerHTML = accounts
      .map((acc) => {
        const balance = this.store.accountBalance(acc.id);
        return `
            <div class="card account-card" data-account-id="${acc.id}" style="min-width:unset;">
              <div class="flex-between mb-16">
                ${Account.badgeHTML(acc.bank)}
                <div class="tx-actions" style="opacity:1;">
                  <button class="icon-btn edit-acc" data-id="${acc.id}" title="Edit">✏️</button>
                  <button class="icon-btn danger delete-acc" data-id="${acc.id}" title="Delete">🗑️</button>
                </div>
              </div>
              <div class="acc-name" style="font-size:1.1rem;">${this.escapeHtml(acc.name)}</div>
              <div class="acc-type">${acc.type} · ${acc.bank}</div>
              <div class="acc-balance" style="font-size:1.5rem;margin-top:12px;">${Formatters.currency(balance)}</div>
              <button class="btn-sm primary mt-16 view-tx-btn" data-id="${acc.id}" style="width:100%;">View transactions</button>
            </div>`;
      })
      .join("");

    // Bind events
    grid.querySelectorAll(".view-tx-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openAccountDetail(btn.dataset.id);
      });
    });

    grid.querySelectorAll(".edit-acc").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openAccountForm(btn.dataset.id);
      });
    });

    grid.querySelectorAll(".delete-acc").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const acc = this.store.getAccount(btn.dataset.id);
        this.confirm(
          `Delete "${acc.name}"?`,
          "All transactions in this account will also be deleted.",
          () => {
            this.store.deleteAccount(btn.dataset.id);
            this.renderAll();
            this.toast("Account deleted 🗑️");
          },
        );
      });
    });

    grid.querySelectorAll(".account-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.openAccountDetail(card.dataset.accountId);
      });
    });
  }

  // ============================================================
  // BUDGET VIEW
  // ============================================================
  renderBudget() {
    const container = document.getElementById("budgetList");
    const budgets = this.store.budgets;

    if (budgets.length === 0) {
      container.innerHTML = `
            <div class="empty-state">
              <span class="emoji">📊</span>
              <p>No budgets set yet. Create a monthly limit for a category to start tracking.</p>
            </div>`;
      return;
    }

    container.innerHTML = budgets
      .map((b) => {
        const cat = this.store.getCategory(b.categoryId);
        if (!cat) return "";
        const spent = this.store.getBudgetSpent(b.categoryId);
        const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        const remaining = b.limit - spent;

        let colorClass = "green";
        if (percent >= 100) colorClass = "red";
        else if (percent >= 80) colorClass = "amber";

        return `
            <div class="budget-item">
              <div class="budget-header">
                <div class="budget-cat">
                  <span>${cat.emoji}</span> ${this.escapeHtml(cat.name)}
                </div>
                <div class="budget-amounts">
                  ${Formatters.currency(spent)} / ${Formatters.currency(b.limit)}
                </div>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${colorClass}" style="width:${Math.min(100, percent)}%"></div>
              </div>
              <div class="flex-between mt-16" style="margin-top:6px;">
                <div class="budget-remaining ${remaining < 0 ? "over" : ""}">
                  ${
                    remaining >= 0
                      ? `${Formatters.currency(remaining)} remaining`
                      : `Over by ${Formatters.currency(Math.abs(remaining))}`
                  }
                </div>
                <div style="display:flex;gap:4px;">
                  <button class="icon-btn edit-budget" data-cat="${b.categoryId}" title="Edit">✏️</button>
                  <button class="icon-btn danger delete-budget" data-cat="${b.categoryId}" title="Remove">🗑️</button>
                </div>
              </div>
            </div>`;
      })
      .join("");

    container.querySelectorAll(".edit-budget").forEach((btn) => {
      btn.addEventListener("click", () => this.openBudgetForm(btn.dataset.cat));
    });

    container.querySelectorAll(".delete-budget").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.store.removeBudget(btn.dataset.cat);
        this.renderBudget();
        this.toast("Budget removed");
      });
    });
  }

  // ============================================================
  // GOALS VIEW
  // ============================================================
  renderGoals() {
    const grid = document.getElementById("goalsGrid");
    const goals = this.store.goals;

    if (goals.length === 0) {
      grid.innerHTML = `
            <div class="card" style="grid-column:1/-1;">
              <div class="empty-state">
                <span class="emoji">🎯</span>
                <p>No savings goals yet. Create one to start tracking your progress!</p>
              </div>
            </div>`;
      return;
    }

    grid.innerHTML = goals
      .map((goal) => {
        const progress = goal.progress;
        const circumference = 2 * Math.PI * 50;
        const offset = circumference - (progress / 100) * circumference;

        return `
            <div class="card goal-card" data-goal-id="${goal.id}">
              <div class="goal-ring-wrap">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle class="goal-ring-bg" cx="60" cy="60" r="50" fill="none" stroke-width="10"/>
                  <circle class="goal-ring-fill" cx="60" cy="60" r="50" fill="none" stroke-width="10"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
                </svg>
                <div class="goal-ring-text">${Math.round(progress)}%</div>
              </div>
              <div class="goal-name">${this.escapeHtml(goal.name)}</div>
              <div class="goal-amounts">
                ${Formatters.currency(goal.currentAmount)} / ${Formatters.currency(goal.targetAmount)}
              </div>
              ${goal.targetDate ? `<div class="text-tertiary" style="font-size:0.75rem;margin-bottom:8px;">Target: ${Formatters.date(goal.targetDate)}</div>` : ""}
              <div class="goal-actions">
                <button class="btn-sm primary add-funds-btn" data-id="${goal.id}">＋ Add funds</button>
                <button class="btn-sm edit-goal" data-id="${goal.id}">✏️</button>
                <button class="btn-sm delete-goal" data-id="${goal.id}" style="color:var(--danger);">🗑️</button>
              </div>
            </div>`;
      })
      .join("");

    grid.querySelectorAll(".add-funds-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.openAddFundsForm(btn.dataset.id),
      );
    });

    grid.querySelectorAll(".edit-goal").forEach((btn) => {
      btn.addEventListener("click", () => this.openGoalForm(btn.dataset.id));
    });

    grid.querySelectorAll(".delete-goal").forEach((btn) => {
      btn.addEventListener("click", () => {
        const goal = this.store.goals.find((g) => g.id === btn.dataset.id);
        this.confirm(
          `Delete "${goal.name}"?`,
          "This goal will be permanently removed.",
          () => {
            this.store.deleteGoal(btn.dataset.id);
            this.renderGoals();
            this.toast("Goal deleted");
          },
        );
      });
    });
  }

  // ============================================================
  // INSIGHTS VIEW
  // ============================================================
  renderInsights() {
    this.renderBarChart();
    this.renderLineChart();
    this.renderCategoryBreakdown();
    this.renderAccountBreakdown();
  }

  renderBarChart() {
    const container = document.getElementById("barChartContainer");
    const data = this.store.getMonthlyTotals(6);

    if (data.every((d) => d.income === 0 && d.expense === 0)) {
      container.innerHTML = `
            <div class="empty-state" style="padding:20px;">
              <span class="emoji">📊</span>
              <p>No data yet. Add some transactions to see your income vs expenses chart.</p>
            </div>`;
      return;
    }

    const maxVal = Math.max(
      ...data.map((d) => Math.max(d.income, d.expense)),
      1,
    );
    const chartHeight = 160;
    const barWidth = 18;
    const groupWidth = 60;
    const padding = 30;

    const svgWidth = data.length * groupWidth + padding * 2;
    const svgHeight = chartHeight + 40;

    let bars = "";
    data.forEach((d, i) => {
      const x = padding + i * groupWidth;
      const incomeH = (d.income / maxVal) * chartHeight;
      const expenseH = (d.expense / maxVal) * chartHeight;

      bars += `<rect x="${x}" y="${chartHeight - incomeH + 20}" width="${barWidth}" height="${incomeH}" rx="4" fill="var(--success)" opacity="0.9"/>`;
      bars += `<rect x="${x + barWidth + 4}" y="${chartHeight - expenseH + 20}" width="${barWidth}" height="${expenseH}" rx="4" fill="var(--danger)" opacity="0.9"/>`;
      bars += `<text x="${x + barWidth}" y="${chartHeight + 36}" text-anchor="middle" class="chart-label">${d.label}</text>`;
    });

    container.innerHTML = `
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
            ${bars}
          </svg>`;
  }

  renderLineChart() {
    const container = document.getElementById("lineChartContainer");
    const data = this.store.getBalanceHistory(6);

    if (
      data.every((d) => d.balance === 0) &&
      this.store.accounts.length === 0
    ) {
      container.innerHTML = `
            <div class="empty-state" style="padding:20px;">
              <span class="emoji">📈</span>
              <p>No balance history yet. Add accounts and transactions to see your balance trend.</p>
            </div>`;
      return;
    }

    const balances = data.map((d) => d.balance);
    const minVal = Math.min(...balances, 0);
    const maxVal = Math.max(...balances, 1);
    const range = maxVal - minVal || 1;

    const chartHeight = 140;
    const chartWidth = 400;
    const padding = 30;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
      const y = 20 + chartHeight - ((d.balance - minVal) / range) * chartHeight;
      return { x, y, ...d };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
    const areaPoints = `${padding},${20 + chartHeight} ${polylinePoints} ${chartWidth - padding},${20 + chartHeight}`;

    const svgHeight = chartHeight + 60;

    let labels = "";
    points.forEach((p) => {
      labels += `<text x="${p.x}" y="${svgHeight - 10}" text-anchor="middle" class="chart-label">${p.label}</text>`;
    });

    container.innerHTML = `
          <svg viewBox="0 0 ${chartWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <polygon class="area-fill" points="${areaPoints}"/>
            <polyline points="${polylinePoints}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`).join("")}
            ${labels}
          </svg>`;
  }

  renderCategoryBreakdown() {
    const container = document.getElementById("categoryBreakdown");
    const data = this.store.getSpendingByCategory();

    if (data.length === 0) {
      container.innerHTML = `
            <div class="empty-state" style="padding:20px;">
              <span class="emoji">🍔</span>
              <p>No expenses this month yet. Your category breakdown will appear here.</p>
            </div>`;
      return;
    }

    container.innerHTML = data
      .map(
        (d) => `
          <div class="cat-row">
            <div class="cat-icon">${d.category.emoji}</div>
            <div class="cat-info">
              <div class="cat-name">${this.escapeHtml(d.category.name)}</div>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:${d.percent}%"></div>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="cat-amount">${Formatters.currency(d.amount)}</div>
              <div class="cat-percent">${d.percent.toFixed(1)}%</div>
            </div>
          </div>
        `,
      )
      .join("");
  }

  renderAccountBreakdown() {
    const container = document.getElementById("accountBreakdown");
    const accounts = this.store.accounts;

    if (accounts.length === 0) {
      container.innerHTML = `
            <div class="empty-state" style="padding:20px;">
              <span class="emoji">🏦</span>
              <p>No accounts yet. Add an account to see your balance breakdown.</p>
            </div>`;
      return;
    }

    container.innerHTML = accounts
      .map((acc) => {
        const balance = this.store.accountBalance(acc.id);
        return `
            <div class="acc-breakdown-row">
              <div class="acc-breakdown-left">
                ${Account.badgeHTML(acc.bank, "width:32px;height:32px;font-size:0.7rem;")}
                <div>
                  <div class="acc-breakdown-name">${this.escapeHtml(acc.name)}</div>
                  <div class="acc-breakdown-type">${acc.type} · ${acc.bank}</div>
                </div>
              </div>
              <div class="acc-breakdown-balance">${Formatters.currency(balance)}</div>
            </div>`;
      })
      .join("");
  }

  // ============================================================
  // SETTINGS VIEW
  // ============================================================
  renderSettings() {
    this.renderCategoriesList();
  }

  renderCategoriesList() {
    const container = document.getElementById("categoriesList");
    const cats = this.store.categories;

    container.innerHTML = cats
      .map(
        (cat) => `
          <div class="cat-manage-row">
            <div class="cat-icon">${cat.emoji}</div>
            <div class="cat-name">${this.escapeHtml(cat.name)}</div>
            ${cat.builtIn ? '<span class="built-in-tag">built-in</span>' : ""}
            <div class="tx-actions" style="opacity:1;">
              <button class="icon-btn edit-cat" data-id="${cat.id}" title="Edit">✏️</button>
              ${!cat.builtIn ? `<button class="icon-btn danger delete-cat" data-id="${cat.id}" title="Delete">🗑️</button>` : ""}
            </div>
          </div>
        `,
      )
      .join("");

    container.querySelectorAll(".edit-cat").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.openCategoryForm(btn.dataset.id),
      );
    });

    container.querySelectorAll(".delete-cat").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = this.store.categories.find((c) => c.id === btn.dataset.id);
        this.confirm(
          `Delete "${cat.name}"?`,
          'Transactions in this category will be reassigned to "Others".',
          () => {
            this.store.deleteCategory(btn.dataset.id);
            this.renderAll();
            this.toast("Category deleted");
          },
        );
      });
    });
  }

  // ============================================================
  // DRAWER — ACCOUNT DETAIL + TRANSACTIONS
  // ============================================================
  openAccountDetail(accountId) {
    const acc = this.store.getAccount(accountId);
    if (!acc) return;

    this.drawerTitle.textContent = acc.name;
    this.renderAccountDetailBody(acc);
    this.openDrawer();
  }

  renderAccountDetailBody(acc) {
    const balance = this.store.accountBalance(acc.id);
    const txs = this.store.getAccountTransactions(acc.id);

    let txHtml = "";
    if (txs.length === 0) {
      txHtml = `
            <div class="empty-state" style="padding:32px 16px;">
              <span class="emoji">📭</span>
              <p>No transactions in this account yet.</p>
            </div>`;
    } else {
      txHtml = txs
        .map((tx) => {
          const cat = this.store.getCategory(tx.categoryId);
          const sign = tx.type === "income" ? "+" : "−";
          return `
              <div class="tx-row" data-tx-id="${tx.id}">
                <div class="tx-icon">${cat ? cat.emoji : "📦"}</div>
                <div class="tx-info">
                  <div class="tx-desc">${this.escapeHtml(tx.description)}</div>
                  <div class="tx-meta">
                    <span>${cat ? cat.name : "Others"}</span>
                    <span>·</span>
                    <span>${Formatters.date(tx.date)}</span>
                  </div>
                </div>
                <div class="tx-amount ${tx.type}">${sign} ${Formatters.currency(tx.amount)}</div>
                <div class="tx-actions">
                  <button class="icon-btn edit-tx" data-id="${tx.id}" title="Edit">✏️</button>
                  <button class="icon-btn danger delete-tx" data-id="${tx.id}" title="Delete">🗑️</button>
                </div>
              </div>`;
        })
        .join("");
    }

    this.drawerBody.innerHTML = `
          <div class="card mb-16" style="text-align:center;">
            ${Account.badgeHTML(acc.bank, "margin:0 auto 12px;")}
            <div class="acc-type" style="margin-bottom:8px;">${acc.type} · ${acc.bank}</div>
            <div class="mono fw-600" style="font-size:2rem;">${Formatters.currency(balance)}</div>
            <div class="text-secondary" style="font-size:0.85rem;margin-top:4px;">
              Starting: ${Formatters.currency(acc.startingBalance)}
            </div>
          </div>

          <button class="btn-primary mb-16" id="addTxToAccount">＋ Add transaction</button>

          <div class="section-title" style="font-size:1rem;">Transactions</div>
          <div class="tx-list" id="accountTxList">
            ${txHtml}
          </div>
        `;

    // Bind events
    document.getElementById("addTxToAccount")?.addEventListener("click", () => {
      this.openTransactionForm(null, acc.id);
    });

    this.drawerBody.querySelectorAll(".edit-tx").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.openTransactionForm(btn.dataset.id);
      });
    });

    this.drawerBody.querySelectorAll(".delete-tx").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.confirm("Delete transaction?", "This cannot be undone.", () => {
          this.store.deleteTransaction(btn.dataset.id);
          this.renderAccountDetailBody(acc);
          this.renderAll();
          this.toast("Transaction deleted");
        });
      });
    });
  }

  // ============================================================
  // FORMS (inline in drawer or via modal-like drawer content)
  // ============================================================
  openAccountForm(editId = null) {
    const isEdit = !!editId;
    const acc = isEdit ? this.store.getAccount(editId) : null;

    this.drawerTitle.textContent = isEdit ? "Edit account" : "New account";
    this.drawerBody.innerHTML = `
          <form id="accountForm">
            <div class="form-group">
              <label>Account name</label>
              <input type="text" id="accName" placeholder="e.g. My BDO Savings" value="${acc ? this.escapeHtml(acc.name) : ""}" required>
            </div>
            <div class="form-group">
              <label>Bank / Provider</label>
              <select id="accBank">
                ${Account.bankList.map((b) => `<option value="${b}" ${acc && acc.bank === b ? "selected" : ""}>${b}</option>`).join("")}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Starting balance (₱)</label>
                <input type="number" id="accBalance" step="0.01" placeholder="0.00" value="${acc ? acc.startingBalance : ""}" required>
              </div>
              <div class="form-group">
                <label>Type</label>
                <select id="accType">
                  <option value="wallet" ${acc && acc.type === "wallet" ? "selected" : ""}>Wallet</option>
                  <option value="savings" ${acc && acc.type === "savings" ? "selected" : ""}>Savings</option>
                  <option value="cash" ${acc && acc.type === "cash" ? "selected" : ""}>Cash</option>
                  <option value="credit" ${acc && acc.type === "credit" ? "selected" : ""}>Credit</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn-primary mt-16">${isEdit ? "Save changes" : "Create account"}</button>
          </form>
        `;

    document.getElementById("accountForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("accName").value.trim();
      const bank = document.getElementById("accBank").value;
      const balance =
        parseFloat(document.getElementById("accBalance").value) || 0;
      const type = document.getElementById("accType").value;

      if (isEdit) {
        this.store.updateAccount(editId, {
          name,
          bank,
          startingBalance: balance,
          type,
        });
        this.toast("Account updated ✏️");
      } else {
        this.store.addAccount(name, bank, balance, type);
        this.toast("Account created 🎉");
      }

      this.closeDrawer();
      this.renderAll();
      this.switchView(this.currentView);
    });

    this.openDrawer();
  }

  openTransactionForm(editId = null, presetAccountId = null) {
    const isEdit = !!editId;
    const tx = isEdit
      ? this.store.transactions.find((t) => t.id === editId)
      : null;
    const accounts = this.store.accounts;
    const categories = this.store.categories;

    if (accounts.length === 0) {
      this.toast("Create an account first 🏦");
      return;
    }

    const selectedAccountId = tx
      ? tx.accountId
      : presetAccountId || accounts[0].id;

    this.drawerTitle.textContent = isEdit
      ? "Edit transaction"
      : "New transaction";
    this.drawerBody.innerHTML = `
          <form id="txForm">
            <div class="type-toggle" id="txTypeToggle">
              <button type="button" data-type="income" class="${tx && tx.type === "income" ? "active income" : ""}">Income</button>
              <button type="button" data-type="expense" class="${!tx || tx.type === "expense" ? "active expense" : ""}">Expense</button>
            </div>
            <input type="hidden" id="txType" value="${tx ? tx.type : "expense"}">

            <div class="form-group">
              <label>Description</label>
              <input type="text" id="txDesc" placeholder="e.g. Lunch at Jollibee" value="${tx ? this.escapeHtml(tx.description) : ""}" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Amount (₱)</label>
                <input type="number" id="txAmount" step="0.01" placeholder="0.00" value="${tx ? tx.amount : ""}" required>
              </div>
              <div class="form-group">
                <label>Date</label>
                <input type="date" id="txDate" value="${tx ? tx.date.split("T")[0] : Formatters.todayISO()}" required>
              </div>
            </div>
            <div class="form-group">
              <label>Category</label>
              <select id="txCategory">
                ${categories.map((c) => `<option value="${c.id}" ${tx && tx.categoryId === c.id ? "selected" : ""}>${c.emoji} ${this.escapeHtml(c.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Account</label>
              <select id="txAccount">
                ${accounts.map((a) => `<option value="${a.id}" ${a.id === selectedAccountId ? "selected" : ""}>${this.escapeHtml(a.name)} (${Formatters.currency(this.store.accountBalance(a.id))})</option>`).join("")}
              </select>
            </div>
            <button type="submit" class="btn-primary mt-16">${isEdit ? "Save changes" : "Add transaction"}</button>
          </form>
        `;

    // Type toggle
    const toggle = document.getElementById("txTypeToggle");
    toggle.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggle
          .querySelectorAll("button")
          .forEach((b) => b.classList.remove("active", "income", "expense"));
        btn.classList.add("active", btn.dataset.type);
        document.getElementById("txType").value = btn.dataset.type;
      });
    });

    document.getElementById("txForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const type = document.getElementById("txType").value;
      const description = document.getElementById("txDesc").value.trim();
      const amount = parseFloat(document.getElementById("txAmount").value) || 0;
      const date = new Date(
        document.getElementById("txDate").value + "T12:00:00",
      ).toISOString();
      const categoryId = document.getElementById("txCategory").value;
      const accountId = document.getElementById("txAccount").value;

      if (isEdit) {
        this.store.updateTransaction(editId, {
          description,
          amount,
          categoryId,
          date,
          type,
          accountId,
        });
        this.toast("Transaction updated ✏️");
      } else {
        this.store.addTransaction(
          accountId,
          description,
          amount,
          categoryId,
          date,
          type,
        );
        this.toast("Transaction added 🎉");
      }

      this.closeDrawer();
      this.renderAll();

      // Re-open account detail if we were in that context
      if (presetAccountId) {
        this.openAccountDetail(presetAccountId);
      }
    });

    this.openDrawer();
  }

  openBudgetForm(categoryId = null) {
    const isEdit = !!categoryId;
    const budget = isEdit
      ? this.store.budgets.find((b) => b.categoryId === categoryId)
      : null;
    const categories = this.store.categories.filter(
      (c) => c.id !== "income" && c.id !== "transfer",
    );

    this.drawerTitle.textContent = isEdit ? "Edit budget" : "Set budget";
    this.drawerBody.innerHTML = `
          <form id="budgetForm">
            <div class="form-group">
              <label>Category</label>
              <select id="budgetCategory" ${isEdit ? "disabled" : ""}>
                ${categories.map((c) => `<option value="${c.id}" ${budget && budget.categoryId === c.id ? "selected" : ""}>${c.emoji} ${this.escapeHtml(c.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Monthly limit (₱)</label>
              <input type="number" id="budgetLimit" step="0.01" placeholder="0.00" value="${budget ? budget.limit : ""}" required>
            </div>
            <button type="submit" class="btn-primary mt-16">${isEdit ? "Save budget" : "Set budget"}</button>
          </form>
        `;

    document.getElementById("budgetForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const catId = isEdit
        ? categoryId
        : document.getElementById("budgetCategory").value;
      const limit =
        parseFloat(document.getElementById("budgetLimit").value) || 0;
      this.store.setBudget(catId, limit);
      this.closeDrawer();
      this.renderBudget();
      this.renderAll();
      this.toast(isEdit ? "Budget updated" : "Budget set 📊");
    });

    this.openDrawer();
  }

  openGoalForm(editId = null) {
    const isEdit = !!editId;
    const goal = isEdit ? this.store.goals.find((g) => g.id === editId) : null;

    this.drawerTitle.textContent = isEdit ? "Edit goal" : "New savings goal";
    this.drawerBody.innerHTML = `
          <form id="goalForm">
            <div class="form-group">
              <label>Goal name</label>
              <input type="text" id="goalName" placeholder="e.g. Emergency fund" value="${goal ? this.escapeHtml(goal.name) : ""}" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Target amount (₱)</label>
                <input type="number" id="goalTarget" step="0.01" placeholder="0.00" value="${goal ? goal.targetAmount : ""}" required>
              </div>
              <div class="form-group">
                <label>Current savings (₱)</label>
                <input type="number" id="goalCurrent" step="0.01" placeholder="0.00" value="${goal ? goal.currentAmount : ""}">
              </div>
            </div>
            <div class="form-group">
              <label>Target date (optional)</label>
              <input type="date" id="goalDate" value="${goal && goal.targetDate ? goal.targetDate.split("T")[0] : ""}">
            </div>
            <button type="submit" class="btn-primary mt-16">${isEdit ? "Save goal" : "Create goal"}</button>
          </form>
        `;

    document.getElementById("goalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("goalName").value.trim();
      const target =
        parseFloat(document.getElementById("goalTarget").value) || 0;
      const current =
        parseFloat(document.getElementById("goalCurrent").value) || 0;
      const dateVal = document.getElementById("goalDate").value;
      const targetDate = dateVal
        ? new Date(dateVal + "T12:00:00").toISOString()
        : null;

      if (isEdit) {
        this.store.updateGoal(editId, {
          name,
          targetAmount: target,
          currentAmount: current,
          targetDate,
        });
        this.toast("Goal updated ✏️");
      } else {
        this.store.addGoal(name, target, current, targetDate);
        this.toast("Goal created 🎯");
      }

      this.closeDrawer();
      this.renderGoals();
      this.renderAll();
    });

    this.openDrawer();
  }

  openAddFundsForm(goalId) {
    const goal = this.store.goals.find((g) => g.id === goalId);
    if (!goal) return;

    this.drawerTitle.textContent = `Add funds to ${goal.name}`;
    this.drawerBody.innerHTML = `
          <form id="addFundsForm">
            <div class="form-group">
              <label>Amount to add (₱)</label>
              <input type="number" id="fundsAmount" step="0.01" placeholder="0.00" required autofocus>
            </div>
            <button type="submit" class="btn-primary mt-16">Add funds</button>
          </form>
        `;

    document.getElementById("addFundsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const amount =
        parseFloat(document.getElementById("fundsAmount").value) || 0;
      this.store.addFundsToGoal(goalId, amount);
      this.closeDrawer();
      this.renderGoals();
      this.renderAll();
      this.toast(`Added ${Formatters.currency(amount)} to "${goal.name}" 💰`);
    });

    this.openDrawer();
    setTimeout(() => document.getElementById("fundsAmount")?.focus(), 300);
  }

  openCategoryForm(editId = null) {
    const isEdit = !!editId;
    const cat = isEdit
      ? this.store.categories.find((c) => c.id === editId)
      : null;

    this.drawerTitle.textContent = isEdit ? "Edit category" : "New category";
    this.drawerBody.innerHTML = `
          <form id="catForm">
            <div class="form-group">
              <label>Category name</label>
              <input type="text" id="catName" placeholder="e.g. Pets" value="${cat ? this.escapeHtml(cat.name) : ""}" required>
            </div>
            <div class="form-group">
              <label>Emoji icon</label>
              <input type="text" id="catEmoji" placeholder="🐶" value="${cat ? cat.emoji : ""}" maxlength="4" required>
            </div>
            <button type="submit" class="btn-primary mt-16">${isEdit ? "Save category" : "Add category"}</button>
          </form>
        `;

    document.getElementById("catForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("catName").value.trim();
      const emoji = document.getElementById("catEmoji").value.trim() || "📦";

      if (isEdit) {
        this.store.updateCategory(editId, { name, emoji });
        this.toast("Category updated ✏️");
      } else {
        this.store.addCategory(name, emoji);
        this.toast("Category added 🎉");
      }

      this.closeDrawer();
      this.renderSettings();
      this.renderAll();
    });

    this.openDrawer();
  }

  // ============================================================
  // DRAWER CONTROLS
  // ============================================================
  openDrawer() {
    this.drawer.classList.add("open");
    this.drawerOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  closeDrawer() {
    this.drawer.classList.remove("open");
    this.drawerOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  // ============================================================
  // TOAST
  // ============================================================
  toast(message, duration = 2600) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    this.toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ============================================================
  // CONFIRM MODAL
  // ============================================================
  confirm(title, message, onConfirm) {
    this.confirmTitle.textContent = title;
    this.confirmMessage.textContent = message;
    this.confirmModal.classList.add("open");

    const handler = () => {
      this.confirmOk.removeEventListener("click", handler);
      this.confirmCancel.removeEventListener("click", closeHandler);
      this.confirmModal.classList.remove("open");
      onConfirm();
    };

    const closeHandler = () => {
      this.confirmOk.removeEventListener("click", handler);
      this.confirmCancel.removeEventListener("click", closeHandler);
      this.confirmModal.classList.remove("open");
    };

    this.confirmOk.addEventListener("click", handler);
    this.confirmCancel.addEventListener("click", closeHandler);
  }

  closeConfirm() {
    this.confirmModal.classList.remove("open");
  }

  // ============================================================
  // DATA EXPORT / IMPORT
  // ============================================================
  exportData() {
    const json = this.store.exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallet-backup-${Formatters.timestamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast("Data exported 📦");
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this.store.importData(e.target.result);
        this.renderAll();
        this.toast("Data imported successfully ✅");
      } catch (err) {
        alert("Failed to import: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

/* ============================================================
       BOOTSTRAP
       ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const store = new WalletStore();
  const ui = new WalletUI(store);

  // Expose for debugging
  window.walletUI = ui;
  window.walletStore = store;

  // Seed sample data if empty (first visit)
  if (store.accounts.length === 0 && store.transactions.length === 0) {
    // Add a sample account
    const acc = store.addAccount("My GCash", "GCash", 2500, "wallet");
    const acc2 = store.addAccount("BDO Savings", "BDO", 15000, "savings");

    // Sample transactions
    store.addTransaction(
      acc.id,
      "Lunch",
      185,
      "food",
      new Date().toISOString(),
      "expense",
    );
    store.addTransaction(
      acc.id,
      "Jeepney fare",
      13,
      "transport",
      new Date().toISOString(),
      "expense",
    );
    store.addTransaction(
      acc.id,
      "Allowance",
      5000,
      "income",
      new Date().toISOString(),
      "income",
    );
    store.addTransaction(
      acc2.id,
      "Electric bill",
      1200,
      "bills",
      new Date().toISOString(),
      "expense",
    );

    // Sample budget
    store.setBudget("food", 5000);
    store.setBudget("transport", 2000);

    // Sample goal
    store.addGoal(
      "Emergency fund",
      50000,
      12000,
      new Date(new Date().getFullYear() + 1, 0, 1).toISOString(),
    );

    ui.renderAll();
  }
});
