import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  CartesianGrid, Cell
} from 'recharts';

//  Simple in-app router (no react-router needed)
const PAGES = ['home', 'trade-employment', 'partners', 'export-composition', 'specialization'];

function useRouter() {
  const [page, setPage] = useState('home');
  return { page, navigate: setPage };
}

//  Design tokens
const C = {
  bg: '#0f1117',
  surface: '#1a1d27',
  surfaceHover: '#21253a',
  border: '#2a2f45',
  accent: '#4f8ef7',
  accentSoft: 'rgba(79,142,247,0.12)',
  green: '#34d399',
  red: '#f87171',
  yellow: '#fbbf24',
  purple: '#a78bfa',
  text: '#e2e8f0',
  muted: '#64748b',
  white: '#ffffff',
};

const CHART_COLORS = ['#4f8ef7', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#38bdf8'];

const styles = {
  root: {
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
  },
  nav: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navBrand: {
    color: C.accent,
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.05em',
    marginRight: 32,
    padding: '16px 0',
    whiteSpace: 'nowrap',
  },
  navLink: (active) => ({
    padding: '18px 16px',
    fontSize: 12,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    color: active ? C.accent : C.muted,
    borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
    transition: 'color 0.15s',
    whiteSpace: 'nowrap',
  }),
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '40px 24px',
  },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    color: C.white,
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },
  h2: {
    fontSize: 18,
    fontWeight: 600,
    color: C.white,
    marginBottom: 16,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    marginBottom: 32,
    lineHeight: 1.6,
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: C.muted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  select: {
    background: '#0f1117',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: C.text,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
    minWidth: 160,
  },
  input: {
    background: '#0f1117',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: C.text,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: 90,
  },
  btn: {
    background: C.accent,
    color: C.white,
    border: 'none',
    borderRadius: 6,
    padding: '9px 20px',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
    fontWeight: 600,
    letterSpacing: '0.02em',
    transition: 'opacity 0.15s',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    color: C.muted,
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${C.border}`,
    fontWeight: 500,
  },
  td: {
    padding: '10px 12px',
    borderBottom: `1px solid ${C.border}`,
    color: C.text,
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color: color,
  }),
  stat: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '20px 24px',
    flex: 1,
    minWidth: 160,
  },
  statLabel: { fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' },
  statValue: { fontSize: 26, fontWeight: 700, color: C.white, marginTop: 6 },
  statSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  error: { color: C.red, fontSize: 13, padding: '12px 0' },
  loading: { color: C.muted, fontSize: 13, padding: '12px 0', fontStyle: 'italic' },
  empty: { color: C.muted, fontSize: 13, padding: '24px 0', textAlign: 'center' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  grid4: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
};

//  Shared components
function Spinner() {
  return <p style={styles.loading}>⟳ Loading…</p>;
}
function ErrorMsg({ msg }) {
  return <p style={styles.error}>⚠ {msg}</p>;
}
function Empty() {
  return <p style={styles.empty}>No results found.</p>;
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...styles.stat, borderTop: `3px solid ${color || C.accent}` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: color || C.white }}>{value}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function DataTable({ columns, rows, keyField }) {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={styles.th}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[keyField] || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              {columns.map(c => (
                <td key={c.key} style={styles.td}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

//  Hooks
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [url]);

  return { data, loading, error };
}

function useManualFetch() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (url) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.statusText);
      const d = await r.json();
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, run };
}

//  Shared dropdown state from /api/countries & /api/sectors
function useDropdowns() {
  const { data: countries } = useFetch('/api/countries');
  const { data: sectors } = useFetch('/api/sectors');
  const { data: yearsData } = useFetch('/api/years');
  const years = yearsData ? yearsData.map(r => r.year) : [];
  const regions = countries
    ? [...new Set(countries.map(c => c.region).filter(Boolean))].sort()
    : [];
  return { countries: countries || [], sectors: sectors || [], years, regions };
}

//  PAGE 1: Home / Overview
function HomePage() {
  const { countries, sectors, years } = useDropdowns();
  const { data: hsSections } = useFetch('/api/hs-sections');
  const minYear = years.length ? Math.min(...years) : '—';
  const maxYear = years.length ? Math.max(...years) : '—';

  const [sector, setSector] = useState('');
  const [year, setYear] = useState('2015');
  const { data: topExp, loading: topLoading, error: topErr, run: runTop } = useManualFetch();

  // Set default sector to first available once hsSections loads
  useEffect(() => {
    if (hsSections && hsSections.length > 0 && !sector) {
      setSector(String(hsSections[0].hs_section));
    }
  }, [hsSections]); // eslint-disable-line

  // Only fetch once we have a valid sector value
  useEffect(() => {
    if (hsSections && hsSections.length > 0 && sector) fetchTop();
  }, [hsSections]); // eslint-disable-line

  const fetchTop = () => runTop(`/api/top-exporters?hs_section=${sector}&year=${year}&limit=10`);

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Global Trade & Labor Explorer</h1>
      <p style={styles.subtitle}>
        CIS 5500 Final Project · UN Comtrade + ILOSTAT · Shrishti Roy, Mel Han, Joshua Ahn, Alex Kim
      </p>

      <div style={styles.grid4}>
        <StatCard label="Countries" value={countries.length || '…'} sub="with trade or employment data" color={C.accent} />
        <StatCard label="ISIC Sectors" value={sectors.length || '…'} sub="industry classifications" color={C.green} />
        <StatCard label="Year Range" value={years.length ? `${minYear}–${maxYear}` : '…'} sub="annual observations" color={C.yellow} />
        <StatCard label="Data Sources" value="2" sub="Comtrade + ILOSTAT" color={C.purple} />
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>Top Exporters by Sector</h2>
        <div style={styles.controls}>
          <FieldGroup label="HS Section">
            <select style={styles.select} value={sector} onChange={e => setSector(e.target.value)}>
              {(hsSections || []).map(s => (
                <option key={s.hs_section} value={s.hs_section}>
                  {s.hs_section} — {s.section_label?.slice(0, 35)}
                </option>
              ))}
            </select>
          </FieldGroup>
          <FieldGroup label="Year">
            <input style={styles.input} type="number" value={year} min="1995" max="2025"
              onChange={e => setYear(e.target.value)} />
          </FieldGroup>
          <div style={{ paddingBottom: 0 }}>
            <button style={styles.btn} onClick={fetchTop}>Query</button>
          </div>
        </div>
        {topLoading && <Spinner />}
        {topErr && <ErrorMsg msg={topErr} />}
        {topExp && (() => {
          const topExpMax = Math.max(...topExp.map(r => Number(r.total_export_value) || 0));
          return (
          <ResponsiveContainer width="100%" height={topExp.length * 42 + 40}>
            <BarChart data={topExp} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }}
                tickFormatter={v => `$${(v / 1e9).toFixed(1)}B`}
                domain={[0, Math.ceil(topExpMax * 1.15)]} />
              <YAxis type="category" dataKey="country_name"
                tick={{ fill: C.text, fontSize: 11 }} width={120}
                tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}
                formatter={v => [`$${(v / 1e9).toFixed(2)}B`, 'Export Value']}
              />
              <Bar dataKey="total_export_value" radius={[0, 4, 4, 0]}>
                {(topExp || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          );
        })()}
      </div>

      <div style={{ ...styles.card, background: C.accentSoft, border: `1px solid ${C.accent}33` }}>
        <h2 style={{ ...styles.h2, color: C.accent }}>Available Analysis Pages</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { title: 'Trade vs. Employment', desc: 'Compare trade volume and workforce size by sector for any country.' },
            { title: 'Top Trading Partners', desc: 'Rank import/export partners for a selected country and year.' },
            { title: 'Export Composition Over Time', desc: 'Track how a country\'s export mix evolves year by year.' },
            { title: 'Workforce & Trade Specialization', desc: 'Explore alignment between labor structure and export profile.' },
          ].map(p => (
            <div key={p.title} style={{ padding: '14px 16px', background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.white, marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

//  PAGE 2: Trade Volume vs. Employment
function TradeEmploymentPage() {
  const { countries } = useDropdowns();
  const [country, setCountry] = useState('USA');
  const [year, setYear] = useState('2015');
  const [submitted, setSubmitted] = useState({ country: 'USA', year: '2015' });

  const empUrl = `/api/employment/${submitted.country}/${submitted.year}?sex=T`;
  const tradeUrl = `/api/trade-totals/${submitted.country}/${submitted.year}`;

  const { data: empData, loading: empLoading, error: empErr } = useFetch(empUrl);
  const { data: tradeData, loading: tradeLoading, error: tradeErr } = useFetch(tradeUrl);

  const exports = tradeData?.find(r => r.flow_direction === 'X');
  const imports = tradeData?.find(r => r.flow_direction === 'M');

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Trade Volume vs. Employment</h1>
      <p style={styles.subtitle}>
        For a selected country and year, compare employment across ISIC sectors against total trade value.
      </p>

      <div style={styles.controls}>
        <FieldGroup label="Country">
          <select style={styles.select} value={country} onChange={e => setCountry(e.target.value)}>
            {countries.map(c => (
              <option key={c.country_code} value={c.country_code}>
                {c.country_name} ({c.country_code})
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Year">
          <input style={styles.input} type="number" value={year} min="1995" max="2025"
            onChange={e => setYear(e.target.value)} />
        </FieldGroup>
        <div>
          <button style={styles.btn} onClick={() => setSubmitted({ country, year })}>Search</button>
        </div>
      </div>

      {/* Trade summary stats */}
      {tradeLoading && <Spinner />}
      {tradeErr && <ErrorMsg msg={tradeErr} />}
      {tradeData && (
        <div style={styles.grid4}>
          <StatCard label="Total Exports"
            value={exports ? `$${(exports.total_value / 1e9).toFixed(1)}B` : '—'}
            color={C.green} />
          <StatCard label="Total Imports"
            value={imports ? `$${(imports.total_value / 1e9).toFixed(1)}B` : '—'}
            color={C.red} />
          <StatCard label="Trade Balance"
            value={exports && imports
              ? `$${((exports.total_value - imports.total_value) / 1e9).toFixed(1)}B`
              : '—'}
            color={exports && imports && exports.total_value > imports.total_value ? C.green : C.red}
            sub={exports && imports
              ? (exports.total_value > imports.total_value ? 'Net Exporter' : 'Net Importer')
              : ''} />
          <StatCard label="Sectors with Data"
            value={empData ? empData.length : '—'}
            color={C.accent} />
        </div>
      )}

      {/* Employment by sector chart */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Employment by ISIC Sector (thousands)</h2>
        {empLoading && <Spinner />}
        {empErr && <ErrorMsg msg={empErr} />}
        {empData && empData.length > 0 && (() => {
          const empMax = Math.max(...empData.map(r => Number(r.employment_thousands) || 0));
          return (
          <ResponsiveContainer width="100%" height={empData.length * 38 + 40}>
            <BarChart data={empData} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}M` : v}
                domain={[0, Math.ceil(empMax * 1.15)]} />
              <YAxis type="category" dataKey="section_name"
                tick={{ fill: C.text, fontSize: 10 }} width={200}
                tickFormatter={v => v.length > 28 ? v.slice(0, 27) + '…' : v} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}
                formatter={v => [`${Number(v).toLocaleString()}k`, 'Employed']}
              />
              <Bar dataKey="employment_thousands" fill={C.accent} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          );
        })()}
        {empData && empData.length === 0 && <Empty />}
      </div>

      {/* Sector table */}
      {empData && empData.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.h2}>Sector Detail</h2>
          <DataTable
            keyField="isic_section"
            rows={empData}
            columns={[
              { key: 'isic_section', label: 'ISIC' },
              { key: 'section_name', label: 'Sector' },
              { key: 'employment_thousands', label: 'Employment (000s)',
                render: v => Number(v).toLocaleString() },
            ]}
          />
        </div>
      )}
    </div>
  );
}

