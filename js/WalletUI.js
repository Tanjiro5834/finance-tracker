'use strict';

import {
  formatPeso, formatDate, formatDateShort, toDateInputValue, monthLabel,
  iconFor, bankLabel, bankBranding
} from './Formatters.js';

export class WalletUI {
  constructor(store) {
    this.store = store;
    this.activeAccountId = null;
    this.pendingTxnType = 'add';
    this.editingTxnId = null;
    this.balanceHidden = false;
    this.currentView = 'home';

    this.initTheme();
    this.bindEvents();
    this.render();
  }

  /* ---------- theme ---------- */

  initTheme() {
    const theme = this.store.getTheme();
    document.body.dataset.theme = theme;
    this.updateThemeUI(theme);
  }

  setTheme(theme) {
    document.body.dataset.theme = theme;
    this.store.setTheme(theme);
    this.updateThemeUI(theme);
    if (this.currentView === 'insights') this.renderBalanceChart();
  }

  toggleTheme() {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  updateThemeUI(theme) {
    const isDark = theme === 'dark';
    const icon = isDark ? '🌙' : '☀️';
    document.getElementById('themeIconSidebar').textContent = icon;
    document.getElementById('themeLabelSidebar').textContent = isDark ? 'Dark mode' : 'Light mode';
    document.getElementById('themeToggleMobile').textContent = icon;
    document.querySelectorAll('.theme-opt').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === theme));
  }

  /* ---------- view routing ---------- */

  goto(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');

    document.querySelectorAll('.nav-item[data-view]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.bnav-item[data-view]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === view));

    if (view === 'insights') this.renderInsights();
    if (view === 'home') this.renderHome();
    if (view === 'budget') this.renderBudget();
    if (view === 'goals') this.renderGoals();
    if (view === 'settings') this.renderSettings();
  }

  /* ---------- rendering: core ---------- */

  render() {
    this.renderNetWorth();
    this.renderAccounts();
    this.renderHome();
    this.populateCategorySelects();
    if (this.currentView === 'insights') this.renderInsights();
    if (this.currentView === 'budget') this.renderBudget();
    if (this.currentView === 'goals') this.renderGoals();
    if (this.currentView === 'settings') this.renderSettings();
  }

  populateCategorySelects() {
    const opts = this.store.categories.map(c =>
      `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    ['txnCategory', 'budgetCategory'].forEach(id => {
      const el = document.getElementById(id);
      const prev = el.value;
      el.innerHTML = opts;
      if (prev && this.store.getCategory(prev)) el.value = prev;
    });
  }

  renderNetWorth() {
    const el = document.getElementById('netWorthAmount');
    el.textContent = formatPeso(this.store.getNetWorth());
    el.classList.toggle('hidden-balance', this.balanceHidden);

    const count = this.store.accounts.length;
    document.getElementById('accountCount').textContent =
      `${count} account${count !== 1 ? 's' : ''}`;

    const { totalIn, totalOut } = this.store.getTotals();
    document.getElementById('totalIn').textContent = formatPeso(totalIn);
    document.getElementById('totalOut').textContent = formatPeso(totalOut);

    const now = new Date();
    document.getElementById('monthSummaryLabel').textContent =
      new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) + ' Summary';
    const { income, expenses } = this.store.getCurrentMonthTotals();
    document.getElementById('monthIncome').textContent = formatPeso(income);
    document.getElementById('monthExpenses').textContent = formatPeso(expenses);
    const net = income - expenses;
    const netEl = document.getElementById('monthNet');
    netEl.textContent = formatPeso(net);
    netEl.classList.toggle('positive', net >= 0);
    netEl.classList.toggle('negative', net < 0);
  }

  accountCardHTML(acc) {
    const balance = acc.getBalance();
    const branding = bankBranding(acc.bank);
    const iconHTML = branding
      ? `<div class="account-icon bank-badge" style="background:${branding.color}22; color:${branding.color}; border-color:${branding.color}44;">${branding.initials}</div>`
      : `<div class="account-icon">${iconFor(acc.type)}</div>`;

    return `
      <div class="account-card" data-id="${acc.id}">
        ${iconHTML}
        <div class="account-name">${acc.name}</div>
        <div class="account-balance ${balance < 0 ? 'negative' : ''}">${formatPeso(balance)}</div>
        <div class="account-type-tag">${bankLabel(acc.bank) ? bankLabel(acc.bank) + ' · ' : ''}${acc.type}</div>
      </div>
    `;
  }

  renderAccounts() {
    const grid = document.getElementById('accountsGrid');
    const empty = document.getElementById('emptyAccounts');

    if (this.store.accounts.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    grid.innerHTML = this.store.accounts.map(acc => this.accountCardHTML(acc)).join('');
    grid.querySelectorAll('.account-card').forEach(card => {
      card.addEventListener('click', () => this.openDetail(card.dataset.id));
    });
  }

  renderHome() {
    const strip = document.getElementById('homeAccountsStrip');
    if (this.store.accounts.length === 0) {
      strip.innerHTML = `<div class="accounts-strip-empty">No accounts yet — add one to get started.</div>`;
    } else {
      strip.innerHTML = this.store.accounts.map(acc => this.accountCardHTML(acc)).join('');
      strip.querySelectorAll('.account-card').forEach(card => {
        card.addEventListener('click', () => this.openDetail(card.dataset.id));
      });
    }

    const feed = document.getElementById('activityFeed');
    const recent = this.store.getRecentActivity(8);
    if (recent.length === 0) {
      feed.innerHTML = `<div class="empty-state">No transactions yet.</div>`;
      return;
    }
    feed.innerHTML = recent.map(({ txn, accountName }) => {
      const cat = this.store.getCategory(txn.categoryId);
      return `
        <div class="activity-item">
          <div class="activity-icon">${cat.icon}</div>
          <div class="activity-body">
            <div class="activity-label">${txn.label}</div>
            <div class="activity-meta">${accountName} · ${formatDate(txn.date)}</div>
          </div>
          <div class="activity-amount ${txn.type === 'minus' ? 'negative' : 'positive'}">
            ${txn.type === 'minus' ? '−' : '+'}${formatPeso(txn.amount)}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- rendering: insights ---------- */

  renderInsights() {
    this.renderIncomeExpenseChart();
    this.renderBalanceChart();

    const spending = this.store.getSpendingByCategory();
    const total = Object.values(spending).reduce((s, v) => s + v, 0);
    const barsEl = document.getElementById('categoryBars');
    const emptyEl = document.getElementById('emptyInsights');
    const entries = Object.entries(spending).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      barsEl.innerHTML = '';
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      barsEl.innerHTML = entries.map(([catId, amt]) => {
        const cat = this.store.getCategory(catId);
        const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
        return `
          <div class="cat-bar-row">
            <div class="cat-bar-icon">${cat.icon}</div>
            <div class="cat-bar-col">
              <div class="cat-bar-label-row">
                <span class="cat-bar-name">${cat.name}</span>
                <span class="cat-bar-amount">${formatPeso(amt)}</span>
              </div>
              <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <div></div>
          </div>
        `;
      }).join('');
    }

    const breakdown = document.getElementById('accountBreakdown');
    if (this.store.accounts.length === 0) {
      breakdown.innerHTML = `<div class="empty-state">No accounts yet.</div>`;
    } else {
      breakdown.innerHTML = this.store.accounts.map(acc => {
        const balance = acc.getBalance();
        const branding = bankBranding(acc.bank);
        const icon = branding ? branding.initials : iconFor(acc.type);
        return `
          <div class="breakdown-row">
            <span class="breakdown-name">${icon} ${acc.name}</span>
            <span class="breakdown-val ${balance < 0 ? 'negative' : ''}">${formatPeso(balance)}</span>
          </div>
        `;
      }).join('');
    }
  }

  renderIncomeExpenseChart() {
    const el = document.getElementById('incomeExpenseChart');
    const months = this.store.getMonthlyHistory(6);
    const maxVal = Math.max(1, ...months.flatMap(m => [m.income, m.expenses]));

    el.innerHTML = months.map(m => {
      const incomeH = Math.round((m.income / maxVal) * 100);
      const expenseH = Math.round((m.expenses / maxVal) * 100);
      return `
        <div class="bar-chart-col">
          <div class="bar-chart-bars">
            <div class="bar-chart-bar income" style="height:${incomeH}%" title="Income: ${formatPeso(m.income)}"></div>
            <div class="bar-chart-bar expense" style="height:${expenseH}%" title="Expenses: ${formatPeso(m.expenses)}"></div>
          </div>
          <div class="bar-chart-label">${monthLabel(m.year, m.month)}</div>
        </div>
      `;
    }).join('');

    let legend = el.parentElement.querySelector('.chip-legend');
    if (!legend) {
      legend = document.createElement('div');
      legend.className = 'chip-legend';
      legend.innerHTML = `<span><span class="chip-dot income"></span>Income</span><span><span class="chip-dot expense"></span>Expenses</span>`;
      el.after(legend);
    }
  }

  renderBalanceChart() {
    const svg = document.getElementById('balanceChart');
    const months = this.store.getBalanceHistory(6);
    const values = months.map(m => m.balance);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;

    const w = 300, h = 120, pad = 8;
    const stepX = (w - pad * 2) / (months.length - 1 || 1);

    const points = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });

    const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--mint').trim() || '#3DDC97';
    const fillId = 'balanceFillGrad';
    const areaPoints = `${pad},${h - pad} ` + points.join(' ') + ` ${w - pad},${h - pad}`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${areaPoints}" fill="url(#${fillId})" />
      <polyline points="${points.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map(p => {
        const [x, y] = p.split(',');
        return `<circle cx="${x}" cy="${y}" r="3" fill="${lineColor}" />`;
      }).join('')}
    `;
  }

  /* ---------- rendering: budget ---------- */

  renderBudget() {
    const list = document.getElementById('budgetList');
    const empty = document.getElementById('emptyBudgets');
    const rows = this.store.getBudgetsWithProgress();

    if (rows.length === 0) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = rows.map(({ budget, category, spent, remaining, pct }) => {
      const fillClass = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
      return `
        <div class="budget-card" data-budget-id="${budget.id}">
          <div class="budget-card-head">
            <div class="budget-card-name">${category.icon} ${category.name}</div>
            <div class="budget-card-amounts"><b>${formatPeso(spent)}</b> / ${formatPeso(budget.monthlyLimit)}</div>
          </div>
          <div class="budget-track"><div class="budget-fill ${fillClass}" style="width:${pct}%"></div></div>
          <div class="budget-card-foot">
            <span class="${remaining < 0 ? 'budget-remaining negative' : ''}">${remaining < 0 ? 'Over by ' + formatPeso(Math.abs(remaining)) : formatPeso(remaining) + ' left'}</span>
            <button class="budget-delete-btn" data-cat="${category.id}">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.budget-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.store.deleteBudget(btn.dataset.cat);
        this.renderBudget();
        this.toast('Budget removed');
      });
    });
  }

  /* ---------- rendering: goals ---------- */

  goalRingSVG(pct) {
    const r = 26, c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;
    return `
      <svg width="64" height="64" viewBox="0 0 64 64" class="goal-ring">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--surface-raised)" stroke-width="6"/>
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--mint)" stroke-width="6"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
          transform="rotate(-90 32 32)"/>
        <text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)" font-family="Space Mono, monospace">${pct}%</text>
      </svg>
    `;
  }

  renderGoals() {
    const grid = document.getElementById('goalsGrid');
    const empty = document.getElementById('emptyGoals');

    if (this.store.goals.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    grid.innerHTML = this.store.goals.map(g => {
      const pct = g.getProgressPct();
      return `
        <div class="goal-card" data-goal-id="${g.id}">
          <div class="goal-card-head">
            <div>
              <div class="goal-card-name">🏆 ${g.name}</div>
              ${g.targetDate ? `<div class="goal-card-date">Target: ${formatDateShort(g.targetDate)}</div>` : ''}
            </div>
            <button class="icon-btn goal-edit-icon" data-edit-goal="${g.id}" style="width:30px;height:30px;font-size:13px;">✎</button>
          </div>
          <div class="goal-ring-wrap">
            ${this.goalRingSVG(pct)}
            <div class="goal-amounts">
              <div class="goal-current">${formatPeso(g.currentAmount)}</div>
              <div class="goal-target">of ${formatPeso(g.targetAmount)}</div>
            </div>
          </div>
          <div class="goal-card-actions">
            <button class="goal-contribute" data-contribute="${g.id}">+ Add funds</button>
            <button class="goal-delete" data-delete-goal="${g.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-contribute]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('contributeGoalId').value = btn.dataset.contribute;
        document.getElementById('contributeForm').reset();
        this.openModal('contributeModal');
      });
    });
    grid.querySelectorAll('[data-edit-goal]').forEach(btn => {
      btn.addEventListener('click', () => this.openGoalEdit(btn.dataset.editGoal));
    });
    grid.querySelectorAll('[data-delete-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = this.store.goals.find(g => g.id === btn.dataset.deleteGoal);
        if (confirm(`Delete goal "${g.name}"?`)) {
          this.store.deleteGoal(g.id);
          this.renderGoals();
          this.toast('Goal deleted');
        }
      });
    });
  }

  openGoalEdit(goalId) {
    const g = this.store.goals.find(g => g.id === goalId);
    if (!g) return;
    document.getElementById('goalModalTitle').textContent = '✎ Edit Goal';
    document.getElementById('goalEditId').value = g.id;
    document.getElementById('goalName').value = g.name;
    document.getElementById('goalTarget').value = g.targetAmount;
    document.getElementById('goalCurrent').value = g.currentAmount;
    document.getElementById('goalDate').value = g.targetDate ? toDateInputValue(g.targetDate) : '';
    this.openModal('goalModal');
  }

  /* ---------- rendering: settings ---------- */

  renderSettings() {
    const list = document.getElementById('categoryList');
    list.innerHTML = this.store.categories.map(c => `
      <div class="category-row" data-cat-id="${c.id}">
        <span class="category-row-icon">${c.icon}</span>
        <span class="category-row-name">${c.name}</span>
        ${c.builtin ? '<span class="category-row-tag">built-in</span>' : ''}
        <div class="category-row-actions">
          <button class="cat-edit" data-edit-cat="${c.id}">✎</button>
          ${!c.builtin ? `<button class="cat-delete" data-delete-cat="${c.id}">🗑</button>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit-cat]').forEach(btn => {
      btn.addEventListener('click', () => this.openCategoryEdit(btn.dataset.editCat));
    });
    list.querySelectorAll('[data-delete-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = this.store.getCategory(btn.dataset.deleteCat);
        if (confirm(`Delete category "${cat.name}"? Transactions using it will move to "Others".`)) {
          this.store.deleteCategory(btn.dataset.deleteCat);
          this.renderSettings();
          this.populateCategorySelects();
          this.toast('Category deleted');
        }
      });
    });
  }

  openCategoryEdit(catId) {
    const c = this.store.getCategory(catId);
    document.getElementById('categoryModalTitle').textContent = '✎ Edit Category';
    document.getElementById('categoryEditId').value = c.id;
    document.getElementById('categoryIcon').value = c.icon;
    document.getElementById('categoryName').value = c.name;
    this.openModal('categoryModal');
  }

  /* ---------- detail panel (account + transactions) ---------- */

  renderDetail() {
    const acc = this.store.getAccount(this.activeAccountId);
    if (!acc) return;

    document.getElementById('detailAccName').textContent = acc.name;
    document.getElementById('detailAccBalance').textContent = formatPeso(acc.getBalance());

    const list = document.getElementById('txnList');
    const txns = acc.getSortedTransactions();

    if (txns.length === 0) {
      list.innerHTML = `<div class="empty-state">No transactions yet.</div>`;
      return;
    }

    list.innerHTML = txns.map(t => {
      const cat = this.store.getCategory(t.categoryId);
      return `
        <div class="txn-item" data-txn-id="${t.id}">
          <div class="txn-icon">${cat.icon}</div>
          <div class="txn-item-body">
            <div class="txn-item-label">${t.label}</div>
            <div class="txn-item-date">${formatDate(t.date)} · ${cat.name}</div>
          </div>
          <div class="txn-item-amount ${t.type === 'minus' ? 'negative' : 'positive'}">
            ${t.type === 'minus' ? '−' : '+'}${formatPeso(t.amount)}
          </div>
          <div class="category-row-actions">
            <button class="cat-edit" data-edit-txn="${t.id}">✎</button>
            <button class="cat-delete" data-delete-txn="${t.id}">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-edit-txn]').forEach(btn => {
      btn.addEventListener('click', () => this.startEditTxn(btn.dataset.editTxn));
    });
    list.querySelectorAll('[data-delete-txn]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this transaction?')) {
          this.store.deleteTransaction(this.activeAccountId, btn.dataset.deleteTxn);
          this.render();
          this.renderDetail();
          this.toast('Transaction deleted');
        }
      });
    });
  }

  startEditTxn(txnId) {
    const acc = this.store.getAccount(this.activeAccountId);
    const txn = acc.transactions.find(t => t.id === txnId);
    if (!txn) return;

    this.editingTxnId = txnId;
    document.getElementById('txnEditId').value = txnId;
    document.getElementById('txnLabel').value = txn.label;
    document.getElementById('txnAmount').value = txn.amount;
    document.getElementById('txnCategory').value = txn.categoryId;
    document.getElementById('txnDate').value = toDateInputValue(txn.date);
    this.pendingTxnType = txn.type;
    document.querySelectorAll('.txn-type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.type === txn.type));
    document.getElementById('txnSubmitBtn').textContent = 'Save Changes';
    document.getElementById('txnCancelEditBtn').hidden = false;
    document.getElementById('addTxnForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cancelEditTxn() {
    this.editingTxnId = null;
    document.getElementById('addTxnForm').reset();
    document.getElementById('txnEditId').value = '';
    document.getElementById('txnDate').value = '';
    document.getElementById('txnSubmitBtn').textContent = 'Log Transaction';
    document.getElementById('txnCancelEditBtn').hidden = true;
    this.pendingTxnType = 'add';
    document.querySelectorAll('.txn-type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.type === 'add'));
  }

  /* ---------- modal / panel control ---------- */

  openModal(id) { document.getElementById(id).classList.add('active'); }
  closeModal(id) { document.getElementById(id).classList.remove('active'); }

  openDetail(accountId) {
    this.activeAccountId = accountId;
    this.cancelEditTxn();
    this.renderDetail();
    document.getElementById('detailOverlay').classList.add('active');
  }

  closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
    this.cancelEditTxn();
  }

  toggleBalanceVisibility() {
    this.balanceHidden = !this.balanceHidden;
    this.renderNetWorth();
  }

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------- event binding ---------- */

  bindEvents() {
    document.querySelectorAll('.nav-item[data-view], .bnav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.goto(btn.dataset.view));
    });
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => this.goto(btn.dataset.goto));
    });

    document.getElementById('themeToggleSidebar').addEventListener('click', () => this.toggleTheme());
    document.getElementById('themeToggleMobile').addEventListener('click', () => this.toggleTheme());
    document.getElementById('settingsMobileBtn').addEventListener('click', () => this.goto('settings'));
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
    });

    document.getElementById('addAccountBtn').addEventListener('click', () => this.openModal('addAccountModal'));
    document.getElementById('sidebarAddBtn').addEventListener('click', () => this.openModal('addAccountModal'));

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.remove('active'));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    });

    document.getElementById('detailBackBtn').addEventListener('click', () => this.closeDetail());
    document.getElementById('detailCloseBtn').addEventListener('click', () => this.closeDetail());
    document.getElementById('detailOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('detailOverlay')) this.closeDetail();
    });

    document.getElementById('addAccountForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('accName').value.trim();
      const bank = document.getElementById('accBank').value;
      const balance = parseFloat(document.getElementById('accBalance').value);
      const type = document.getElementById('accType').value;
      if (!name || isNaN(balance)) return;
      this.store.createAccount(name, balance, type, bank);
      this.render();
      e.target.reset();
      this.closeModal('addAccountModal');
      this.toast(`✦ ${name} added`);
    });

    document.querySelectorAll('.txn-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.pendingTxnType = btn.dataset.type;
        document.querySelectorAll('.txn-type-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('addTxnForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const label = document.getElementById('txnLabel').value.trim();
      const amount = parseFloat(document.getElementById('txnAmount').value);
      const categoryId = document.getElementById('txnCategory').value;
      const dateVal = document.getElementById('txnDate').value;
      const date = dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : undefined;

      if (!label || isNaN(amount) || amount <= 0) return;

      if (this.editingTxnId) {
        this.store.editTransaction(this.activeAccountId, this.editingTxnId, {
          label, amount, type: this.pendingTxnType, categoryId, date: date || undefined
        });
        this.toast('Transaction updated');
      } else {
        this.store.addTransaction(this.activeAccountId, label, amount, this.pendingTxnType, categoryId, date);
        this.toast(this.pendingTxnType === 'minus' ? `− ${formatPeso(amount)} logged` : `+ ${formatPeso(amount)} logged`);
      }

      this.render();
      this.renderDetail();
      this.cancelEditTxn();
    });

    document.getElementById('txnCancelEditBtn').addEventListener('click', () => this.cancelEditTxn());

    document.getElementById('deleteAccountBtn').addEventListener('click', () => {
      if (!this.activeAccountId) return;
      const acc = this.store.getAccount(this.activeAccountId);
      if (confirm(`Delete "${acc.name}"? This cannot be undone.`)) {
        this.store.deleteAccount(this.activeAccountId);
        this.render();
        this.closeDetail();
        this.toast(`${acc.name} deleted`);
      }
    });

    document.getElementById('toggleVisibility').addEventListener('click', () => this.toggleBalanceVisibility());

    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      document.getElementById('categoryModalTitle').textContent = '✨ New Category';
      document.getElementById('categoryForm').reset();
      document.getElementById('categoryEditId').value = '';
      this.openModal('categoryModal');
    });

    document.getElementById('categoryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('categoryEditId').value;
      const name = document.getElementById('categoryName').value.trim();
      const icon = document.getElementById('categoryIcon').value.trim() || '✦';
      if (!name) return;

      if (id) {
        this.store.editCategory(id, { name, icon });
        this.toast('Category updated');
      } else {
        this.store.createCategory(name, icon);
        this.toast(`${icon} ${name} added`);
      }
      this.populateCategorySelects();
      if (this.currentView === 'settings') this.renderSettings();
      e.target.reset();
      this.closeModal('categoryModal');
    });

    document.getElementById('addBudgetBtn').addEventListener('click', () => {
      document.getElementById('budgetForm').reset();
      this.populateCategorySelects();
      this.openModal('budgetModal');
    });

    document.getElementById('budgetForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const categoryId = document.getElementById('budgetCategory').value;
      const limit = parseFloat(document.getElementById('budgetLimit').value);
      if (isNaN(limit) || limit <= 0) return;
      this.store.setBudget(categoryId, limit);
      this.renderBudget();
      e.target.reset();
      this.closeModal('budgetModal');
      this.toast('Budget saved');
    });

    document.getElementById('addGoalBtn').addEventListener('click', () => {
      document.getElementById('goalModalTitle').textContent = '🏆 New Savings Goal';
      document.getElementById('goalForm').reset();
      document.getElementById('goalEditId').value = '';
      document.getElementById('goalCurrent').value = '0';
      this.openModal('goalModal');
    });

    document.getElementById('goalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('goalEditId').value;
      const name = document.getElementById('goalName').value.trim();
      const target = parseFloat(document.getElementById('goalTarget').value);
      const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
      const dateVal = document.getElementById('goalDate').value;
      const targetDate = dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : null;
      if (!name || isNaN(target) || target <= 0) return;

      if (id) {
        this.store.editGoal(id, { name, targetAmount: target, targetDate });
        const g = this.store.goals.find(g => g.id === id);
        if (g) g.currentAmount = current;
        this.store.save();
        this.toast('Goal updated');
      } else {
        this.store.createGoal(name, target, current, targetDate);
        this.toast(`🏆 ${name} created`);
      }
      this.renderGoals();
      e.target.reset();
      this.closeModal('goalModal');
    });

    document.getElementById('contributeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const goalId = document.getElementById('contributeGoalId').value;
      const amount = parseFloat(document.getElementById('contributeAmount').value);
      if (isNaN(amount) || amount <= 0) return;
      this.store.contributeToGoal(goalId, amount);
      this.renderGoals();
      e.target.reset();
      this.closeModal('contributeModal');
      this.toast(`+ ${formatPeso(amount)} added to goal`);
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      const json = this.store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wallet-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast('Data exported');
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.store.importJSON(reader.result);
          this.render();
          this.toast('Data imported');
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
      if (confirm('Clear ALL data? This deletes every account, transaction, budget, and goal. This cannot be undone.')) {
        this.store.clearAll();
        this.render();
        this.toast('All data cleared');
      }
    });
  }
}