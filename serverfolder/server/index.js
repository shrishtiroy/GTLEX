const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');

const app = express();
const PORT = process.env.SERVER_PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'CIS 5500 API is running' });
});


app.get('/api/countries', async (req, res) => {
  // Optimization: WHERE clause is appended only when `region` is supplied, and the
  // value is bound as a parameter so PG can cache the plan.
  // Worse alternative: always emitting `WHERE region = $1 OR $1 IS NULL`, which
  // disables index use on `region`, or string-concatenating the value (no plan
  // cache + SQL injection risk).
  const { region } = req.query;
  let query = 'SELECT country_code, country_name, region FROM country';
  const params = [];
  if (region) { params.push(region); query += ` WHERE region = $1`; }
  query += ' ORDER BY country_name';
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/sectors', async (req, res) => {
  // Optimization: tiny lookup table; ORDER BY uses the PK so no real sort cost.
  // Worse alternative: `SELECT *` would pull unused columns over the wire.
  try {
    const result = await pool.query(
      'SELECT isic_section, section_name FROM isic_sector ORDER BY isic_section'
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/years', async (req, res) => {
  // Optimization: DISTINCT on a single indexed column lets PG use an
  // index-only scan / loose-index scan rather than a full table scan + hash agg.
  // Worse alternative: `SELECT year FROM trade_flow GROUP BY year` materialises
  // a hash aggregate over every row in the fact table.
  try {
    const result = await pool.query('SELECT DISTINCT year FROM trade_flow ORDER BY year');
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// List all distinct HS chapters for the chapter-momentum dropdown
app.get('/api/hs-chapters', async (req, res) => {
  // Optimization: read directly from the small `hs_commodity` dimension table
  // (one row per chapter), already keyed by hs_code.
  // Worse alternative: `SELECT DISTINCT hs_chapter FROM trade_flow` — would scan
  // the entire fact table just to recover the dimension.
  try {
    const result = await pool.query(
      'SELECT hs_code, hs_description FROM hs_commodity ORDER BY hs_code'
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// GET /api/hs-sections — all HS sections for the top-exporters dropdown
app.get('/api/hs-sections', async (req, res) => {
  // Optimization: small dimension table, sorted by PK -> effectively a free scan.
  // Worse alternative: deriving sections by joining `trade_flow -> hs_commodity
  // -> hs_section` and DISTINCT-ing, which would touch the fact table needlessly.
  try {
    const result = await pool.query(
      'SELECT hs_section, section_label FROM hs_section ORDER BY hs_section'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

//  COMPLEX QUERY ROUTES (1-4)

// Route 1: GET /api/alignment
// Params: start_year, end_year, region
//
// Optimizations:
//  - Per-country/year share is computed in a single scan via a window function
//    `SUM(SUM(...)) OVER (PARTITION BY country_code, year)`, so the denominator
//    is found in the same pass as the numerator.
//  - `trade_flow='X'` and `IS NOT NULL` predicates are pushed into the CTE so
//    we never aggregate rows we'd later discard.
//  - Two narrow CTEs (one per HHI) joined once on (country_code, year), keeping
//    the join input tiny; RANK() runs over that small joined set.
//  - Year/region filters live on the OUTER select so the heavy CTEs stay
//    parameter-free and PG can reuse the plan shape.
//
// Worse alternative: a correlated subquery to compute each country's yearly total
// (re-scanning trade_flow per row), then a self-join between exports and labor
// before any aggregation — quadratic blow-up plus a giant sort for the rank.
app.get('/api/alignment', async (req, res) => {
  const { start_year = 2005, end_year, region } = req.query;
  const params = [parseInt(start_year)];

  let yearFilter = 'AND e.year >= $1';
  if (end_year) {
    params.push(parseInt(end_year));
    yearFilter += ` AND e.year <= $${params.length}`;
  }
  let regionFilter = '';
  if (region) {
    params.push(region);
    regionFilter = `AND c.region = $${params.length}`;
  }

  const query = `
    WITH export_hhi AS (
      SELECT country_code, year,
        SUM(POWER(chapter_share, 2)) AS export_hhi
      FROM (
        SELECT country_code, year, hs_chapter,
          SUM(trade_value_usd) / NULLIF(
            SUM(SUM(trade_value_usd)) OVER (PARTITION BY country_code, year), 0
          ) AS chapter_share
        FROM trade_flow
        WHERE trade_flow = 'X' AND trade_value_usd IS NOT NULL
        GROUP BY country_code, year, hs_chapter
      ) s
      GROUP BY country_code, year
    ),
    labor_hhi AS (
      SELECT country_code, year,
        SUM(POWER(sector_share, 2)) AS labor_hhi
      FROM (
        SELECT country_code, year, isic_section,
          employment_thousands / NULLIF(
            SUM(employment_thousands) OVER (PARTITION BY country_code, year), 0
          ) AS sector_share
        FROM employment_fact
        WHERE sex = 'T' AND employment_thousands IS NOT NULL
      ) s
      GROUP BY country_code, year
    )
    SELECT
      c.country_name, c.region, e.year,
      ROUND(e.export_hhi::NUMERIC, 4)                     AS export_concentration_hhi,
      ROUND(l.labor_hhi::NUMERIC, 4)                      AS labor_concentration_hhi,
      ROUND(ABS(e.export_hhi - l.labor_hhi)::NUMERIC, 4) AS concentration_gap,
      RANK() OVER (
        PARTITION BY e.year ORDER BY ABS(e.export_hhi - l.labor_hhi) ASC
      ) AS alignment_rank
    FROM export_hhi e
    JOIN labor_hhi l ON e.country_code = l.country_code AND e.year = l.year
    JOIN country c   ON e.country_code = c.country_code
    WHERE 1=1 ${yearFilter} ${regionFilter}
    ORDER BY e.year, alignment_rank
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 2: GET /api/export-flip
// Countries whose #1 HS section flipped over a decade.
// Params: region, start_decade
//
// Optimizations:
//  - `section_exports` pre-aggregates raw chapter rows to (country, year, section)
//    BEFORE ranking, so RANK() runs over a far smaller set.
//  - Top-1 sector is selected via `RANK() ... = 1` (one window pass) instead of
//    a correlated `MAX` subquery per (country, year).
//  - The decade comparison is an arithmetic self-join on `t_late.year =
//    t_early.year + 10`, restricted to top-sector rows only — index-friendly and
//    tiny on both sides.
//  - `t_early.hs_section <> t_late.hs_section` is in the JOIN ON, so non-flipped
//    pairs never materialise.
//
// Worse alternative: `LAG(top_section, 10) OVER (PARTITION BY country_code ORDER
// BY year)` over the raw trade_flow stream — has to sort every fact row, then
// post-filter, which is dramatically more expensive than joining two top-1 sets.
app.get('/api/export-flip', async (req, res) => {
  const { region, start_decade } = req.query;
  const params = [];

  let regionFilter = '';
  if (region) { params.push(region); regionFilter = `AND c.region = $${params.length}`; }
  let decadeFilter = '';
  if (start_decade) { params.push(parseInt(start_decade)); decadeFilter = `AND f.early_year >= $${params.length}`; }

  const query = `
    WITH section_exports AS (
      SELECT tf.country_code, tf.year,
        hs_sec.hs_section, hs_sec.section_label,
        SUM(tf.trade_value_usd) AS section_value
      FROM trade_flow tf
      JOIN hs_commodity hc   ON tf.hs_chapter   = hc.hs_code
      JOIN hs_section hs_sec ON hc.hs_section   = hs_sec.hs_section
      WHERE tf.trade_flow = 'X' AND tf.trade_value_usd IS NOT NULL
      GROUP BY tf.country_code, tf.year, hs_sec.hs_section, hs_sec.section_label
    ),
    ranked AS (
      SELECT country_code, year, hs_section, section_label, section_value,
        RANK() OVER (PARTITION BY country_code, year ORDER BY section_value DESC) AS sector_rank
      FROM section_exports
    ),
    top_sector AS (
      SELECT country_code, year, hs_section, section_label, section_value
      FROM ranked WHERE sector_rank = 1
    ),
    flipped AS (
      SELECT
        t_early.country_code,
        t_early.year AS early_year, t_early.hs_section AS early_section,
        t_early.section_label AS early_label, t_early.section_value AS early_value,
        t_late.year AS late_year, t_late.hs_section AS late_section,
        t_late.section_label AS late_label, t_late.section_value AS late_value
      FROM top_sector t_early
      JOIN top_sector t_late
        ON t_early.country_code = t_late.country_code
        AND t_late.year = t_early.year + 10
        AND t_early.hs_section <> t_late.hs_section
    )
    SELECT
      c.country_name, c.region,
      f.early_year, f.late_year,
      f.early_label AS top_sector_early,
      ROUND((f.early_value / 1e9)::NUMERIC, 2) AS early_value_bn_usd,
      f.late_label AS top_sector_late,
      ROUND((f.late_value / 1e9)::NUMERIC, 2) AS late_value_bn_usd
    FROM flipped f
    JOIN country c ON f.country_code = c.country_code
    WHERE 1=1 ${regionFilter} ${decadeFilter}
    ORDER BY c.region, c.country_name, f.early_year
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 3: GET /api/chapter-momentum
// Shows which countries are gaining/losing world export share per HS chapter.
// Params: year (required), hs_chapter, limit
//
// Optimizations:
//  - `year IN ($1, $2)` in the base CTE limits the scan of trade_flow to just
//    the two years we care about — the single biggest win in this query.
//  - Layered CTEs (chapter_totals -> world_totals -> with_share -> momentum)
//    are computed once and reused; world_totals reads from chapter_totals, not
//    from the fact table again.
//  - YoY delta uses a self-join on `with_share` keyed by year=$1 / year=$2
//    instead of a window LAG that would have to sort the entire dataset.
//  - `ABS(share_change) > 0.0001` early-prunes microscopic countries before
//    RANK + ORDER BY; `LIMIT $3` lets PG do a bounded top-K sort.
//
// Worse alternative: scan all years of trade_flow and compute LAG over them, or
// recompute world totals via a correlated subquery per row — both turn an
// O(2 years) scan into an O(all history) scan.
app.get('/api/chapter-momentum', async (req, res) => {
  const { year, hs_chapter, limit = 50 } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });

  const params = [parseInt(year), parseInt(year) - 1, parseInt(limit)];

  let chapterFilter = '';
  if (hs_chapter) {
    params.push(hs_chapter);
    chapterFilter = `AND m.hs_chapter = $${params.length}`;
  }

  const query = `
    WITH chapter_totals AS (
      SELECT country_code, year, hs_chapter,
        SUM(trade_value_usd) AS export_value
      FROM trade_flow
      WHERE trade_flow = 'X' AND trade_value_usd IS NOT NULL
        AND year IN ($1, $2)
      GROUP BY country_code, year, hs_chapter
    ),
    world_totals AS (
      SELECT year, hs_chapter, SUM(export_value) AS world_export_value
      FROM chapter_totals
      GROUP BY year, hs_chapter
    ),
    with_share AS (
      SELECT ct.country_code, ct.year, ct.hs_chapter, ct.export_value,
        ct.export_value / NULLIF(wt.world_export_value, 0) AS world_share
      FROM chapter_totals ct
      JOIN world_totals wt ON ct.year = wt.year AND ct.hs_chapter = wt.hs_chapter
    ),
    momentum AS (
      SELECT
        curr.country_code, curr.hs_chapter,
        curr.export_value                   AS current_export_value,
        curr.world_share                    AS current_world_share,
        prev.world_share                    AS prev_world_share,
        curr.world_share - prev.world_share AS share_change
      FROM with_share curr
      JOIN with_share prev
        ON curr.country_code = prev.country_code
        AND curr.hs_chapter  = prev.hs_chapter
        AND curr.year = $1 AND prev.year = $2
    )
    SELECT
      c.country_name, c.region,
      m.hs_chapter,
      hc.hs_description,
      ROUND((m.current_export_value / 1e9)::NUMERIC, 3) AS export_value_bn,
      ROUND((m.current_world_share * 100)::NUMERIC, 4)  AS world_share_pct,
      ROUND((m.share_change * 100)::NUMERIC, 4)         AS share_change_pct,
      RANK() OVER (PARTITION BY m.hs_chapter ORDER BY m.share_change DESC) AS momentum_rank
    FROM momentum m
    JOIN country c       ON m.country_code = c.country_code
    JOIN hs_commodity hc ON m.hs_chapter   = hc.hs_code
    WHERE ABS(m.share_change) > 0.0001 ${chapterFilter}
    ORDER BY ABS(m.share_change) DESC
    LIMIT $3
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 4: GET /api/hhi-concentration
// HHI export basket concentration decade over decade.
// Params: region, trend
//
// Optimizations:
//  - Decade key is integer arithmetic `(year/10)*10` — cheaper than DATE_TRUNC
//    or string formatting and groups predictably.
//  - Median HHI per decade is computed inside `decade_hhi` with PERCENTILE_CONT,
//    so the outer query reads one row per (country, decade) instead of
//    recomputing the percentile.
//  - `years_in_decade >= 5` lives inside the JOIN ON of `decade_comparison`, so
//    sparse decades are eliminated before the decade-pair set is materialised.
//  - The trend label (CASE) is precomputed in `classified`, so the optional
//    `trend = $...` filter is a cheap equality on a derived column.
//  - `chapter_exports` is reused by both `country_totals` and `chapter_shares`
//    so the fact table is scanned only once.
//
// Worse alternative: compute decade boundaries in JS and issue one query per
// (country, decade), or recompute the median in the outer SELECT — N+1 round-
// trips and repeated sorts.
app.get('/api/hhi-concentration', async (req, res) => {
  const { region, trend } = req.query;
  const params = [];

  let regionFilter = '';
  if (region) { params.push(region); regionFilter = `AND c.region = $${params.length}`; }
  let trendFilter = '';
  if (trend) { params.push(trend); trendFilter = `AND concentration_trend = $${params.length}`; }

  const query = `
    WITH chapter_exports AS (
      SELECT country_code, year, hs_chapter,
        SUM(trade_value_usd) AS chapter_value
      FROM trade_flow
      WHERE trade_flow = 'X' AND trade_value_usd IS NOT NULL
      GROUP BY country_code, year, hs_chapter
    ),
    country_totals AS (
      SELECT country_code, year, SUM(chapter_value) AS total_export_value
      FROM chapter_exports GROUP BY country_code, year
    ),
    chapter_shares AS (
      SELECT ce.country_code, ce.year, ce.hs_chapter,
        ce.chapter_value / NULLIF(ct.total_export_value, 0) AS share
      FROM chapter_exports ce
      JOIN country_totals ct ON ce.country_code = ct.country_code AND ce.year = ct.year
    ),
    hhi_annual AS (
      SELECT country_code, year,
        SUM(share * share) AS hhi,
        COUNT(DISTINCT hs_chapter) AS num_chapters
      FROM chapter_shares GROUP BY country_code, year
    ),
    decade_hhi AS (
      SELECT country_code, (year / 10) * 10 AS decade,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hhi) AS median_hhi,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY num_chapters) AS median_chapters,
        COUNT(*) AS years_in_decade
      FROM hhi_annual GROUP BY country_code, (year / 10) * 10
    ),
    decade_comparison AS (
      SELECT d_early.country_code,
        d_early.decade AS decade_early, d_late.decade AS decade_late,
        d_early.median_hhi AS hhi_early, d_late.median_hhi AS hhi_late,
        d_late.median_hhi - d_early.median_hhi AS hhi_delta,
        d_early.median_chapters AS chapters_early, d_late.median_chapters AS chapters_late
      FROM decade_hhi d_early
      JOIN decade_hhi d_late
        ON d_early.country_code = d_late.country_code
        AND d_late.decade = d_early.decade + 10
        AND d_early.years_in_decade >= 5 AND d_late.years_in_decade >= 5
    ),
    classified AS (
      SELECT dc.*,
        CASE
          WHEN dc.hhi_delta >  0.05 THEN 'strongly more concentrated'
          WHEN dc.hhi_delta >  0.01 THEN 'moderately more concentrated'
          WHEN dc.hhi_delta < -0.05 THEN 'strongly more diversified'
          WHEN dc.hhi_delta < -0.01 THEN 'moderately more diversified'
          ELSE 'stable'
        END AS concentration_trend
      FROM decade_comparison dc
    )
    SELECT
      c.country_name, c.region,
      cl.decade_early, cl.decade_late,
      ROUND(cl.hhi_early::NUMERIC, 4) AS hhi_early,
      ROUND(cl.hhi_late::NUMERIC, 4)  AS hhi_late,
      ROUND(cl.hhi_delta::NUMERIC, 4) AS hhi_change,
      cl.chapters_early::INT, cl.chapters_late::INT,
      cl.concentration_trend
    FROM classified cl
    JOIN country c ON cl.country_code = c.country_code
    WHERE 1=1 ${regionFilter} ${trendFilter}
    ORDER BY cl.hhi_delta DESC
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});


//  STANDARD QUERY ROUTES (5-10)

// Route 5: Top exporters by ISIC sector and year
//
// Optimizations:
//  - Required-param guard fails fast in JS before any DB round-trip.
//  - Highly selective equality predicates (`year = $2`, `hs_section = $1`) are
//    pushed first so PG can use the (year, ...) index on trade_flow before joining.
//  - Joins are all on PK/FK columns (hs_code, hs_section, country_code).
//  - `GROUP BY ... ORDER BY total DESC LIMIT $3` is the textbook top-N pattern
//    so PG does a bounded heap sort rather than a full sort.
//
// Worse alternative: aggregate over all years/sections and filter afterwards,
// or `ORDER BY` without `LIMIT` and slice in JS — both pull and sort orders of
// magnitude more rows than necessary.
app.get('/api/top-exporters', async (req, res) => {
  const { hs_section, year, limit = 10 } = req.query;
  if (!hs_section || !year) {
    return res.status(400).json({ error: 'hs_section and year are required' });
  }

  const query = `
    SELECT
      c.country_name, c.region,
      SUM(tf.trade_value_usd) AS total_export_value
    FROM trade_flow tf
    JOIN hs_commodity hc   ON tf.hs_chapter  = hc.hs_code
    JOIN hs_section hs_sec ON hc.hs_section  = hs_sec.hs_section
    JOIN country c         ON tf.country_code = c.country_code
    WHERE tf.trade_flow = 'X'
      AND hs_sec.hs_section = $1
      AND tf.year = $2
      AND tf.trade_value_usd IS NOT NULL
    GROUP BY c.country_name, c.region
    ORDER BY total_export_value DESC
    LIMIT $3
  `;

  try {
    const result = await pool.query(query, [
      parseInt(hs_section),
      parseInt(year),
      parseInt(limit)
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Route 6: Trade totals (import/export) for a country and year
//
// Optimizations:
//  - Filters on `(country_code, year)` match the natural composite index on
//    trade_flow, making this an index range scan + small hash agg.
//  - `country_code.toUpperCase()` normalises input so equality matches the
//    canonical stored form (would otherwise miss the index).
//  - Returns at most 2 rows (one per flow direction); 404 short-circuits on
//    empty results so the client doesn't render an empty payload.
//
// Worse alternative: two separate queries (one for X, one for M) — double the
// round-trips and double the index probes.
app.get('/api/trade-totals/:country_code/:year', async (req, res) => {
  const { country_code, year } = req.params;
  const query = `
    SELECT trade_flow AS flow_direction, SUM(trade_value_usd) AS total_value
    FROM trade_flow
    WHERE country_code = $1 AND year = $2 AND trade_value_usd IS NOT NULL
    GROUP BY trade_flow
  `;
  try {
    const result = await pool.query(query, [country_code.toUpperCase(), parseInt(year)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No data found' });
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 7: Employment by sector for a country and year
//
// Optimizations:
//  - Three equality predicates on `(country_code, year, sex)` — the natural
//    composite key on employment_fact, so this is an index probe.
//  - One small join to `isic_sector` for the human label; data is already at
//    sector grain so no aggregation is needed.
//  - Selects only the three columns the UI uses (no SELECT *).
//
// Worse alternative: pull all employment rows for the country and filter/join
// in JS — wastes bandwidth and skips the index entirely.
app.get('/api/employment/:country_code/:year', async (req, res) => {
  const { country_code, year } = req.params;
  const { sex = 'T' } = req.query;
  const query = `
    SELECT s.section_name, ef.isic_section, ef.employment_thousands
    FROM employment_fact ef
    JOIN isic_sector s ON ef.isic_section = s.isic_section
    WHERE ef.country_code = $1 AND ef.year = $2 AND ef.sex = $3
    ORDER BY ef.employment_thousands DESC
  `;
  try {
    const result = await pool.query(query, [country_code.toUpperCase(), parseInt(year), sex.toUpperCase()]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No data found' });
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 8: GET /api/export-diversity
// Params: year (required), region
//
// Optimizations:
//  - `year = $1` is pushed into the very first CTE, so only one year of
//    trade_flow is ever scanned.
//  - Shannon entropy is computed in a single aggregate pass:
//    `-SUM(share * LN(NULLIF(share, 0)))` — no loop, no self-join.
//  - `NULLIF(share, 0)` inside LN avoids -inf / domain errors without a CASE.
//  - RANK runs over the small `entropy` CTE, not raw trade rows.
//
// Worse alternative: compute shares in JS and entropy in JS after pulling all
// chapter rows for every country — N×M data transfer plus per-row math.
app.get('/api/export-diversity', async (req, res) => {
  const { year, region } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });

  const params = [parseInt(year)];
  let regionFilter = '';
  if (region) { params.push(region); regionFilter = `AND c.region = $${params.length}`; }

  const query = `
    WITH chapter_exports AS (
      SELECT country_code, year, hs_chapter,
        SUM(trade_value_usd) AS chapter_value
      FROM trade_flow
      WHERE trade_flow = 'X' AND trade_value_usd IS NOT NULL AND year = $1
      GROUP BY country_code, year, hs_chapter
    ),
    totals AS (
      SELECT country_code, year, SUM(chapter_value) AS total_value
      FROM chapter_exports GROUP BY country_code, year
    ),
    shares AS (
      SELECT ce.country_code, ce.year, ce.hs_chapter,
        ce.chapter_value / NULLIF(t.total_value, 0) AS share
      FROM chapter_exports ce
      JOIN totals t ON ce.country_code = t.country_code AND ce.year = t.year
    ),
    entropy AS (
      SELECT country_code, year,
        -SUM(share * LN(NULLIF(share, 0))) AS shannon_entropy,
        COUNT(DISTINCT hs_chapter) AS active_chapters
      FROM shares GROUP BY country_code, year
    )
    SELECT
      c.country_name, c.region, e.year,
      ROUND(e.shannon_entropy::NUMERIC, 4) AS shannon_entropy,
      e.active_chapters,
      RANK() OVER (PARTITION BY e.year ORDER BY e.shannon_entropy DESC) AS diversity_rank
    FROM entropy e
    JOIN country c ON e.country_code = c.country_code
    WHERE 1=1 ${regionFilter}
    ORDER BY e.year, diversity_rank
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 9: Export growth momentum by ISIC sector (kept as-is, uses csm but has data for sector C)
//
// Optimizations:
//  - YoY growth is computed with `LAG()` in one ordered window pass instead of
//    a self-join `ON year = year - 1`.
//  - `sector_exports` pre-aggregates chapter rows up to ISIC sector first, so
//    LAG operates on a much smaller partition.
//  - Outer `g.year = $1` keeps only the requested year AFTER LAG has populated
//    growth from the prior year's value.
//  - `growth_rate IS NOT NULL` discards the first-year-per-partition rows
//    (where LAG returns NULL) without an extra subquery.
//  - `LIMIT` is parameterised so the result set is bounded.
//
// Worse alternative: self-join `sector_exports` with itself on `year = year - 1`
// — doubles the input to the join and prevents the single-pass window plan.
app.get('/api/export-momentum', async (req, res) => {
  const { year, isic_section, limit } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });

  const params = [parseInt(year)];
  let sectionFilter = '';
  if (isic_section) { params.push(isic_section.toUpperCase()); sectionFilter = `AND g.isic_section = $${params.length}`; }

  params.push(parseInt(limit) || 50);
  const limitClause = `LIMIT $${params.length}`;

  const query = `
    WITH sector_exports AS (
      SELECT tf.country_code, tf.year, csm.isic_section,
        SUM(tf.trade_value_usd) AS export_value
      FROM trade_flow tf
      JOIN commodity_sector_mapping csm ON tf.hs_chapter = csm.hs_code
      WHERE tf.trade_flow = 'X' AND tf.trade_value_usd IS NOT NULL
      GROUP BY tf.country_code, tf.year, csm.isic_section
    ),
    growth AS (
      SELECT country_code, year, isic_section, export_value,
        (export_value - LAG(export_value) OVER (
          PARTITION BY country_code, isic_section ORDER BY year
        )) / NULLIF(LAG(export_value) OVER (
          PARTITION BY country_code, isic_section ORDER BY year
        ), 0) AS growth_rate
      FROM sector_exports
    )
    SELECT
      c.country_name, c.region, g.year, g.isic_section, s.section_name,
      ROUND(g.growth_rate::NUMERIC, 4) AS growth_rate,
      RANK() OVER (PARTITION BY g.year, g.isic_section ORDER BY g.growth_rate DESC) AS rank_within_sector
    FROM growth g
    JOIN country c    ON g.country_code = c.country_code
    JOIN isic_sector s ON g.isic_section = s.isic_section
    WHERE g.year = $1 AND g.growth_rate IS NOT NULL ${sectionFilter}
    ORDER BY g.year, g.isic_section, rank_within_sector
    ${limitClause}
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Route 10: Trade balance by ISIC sector for a country and year
//
// Optimizations:
//  - Two narrow CTEs (`exports`, `imports`) each push `country_code = $1 AND
//    year = $2` down to the scan, so each only touches the relevant slice of
//    trade_flow.
//  - Aggregation happens BEFORE the join, so the join input is one row per
//    (country, year, sector) — essentially a lookup.
//  - The exporter/importer label is computed in projection with a CASE — no
//    extra pass over the data.
//
// Worse alternative: one query that scans trade_flow once and pivots X vs M
// with conditional SUMs is fine, but doing it without pushing the country/year
// filter down (e.g. filtering only in the outer SELECT) would scan the entire
// fact table.
app.get('/api/trade-balance/:country_code/:year', async (req, res) => {
  const { country_code, year } = req.params;
  // Single-scan conditional SUM: pivots X / M in one pass over trade_flow so
  // sectors with only exports OR only imports still appear (the previous
  // INNER JOIN between exports and imports dropped those rows). Also returns
  // [] on empty instead of 404 so the React chart renders cleanly.
  const query = `
    SELECT
      c.country_name, c.region, tf.year, csm.isic_section, s.section_name,
      ROUND(((SUM(CASE WHEN tf.trade_flow = 'X' THEN tf.trade_value_usd ELSE 0 END)
            - SUM(CASE WHEN tf.trade_flow = 'M' THEN tf.trade_value_usd ELSE 0 END)
           ) / 1e9)::NUMERIC, 2) AS trade_balance_bn,
      CASE WHEN SUM(CASE WHEN tf.trade_flow = 'X' THEN tf.trade_value_usd ELSE 0 END)
              > SUM(CASE WHEN tf.trade_flow = 'M' THEN tf.trade_value_usd ELSE 0 END)
           THEN 'net exporter' ELSE 'net importer' END AS status
    FROM trade_flow tf
    JOIN commodity_sector_mapping csm ON tf.hs_chapter   = csm.hs_code
    JOIN country c                    ON tf.country_code = c.country_code
    JOIN isic_sector s                ON csm.isic_section = s.isic_section
    WHERE tf.country_code = $1 AND tf.year = $2 AND tf.trade_value_usd IS NOT NULL
    GROUP BY c.country_name, c.region, tf.year, csm.isic_section, s.section_name
    ORDER BY trade_balance_bn DESC
  `;
  try {
    const result = await pool.query(query, [country_code.toUpperCase(), parseInt(year)]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});


// Legacy route
// Optimization: minimal projection over the small `country` dimension table,
// sorted by an indexed column. Kept for backwards compatibility with older
// frontend builds.
app.get('/countries', async (req, res) => {
  try {
    const result = await pool.query('SELECT country_code, country_name FROM country ORDER BY country_name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});