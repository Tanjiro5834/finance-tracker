'use strict';

import { Account } from './Account.js';
import { Category, DEFAULT_CATEGORIES } from './Category.js';
import { Budget } from './Budget.js';
import { Goal } from './Goal.js';

export class WalletStore {
  static STORAGE_KEY = 'wallet_app_data_v2';
  static THEME_KEY = 'wallet_app_theme';

  constructor() {
    this.accounts = [];
    this.categories = DEFAULT_CATEGORIES.map(c => new Category(c.name, c.icon, c.builtin, c.id));
    this.budgets = [];
    this.goals = [];
    this.load();
  }

  /* ---------- persistence ---------- */

  save() {
    const data = {
      accounts: this.accounts.map(acc => acc.toJSON()),
      categories: this.categories.map(c => c.toJSON()),
      budgets: this.budgets.map(b => b.toJSON()),
      goals: this.goals.map(g => g.toJSON()),
    };
    localStorage.setItem(WalletStore.STORAGE_KEY, JSON.stringify(data));
  }

  load() {
    const raw = localStorage.getItem(WalletStore.STORAGE_KEY);
    if (!raw) {
      // try migrating from v1 key if present
      this.migrateFromV1();
      return;
    }
    try {
      const data = JSON.parse(raw);
      this.accounts = (data.accounts || []).map(Account.fromJSON);
      this.categories = (data.categories && data.categories.length)
        ? data.categories.map(Category.fromJSON)
        : DEFAULT_CATEGORIES.map(c => new Category(c.name, c.icon, c.builtin, c.id));
      this.budgets = (data.budgets || []).map(Budget.fromJSON);
      this.goals = (data.goals || []).map(Goal.fromJSON);
    } catch (e) {
      console.error('Failed to load wallet data:', e);
    }
  }

