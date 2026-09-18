'use strict';

export class Budget {
  constructor(categoryId, monthlyLimit) {
    this.id = crypto.randomUUID();
    this.categoryId = categoryId;   // matches Category.id
    this.monthlyLimit = Number(monthlyLimit);
  }

  toJSON() {
    return { id: this.id, categoryId: this.categoryId, monthlyLimit: this.monthlyLimit };
  }

  static fromJSON(obj) {
    const b = new Budget(obj.categoryId, obj.monthlyLimit);
    b.id = obj.id;
    return b;
  }
}