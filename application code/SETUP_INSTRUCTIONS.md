# CIS 5500 Project — Setup Instructions

## Project Structure
```
project/
  server/
    index.js        ← Express routes
    db.js           ← PostgreSQL connection pool
    package.json
    .env            ← Your credentials (create from .env.example)
  client/
    src/
      App.js        ← React frontend
      index.js
    public/
      index.html
    package.json
```

---

## Step 1: Set up the server

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and fill in your AWS RDS credentials:
```
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
SERVER_PORT=8080
```

Start the server:
```bash
npm run dev     # development (auto-restarts on changes)
# or
npm start       # production
```

Test it: open http://localhost:8080/countries in your browser — you should see a JSON list of countries.

---

## Step 2: Set up the client

```bash
cd client
npm install
npm start
```

The React app will open at http://localhost:3000.
The `"proxy": "http://localhost:8080"` line in client/package.json
automatically forwards API calls to your backend — no CORS issues.

---

## API Routes

| Route | Description |
|-------|-------------|
| `GET /countries` | All countries |
| `GET /trade?country=USA&year=2020` | Trade flows (both params optional) |
| `GET /employment?country=USA&year=2020` | Employment data (both params optional) |

---

## Important: Add your .env to .gitignore

Create a `.gitignore` in the server folder:
```
node_modules/
.env
```

DON'T COMMIT database password to GitHub!!!!!!!!!