//  PAGE 3: Top Trading Partners (trade totals by country/year)
function PartnersPage() {
  const { countries } = useDropdowns();
  const [country, setCountry] = useState('USA');
  const [year, setYear] = useState('2015');
  const [flow, setFlow] = useState('X');
  const { data, loading, error, run } = useManualFetch();

  const search = () => run(`/api/top-exporters?isic_section=C&year=${year}&limit=20`);

  // Also fetch trade totals for the selected country
  const { data: tradeTotals, loading: ttLoading } = useFetch(
    `/api/trade-totals/${country}/${year}`
  );
  const { data: tradeBalance, loading: tbLoading } = useFetch(
    `/api/trade-balance/${country}/${year}`
  );

  const chartData = tradeBalance
    ? tradeBalance.map(r => ({
        name: r.section_name?.slice(0, 20) || r.isic_section,
        balance: Number(r.trade_balance_bn),
        status: r.status,
      }))
    : [];

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Trade Totals & Sector Balance</h1>
      <p style={styles.subtitle}>
        Explore a country's total import/export value and trade balance by ISIC sector for a given year.
      </p>

      <div style={styles.controls}>
        <FieldGroup label="Country">
          <select style={styles.select} value={country} onChange={e => setCountry(e.target.value)}>
            {countries.map(c => (
              <option key={c.country_code} value={c.country_code}>
                {c.country_name} ({c.country_code})
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Year">
          <input style={styles.input} type="number" value={year} min="1995" max="2025"
            onChange={e => setYear(e.target.value)} />
        </FieldGroup>
      </div>

      {/* Trade totals */}
      {ttLoading && <Spinner />}
      {tradeTotals && (
        <div style={styles.grid4}>
          {tradeTotals.map(r => (
            <StatCard
              key={r.flow_direction}
              label={r.flow_direction === 'X' ? 'Total Exports' : 'Total Imports'}
              value={`$${(r.total_value / 1e9).toFixed(2)}B`}
              color={r.flow_direction === 'X' ? C.green : C.red}
              sub={`USD ${year}`}
            />
          ))}
        </div>
      )}

      {/* Trade balance by sector */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Trade Balance by ISIC Sector (Billions USD)</h2>
        {tbLoading && <Spinner />}
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }}
                tickFormatter={v => `$${v}B`} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}
                formatter={v => [`$${v}B`, 'Trade Balance']}
              />
              <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.balance >= 0 ? C.green : C.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {!tbLoading && chartData.length === 0 && <Empty />}
      </div>

      {/* Balance table */}
      {tradeBalance && tradeBalance.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.h2}>Sector Detail</h2>
          <DataTable
            keyField="isic_section"
            rows={tradeBalance}
            columns={[
              { key: 'isic_section', label: 'ISIC' },
              { key: 'section_name', label: 'Sector' },
              { key: 'trade_balance_bn', label: 'Balance (B USD)',
                render: v => <span style={{ color: v >= 0 ? C.green : C.red }}>{v >= 0 ? '+' : ''}{v}</span> },
              { key: 'status', label: 'Status',
                render: v => <span style={styles.badge(v === 'net exporter' ? C.green : C.red)}>{v}</span> },
            ]}
          />
        </div>
      )}
    </div>
  );
}

