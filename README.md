# FinTrack — Personal Finance Dashboard

FinTrack is a premium, SaaS-style personal finance dashboard built entirely with vanilla HTML, CSS, and JavaScript. It lets you track income and expenses, visualize spending patterns, and manage a monthly budget — all stored locally in your browser, with no backend, no build step, and no framework.

It's designed as a portfolio-grade front-end project: a dark-themed dashboard with a ledger-inspired gold accent, tabular numerals for financial data, animated stat counters, and a fully responsive layout from desktop down to mobile.

---

## Features

### Dashboard
- Total balance, total income, total expenses, and current-month savings, each with month-over-month percentage change
- Animated, count-up stat values
- Mini income vs. expenses chart
- Live budget progress card
- Recent transactions feed

### Transactions
- Add, edit, and delete transactions
- Toggle between Income and Expense
- Amount, description, category, and date fields with inline validation
- Search by description or category
- Filter by type (income/expense) and category
- Sort by newest, oldest, or amount
- Confirmation dialog before deleting
- Empty states for no data / no search results

### Categories
Salary · Freelance · Food · Transport · Shopping · Entertainment · Bills · Education · Other

### Analytics (Chart.js)
- **Income vs. Expenses** — grouped bar chart, last 6 months
- **Spending by Category** — doughnut chart with a percentage legend, current month
- **Spending Trend** — line chart of monthly expenses over time

All charts update automatically whenever a transaction is added, edited, or deleted.

### Budget
- Set a monthly spending limit
- Live progress bar (on-track / warning / over-budget states)
- Category-by-category breakdown of the current month's spending

### Extras
- Dark / light mode toggle (persisted)
- Toast notifications for every action
- Realistic sample transactions seeded on first load
- Responsive sidebar navigation with an off-canvas mobile drawer
- Currency formatting via `Intl.NumberFormat`
- Full LocalStorage persistence — your data survives a refresh or browser restart

---

## Technologies used

| Tech | Purpose |
|---|---|
| HTML5 | Semantic structure |
| CSS3 | Custom design system (CSS variables, grid, flexbox, animations) — no CSS framework |
| Vanilla JavaScript (ES6+) | All app logic, state management, and rendering |
| [Chart.js](https://www.chartjs.org/) | Bar, doughnut, and line charts |
| LocalStorage | Client-side data persistence |
| Google Fonts | Space Grotesk (display), Inter (body), IBM Plex Mono (financial figures) |

No build tools, bundlers, or frameworks are required.

---

## How to run locally

1. Download or clone this folder.
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, or Safari).

That's it — there's no server, no `npm install`, and no build step. For the best experience (and to avoid any browser restrictions on local file access), you can optionally serve it with a simple static server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then visit `http://localhost:8080`.

The first time you open the app, it seeds realistic sample transactions and a sample monthly budget so the dashboard and charts aren't empty. Everything you add, edit, or delete afterward is saved to your browser's LocalStorage.

---

## Project structure

```
fintrack/
├── index.html      # Markup for all views (dashboard, transactions, analytics, budget)
├── style.css        # Design tokens + full styling, dark/light themes, responsive layout
├── script.js         # App state, rendering, chart logic, LocalStorage persistence
└── README.md
```

---

## Screenshots

> _Add screenshots of the Dashboard, Transactions, Analytics, and Budget views here before publishing to GitHub — e.g._
>
> `![Dashboard](screenshots/dashboard.png)`
> `![Transactions](screenshots/transactions.png)`
> `![Analytics](screenshots/analytics.png)`
> `![Budget](screenshots/budget.png)`

---

## Future improvements

- Multi-currency support with live exchange rates
- Export transactions to CSV / PDF
- Recurring transaction rules (auto-add rent, subscriptions, etc.)
- Multiple accounts / wallets
- Custom, user-defined categories with icon and color pickers
- Data import (CSV / bank statement)
- Optional cloud sync / account system for cross-device access
- Yearly view and custom date-range filtering in Analytics

---

Built as a front-end portfolio project. Feedback and pull requests welcome.
