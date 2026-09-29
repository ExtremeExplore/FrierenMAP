import { useState, useRef, useEffect, useCallback } from 'react';
import {
  searchStations,
  getImportanceBadge,
  getImportanceLabel,
  railLines,
  stations,
  type Station,
} from '@/data/railwayData';

// ─── types ────────────────────────────────────────────────────────────────────

interface StationSearchProps {
  label?: string;
  placeholder?: string;
  value?: Station | null;
  onChange?: (station: Station | null) => void;
  /** If true, freight-only stations are hidden from results */
  excludeFreightOnly?: boolean;
  /** Only show stations served by this line */
  lineFilter?: string;
  /** Limit results shown */
  limit?: number;
  /** Additional className for the wrapper */
  className?: string;
  disabled?: boolean;
}

// ─── badge colour per importance ─────────────────────────────────────────────
const IMPORTANCE_COLOURS: Record<Station['importance'], string> = {
  hub:      '#E63946',
  major:    '#F4A261',
  regional: '#457B9D',
  local:    '#6c757d',
};

// ─── get all unique regions ───────────────────────────────────────────────────
const ALL_REGIONS: string[] = [...new Set(stations.map((s: Station) => s.region))].sort();

// ─── helper: get lines serving a station, with metadata ──────────────────────
function getStationLines(station: Station) {
  return station.lines
    .map((lid: string) => railLines.find((l) => l.id === lid))
    .filter(Boolean) as typeof railLines;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function StationSearch({
  label,
  placeholder = 'Hledat stanici / Search station…',
  value,
  onChange,
  excludeFreightOnly = true,
  lineFilter,
  limit = 12,
  className = '',
  disabled = false,
}: StationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [regionFilter, setRegionFilter] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── search whenever query changes ─────────────────────────────────────────
  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const found = searchStations(q, {
      limit,
      regionFilter: regionFilter || undefined,
      lineFilter: lineFilter || undefined,
      excludeFreightOnly,
    });
    setResults(found);
    setOpen(true);
    setActiveIdx(-1);
  }, [regionFilter, lineFilter, excludeFreightOnly, limit]);

  useEffect(() => { runSearch(query); }, [query, runSearch]);

  // ── click outside closes dropdown ─────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── keyboard navigation ────────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      select(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // ── scroll active item into view ──────────────────────────────────────────
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIdx] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function select(s: Station) {
    onChange?.(s);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange?.(null);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={`station-search ${className}`} style={wrapStyle}>
      {label && (
        <label style={labelStyle}>{label}</label>
      )}

      {/* Filter row */}
      <div style={filterRowStyle}>
        <select
          value={regionFilter}
          onChange={e => { setRegionFilter(e.target.value); runSearch(query); }}
          style={selectStyle}
          disabled={disabled}
          title="Filter by region"
        >
          <option value="">All regions</option>
          {ALL_REGIONS.map((r: string) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Input row */}
      <div style={{ position: 'relative' }}>
        <div style={{
          ...inputWrapStyle,
          borderColor: focused ? '#457B9D' : '#555',
          background: disabled ? '#1a1a1a' : '#111',
        }}>
          {/* Search icon */}
          <span style={{ color: '#888', marginRight: 6, flexShrink: 0 }}>🔍</span>

          {/* Selected badge OR input */}
          {value && !focused ? (
            <div style={selectedBadgeStyle} onClick={() => { setFocused(true); inputRef.current?.focus(); }}>
              <span style={{ color: IMPORTANCE_COLOURS[value.importance], marginRight: 4 }}>
                {getImportanceBadge(value.importance)}
              </span>
              <span style={{ fontWeight: 600 }}>{value.name.english}</span>
              <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>
                {value.region}
              </span>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={placeholder}
              disabled={disabled}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => { setFocused(true); if (query) setOpen(true); }}
              onKeyDown={onKeyDown}
              style={inputStyle}
              autoComplete="off"
              spellCheck={false}
            />
          )}

          {/* Clear button */}
          {(value || query) && !disabled && (
            <button onClick={clear} style={clearBtnStyle} title="Clear">✕</button>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <ul ref={listRef} style={dropdownStyle}>
            {results.map((s, i) => (
              <ResultItem
                key={s.id}
                station={s}
                active={i === activeIdx}
                onSelect={() => select(s)}
                onHover={() => setActiveIdx(i)}
              />
            ))}
            {results.length === limit && (
              <li style={moreHintStyle}>
                Zobrazeno prvních {limit} výsledků – upřesněte hledání
              </li>
            )}
          </ul>
        )}

        {open && query.trim() && results.length === 0 && (
          <div style={emptyStyle}>
            Žádná stanice nenalezena / No station found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ResultItem ───────────────────────────────────────────────────────────────
function ResultItem({
  station,
  active,
  onSelect,
  onHover,
}: {
  station: Station;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const servingLines = getStationLines(station).slice(0, 5);

  return (
    <li
      onMouseDown={e => { e.preventDefault(); onSelect(); }}
      onMouseEnter={onHover}
      style={{
        ...resultItemStyle,
        background: active ? '#1e3a5f' : 'transparent',
        borderLeft: active ? '3px solid #457B9D' : '3px solid transparent',
      }}
    >
      {/* Left: importance badge */}
      <span style={{
        color: IMPORTANCE_COLOURS[station.importance],
        fontSize: 18,
        marginRight: 8,
        flexShrink: 0,
        lineHeight: 1,
      }}>
        {getImportanceBadge(station.importance)}
      </span>

      {/* Centre: names + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#f0f0f0' }}>
            {station.name.english}
          </span>
          <span style={{ fontSize: 10, color: '#999', fontStyle: 'italic' }}>
            {station.name.romaji}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#7a9ab0', marginTop: 1 }}>
          {station.region}
          {station.subRegion !== station.region && ` › ${station.subRegion}`}
        </div>
        {/* Line pills */}
        {servingLines.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
            {servingLines.map(l => (
              <span key={l.id} style={{
                ...linePillStyle,
                background: l.color + '33',
                borderColor: l.color,
                color: l.color,
              }}>
                {l.id}
                {l.freightOnly && ' 📦'}
              </span>
            ))}
            {station.lines.length > 5 && (
              <span style={{ ...linePillStyle, borderColor: '#555', color: '#888' }}>
                +{station.lines.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: importance label */}
      <span style={{
        fontSize: 10,
        color: IMPORTANCE_COLOURS[station.importance] + 'cc',
        flexShrink: 0,
        textAlign: 'right',
        marginLeft: 4,
      }}>
        {getImportanceLabel(station.importance)}
      </span>
    </li>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const wrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  color: '#f0f0f0',
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#aaa',
};
const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
};
const selectStyle: React.CSSProperties = {
  flex: 1,
  background: '#1a1a1a',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
};
const inputWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1.5px solid #555',
  borderRadius: 8,
  padding: '7px 10px',
  gap: 6,
  transition: 'border-color 0.15s',
  cursor: 'text',
};
const selectedBadgeStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#f0f0f0',
  fontSize: 13,
  minWidth: 0,
};
const clearBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#777',
  cursor: 'pointer',
  fontSize: 12,
  padding: '0 2px',
  flexShrink: 0,
};
const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: '#141414',
  border: '1px solid #333',
  borderRadius: 8,
  listStyle: 'none',
  margin: 0,
  padding: '4px 0',
  maxHeight: 380,
  overflowY: 'auto',
  zIndex: 9999,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};
const resultItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '8px 12px',
  cursor: 'pointer',
  transition: 'background 0.08s',
};
const moreHintStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 11,
  color: '#666',
  borderTop: '1px solid #222',
  fontStyle: 'italic',
};
const emptyStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: '#141414',
  border: '1px solid #333',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 12,
  color: '#666',
  zIndex: 9999,
};
const linePillStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 5px',
  borderRadius: 4,
  border: '1px solid',
  fontWeight: 700,
  letterSpacing: '0.03em',
};