//  PAGE 4: Export Composition Over Time (HHI + Diversity)
function ExportCompositionPage() {
  const { regions } = useDropdowns();
  const [region, setRegion] = useState('');
  const [trend, setTrend] = useState('');
  const [year, setYear] = useState('2015');

  const { data: hhiData, loading: hhiLoading, error: hhiErr, run: runHHI } = useManualFetch();
  const { data: divData, loading: divLoading, error: divErr, run: runDiv } = useManualFetch();
  const { data: momentumData, loading: momLoading, error: momErr, run: runMom } = useManualFetch();

  const search = () => {
    const hhiParams = new URLSearchParams();
    if (region) hhiParams.set('region', region);
    if (trend) hhiParams.set('trend', trend);
    runHHI(`/api/hhi-concentration?${hhiParams}`);

    const divParams = new URLSearchParams({ year });
    if (region) divParams.set('region', region);
    runDiv(`/api/export-diversity?${divParams}`);

    runMom(`/api/export-momentum?year=${year}`);
  };

  useEffect(() => { search(); }, []); // eslint-disable-line

  const TRENDS = [
    '', 'strongly more concentrated', 'moderately more concentrated',
    'stable', 'moderately more diversified', 'strongly more diversified'
  ];

  // Diversity chart — top 20
  const divChart = divData ? divData.slice(0, 20).map(r => ({
    name: r.country_name?.slice(0, 12),
    entropy: Number(r.shannon_entropy),
    sectors: r.active_sectors,
  })) : [];

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Export Composition & Concentration</h1>
      <p style={styles.subtitle}>
        Analyze how countries' export baskets have changed over time using HHI concentration and Shannon entropy diversity scores.
      </p>

      <div style={styles.controls}>
        <FieldGroup label="Region">
          <select style={styles.select} value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Concentration Trend">
          <select style={styles.select} value={trend} onChange={e => setTrend(e.target.value)}>
            {TRENDS.map(t => <option key={t} value={t}>{t || 'All Trends'}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Year (Diversity)">
          <input style={styles.input} type="number" value={year} min="1995" max="2025"
            onChange={e => setYear(e.target.value)} />
        </FieldGroup>
        <div>
          <button style={styles.btn} onClick={search}>Search</button>
        </div>
      </div>

      {/* Export Diversity Chart */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Export Diversity Score (Shannon Entropy) — Top 20</h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          Higher entropy = more diversified export basket across HS commodity chapters.
        </p>
        {divLoading && <Spinner />}
        {divErr && <ErrorMsg msg={divErr} />}
        {divChart.length > 0 && (() => {
          const divMax = Math.max(...divChart.map(r => Number(r.entropy) || 0));
          return (
          <ResponsiveContainer width="100%" height={divChart.length * 36 + 40}>
            <BarChart data={divChart} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }}
                domain={[0, Math.ceil(divMax * 1.15 * 10) / 10]} />
              <YAxis type="category" dataKey="name"
                tick={{ fill: C.text, fontSize: 11 }} width={130}
                tickFormatter={v => v.length > 16 ? v.slice(0, 15) + '…' : v} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}
                formatter={v => [Number(v).toFixed(4), 'Shannon Entropy']}
              />
              <Bar dataKey="entropy" fill={C.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          );
        })()}
        {!divLoading && divChart.length === 0 && <Empty />}
      </div>

      {/* HHI Table */}
      <div style={styles.card}>
        <h2 style={styles.h2}>HHI Concentration — Decade Over Decade</h2>
        {hhiLoading && <Spinner />}
        {hhiErr && <ErrorMsg msg={hhiErr} />}
        {hhiData && (
          <DataTable
            keyField="country_name"
            rows={hhiData.slice(0, 50)}
            columns={[
              { key: 'country_name', label: 'Country' },
              { key: 'region', label: 'Region' },
              { key: 'decade_early', label: 'Decade A' },
              { key: 'decade_late', label: 'Decade B' },
              { key: 'hhi_early', label: 'HHI (A)' },
              { key: 'hhi_late', label: 'HHI (B)' },
              { key: 'hhi_change', label: 'Δ HHI',
                render: v => <span style={{ color: v > 0 ? C.red : C.green }}>{v > 0 ? '+' : ''}{v}</span> },
              { key: 'concentration_trend', label: 'Trend',
                render: v => {
                  const color = v?.includes('concentrated') ? C.red
                    : v?.includes('diversified') ? C.green : C.yellow;
                  return <span style={styles.badge(color)}>{v}</span>;
                }
              },
            ]}
          />
        )}
      </div>

      {/* Momentum table */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Export Growth Momentum</h2>
        {momLoading && <Spinner />}
        {momErr && <ErrorMsg msg={momErr} />}
        {momentumData && (
          <DataTable
            keyField="country_name"
            rows={momentumData.slice(0, 30)}
            columns={[
              { key: 'country_name', label: 'Country' },
              { key: 'region', label: 'Region' },
              { key: 'isic_section', label: 'ISIC' },
              { key: 'section_name', label: 'Sector' },
              { key: 'growth_rate', label: 'YoY Growth',
                render: v => {
                  const pct = (Number(v) * 100).toFixed(1);
                  return <span style={{ color: v >= 0 ? C.green : C.red }}>{v >= 0 ? '+' : ''}{pct}%</span>;
                }
              },
              { key: 'rank_within_sector', label: 'Rank' },
            ]}
          />
        )}
      </div>
    </div>
  );
}

//  PAGE 5: Workforce & Trade Specialization
function SpecializationPage() {
  const { regions, sectors } = useDropdowns();
  const [region, setRegion] = useState('');
  const [startYear, setStartYear] = useState('2005');
  const [endYear, setEndYear] = useState('2020');
  const [momentumYear, setMomentumYear] = useState('2015');

  const { data: alignData, loading: alignLoading, error: alignErr, run: runAlign } = useManualFetch();
  const { data: flipData,  loading: flipLoading,  error: flipErr,  run: runFlip  } = useManualFetch();
  const { data: momentumData, loading: momLoading, error: momErr,  run: runMom   } = useManualFetch();

  const search = () => {
    const ap = new URLSearchParams({ start_year: startYear, end_year: endYear });
    if (region) ap.set('region', region);
    runAlign('/api/alignment?' + ap.toString());

    const fp = new URLSearchParams({ start_decade: startYear });
    if (region) fp.set('region', region);
    runFlip('/api/export-flip?' + fp.toString());

    runMom('/api/chapter-momentum?year=' + momentumYear + '&limit=50');
  };

  useEffect(() => { search(); }, []); // eslint-disable-line

  // Best-aligned countries for the latest year in the result set
  const alignChart = alignData
    ? (() => {
        const maxYear = Math.max(...alignData.map(r => r.year));
        return alignData
          .filter(r => r.year === maxYear)
          .slice(0, 25)
          .map(r => ({
            name: r.country_name,
            gap: Number(r.concentration_gap),
            export_hhi: Number(r.export_concentration_hhi),
            labor_hhi:  Number(r.labor_concentration_hhi),
          }));
      })()
    : [];

  // Top 20 by absolute share change for chart
  const momChart = momentumData
    ? momentumData.slice(0, 20).map(r => ({
        name: (r.country_name || '').slice(0, 14),
        chapter: r.hs_chapter,
        change: Number(r.share_change_pct),
      }))
    : [];

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Workforce &amp; Trade Specialization</h1>
      <p style={styles.subtitle}>
        Explore how a country's export concentration aligns with its workforce concentration,
        which countries structurally shifted their top export sector over a decade, and
        which are rapidly gaining or losing global market share in specific commodity chapters.
      </p>

      <div style={styles.controls}>
        <FieldGroup label="Region">
          <select style={styles.select} value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Alignment Start Year">
          <input style={styles.input} type="number" value={startYear} min="1995" max="2025"
            onChange={e => setStartYear(e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Alignment End Year">
          <input style={styles.input} type="number" value={endYear} min="1995" max="2025"
            onChange={e => setEndYear(e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Momentum Year">
          <input style={styles.input} type="number" value={momentumYear} min="1996" max="2025"
            onChange={e => setMomentumYear(e.target.value)} />
        </FieldGroup>
        <div>
          <button style={styles.btn} onClick={search}>Search</button>
        </div>
      </div>

      {/* ── Alignment: Export HHI vs Labor HHI ── */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Export vs. Labor Concentration Alignment</h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          Compares export concentration (HHI across HS chapters) against labor concentration
          (HHI across ISIC sectors). Smaller gap = trade structure mirrors workforce structure.
          Showing best-aligned 25 countries for the latest available year.
        </p>
        {alignLoading && <Spinner />}
        {alignErr && <ErrorMsg msg={alignErr} />}
        {alignChart.length > 0 && (() => {
          const alignMax = Math.max(...alignChart.flatMap(r => [Number(r.export_hhi) || 0, Number(r.labor_hhi) || 0]));
          return (
          <>
            <ResponsiveContainer width="100%" height={alignChart.length * 38 + 60}>
              <BarChart data={alignChart} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }}
                  tickFormatter={v => v.toFixed(3)}
                  domain={[0, Math.ceil(alignMax * 1.2 * 100) / 100]} />
                <YAxis type="category" dataKey="name"
                  tick={{ fill: C.text, fontSize: 10 }} width={155}
                  tickFormatter={v => v.length > 20 ? v.slice(0, 19) + '…' : v} />
                <Tooltip
                  contentStyle={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 6 }}
                  formatter={(v, name) => [
                    Number(v).toFixed(4),
                    name === 'export_hhi' ? 'Export HHI' : name === 'labor_hhi' ? 'Labor HHI' : name
                  ]}
                />
                <Legend />
                <Bar dataKey="export_hhi" name="Export HHI" fill={C.accent} radius={[0, 4, 4, 0]} />
                <Bar dataKey="labor_hhi"  name="Labor HHI"  fill={C.purple} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 16 }}>
              <DataTable
                keyField="name"
                rows={alignChart}
                columns={[
                  { key: 'name',       label: 'Country' },
                  { key: 'export_hhi', label: 'Export HHI', render: v => Number(v).toFixed(4) },
                  { key: 'labor_hhi',  label: 'Labor HHI',  render: v => Number(v).toFixed(4) },
                  { key: 'gap', label: 'Concentration Gap',
                    render: v => (
                      <span style={{ color: v < 0.05 ? C.green : v < 0.15 ? C.yellow : C.red, fontWeight: 600 }}>
                        {Number(v).toFixed(4)}
                      </span>
                    )
                  },
                ]}
              />
            </div>
          </>
          );
        })()}
        {!alignLoading && alignChart.length === 0 && <Empty />}
      </div>

      {/* ── Export Flip Table ── */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Countries That Flipped Their #1 Export Sector (Decade Shift)</h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          Countries where the dominant HS export section changed entirely over a 10-year span,
          capturing structural economic transformation.
        </p>
        {flipLoading && <Spinner />}
        {flipErr && <ErrorMsg msg={flipErr} />}
        {flipData && (
          <DataTable
            keyField="country_name"
            rows={flipData.slice(0, 40)}
            columns={[
              { key: 'country_name',     label: 'Country' },
              { key: 'region',           label: 'Region' },
              { key: 'early_year',       label: 'From' },
              { key: 'top_sector_early', label: 'Old Top Sector' },
              { key: 'early_value_bn_usd', label: 'Value', render: v => '$' + v + 'B' },
              { key: 'late_year',        label: 'To' },
              { key: 'top_sector_late',  label: 'New Top Sector' },
              { key: 'late_value_bn_usd', label: 'Value', render: v => '$' + v + 'B' },
            ]}
          />
        )}
        {!flipLoading && flipData?.length === 0 && <Empty />}
      </div>

      {/* ── Chapter Momentum ── */}
      <div style={styles.card}>
        <h2 style={styles.h2}>HS Chapter Market Share Momentum</h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          Countries gaining or losing the most global export share in specific HS commodity
          chapters year-over-year. Green = gaining share; red = losing share.
        </p>
        {momLoading && <Spinner />}
        {momErr && <ErrorMsg msg={momErr} />}
        {momChart.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={momChart} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 9 }}
                angle={-25} textAnchor="end" height={55} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }}
                tickFormatter={v => v + '%'} />
              <Tooltip
                contentStyle={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 6 }}
                formatter={v => [Number(v).toFixed(4) + '%', 'World Share Change']}
              />
              <Bar dataKey="change" radius={[4, 4, 0, 0]}>
                {momChart.map((entry, i) => (
                  <Cell key={i} fill={entry.change >= 0 ? C.green : C.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {momentumData && momentumData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <DataTable
              keyField="country_name"
              rows={momentumData}
              columns={[
                { key: 'country_name',    label: 'Country' },
                { key: 'region',          label: 'Region' },
                { key: 'hs_chapter',      label: 'HS Ch.' },
                { key: 'hs_description',  label: 'Commodity' },
                { key: 'export_value_bn', label: 'Export (B)', render: v => '$' + v + 'B' },
                { key: 'world_share_pct', label: 'World Share %',
                  render: v => Number(v).toFixed(3) + '%' },
                { key: 'share_change_pct', label: 'Delta Share %',
                  render: v => (
                    <span style={{ color: v >= 0 ? C.green : C.red, fontWeight: 600 }}>
                      {v >= 0 ? '+' : ''}{Number(v).toFixed(4)}%
                    </span>
                  )
                },
                { key: 'momentum_rank', label: 'Rank' },
              ]}
            />
          </div>
        )}
        {!momLoading && momentumData?.length === 0 && <Empty />}
      </div>
    </div>
  );
}
//  Root App
export default function App() {
  const { page, navigate } = useRouter();

  const navItems = [
    { id: 'home', label: 'HOME' },
    { id: 'trade-employment', label: 'TRADE VS. EMPLOYMENT' },
    { id: 'partners', label: 'TRADE TOTALS' },
    { id: 'export-composition', label: 'EXPORT COMPOSITION' },
    { id: 'specialization', label: 'SPECIALIZATION' },
  ];

  const renderPage = () => {
    switch (page) {
      case 'home': return <HomePage />;
      case 'trade-employment': return <TradeEmploymentPage />;
      case 'partners': return <PartnersPage />;
      case 'export-composition': return <ExportCompositionPage />;
      case 'specialization': return <SpecializationPage />;
      default: return <HomePage />;
    }
  };

  return (
    <div style={styles.root}>
      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <nav style={styles.nav}>
        <span style={styles.navBrand}>⬡ GTLEX</span>
        {navItems.map(item => (
          <span
            key={item.id}
            style={styles.navLink(page === item.id)}
            onClick={() => navigate(item.id)}
          >
            {item.label}
          </span>
        ))}
      </nav>
      {renderPage()}
    </div>
  );
}