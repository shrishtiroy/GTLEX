const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');

const app = express();
const PORT = process.env.SERVER_PORT || 8080;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------
// Health check — confirm server is running
// GET /
// -------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ message: 'CIS 5500 API is running' });
});

// -------------------------------------------------------
// Route 1: Get all countries
// GET /countries
// -------------------------------------------------------
app.get('/countries', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT country_code, country_name FROM country ORDER BY country_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// -------------------------------------------------------
// Route 2: Get trade flow summary by country and year
// GET /trade?country=USA&year=2020
// -------------------------------------------------------
app.get('/trade', async (req, res) => {
  const { country, year } = req.query;

  let query = `
    SELECT
      tf.country_code,
      c.country_name,
      tf.year,
      tf.trade_flow,
      tf.hs_chapter,
      tf.trade_value_usd
    FROM trade_flow tf
    JOIN country c ON tf.country_code = c.country_code
    WHERE 1=1
  `;
  const params = [];

  if (country) {
    params.push(country);
    query += ` AND tf.country_code = $${params.length}`;
  }
  if (year) {
    params.push(parseInt(year));
    query += ` AND tf.year = $${params.length}`;
  }

  query += ' ORDER BY tf.year DESC, tf.trade_value_usd DESC LIMIT 100';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// -------------------------------------------------------
// Route 3: Get employment data by country and year
// GET /employment?country=USA&year=2020
// -------------------------------------------------------
app.get('/employment', async (req, res) => {
  const { country, year } = req.query;

  let query = `
    SELECT
      ef.country_code,
      c.country_name,
      ef.year,
      ef.sex,
      ef.isic_section,
      i.section_name,
      ef.employment_thousands,
      ef.data_quality_flag
    FROM employment_fact ef
    JOIN country c ON ef.country_code = c.country_code
    JOIN isic_sector i ON ef.isic_section = i.isic_section
    WHERE 1=1
  `;
  const params = [];

  if (country) {
    params.push(country);
    query += ` AND ef.country_code = $${params.length}`;
  }
  if (year) {
    params.push(parseInt(year));
    query += ` AND ef.year = $${params.length}`;
  }

  query += ' ORDER BY ef.year DESC, ef.employment_thousands DESC LIMIT 100';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// -------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
