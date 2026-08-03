'use strict';

import { Account } from './Account.js';

export class WalletStore {
  static STORAGE_KEY = 'wallet_app_data_v1';

  constructor() {
    this.accounts = [];
    this.load();
  }

  /* ---------- persistence ---------- */

  save() {
    const data = this.accounts.map(acc => acc.toJSON());
    localStorage.setItem(WalletStore.STORAGE_KEY, JSON.stringify(data));
  }

  load() {
    const raw = localStorage.getItem(WalletStore.STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      this.accounts = data.map(Account.fromJSON);
    } catch (e) {
      console.error('Failed to load wallet data:', e);
      this.accounts = [];
    }
  }

  /* ---------- computed ---------- */

  getNetWorth() {
    return this.accounts.reduce((sum, acc) => sum + acc.getBalance(), 0);
  }

  getAccount(id) {
    return this.accounts.find(a => a.id === id);
  }

  /* ---------- mutations ---------- */

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

  addTransaction(accountId, label, amount, type) {
    const acc = this.getAccount(accountId);
    if (!acc) return null;
    const txn = acc.addTransaction(label, amount, type);
    this.save();
    return txn;
  }
}