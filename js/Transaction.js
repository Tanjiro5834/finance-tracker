'use strict';

export class Transaction {
  constructor(label, amount, type, date = new Date().toISOString()) {
    this.id = crypto.randomUUID();
    this.label = label;
    this.amount = Math.abs(amount);   // always store positive magnitude
    this.type = type;                 // 'add' | 'minus'
    this.date = date;
  }

  // Signed value used for math (add = +, minus = -)
  get signedAmount() {
    return this.type === 'minus' ? -this.amount : this.amount;
  }

  static fromJSON(obj) {
    const t = new Transaction(obj.label, obj.amount, obj.type, obj.date);
    t.id = obj.id;
    return t;
  }
}