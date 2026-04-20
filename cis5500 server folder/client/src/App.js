import { useEffect, useState } from 'react';

export default function App() {
  const [countries, setCountries] = useState([]);

  // Trade state
  const [tradeData, setTradeData] = useState([]);
  const [tradeCountry, setTradeCountry] = useState('');
  const [tradeYear, setTradeYear] = useState('2020');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState(null);

  // Employment state
  const [employmentData, setEmploymentData] = useState([]);
  const [empCountry, setEmpCountry] = useState('');
  const [empYear, setEmpYear] = useState('2020');
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState(null);

  // Load country list + default data on mount
  useEffect(() => {
    fetch('/countries')
      .then(res => res.json())
      .then(data => setCountries(data))
      .catch(() => {});

    // Auto-load trade data for default year
    setTradeLoading(true);
    fetch('/trade?year=2020')
      .then(res => res.json())
      .then(data => { setTradeData(data); setTradeLoading(false); })
      .catch(() => { setTradeError('Could not load trade data'); setTradeLoading(false); });

    // Auto-load employment data for default year
    setEmpLoading(true);
    fetch('/employment?year=2020')
      .then(res => res.json())
      .then(data => { setEmploymentData(data); setEmpLoading(false); })
      .catch(() => { setEmpError('Could not load employment data'); setEmpLoading(false); });
  }, []);

  // Fetch trade data
  const handleTradeSearch = async () => {
    setTradeLoading(true);
    setTradeError(null);
    try {
      const params = new URLSearchParams();
      if (tradeCountry) params.append('country', tradeCountry);
      if (tradeYear) params.append('year', tradeYear);
      const res = await fetch(`/trade?${params.toString()}`);
      const data = await res.json();
      setTradeData(data);
    } catch (err) {
      setTradeError('Could not load trade data');
    } finally {
      setTradeLoading(false);
    }
  };

  // Fetch employment data
  const handleEmpSearch = async () => {
    setEmpLoading(true);
    setEmpError(null);
    try {
      const params = new URLSearchParams();
      if (empCountry) params.append('country', empCountry);
      if (empYear) params.append('year', empYear);
      const res = await fetch(`/employment?${params.toString()}`);
      const data = await res.json();
      setEmploymentData(data);
    } catch (err) {
      setEmpError('Could not load employment data');
    } finally {
      setEmpLoading(false);
    }
  };

  const CountryYearControls = ({ country, setCountry, year, setYear, onSearch, label }) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', margin: '16px 0' }}>
      <div>
        <label style={{ display: 'block', marginBottom: 4 }}>Country</label>
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 14 }}
        >
          <option value="">All countries</option>
          {countries.map(c => (
            <option key={c.country_code} value={c.country_code}>
              {c.country_name} ({c.country_code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 4 }}>Year</label>
        <input
          type="number"
          value={year}
          onChange={e => setYear(e.target.value)}
          min="1995"
          max="2023"
          style={{ padding: '6px 10px', fontSize: 14, width: 80 }}
        />
      </div>
      <button
        onClick={onSearch}
        style={{ padding: '7px 18px', fontSize: 14, cursor: 'pointer' }}
      >
        {label}
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 960, margin: '40px auto', padding: '0 20px' }}>
      <h1>Global Trade & Labor Explorer</h1>
      <p>CIS 5500 Final Project — UN Comtrade + ILOSTAT</p>

      <hr />

      {/* ── TRADE SECTION ── */}
      <h2>Trade Flows</h2>
      <CountryYearControls
        country={tradeCountry} setCountry={setTradeCountry}
        year={tradeYear} setYear={setTradeYear}
        onSearch={handleTradeSearch} label="Search Trade"
      />

      {tradeError && <p style={{ color: 'red' }}>{tradeError}</p>}
      {tradeLoading && <p>Loading...</p>}

      {tradeData.length > 0 ? (
        <>
          <p style={{ color: '#555' }}>Showing {tradeData.length} rows</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={th}>Country</th>
                <th style={th}>Year</th>
                <th style={th}>Flow</th>
                <th style={th}>HS Chapter</th>
                <th style={th}>Trade Value (USD)</th>
              </tr>
            </thead>
            <tbody>
              {tradeData.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={td}>{row.country_name} ({row.country_code})</td>
                  <td style={td}>{row.year}</td>
                  <td style={td}>{row.trade_flow}</td>
                  <td style={td}>{row.hs_chapter}</td>
                  <td style={td}>${Number(row.trade_value_usd).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        !tradeLoading && <p style={{ color: '#888' }}>No results found.</p>
      )}

      <hr style={{ margin: '36px 0' }} />

      {/* ── EMPLOYMENT SECTION ── */}
      <h2>Employment Data</h2>
      <CountryYearControls
        country={empCountry} setCountry={setEmpCountry}
        year={empYear} setYear={setEmpYear}
        onSearch={handleEmpSearch} label="Search Employment"
      />

      {empError && <p style={{ color: 'red' }}>{empError}</p>}
      {empLoading && <p>Loading...</p>}

      {employmentData.length > 0 ? (
        <>
          <p style={{ color: '#555' }}>Showing {employmentData.length} rows</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={th}>Country</th>
                <th style={th}>Year</th>
                <th style={th}>Sex</th>
                <th style={th}>ISIC Section</th>
                <th style={th}>Industry</th>
                <th style={th}>Employment (thousands)</th>
                <th style={th}>Quality Flag</th>
              </tr>
            </thead>
            <tbody>
              {employmentData.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={td}>{row.country_name} ({row.country_code})</td>
                  <td style={td}>{row.year}</td>
                  <td style={td}>{row.sex === 'M' ? 'Male' : row.sex === 'F' ? 'Female' : 'Total'}</td>
                  <td style={td}>{row.isic_section}</td>
                  <td style={td}>{row.section_name}</td>
                  <td style={td}>{Number(row.employment_thousands).toLocaleString()}</td>
                  <td style={td}>{row.data_quality_flag || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        !empLoading && <p style={{ color: '#888' }}>No results found.</p>
      )}
    </div>
  );
}

const th = {
  border: '1px solid #ddd',
  padding: '8px 10px',
  textAlign: 'left'
};

const td = {
  border: '1px solid #ddd',
  padding: '7px 10px'
};
