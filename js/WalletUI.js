'use strict';

import { formatPeso, formatDate, iconFor, bankLabel, bankBranding } from './Formatters.js';

export class WalletUI {
  constructor(store) {
    this.store = store;
    this.activeAccountId = null;
    this.pendingTxnType = 'add';
    this.balanceHidden = false;

    this.bindEvents();
    this.render();
  }

  /* ---------- rendering ---------- */

  render() {
    this.renderNetWorth();
    this.renderAccounts();
  }

  renderNetWorth() {
    const el = document.getElementById('netWorthAmount');
    el.textContent = formatPeso(this.store.getNetWorth());
    el.classList.toggle('hidden-balance', this.balanceHidden);

    const count = this.store.accounts.length;
    document.getElementById('accountCount').textContent =
      `${count} account${count !== 1 ? 's' : ''}`;
  }

  renderAccounts() {
    const grid = document.getElementById('accountsGrid');
    grid.innerHTML = '';

    if (this.store.accounts.length === 0) {
      grid.innerHTML = `<div class="empty-state">No accounts yet. Tap "+ Add Account" to start tracking.</div>`;
      return;
    }

    this.store.accounts.forEach(acc => {
      const balance = acc.getBalance();
      const branding = bankBranding(acc.bank);
      const card = document.createElement('div');
      card.className = 'account-card';
      card.dataset.id = acc.id;

      const iconHTML = branding
        ? `<div class="account-icon bank-badge" style="background:${branding.color}22; color:${branding.color}; border-color:${branding.color}44;">${branding.initials}</div>`
        : `<div class="account-icon">${iconFor(acc.type)}</div>`;

      card.innerHTML = `
        ${iconHTML}
        <div class="account-name">${acc.name}</div>
        <div class="account-balance ${balance < 0 ? 'negative' : ''}">${formatPeso(balance)}</div>
        <div class="account-type-tag">${bankLabel(acc.bank) ? bankLabel(acc.bank) + ' · ' : ''}${acc.type}</div>
      `;
      card.addEventListener('click', () => this.openDetail(acc.id));
      grid.appendChild(card);
    });
  }

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

    list.innerHTML = txns.map(t => `
      <div class="txn-item">
        <div>
          <div class="txn-item-label">${t.label}</div>
          <div class="txn-item-date">${formatDate(t.date)}</div>
        </div>
        <div class="txn-item-amount ${t.type === 'minus' ? 'negative' : 'positive'}">
          ${t.type === 'minus' ? '−' : '+'}${formatPeso(t.amount)}
        </div>
      </div>
    `).join('');
  }

  /* ---------- modal control ---------- */

  openModal(id) {
    document.getElementById(id).classList.add('active');
  }

  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  openDetail(accountId) {
    this.activeAccountId = accountId;
    this.pendingTxnType = 'add';
    document.querySelectorAll('.txn-type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.type === 'add'));
    this.renderDetail();
    this.openModal('detailModal');
  }

  toggleBalanceVisibility() {
    this.balanceHidden = !this.balanceHidden;
    this.renderNetWorth();
  }

  /* ---------- event binding ---------- */

  bindEvents() {
    document.getElementById('addAccountBtn')
      .addEventListener('click', () => this.openModal('addAccountModal'));

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal-overlay').classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
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
    });

    document.querySelectorAll('.txn-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.pendingTxnType = btn.dataset.type;
        document.querySelectorAll('.txn-type-btn').forEach(b =>
          b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('addTxnForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const label = document.getElementById('txnLabel').value.trim();
      const amount = parseFloat(document.getElementById('txnAmount').value);

      if (!label || isNaN(amount) || amount <= 0) return;

      this.store.addTransaction(this.activeAccountId, label, amount, this.pendingTxnType);
      this.render();
      this.renderDetail();
      e.target.reset();
    });

    document.getElementById('deleteAccountBtn').addEventListener('click', () => {
      if (!this.activeAccountId) return;
      const acc = this.store.getAccount(this.activeAccountId);
      if (confirm(`Delete "${acc.name}"? This cannot be undone.`)) {
        this.store.deleteAccount(this.activeAccountId);
        this.render();
        this.closeModal('detailModal');
      }
    });

    document.getElementById('toggleVisibility')
      .addEventListener('click', () => this.toggleBalanceVisibility());
  }
}