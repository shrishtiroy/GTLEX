# GTLEX: Global Trade & Labor Explorer

GTLEX is an interactive web application that combines international trade data (UN Comtrade) with labor market data (ILOSTAT) so users can explore how export structure, trade value, and employment composition relate across countries and over time. The application centers on questions that are difficult to answer when trade and labor datasets remain separate: whether manufacturing-heavy labor markets correspond to manufactured exports, which countries dominate specific commodity categories, and which countries structurally transformed their export baskets over a decade.

CIS 5500 Final Project — Shrishti Roy, Alex Kim, Mel Han, Joshua Ahn.

## Repository structure

```
550_project/
├── README.md                       This file
├── requirements.txt                Python dependencies for the data pipeline
├── .gitignore
├── data_preprocessing.ipynb        Cleans/wrangles the raw CSVs into load-ready tables
└── application code/
    ├── SETUP_INSTRUCTIONS.md       Detailed local-run notes (referenced from this README)
    ├── server/                     Node.js + Express backend
    │   ├── index.js                REST API routes (10 endpoints)
    │   ├── db.js                   PostgreSQL connection pool
    │   ├── package.json            Backend dependency manifest
    │   └── .env.example            Template for DB credentials (copy to .env)
    └── client/                     React frontend
        ├── src/
        │   ├── App.js              Main application + page components
        │   └── index.js
        ├── public/index.html
        └── package.json            Frontend dependency manifest
```

`node_modules/` directories are intentionally omitted from this submission — `npm install` regenerates them from the `package.json` manifests.

## Dependencies

### Backend (Node.js, see `application code/server/package.json`)
- `express` ^4.18.3 — HTTP server and routing
- `pg` ^8.11.3 — PostgreSQL client
- `cors` ^2.8.5 — cross-origin support for the React dev server
- `dotenv` ^16.4.5 — loads `.env` credentials at startup
- `nodemon` ^3.1.0 (dev) — auto-restarts the server on file changes

### Frontend (Node.js, see `application code/client/package.json`)
- `react` ^18.2.0, `react-dom` ^18.2.0
- `react-scripts` 5.0.1 — Create React App build/dev tooling
- `recharts` ^2.12.7 — chart components for the visualization layer

### Data pipeline (Python, see `requirements.txt`)
- `pandas` — primary data wrangling library
- `numpy` — numerical support
- `scipy` — used for distribution statistics during cleaning

The `data_preprocessing.ipynb` notebook also imports `glob`, `os`, and `pathlib` (Python standard library, no install needed). The `from google.colab import drive` line is only used when running the notebook in Google Colab and can be skipped in a local Jupyter environment.

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (for the data pipeline only)
- Access to a PostgreSQL 13+ database — we deployed to AWS RDS

## How to run locally

### 1. Database

Provision a PostgreSQL instance and load the cleaned tables from `data_preprocessing.ipynb`. The schema consists of four dimension tables (`country`, `year`, `hs_commodity`, `isic_sector`), one crosswalk (`commodity_sector_mapping`), and two fact tables (`trade_flow`, `employment_fact`). Final cleaned row counts are 101,811 trade rows and 146,731 employment rows covering 209 countries from 1995 to 2025.

### 2. Backend server

```bash
cd "application code/server"
npm install
cp .env.example .env       # then edit .env with your real DB credentials
npm run dev                # development (auto-restart) — or: npm start
```

Server starts on `http://localhost:8080`. Smoke test: `curl http://localhost:8080/api/countries` should return a JSON list of 209 countries.

### 3. Frontend

In a second terminal:

```bash
cd "application code/client"
npm install
npm start
```

The React app opens at `http://localhost:3000`. The `"proxy"` field in `client/package.json` forwards `/api/*` requests to the backend on port 8080, so you do not need to configure CORS or a separate base URL during development.

### 4. (Optional) Re-running the data pipeline

```bash
pip install -r requirements.txt
jupyter notebook data_preprocessing.ipynb
```

The notebook reads raw UN Comtrade CSVs and the ILOSTAT bulk download, performs the cleaning and entity-resolution steps described in §2 and §3 of the project report, and writes the cleaned tables that get loaded into PostgreSQL.

## API routes

| Route | Page | Description |
|---|---|---|
| `GET /api/countries` | dropdowns | List of 209 countries with region |
| `GET /api/sectors` | dropdowns | 21 ISIC sectors |
| `GET /api/years` | dropdowns | Available trade years |
| `GET /api/hs-chapters` | dropdowns | HS chapters loaded |
| `GET /api/hs-sections` | dropdowns | HS sections for top-exporters |
| `GET /api/alignment` | Specialization | Q1 — export HHI vs labor HHI alignment |
| `GET /api/export-flip` | Specialization | Q2 — countries that flipped top sector |
| `GET /api/chapter-momentum` | Specialization | Q3 — HS chapter world-share momentum |
| `GET /api/hhi-concentration` | Export Composition | Q4 — decade-over-decade HHI |
| `GET /api/top-exporters` | Home | Q5 — top exporters by sector and year |
| `GET /api/trade-totals/:country/:year` | Trade Totals | Import/export totals |
| `GET /api/employment/:country/:year` | Trade vs. Employment | Employment by ISIC sector |
| `GET /api/export-diversity` | Export Composition | Shannon entropy by country-year |
| `GET /api/export-momentum` | Export Composition | YoY export growth rankings |
| `GET /api/trade-balance/:country/:year` | Trade Totals | Sector-level net exporter/importer |

Routes 1–4 (`/api/alignment`, `/api/export-flip`, `/api/chapter-momentum`, `/api/hhi-concentration`) are the four complex queries described in §4 of the project report.

## Notes for graders

- The `.env.example` file in `application code/server/` shows the expected configuration shape. No real credentials are committed.
- `application code/SETUP_INSTRUCTIONS.md` contains the original step-by-step setup notes the team used during development; this README supersedes it but keeps it for reference.
- Performance evaluation, ER diagram, and full query catalog are in the accompanying project report.
