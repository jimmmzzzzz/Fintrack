/* ==========================================================================
   FinTrack — application logic
   Vanilla JS, LocalStorage persistence, Chart.js visualizations.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Constants & reference data
     ------------------------------------------------------------------ */

  const STORAGE_KEYS = {
    TX: 'fintrack_transactions',
    BUDGET: 'fintrack_budget',
    THEME: 'fintrack_theme',
    CURRENCY: 'fintrack_currency',
  };

  const CATEGORIES = [
    { id: 'salary', label: 'Salary', type: 'income', icon: '💼' },
    { id: 'freelance', label: 'Freelance', type: 'income', icon: '🧾' },
    { id: 'food', label: 'Food', type: 'expense', icon: '🍔' },
    { id: 'transport', label: 'Transport', type: 'expense', icon: '🚌' },
    { id: 'shopping', label: 'Shopping', type: 'expense', icon: '🛍️' },
    { id: 'entertainment', label: 'Entertainment', type: 'expense', icon: '🎬' },
    { id: 'bills', label: 'Bills', type: 'expense', icon: '💡' },
    { id: 'education', label: 'Education', type: 'expense', icon: '🎓' },
    { id: 'housing', label: 'Housing', type: 'expense', icon: '🏠' },
    { id: 'health', label: 'Health', type: 'expense', icon: '🩺' },
    { id: 'subscriptions', label: 'Subscriptions', type: 'expense', icon: '🔁' },
    { id: 'gifts', label: 'Gifts', type: 'expense', icon: '🎁' },
    { id: 'other', label: 'Other', type: 'both', icon: '✨' },
  ];
  const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === 'expense' || c.type === 'both');

  const CATEGORY_COLORS = {
    salary: '#34c495',
    freelance: '#4fd1c5',
    food: '#ef6f6c',
    transport: '#7c9cff',
    shopping: '#b18cf0',
    entertainment: '#e8a33d',
    bills: '#5c9eea',
    education: '#f2789a',
    housing: '#d4af6a',
    health: '#45b7aa',
    subscriptions: '#8a7cf0',
    gifts: '#e28b5b',
    other: '#8d97a8',
  };

  const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 13a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-1L16 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5v6M12 16.5h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8h.01M11.25 11h1.25v5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const VIEW_META = {
    dashboard: ['Dashboard', 'Your financial overview at a glance'],
    transactions: ['Transactions', 'Manage all your income and expenses'],
    analytics: ['Analytics', 'Visualize where your money goes'],
    budget: ['Budget', 'Set limits and track your spending'],
    settings: ['Settings', 'Control your currency, backups and local data'],
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */

  const state = {
    transactions: [],
    budget: 0,
    theme: 'dark',
    currency: 'NGN',
    currentView: 'dashboard',
    formType: 'expense',
    editingId: null,
    pendingDeleteId: null,
  };

  const charts = {};

  /* ------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------ */

  function formatCurrency(n) {
    if (!isFinite(n)) n = 0;
    const locale = state.currency === 'NGN' ? 'en-NG' : state.currency === 'GBP' ? 'en-GB' : state.currency === 'EUR' ? 'en-IE' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: state.currency, maximumFractionDigits: 2 }).format(n);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function monthLabelLong(d) {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function monthKeyOfDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function todayISO() {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 10);
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function sumByType(list, type) {
    return list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  }

  function sumByTypeForMonth(list, key, type) {
    return list.filter((t) => t.type === type && t.date.slice(0, 7) === key).reduce((s, t) => s + t.amount, 0);
  }

  function pctChange(curr, prev) {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  function getLastNMonths(n) {
    const arr = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({ key: monthKeyOfDate(d), label: d.toLocaleString('en-US', { month: 'short' }) });
    }
    return arr;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ------------------------------------------------------------------
     Seed data (realistic sample transactions, generated relative to today)
     ------------------------------------------------------------------ */

  function generateSeedData() {
    const tx = [];
    const now = new Date();

    const descriptions = {
      food: ["Whole Foods groceries", "Trader Joe's run", "Sunday brunch", "Blue Bottle coffee", "Thai takeout", "Farmers market produce", "Pizza night", "Sushi dinner", "Bagel shop breakfast"],
      transport: ['Uber ride', 'Gas station fill-up', 'Monthly transit pass', 'Parking garage', 'Car wash', 'Lyft to airport'],
      shopping: ['Amazon order', 'New running shoes', 'Winter jacket', 'Home decor', 'Electronics accessory', 'Bookstore haul'],
      entertainment: ['Movie tickets', 'Concert tickets', 'Netflix subscription', 'Spotify Premium', 'Bowling night', 'Museum admission'],
      bills: ['Electricity bill', 'Internet bill', 'Phone bill', 'Water bill', 'Gym membership', 'Insurance premium'],
      education: ['Online course', 'Textbooks', 'Bootcamp fee installment', 'Udemy course bundle', 'Language app subscription'],
      housing: ['Rent payment', 'Home repair', 'Household supplies'],
      health: ['Pharmacy', 'Doctor visit', 'Health checkup'],
      subscriptions: ['Streaming subscription', 'Cloud storage', 'Software subscription'],
      gifts: ['Birthday gift', 'Gift for a friend'],
      other: ['ATM cash withdrawal', 'Charity donation', 'Miscellaneous purchase'],
      salary: ['Monthly salary'],
      freelance: ['Freelance web project', 'Logo design gig', 'Freelance consulting', 'Contract dev work'],
    };

    function rand(min, max) { return Math.random() * (max - min) + min; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function dateStr(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    function push(type, category, description, amount, y, m, d) {
      tx.push({
        id: uid(),
        type,
        category,
        description,
        amount: Math.round(amount * 100) / 100,
        date: dateStr(y, m, d),
        createdAt: new Date(y, m, d).getTime() + Math.floor(Math.random() * 999),
      });
    }

    for (let mAgo = 5; mAgo >= 0; mAgo--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - mAgo, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const maxDay = mAgo === 0 ? Math.max(1, now.getDate()) : daysInMonth;
      const day = () => Math.max(1, Math.min(maxDay, Math.floor(rand(1, maxDay + 1))));

      push('income', 'salary', pick(descriptions.salary), rand(4100, 4650), year, month, Math.min(maxDay, 1));

      if (Math.random() < 0.7) {
        const n = Math.floor(rand(1, 3));
        for (let i = 0; i < n; i++) push('income', 'freelance', pick(descriptions.freelance), rand(150, 900), year, month, day());
      }

      push('expense', 'bills', 'Rent payment', rand(1150, 1300), year, month, Math.min(maxDay, 3));
      push('expense', 'bills', pick(descriptions.bills), rand(55, 140), year, month, Math.min(maxDay, 7));
      push('expense', 'bills', pick(descriptions.bills), rand(35, 65), year, month, Math.min(maxDay, 10));
      if (Math.random() < 0.6) push('expense', 'bills', pick(descriptions.bills), rand(25, 90), year, month, Math.min(maxDay, 14));

      const foodCount = Math.floor(rand(6, 11));
      for (let i = 0; i < foodCount; i++) push('expense', 'food', pick(descriptions.food), rand(7, 65), year, month, day());

      const transportCount = Math.floor(rand(3, 7));
      for (let i = 0; i < transportCount; i++) push('expense', 'transport', pick(descriptions.transport), rand(8, 55), year, month, day());

      const shopCount = Math.floor(rand(1, 4));
      for (let i = 0; i < shopCount; i++) push('expense', 'shopping', pick(descriptions.shopping), rand(18, 190), year, month, day());

      const entCount = Math.floor(rand(1, 4));
      for (let i = 0; i < entCount; i++) push('expense', 'entertainment', pick(descriptions.entertainment), rand(9, 75), year, month, day());

      if (Math.random() < 0.4) push('expense', 'education', pick(descriptions.education), rand(25, 260), year, month, day());
      if (Math.random() < 0.5) push('expense', 'other', pick(descriptions.other), rand(10, 90), year, month, day());
    }

    tx.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    return tx;
  }

  /* ------------------------------------------------------------------
     Persistence
     ------------------------------------------------------------------ */

  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TX);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('FinTrack: could not read stored transactions', e);
    }
    persistTransactions([]);
    return [];
  }
  function persistTransactions(list) {
    localStorage.setItem(STORAGE_KEYS.TX, JSON.stringify(list));
  }

  function loadBudget() {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (raw !== null) {
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
    const def = 0;
    localStorage.setItem(STORAGE_KEYS.BUDGET, String(def));
    return def;
  }
  function persistBudget(val) {
    localStorage.setItem(STORAGE_KEYS.BUDGET, String(val));
  }

  function loadTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  }
  function persistTheme(t) {
    localStorage.setItem(STORAGE_KEYS.THEME, t);
  }

  function loadCurrency() {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENCY);
    return ['NGN', 'USD', 'GBP', 'EUR', 'CAD'].includes(saved) ? saved : 'NGN';
  }
  function persistCurrency(currency) {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, currency);
  }

  /* ------------------------------------------------------------------
     DOM references
     ------------------------------------------------------------------ */

  const dom = {};

  function cacheDom() {
    const ids = [
      'sidebar', 'sidebarOverlay', 'hamburgerBtn', 'themeToggle', 'viewTitle', 'viewSubtitle',
      'globalSearch', 'addTransactionBtn',
      'statBalance', 'statBalanceDelta', 'statIncome', 'statIncomeDelta',
      'statExpenses', 'statExpensesDelta', 'statSavings', 'statSavingsDelta',
      'budgetMonthLabel', 'budgetMiniContent', 'recentTransactions',
      'filterType', 'filterCategory', 'filterMonth', 'sortBy', 'clearFiltersBtn', 'txCountLabel', 'txTable', 'txTableBody',
      'txEmptyState', 'emptyStateAddBtn',
      'currencySelect', 'storageSummary', 'storageDetail', 'exportDataBtn', 'importDataBtn', 'importDataFile',
      'loadSampleBtn', 'clearAllDataBtn',
      'categoryChartSub', 'categoryLegend',
      'budgetForm', 'budgetInput', 'budgetMonthLabel2', 'budgetDetailContent', 'budgetCategoryBreakdown',
      'modalOverlay', 'modalTitle', 'modalCloseBtn', 'txForm', 'txId', 'txAmount', 'txDescription',
      'txCategory', 'txDate', 'cancelTxBtn', 'saveTxBtn',
      'confirmOverlay', 'confirmBody', 'confirmCancelBtn', 'confirmDeleteBtn',
      'toastStack',
    ];
    ids.forEach((id) => { dom[id] = document.getElementById(id); });
  }

  /* ------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------ */

  function showToast(message, type) {
    type = type || 'info';
    const el = document.createElement('div');
    el.className = `toast is-${type}`;
    el.innerHTML = `<span class="toast__icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span><span class="toast__text">${escapeHtml(message)}</span>`;
    dom.toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  /* ------------------------------------------------------------------
     Number count-up animation (dashboard signature detail)
     ------------------------------------------------------------------ */

  function animateStat(el, value) {
    const prev = parseFloat(el.dataset.raw || '0');
    if (reduceMotion) {
      el.textContent = formatCurrency(value);
      el.dataset.raw = String(value);
      return;
    }
    const duration = 700;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = prev + (value - prev) * eased;
      el.textContent = formatCurrency(current);
      if (t < 1) requestAnimationFrame(frame);
      else { el.textContent = formatCurrency(value); el.dataset.raw = String(value); }
    }
    requestAnimationFrame(frame);
  }

  function setDeltaBadge(el, pct, opts) {
    opts = opts || {};
    const rounded = Math.round(Math.abs(pct));
    const isUp = pct >= 0;
    const goodDirection = opts.invertColor ? !isUp : isUp;
    el.classList.remove('is-positive', 'is-negative', 'is-down');
    el.classList.add(goodDirection ? 'is-positive' : 'is-negative');
    if (!isUp) el.classList.add('is-down');
    el.innerHTML = `<span class="delta-arrow">${isUp ? '↑' : '↓'}</span> ${rounded}% vs last month`;
  }

  /* ------------------------------------------------------------------
     Category select population
     ------------------------------------------------------------------ */

  function populateCategorySelect(selectEl, type, includeAllOption) {
    const prev = selectEl.value;
    selectEl.innerHTML = '';
    if (includeAllOption) {
      const opt = document.createElement('option');
      opt.value = 'all';
      opt.textContent = 'All categories';
      selectEl.appendChild(opt);
    }
    CATEGORIES
      .filter((c) => type === 'all' || c.type === type || c.type === 'both')
      .forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon}  ${c.label}`;
        selectEl.appendChild(opt);
      });
    if ([...selectEl.options].some((o) => o.value === prev)) selectEl.value = prev;
  }

  /* ------------------------------------------------------------------
     Row templates
     ------------------------------------------------------------------ */

  function emptyMiniState(msg) {
    return `<div class="empty-state" style="padding:32px 12px;"><p>${escapeHtml(msg)}</p></div>`;
  }

  function recentTxRowHTML(t) {
    const cat = CATEGORY_MAP[t.category] || { label: t.category, icon: '✨' };
    const sign = t.type === 'income' ? '+' : '−';
    return `<div class="tx-row">
      <span class="tx-row__icon is-${t.type}">${cat.icon}</span>
      <div class="tx-row__info">
        <div class="tx-row__desc">${escapeHtml(t.description)}</div>
        <div class="tx-row__meta">${escapeHtml(cat.label)} · ${formatDate(t.date)}</div>
      </div>
      <div class="tx-row__amount is-${t.type}">${sign} ${formatCurrency(t.amount)}</div>
    </div>`;
  }

  function txRowHTML(t) {
    const cat = CATEGORY_MAP[t.category] || { label: t.category, icon: '✨' };
    const color = CATEGORY_COLORS[t.category] || '#8d97a8';
    const sign = t.type === 'income' ? '+' : '−';
    return `<tr>
      <td><div class="tx-desc-cell">
        <span class="tx-row__icon is-${t.type}">${cat.icon}</span>
        <div class="tx-row__desc">${escapeHtml(t.description)}</div>
      </div></td>
      <td><span class="category-pill"><span class="legend-dot" style="background:${color}"></span>${escapeHtml(cat.label)}</span></td>
      <td>${formatDate(t.date)}</td>
      <td class="align-right amount-cell is-${t.type}">${sign} ${formatCurrency(t.amount)}</td>
      <td><div class="row-actions">
        <button class="edit-btn" data-id="${t.id}" type="button" aria-label="Edit transaction">${ICON_EDIT}</button>
        <button class="delete-btn" data-id="${t.id}" type="button" aria-label="Delete transaction">${ICON_TRASH}</button>
      </div></td>
    </tr>`;
  }

  /* ------------------------------------------------------------------
     Budget rendering
     ------------------------------------------------------------------ */

  function renderBudgetMini(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const monthKey = monthKeyOfDate(new Date());
    const spent = sumByTypeForMonth(state.transactions, monthKey, 'expense');
    const budget = state.budget;

    if (!budget || budget <= 0) {
      container.innerHTML = `<div class="empty-state" style="padding:20px 8px;">
        <p>No budget set yet. Head to the Budget page to set a monthly limit.</p>
      </div>`;
      return;
    }

    const pct = Math.min(100, (spent / budget) * 100);
    let stateClass = '';
    let note = '';
    if (pct < 70) {
      note = `You're on track — ${formatCurrency(Math.max(0, budget - spent))} left to spend.`;
    } else if (pct < 100) {
      stateClass = 'is-warning';
      note = `Careful — ${formatCurrency(Math.max(0, budget - spent))} left this month.`;
    } else {
      stateClass = 'is-danger';
      note = `Over budget by ${formatCurrency(spent - budget)}.`;
    }

    container.innerHTML = `
      <div class="budget-figures">
        <span class="label">Spent this month</span>
        <span class="value">${formatCurrency(spent)} <span style="color:var(--text-tertiary); font-weight:500; font-size:12.5px;">of ${formatCurrency(budget)}</span></span>
      </div>
      <div class="progress-track"><div class="progress-fill ${stateClass}" style="width:${pct}%"></div></div>
      <p class="budget-status-note ${stateClass}">${note}</p>
    `;
  }

  function renderBudgetCategoryBreakdown() {
    const el = dom.budgetCategoryBreakdown;
    const monthKey = monthKeyOfDate(new Date());
    const totals = {};
    EXPENSE_CATEGORIES.forEach((c) => { totals[c.id] = 0; });
    state.transactions
      .filter((t) => t.type === 'expense' && t.date.slice(0, 7) === monthKey)
      .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

    const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
      el.innerHTML = emptyMiniState('No spending recorded yet this month.');
      return;
    }
    const max = entries[0][1];
    el.innerHTML = entries.map(([catId, amt]) => {
      const cat = CATEGORY_MAP[catId];
      const pct = (amt / max) * 100;
      const color = CATEGORY_COLORS[catId] || '#8d97a8';
      return `<div class="budget-cat-row">
        <div class="top"><span class="name">${cat.icon} ${cat.label}</span><span class="amt">${formatCurrency(amt)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%; background:${color}"></div></div>
      </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
     View renderers
     ------------------------------------------------------------------ */

  function renderDashboard() {
    const totalIncomeAll = sumByType(state.transactions, 'income');
    const totalExpenseAll = sumByType(state.transactions, 'expense');
    const balance = totalIncomeAll - totalExpenseAll;

    const now = new Date();
    const thisKey = monthKeyOfDate(now);
    const lastKey = monthKeyOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const thisIncome = sumByTypeForMonth(state.transactions, thisKey, 'income');
    const lastIncome = sumByTypeForMonth(state.transactions, lastKey, 'income');
    const thisExpense = sumByTypeForMonth(state.transactions, thisKey, 'expense');
    const lastExpense = sumByTypeForMonth(state.transactions, lastKey, 'expense');
    const thisNet = thisIncome - thisExpense;
    const lastNet = lastIncome - lastExpense;

    animateStat(dom.statBalance, balance);
    animateStat(dom.statIncome, totalIncomeAll);
    animateStat(dom.statExpenses, totalExpenseAll);
    animateStat(dom.statSavings, thisNet);

    setDeltaBadge(dom.statBalanceDelta, pctChange(thisNet, lastNet));
    setDeltaBadge(dom.statIncomeDelta, pctChange(thisIncome, lastIncome));
    setDeltaBadge(dom.statExpensesDelta, pctChange(thisExpense, lastExpense), { invertColor: true });

    const savingsRate = thisIncome > 0 ? (thisNet / thisIncome) * 100 : 0;
    dom.statSavingsDelta.textContent = `${Math.round(savingsRate)}% of income saved this month`;
    dom.statSavingsDelta.classList.remove('is-positive', 'is-negative');
    dom.statSavingsDelta.classList.add(savingsRate >= 0 ? 'is-positive' : 'is-negative');

    const recent = state.transactions.slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, 6);
    dom.recentTransactions.innerHTML = recent.length
      ? recent.map(recentTxRowHTML).join('')
      : emptyMiniState('No transactions yet — add your first one to get started.');

    renderBudgetMini('budgetMiniContent');
    dom.budgetMonthLabel.textContent = monthLabelLong(now);
  }

  function getFilteredSortedTransactions() {
    const q = (dom.globalSearch.value || '').trim().toLowerCase();
    const typeVal = dom.filterType.value;
    const catVal = dom.filterCategory.value;
    const sortVal = dom.sortBy.value;
    const monthVal = dom.filterMonth ? dom.filterMonth.value : '';

    let list = state.transactions.slice();
    if (typeVal !== 'all') list = list.filter((t) => t.type === typeVal);
    if (catVal !== 'all') list = list.filter((t) => t.category === catVal);
    if (monthVal) list = list.filter((t) => t.date.slice(0, 7) === monthVal);
    if (q) {
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        (CATEGORY_MAP[t.category] && CATEGORY_MAP[t.category].label.toLowerCase().includes(q))
      );
    }

    switch (sortVal) {
      case 'date-asc': list.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt); break;
      case 'amount-desc': list.sort((a, b) => b.amount - a.amount); break;
      case 'amount-asc': list.sort((a, b) => a.amount - b.amount); break;
      default: list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    }
    return list;
  }

  function renderTransactionsView() {
    const list = getFilteredSortedTransactions();
    dom.txCountLabel.textContent = `${list.length} transaction${list.length === 1 ? '' : 's'}`;
    if (!list.length) {
      dom.txTableBody.innerHTML = '';
      dom.txTable.style.display = 'none';
      dom.txEmptyState.hidden = false;
    } else {
      dom.txTable.style.display = '';
      dom.txEmptyState.hidden = true;
      dom.txTableBody.innerHTML = list.map(txRowHTML).join('');
    }
  }

  function renderAnalyticsMeta() {
    dom.categoryChartSub.textContent = monthLabelLong(new Date());
  }

  function renderBudgetView() {
    dom.budgetInput.value = state.budget ? state.budget : '';
    dom.budgetMonthLabel2.textContent = `Updated live as you spend — ${monthLabelLong(new Date())}`;
    renderBudgetMini('budgetDetailContent');
    renderBudgetCategoryBreakdown();
  }

  function renderSettingsView() {
    if (dom.currencySelect) dom.currencySelect.value = state.currency;
    if (dom.storageSummary) dom.storageSummary.textContent = 'Local storage active';
    if (dom.storageDetail) {
      const bytes = new Blob([
        localStorage.getItem(STORAGE_KEYS.TX) || '',
        localStorage.getItem(STORAGE_KEYS.BUDGET) || '',
        localStorage.getItem(STORAGE_KEYS.CURRENCY) || ''
      ]).size;
      const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
      dom.storageDetail.textContent = `${state.transactions.length} transaction${state.transactions.length === 1 ? '' : 's'} saved · about ${size}`;
    }
  }

  function renderAll() {
    renderDashboard();
    renderTransactionsView();
    renderAnalyticsMeta();
    renderBudgetView();
    renderSettingsView();
    refreshVisibleCharts();
  }

  /* ------------------------------------------------------------------
     Charts
     ------------------------------------------------------------------ */

  function setupChartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;
  }

  function upsertChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(canvas, config);
  }

  function renderIncomeExpenseChart(canvasId, compact) {
    const months = getLastNMonths(6);
    const income = months.map((m) => sumByTypeForMonth(state.transactions, m.key, 'income'));
    const expense = months.map((m) => sumByTypeForMonth(state.transactions, m.key, 'expense'));
    const textSecondary = cssVar('--text-secondary');
    const borderSubtle = cssVar('--border-subtle');
    const positive = cssVar('--positive');
    const negative = cssVar('--negative');

    upsertChart(canvasId, {
      type: 'bar',
      data: {
        labels: months.map((m) => m.label),
        datasets: [
          { label: 'Income', data: income, backgroundColor: positive, borderRadius: 6, maxBarThickness: compact ? 16 : 26 },
          { label: 'Expenses', data: expense, backgroundColor: negative, borderRadius: 6, maxBarThickness: compact ? 16 : 26 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !compact,
            position: 'top',
            align: 'end',
            labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', color: textSecondary, padding: 16 },
          },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textSecondary } },
          y: {
            grid: { color: borderSubtle },
            ticks: {
              color: textSecondary,
              maxTicksLimit: compact ? 4 : 6,
              callback: (v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v),
            },
          },
        },
      },
    });
  }

  function renderCategoryChart() {
    const monthKey = monthKeyOfDate(new Date());
    const totals = {};
    EXPENSE_CATEGORIES.forEach((c) => { totals[c.id] = 0; });
    state.transactions
      .filter((t) => t.type === 'expense' && t.date.slice(0, 7) === monthKey)
      .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

    const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    if (!entries.length) {
      upsertChart('chartCategory', {
        type: 'doughnut',
        data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: [cssVar('--border')], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { enabled: false } } },
      });
      dom.categoryLegend.innerHTML = `<p style="color:var(--text-tertiary); font-size:12.5px;">No expenses recorded yet this month.</p>`;
      return;
    }

    upsertChart('chartCategory', {
      type: 'doughnut',
      data: {
        labels: entries.map(([id]) => CATEGORY_MAP[id].label),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([id]) => CATEGORY_COLORS[id]),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } },
        },
      },
    });

    dom.categoryLegend.innerHTML = entries.map(([id, amt]) => {
      const cat = CATEGORY_MAP[id];
      const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
      return `<div class="legend-item"><span class="legend-dot" style="background:${CATEGORY_COLORS[id]}"></span>${cat.label} — <strong>${formatCurrency(amt)}</strong> (${pct}%)</div>`;
    }).join('');
  }

  function renderTrendChart() {
    const months = getLastNMonths(6);
    const totals = months.map((m) => sumByTypeForMonth(state.transactions, m.key, 'expense'));
    const textSecondary = cssVar('--text-secondary');
    const borderSubtle = cssVar('--border-subtle');
    const violet = cssVar('--violet');

    upsertChart('chartTrend', {
      type: 'line',
      data: {
        labels: months.map((m) => m.label),
        datasets: [{
          label: 'Expenses',
          data: totals,
          borderColor: violet,
          backgroundColor: 'rgba(177,140,240,0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: violet,
          pointBorderColor: violet,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `Expenses: ${formatCurrency(ctx.raw)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textSecondary } },
          y: {
            grid: { color: borderSubtle },
            ticks: { color: textSecondary, maxTicksLimit: 6, callback: (v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v) },
          },
        },
      },
    });
  }

  function refreshVisibleCharts() {
    if (!window.Chart) return;
    if (state.currentView === 'dashboard') {
      renderIncomeExpenseChart('chartIncomeExpenseMini', true);
    }
    if (state.currentView === 'analytics') {
      renderIncomeExpenseChart('chartIncomeExpense', false);
      renderCategoryChart();
      renderTrendChart();
    }
  }

  /* ------------------------------------------------------------------
     View switching / sidebar
     ------------------------------------------------------------------ */

  function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('is-active'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('is-active');
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('is-active', n.dataset.view === view));
    const meta = VIEW_META[view] || VIEW_META.dashboard;
    dom.viewTitle.textContent = meta[0];
    dom.viewSubtitle.textContent = meta[1];
    closeSidebar();
    refreshVisibleCharts();
  }

  function openSidebar() {
    dom.sidebar.classList.add('is-open');
    dom.sidebarOverlay.classList.add('is-open');
  }
  function closeSidebar() {
    dom.sidebar.classList.remove('is-open');
    dom.sidebarOverlay.classList.remove('is-open');
  }

  /* ------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------ */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const label = dom.themeToggle.querySelector('.theme-toggle__label');
    if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    persistTheme(state.theme);
    refreshVisibleCharts();
  }

  /* ------------------------------------------------------------------
     Transaction modal
     ------------------------------------------------------------------ */

  function setFormType(type) {
    state.formType = type;
    document.querySelectorAll('.type-toggle__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.type === type));
    populateCategorySelect(dom.txCategory, type, false);
  }

  function clearFormErrors() {
    document.querySelectorAll('#txForm .field').forEach((f) => f.classList.remove('has-error'));
  }

  function openAddModal() {
    state.editingId = null;
    dom.txId.value = '';
    dom.txForm.reset();
    clearFormErrors();
    setFormType('expense');
    dom.txDate.value = todayISO();
    dom.modalTitle.textContent = 'Add transaction';
    dom.saveTxBtn.textContent = 'Add transaction';
    openModal();
  }

  function openEditModal(id) {
    const t = state.transactions.find((tx) => tx.id === id);
    if (!t) return;
    state.editingId = id;
    dom.txId.value = id;
    clearFormErrors();
    setFormType(t.type);
    dom.txAmount.value = t.amount;
    dom.txDescription.value = t.description;
    dom.txCategory.value = t.category;
    dom.txDate.value = t.date;
    dom.modalTitle.textContent = 'Edit transaction';
    dom.saveTxBtn.textContent = 'Save changes';
    openModal();
  }

  function openModal() {
    dom.modalOverlay.classList.add('is-open');
    setTimeout(() => dom.txAmount.focus(), 50);
  }
  function closeModal() {
    dom.modalOverlay.classList.remove('is-open');
  }

  function toggleFieldError(fieldEl, hasError) {
    if (fieldEl) fieldEl.classList.toggle('has-error', !!hasError);
  }

  function validateForm() {
    let valid = true;
    const amount = parseFloat(dom.txAmount.value);
    const amountBad = !(amount > 0);
    toggleFieldError(dom.txAmount.closest('.field'), amountBad);
    if (amountBad) valid = false;

    const desc = dom.txDescription.value.trim();
    const descBad = desc.length < 2;
    toggleFieldError(dom.txDescription.closest('.field'), descBad);
    if (descBad) valid = false;

    const catBad = !dom.txCategory.value;
    toggleFieldError(dom.txCategory.closest('.field'), catBad);
    if (catBad) valid = false;

    const dateBad = !dom.txDate.value;
    toggleFieldError(dom.txDate.closest('.field'), dateBad);
    if (dateBad) valid = false;

    return valid;
  }

  function handleTxSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const amount = Math.round(parseFloat(dom.txAmount.value) * 100) / 100;
    const description = dom.txDescription.value.trim();
    const category = dom.txCategory.value;
    const date = dom.txDate.value;

    if (state.editingId) {
      const idx = state.transactions.findIndex((t) => t.id === state.editingId);
      if (idx !== -1) {
        state.transactions[idx] = { ...state.transactions[idx], type: state.formType, amount, description, category, date };
      }
      showToast('Transaction updated.', 'success');
    } else {
      state.transactions.unshift({ id: uid(), type: state.formType, amount, description, category, date, createdAt: Date.now() });
      showToast('Transaction added.', 'success');
    }

    persistTransactions(state.transactions);
    closeModal();
    renderAll();
  }

  /* ------------------------------------------------------------------
     Delete confirmation
     ------------------------------------------------------------------ */

  function openConfirm(id) {
    const t = state.transactions.find((tx) => tx.id === id);
    state.pendingDeleteId = id;
    dom.confirmBody.textContent = t
      ? `"${t.description}" (${formatCurrency(t.amount)}) will be permanently removed from your records.`
      : "This action can't be undone.";
    dom.confirmOverlay.classList.add('is-open');
  }
  function closeConfirm() {
    dom.confirmOverlay.classList.remove('is-open');
    state.pendingDeleteId = null;
  }
  function handleConfirmDelete() {
    if (!state.pendingDeleteId) return;
    state.transactions = state.transactions.filter((t) => t.id !== state.pendingDeleteId);
    persistTransactions(state.transactions);
    closeConfirm();
    renderAll();
    showToast('Transaction deleted.', 'success');
  }

  /* ------------------------------------------------------------------
     Budget form
     ------------------------------------------------------------------ */

  function handleBudgetSubmit(e) {
    e.preventDefault();
    const val = parseFloat(dom.budgetInput.value);
    if (isNaN(val) || val < 0) {
      showToast('Enter a valid budget amount.', 'error');
      return;
    }
    state.budget = val;
    persistBudget(val);
    renderAll();
    showToast('Budget updated.', 'success');
  }

  /* ------------------------------------------------------------------
     Event delegation for row actions
     ------------------------------------------------------------------ */

  function handleDocumentClick(e) {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) { openEditModal(editBtn.dataset.id); return; }
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) { openConfirm(deleteBtn.dataset.id); return; }
  }


  /* ------------------------------------------------------------------
     Local data tools
     ------------------------------------------------------------------ */

  function exportBackup() {
    const payload = {
      app: 'FinTrack',
      version: 2,
      exportedAt: new Date().toISOString(),
      currency: state.currency,
      budget: state.budget,
      transactions: state.transactions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Backup exported.', 'success');
  }

  function validateImportedTransactions(list) {
    if (!Array.isArray(list)) return false;
    return list.every((t) =>
      t && typeof t.id === 'string' &&
      ['income', 'expense'].includes(t.type) &&
      Number.isFinite(Number(t.amount)) &&
      typeof t.description === 'string' &&
      typeof t.category === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.date)
    );
  }

  async function importBackupFile(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload || !validateImportedTransactions(payload.transactions)) throw new Error('Invalid FinTrack backup');
      state.transactions = payload.transactions.map((t) => ({ ...t, amount: Number(t.amount), createdAt: Number(t.createdAt) || Date.now() }));
      state.budget = Number.isFinite(Number(payload.budget)) ? Math.max(0, Number(payload.budget)) : 0;
      if (['NGN', 'USD', 'GBP', 'EUR', 'CAD'].includes(payload.currency)) state.currency = payload.currency;
      persistTransactions(state.transactions);
      persistBudget(state.budget);
      persistCurrency(state.currency);
      renderAll();
      showToast('Backup imported successfully.', 'success');
    } catch (err) {
      console.warn('FinTrack import failed', err);
      showToast('That file is not a valid FinTrack backup.', 'error');
    } finally {
      dom.importDataFile.value = '';
    }
  }

  function loadSampleData() {
    if (state.transactions.length && !window.confirm('Replace your current transactions with sample data? Export a backup first if needed.')) return;
    state.transactions = generateSeedData();
    persistTransactions(state.transactions);
    renderAll();
    showToast('Sample data loaded. You can clear it anytime.', 'success');
  }

  function clearAllFinanceData() {
    if (!window.confirm('Clear all transactions and your budget from this browser? This cannot be undone unless you exported a backup.')) return;
    state.transactions = [];
    state.budget = 0;
    persistTransactions([]);
    persistBudget(0);
    renderAll();
    showToast('Finance data cleared. Your ledger will stay empty.', 'success');
  }

  function clearTransactionFilters() {
    dom.filterType.value = 'all';
    dom.filterCategory.value = 'all';
    dom.filterMonth.value = '';
    dom.sortBy.value = 'date-desc';
    dom.globalSearch.value = '';
    renderTransactionsView();
  }

  /* ------------------------------------------------------------------
     Event binding
     ------------------------------------------------------------------ */

  function bindEvents() {
    dom.hamburgerBtn.addEventListener('click', openSidebar);
    dom.sidebarOverlay.addEventListener('click', closeSidebar);

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.querySelectorAll('[data-view-link]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.viewLink));
    });

    dom.themeToggle.addEventListener('click', toggleTheme);

    dom.addTransactionBtn.addEventListener('click', openAddModal);
    dom.emptyStateAddBtn.addEventListener('click', openAddModal);
    dom.modalCloseBtn.addEventListener('click', closeModal);
    dom.cancelTxBtn.addEventListener('click', closeModal);
    dom.modalOverlay.addEventListener('click', (e) => { if (e.target === dom.modalOverlay) closeModal(); });
    dom.txForm.addEventListener('submit', handleTxSubmit);

    document.querySelectorAll('.type-toggle__btn').forEach((btn) => {
      btn.addEventListener('click', () => setFormType(btn.dataset.type));
    });

    dom.confirmCancelBtn.addEventListener('click', closeConfirm);
    dom.confirmOverlay.addEventListener('click', (e) => { if (e.target === dom.confirmOverlay) closeConfirm(); });
    dom.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

    document.body.addEventListener('click', handleDocumentClick);

    dom.filterType.addEventListener('change', renderTransactionsView);
    dom.filterCategory.addEventListener('change', renderTransactionsView);
    dom.filterMonth.addEventListener('change', renderTransactionsView);
    dom.sortBy.addEventListener('change', renderTransactionsView);
    dom.clearFiltersBtn.addEventListener('click', clearTransactionFilters);
    dom.globalSearch.addEventListener('input', () => {
      if (state.currentView !== 'transactions') switchView('transactions');
      renderTransactionsView();
    });

    dom.budgetForm.addEventListener('submit', handleBudgetSubmit);

    dom.currencySelect.addEventListener('change', () => {
      state.currency = dom.currencySelect.value;
      persistCurrency(state.currency);
      renderAll();
      showToast(`Currency changed to ${state.currency}.`, 'success');
    });
    dom.exportDataBtn.addEventListener('click', exportBackup);
    dom.importDataBtn.addEventListener('click', () => dom.importDataFile.click());
    dom.importDataFile.addEventListener('change', () => importBackupFile(dom.importDataFile.files[0]));
    dom.loadSampleBtn.addEventListener('click', loadSampleData);
    dom.clearAllDataBtn.addEventListener('click', clearAllFinanceData);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closeConfirm(); closeSidebar(); }
    });

    window.addEventListener('resize', () => {
      // Chart.js handles internal responsiveness; nothing extra required.
    });
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */

  function init() {
    cacheDom();

    state.theme = loadTheme();
    applyTheme(state.theme);
    state.currency = loadCurrency();

    state.transactions = loadTransactions();
    state.budget = loadBudget();

    setupChartDefaults();
    bindEvents();

    populateCategorySelect(dom.filterCategory, 'all', true);
    populateCategorySelect(dom.txCategory, state.formType, false);
    dom.txDate.value = todayISO();

    switchView('dashboard');
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
