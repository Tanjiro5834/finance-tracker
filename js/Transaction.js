'use strict';

export class Transaction {
  constructor(label, amount, type, categoryId = 'others', date = new Date().toISOString()) {
    this.id = crypto.randomUUID();
    this.label = label;
    this.amount = Math.abs(amount);   // always store positive magnitude
    this.type = type;                 // 'add' | 'minus'
    this.categoryId = categoryId;     // references Category.id
    this.date = date;                 // ISO string, user-editable
  }

  get signedAmount() {
    return this.type === 'minus' ? -this.amount : this.amount;
  }

  update({ label, amount, type, categoryId, date }) {
    if (label !== undefined) this.label = label;
    if (amount !== undefined) this.amount = Math.abs(amount);
    if (type !== undefined) this.type = type;
    if (categoryId !== undefined) this.categoryId = categoryId;
    if (date !== undefined) this.date = date;
  }

  toJSON() {
    return {
      id: this.id, label: this.label, amount: this.amount,
      type: this.type, categoryId: this.categoryId, date: this.date
    };
  }

  static fromJSON(obj) {
    // backward-compat: old data used `category` (capitalized name string, e.g. "Food")
    // instead of `categoryId` (lowercase id, e.g. "food"). Normalize either case.
    const raw = obj.categoryId || obj.category || 'others';
    const catId = raw.toLowerCase().trim();
    const t = new Transaction(obj.label, obj.amount, obj.type, catId, obj.date);
    t.id = obj.id;
    return t;
  }
}