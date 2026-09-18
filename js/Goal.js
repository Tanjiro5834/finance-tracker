'use strict';

export class Goal {
  constructor(name, targetAmount, currentAmount = 0, targetDate = null) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.targetAmount = Number(targetAmount);
    this.currentAmount = Number(currentAmount);
    this.targetDate = targetDate || null; // ISO date string or null
  }

  getProgressPct() {
    if (this.targetAmount <= 0) return 0;
    return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
  }

  addContribution(amount) {
    this.currentAmount += Number(amount);
  }

  toJSON() {
    return {
      id: this.id, name: this.name, targetAmount: this.targetAmount,
      currentAmount: this.currentAmount, targetDate: this.targetDate
    };
  }

  static fromJSON(obj) {
    const g = new Goal(obj.name, obj.targetAmount, obj.currentAmount, obj.targetDate);
    g.id = obj.id;
    return g;
  }
}