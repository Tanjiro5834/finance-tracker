'use strict';

import { WalletStore } from './WalletStore.js';
import { WalletUI } from './WalletUI.js';

document.addEventListener('DOMContentLoaded', () => {
  const store = new WalletStore();
  window.walletApp = new WalletUI(store);
});