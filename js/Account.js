'use strict';

import { Transaction } from './Transaction.js';

export class Account {
  constructor(name, startingBalance, type = 'wallet', bank = '') {
    this.id = crypto.randomUUID();
    this.name = name;
    this.startingBalance = Number(startingBalance);
    this.type = type;
    this.bank = bank;
    this.transactions = [];
  }

  addTransaction(label, amount, type) {
    const txn = new Transaction(label, amount, type);
    this.transactions.push(txn);
    return txn;
  }

  // Balance = starting balance + sum of all signed transactions
  getBalance() {
    const txnSum = this.transactions.reduce((sum, t) => sum + t.signedAmount, 0);
    return this.startingBalance + txnSum;
  }

  getSortedTransactions() {
    return [...this.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      startingBalance: this.startingBalance,
      type: this.type,
      bank: this.bank,
      transactions: this.transactions
    };
  }

  static fromJSON(obj) {
    const acc = new Account(obj.name, obj.startingBalance, obj.type, obj.bank);
    acc.id = obj.id;
    acc.transactions = obj.transactions.map(Transaction.fromJSON);
    return acc;
  }
}