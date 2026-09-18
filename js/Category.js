'use strict';

// Built-in defaults; user can add/edit/delete custom ones on top of these.
export const DEFAULT_CATEGORIES = [
  { id: 'food',      name: 'Food',           icon: '🍔', builtin: true },
  { id: 'transport',  name: 'Transportation', icon: '🚗', builtin: true },
  { id: 'bills',      name: 'Bills',          icon: '🧾', builtin: true },
  { id: 'shopping',   name: 'Shopping',       icon: '🛍️', builtin: true },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', builtin: true },
  { id: 'income',     name: 'Income',         icon: '💰', builtin: true },
  { id: 'transfer',   name: 'Transfer',       icon: '🔁', builtin: true },
  { id: 'others',     name: 'Others',         icon: '✦', builtin: true },
];

export class Category {
  constructor(name, icon = '✦', builtin = false, id = null) {
    this.id = id || crypto.randomUUID();
    this.name = name;
    this.icon = icon;
    this.builtin = builtin;
  }

  toJSON() {
    return { id: this.id, name: this.name, icon: this.icon, builtin: this.builtin };
  }

  static fromJSON(obj) {
    return new Category(obj.name, obj.icon, obj.builtin, obj.id);
  }
}