  migrateFromV1() {
    const raw = localStorage.getItem('wallet_app_data_v1');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      this.accounts = data.map(Account.fromJSON);
      this.save();
    } catch (e) {
      console.error('Failed to migrate v1 data:', e);
    }
  }

  exportJSON() {
    return JSON.stringify({
      accounts: this.accounts.map(acc => acc.toJSON()),
      categories: this.categories.map(c => c.toJSON()),
      budgets: this.budgets.map(b => b.toJSON()),
      goals: this.goals.map(g => g.toJSON()),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  importJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.accounts)) throw new Error('Invalid file format');
    this.accounts = data.accounts.map(Account.fromJSON);
    this.categories = (data.categories && data.categories.length)
      ? data.categories.map(Category.fromJSON)
      : DEFAULT_CATEGORIES.map(c => new Category(c.name, c.icon, c.builtin, c.id));
    this.budgets = (data.budgets || []).map(Budget.fromJSON);
    this.goals = (data.goals || []).map(Goal.fromJSON);
    this.save();
  }

  clearAll() {
    this.accounts = [];
    this.categories = DEFAULT_CATEGORIES.map(c => new Category(c.name, c.icon, c.builtin, c.id));
    this.budgets = [];
    this.goals = [];
    this.save();
  }

  /* ---------- theme ---------- */

  getTheme() {
    return localStorage.getItem(WalletStore.THEME_KEY) || 'dark';
  }

  setTheme(theme) {
    localStorage.setItem(WalletStore.THEME_KEY, theme);
  }

  /* ---------- computed: net worth / totals ---------- */

  getNetWorth() {
    return this.accounts.reduce((sum, acc) => sum + acc.getBalance(), 0);
  }

  getAccount(id) {
    return this.accounts.find(a => a.id === id);
  }

  getRecentActivity(limit = 8) {
    const all = this.accounts.flatMap(acc => acc.getAllTransactionsWithAccount());
    return all
      .sort((a, b) => new Date(b.txn.date) - new Date(a.txn.date))
      .slice(0, limit);
  }

  getAllTransactionsFlat() {
    return this.accounts.flatMap(acc => acc.getAllTransactionsWithAccount());
  }

  getTotals() {
    let totalIn = 0, totalOut = 0;
    this.accounts.forEach(acc => {
      acc.transactions.forEach(t => {
        if (t.type === 'minus') totalOut += t.amount;
        else totalIn += t.amount;
      });
    });
    return { totalIn, totalOut };
  }

  getMonthTotals(year, month) {
    // month: 0-11
    let income = 0, expenses = 0;
    this.accounts.forEach(acc => {
      acc.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getFullYear() !== year || d.getMonth() !== month) return;
        if (t.type === 'minus') expenses += t.amount;
        else income += t.amount;
      });
    });
    return { income, expenses };
  }

  getCurrentMonthTotals() {
    const now = new Date();
    return this.getMonthTotals(now.getFullYear(), now.getMonth());
  }

  getSpendingByCategory(year = null, month = null) {
    const totals = {};
    this.accounts.forEach(acc => {
      acc.transactions.forEach(t => {
        if (t.type !== 'minus') return;
        if (year !== null) {
          const d = new Date(t.date);
          if (d.getFullYear() !== year || d.getMonth() !== month) return;
        }
        totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
      });
    });
    return totals;
  }

  // last N months of income/expense, oldest first
  getMonthlyHistory(n = 6) {
    const now = new Date();
    const months = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { income, expenses } = this.getMonthTotals(d.getFullYear(), d.getMonth());
      months.push({ year: d.getFullYear(), month: d.getMonth(), income, expenses });
    }
    return months;
  }

  // net worth balance trajectory over last N months (approximate, based on txn dates)
  getBalanceHistory(n = 6) {
    const now = new Date();
    const startingTotal = this.accounts.reduce((sum, acc) => sum + acc.startingBalance, 0);
    const allTxns = this.getAllTransactionsFlat().map(x => x.txn);

    const months = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1); // end of this month
      const sumUpTo = allTxns
        .filter(t => new Date(t.date) < d)
        .reduce((sum, t) => sum + t.signedAmount, 0);
      months.push({
        year: d.getFullYear(), month: d.getMonth() - 1,
        balance: startingTotal + sumUpTo
      });
    }
    return months;
  }

  /* ---------- accounts ---------- */

  createAccount(name, startingBalance, type, bank) {
    const acc = new Account(name, startingBalance, type, bank);
    this.accounts.push(acc);
    this.save();
    return acc;
  }

  deleteAccount(accountId) {
    this.accounts = this.accounts.filter(a => a.id !== accountId);
    this.save();
  }

  /* ---------- transactions ---------- */

  addTransaction(accountId, label, amount, type, categoryId = 'others', date = undefined) {
    const acc = this.getAccount(accountId);
    if (!acc) return null;
    const txn = acc.addTransaction(label, amount, type, categoryId, date);
    this.save();
    return txn;
  }

  editTransaction(accountId, txnId, fields) {
    const acc = this.getAccount(accountId);
    if (!acc) return null;
    const txn = acc.editTransaction(txnId, fields);
    this.save();
    return txn;
  }

  deleteTransaction(accountId, txnId) {
    const acc = this.getAccount(accountId);
    if (!acc) return;
    acc.deleteTransaction(txnId);
    this.save();
  }

  /* ---------- categories ---------- */

  getCategory(id) {
    return this.categories.find(c => c.id === id) || this.categories.find(c => c.id === 'others');
  }

  createCategory(name, icon) {
    const cat = new Category(name, icon || '✦', false);
    this.categories.push(cat);
    this.save();
    return cat;
  }

  editCategory(id, fields) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) return null;
    if (fields.name !== undefined) cat.name = fields.name;
    if (fields.icon !== undefined) cat.icon = fields.icon;
    this.save();
    return cat;
  }

  deleteCategory(id) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat || cat.builtin) return false;
    this.categories = this.categories.filter(c => c.id !== id);
    // reassign orphaned transactions to 'others'
    this.accounts.forEach(acc => {
      acc.transactions.forEach(t => {
        if (t.categoryId === id) t.categoryId = 'others';
      });
    });
    // remove any budget tied to this category
    this.budgets = this.budgets.filter(b => b.categoryId !== id);
    this.save();
    return true;
  }

  /* ---------- budgets ---------- */

  setBudget(categoryId, monthlyLimit) {
    let b = this.budgets.find(b => b.categoryId === categoryId);
    if (b) {
      b.monthlyLimit = Number(monthlyLimit);
    } else {
      b = new Budget(categoryId, monthlyLimit);
      this.budgets.push(b);
    }
    this.save();
    return b;
  }

  deleteBudget(categoryId) {
    this.budgets = this.budgets.filter(b => b.categoryId !== categoryId);
    this.save();
  }

  getBudgetsWithProgress() {
    const now = new Date();
    const spent = this.getSpendingByCategory(now.getFullYear(), now.getMonth());
    return this.budgets.map(b => {
      const category = this.getCategory(b.categoryId);
      const spentAmt = spent[b.categoryId] || 0;
      const remaining = b.monthlyLimit - spentAmt;
      const pct = b.monthlyLimit > 0 ? Math.min(100, Math.round((spentAmt / b.monthlyLimit) * 100)) : 0;
      return { budget: b, category, spent: spentAmt, remaining, pct };
    });
  }

  /* ---------- savings goals ---------- */

  createGoal(name, targetAmount, currentAmount = 0, targetDate = null) {
    const g = new Goal(name, targetAmount, currentAmount, targetDate);
    this.goals.push(g);
    this.save();
    return g;
  }

  editGoal(id, fields) {
    const g = this.goals.find(g => g.id === id);
    if (!g) return null;
    if (fields.name !== undefined) g.name = fields.name;
    if (fields.targetAmount !== undefined) g.targetAmount = Number(fields.targetAmount);
    if (fields.targetDate !== undefined) g.targetDate = fields.targetDate;
    this.save();
    return g;
  }

  contributeToGoal(id, amount) {
    const g = this.goals.find(g => g.id === id);
    if (!g) return null;
    g.addContribution(amount);
    this.save();
    return g;
  }

  deleteGoal(id) {
    this.goals = this.goals.filter(g => g.id !== id);
    this.save();
  }
}