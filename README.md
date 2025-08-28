# Personal Finance & Loans - Prototype

This is a small React + Vite prototype for personal finance tracking (transactions, bank-wise balances, loans & installments) that runs entirely in the browser using localStorage.

## What's included
- `index.html` — entry, includes Tailwind CDN for quick styling.
- `src/main.jsx` — app bootstrap.
- `src/App.jsx` — main React app (dashboard, transactions, banks, loans, reports).
- `src/styles.css` — small CSS file.
- `package.json` — scripts and dependencies.

## Requirements
- Node.js (v18+ recommended)
- npm

## Run locally
1. Extract the project folder.
2. Open terminal in the project directory.
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the URL shown by Vite (usually http://localhost:5173).

## Build for production
```bash
npm run build
npm run preview
```

## Notes & next steps
- Data is stored in browser `localStorage` (key: `pfm_prototype_v1`). Clearing browser storage will remove data.
- To persist data across devices, you'll need a backend (Node + MongoDB) and API endpoints; I can help wire that up.
- Tailwind is included via CDN for convenience. For production, integrate Tailwind properly.

