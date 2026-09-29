import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  stations, railLines, passengerRailLines, getStationById, getLineById,
  searchStations, getImportanceBadge, getLineCategoryLabel,
} from '@/data/railwayData';
import {
  findRoute, getRegionColor, buildJourneySegments,
} from '@/utils/routing';
import type { RouteResult, JourneySegment } from '@/utils/routing';
import type { Station } from '@/data/railwayData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Train, MapPin, ArrowRight, Clock, Route, Navigation, Layers, Info,
  Search, X, ChevronDown, Mountain, Building2, TreePine, Castle,
  Repeat, RotateCcw, Package, AlertTriangle,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// STATION COMBOBOX  (inline – uses searchStations from railwayData)
// ────────────────────────────────────────────────────────────────────────────

const IMPORTANCE_COLORS: Record<Station['importance'], string> = {
  hub: '#EF4444', major: '#F97316', regional: '#60A5FA', local: '#6B7280',
};

function StationCombobox({
  label, placeholder, value, onChange, icon: Icon, iconColor,
  excludeFreightOnly = true,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (id: string) => void;
  icon: React.ElementType;
  iconColor: string;
  excludeFreightOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = value ? getStationById(value) : undefined;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchStations(query, { limit: 10, excludeFreightOnly });
  }, [query, excludeFreightOnly]);

  useEffect(() => {
    setOpen(results.length > 0 && query.trim().length > 0);
    setActiveIdx(-1);
  }, [results, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(results[activeIdx].id); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    (listRef.current.children[activeIdx] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <div className="relative">
        {/* Trigger/selected display */}
        {selected && !query ? (
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-600 bg-slate-800 cursor-text"
               onClick={() => { inputRef.current?.focus(); }}>
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: IMPORTANCE_COLORS[selected.importance] }}
            />
            <span className="text-sm text-slate-100 truncate flex-1">{selected.name.english}</span>
            <button onClick={e => { e.stopPropagation(); clear(); }}
                    className="text-slate-500 hover:text-slate-300 transition-colors ml-1">
              <X className="w-3.5 h-3.5" />
            </button>
            <input ref={inputRef} className="sr-only" readOnly />
          </div>
        ) : (
          <div className="relative">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: iconColor }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={selected ? selected.name.english : placeholder}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => { if (query.trim()) setOpen(results.length > 0); }}
              className="w-full h-10 pl-9 pr-8 text-sm rounded-md border border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-colors"
              autoComplete="off"
            />
            {query && (
              <button onClick={clear}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Dropdown */}
        {open && (
          <ul ref={listRef}
              className="absolute top-full mt-1 left-0 right-0 z-50 max-h-72 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
            {results.map((s, i) => (
              <li key={s.id}
                  onMouseDown={e => { e.preventDefault(); select(s.id); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                    i === activeIdx ? 'bg-slate-700' : 'hover:bg-slate-800'
                  }`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: IMPORTANCE_COLORS[s.importance] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-100 truncate">{s.name.english}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {s.region}{s.subRegion !== s.region ? ` › ${s.subRegion}` : ''}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-24">
                  {s.lines.slice(0, 3).map(lid => {
                    const ln = getLineById(lid);
                    return ln ? (
                      <span key={lid} className="text-[9px] px-1 py-0.5 rounded font-bold border"
                            style={{ borderColor: ln.color + '60', color: ln.color, background: ln.color + '15' }}>
                        {lid}
                      </span>
                    ) : null;
                  })}
                  {s.lines.length > 3 && <span className="text-[9px] text-slate-500">+{s.lines.length - 3}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [fromStation, setFromStation] = useState('');
  const [toStation, setToStation] = useState('');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState('all');
  const [lineCategory, setLineCategory] = useState('all');
  const [searchError, setSearchError] = useState('');

  const handleSearch = useCallback(() => {
    setSearchError('');
    if (!fromStation || !toStation) { setSearchError('Vyber odjezdovou i cílovou stanici.'); return; }
    if (fromStation === toStation) { setSearchError('Odjezd a cíl nemohou být stejná stanice.'); return; }
    const result = findRoute(fromStation, toStation, departureTime);
    if (result) { setRoute(result); }
    else { setSearchError('Trasa nebyla nalezena. Zkus jiný čas odjezdu nebo trasu.'); }
  }, [fromStation, toStation, departureTime]);

  const handleSetFrom = (id: string) => {
    setFromStation(id);
    if (toStation === id) setToStation('');
  };
  const handleSetTo = (id: string) => {
    setToStation(id);
    if (fromStation === id) setFromStation('');
  };
  const handleStationClick = useCallback((id: string) => {
    if (!fromStation) setFromStation(id);
    else if (!toStation && id !== fromStation) setToStation(id);
    else if (id === fromStation) setFromStation('');
    else if (id === toStation) setToStation('');
    else setToStation(id);
  }, [fromStation, toStation]);

  const passengerCount = useMemo(() => passengerRailLines.length, []);
  const freightCount   = useMemo(() => railLines.length - passengerCount, [passengerCount]);

  const visibleLines = useMemo(() => {
    if (lineCategory === 'all') return railLines;
    return railLines.filter(l => l.serviceCategory === lineCategory);
  }, [lineCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Train className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-50">MAGE-RAIL</h1>
              <p className="text-xs text-slate-400 -mt-0.5">Magical Accelerated Ground Express v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
              <Route className="w-3 h-3 mr-1" />{stations.length} stanic
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              <Layers className="w-3 h-3 mr-1" />{passengerCount} osobní linky
            </Badge>
            <Badge variant="outline" className="border-orange-500/30 text-orange-400 bg-orange-500/10">
              <Package className="w-3 h-3 mr-1" />{freightCount} nákladní
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search Panel */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
              <Search className="w-5 h-5 text-amber-400" />
              Hledat trasu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StationCombobox
                label="Odkud (odjezd)"
                placeholder="Hledat stanici…"
                value={fromStation}
                onChange={handleSetFrom}
                icon={MapPin}
                iconColor="#F59E0B"
              />
              <StationCombobox
                label="Kam (cíl)"
                placeholder="Hledat stanici…"
                value={toStation}
                onChange={handleSetTo}
                icon={Navigation}
                iconColor="#3B82F6"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Čas odjezdu</label>
                <Input type="time" value={departureTime}
                       onChange={e => setDepartureTime(e.target.value)}
                       className="bg-slate-800 border-slate-600 text-slate-100 h-10" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold h-10">
                  <Search className="w-4 h-4 mr-2" />Hledat spojení
                </Button>
              </div>
            </div>

            {searchError && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />{searchError}
              </div>
            )}

            {fromStation && toStation && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <span className="text-amber-400 font-medium">{getStationById(fromStation)?.name.english}</span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <span className="text-sky-400 font-medium">{getStationById(toStation)?.name.english}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="bg-slate-900 border-slate-700 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                <MapPin className="w-5 h-5 text-emerald-400" />Mapa sítě
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Region:</span>
                <select value={mapFilter} onChange={e => setMapFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200">
                  <option value="all">Vše</option>
                  <option value="Central Lands">Central Lands</option>
                  <option value="Northern Lands">Northern Lands</option>
                  <option value="Northern Plateau">Northern Plateau</option>
                  <option value="Imperial Territory">Imperial Territory</option>
                  <option value="Ende">Ende</option>
                  <option value="Southern Lands">Southern Lands</option>
                </select>
                <Button variant="outline" size="sm"
                        onClick={() => { setFromStation(''); setToStation(''); setRoute(null); }}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2 text-xs">
                  <X className="w-3 h-3 mr-1" />Reset
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <RailwayMap fromStation={fromStation} toStation={toStation}
                        hoveredLine={hoveredLine} route={route} mapFilter={mapFilter}
                        onStationClick={handleStationClick} onLineHover={setHoveredLine} />
          </CardContent>
        </Card>

        {/* Route Results */}
        {route && (
          <RouteResults route={route} fromStation={fromStation} toStation={toStation} />
        )}

        {/* Line Directory */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                <Layers className="w-5 h-5 text-violet-400" />Katalog linek
              </CardTitle>
              <div className="flex items-center gap-1 flex-wrap">
                {(['all','highspeed','express','regional','local','freight'] as const).map(cat => (
                  <button key={cat}
                          onClick={() => setLineCategory(cat)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                            lineCategory === cat
                              ? 'bg-slate-600 border-slate-400 text-slate-100'
                              : 'border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}>
                    {cat === 'all' ? 'Vše' : getLineCategoryLabel(cat, 'cs')}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleLines.map(line => (
                <div key={line.id}
                     className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors"
                     onMouseEnter={() => setHoveredLine(line.id)}
                     onMouseLeave={() => setHoveredLine(null)}>
                  <div className="w-4 h-4 rounded-full border-2 shrink-0"
                       style={{ borderColor: line.color, backgroundColor: line.color + '40' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">{line.name}</div>
                    <div className="text-xs text-slate-500">
                      {line.stations.length} zastávek ·{' '}
                      {Math.round(line.segments.reduce((s, sg) => s + sg.distance, 0))} km
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: line.color }}>
                      {line.trainSet} · {line.maxSpeed} km/h
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs"
                           style={{ borderColor: line.color + '60', color: line.color, background: line.color + '15' }}>
                      {line.id}
                    </Badge>
                    {line.freightOnly && (
                      <Badge variant="outline" className="text-[9px] border-orange-500/40 text-orange-400 bg-orange-500/10 flex items-center gap-0.5">
                        <Package className="w-2.5 h-2.5" />NÁKLADNÍ
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Station Directory */}
        <StationDirectory onSelectStation={id => { handleStationClick(id); }} />
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          <p>MAGE-RAIL Network v2.0 · Frieren Supercontinent · {stations.length} stanic · {railLines.length} linek</p>
          <p className="mt-1 text-xs text-slate-600">
            Osobní vlaky: rychlovlaky · expresní · regionální · S-Bahn/příměstské · horská dráha
            &nbsp;|&nbsp; Nákladní: FG1–FG5 (bez osobní přepravy)
          </p>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RAILWAY MAP  (pan + zoom, 359 stations, freight lines dashed)
// ────────────────────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8;

// Which stations to show labels for at default zoom
const LABEL_IMPORTANCE: Record<Station['importance'], boolean> = {
  hub: true, major: true, regional: false, local: false,
};

function RailwayMap({ fromStation, toStation, hoveredLine, route, mapFilter,
                      onStationClick, onLineHover }: {
  fromStation: string; toStation: string; hoveredLine: string | null;
  route: RouteResult | null; mapFilter: string;
  onStationClick: (id: string) => void; onLineHover: (id: string | null) => void;
}) {
  const svgWidth = 1060;
  const svgHeight = 840;
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<SVGGElement>(null);
  const tfRef = useRef({ scale: 1, x: 0, y: 0 });
  const panRef = useRef({ panning: false, sx: 0, sy: 0, ox: 0, oy: 0, dragged: false });
  const [zoomPct, setZoomPct] = useState(100);
  const [zoomScale, setZoomScale] = useState(1);

  const applyTf = useCallback(() => {
    const g = zoomRef.current;
    if (!g) return;
    const { scale, x, y } = tfRef.current;
    g.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
    setZoomPct(Math.round(scale * 100));
    setZoomScale(scale);
  }, []);

  const resetView = () => { tfRef.current = { scale: 1, x: 0, y: 0 }; applyTf(); };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const svgPt = (cx: number, cy: number) => {
      const pt = svg.createSVGPoint();
      pt.x = cx; pt.y = cy;
      const ctm = svg.getScreenCTM();
      return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { scale, x, y } = tfRef.current;
      const z = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const ns = clamp(scale * z, MIN_ZOOM, MAX_ZOOM);
      const p = svgPt(e.clientX, e.clientY);
      const lx = (p.x - x) / scale;
      const ly = (p.y - y) / scale;
      tfRef.current = { scale: ns, x: p.x - lx * ns, y: p.y - ly * ns };
      applyTf();
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      panRef.current = { panning: true, sx: e.clientX, sy: e.clientY,
                         ox: tfRef.current.x, oy: tfRef.current.y, dragged: false };
      svg.style.cursor = 'grabbing';
    };
    const onMove = (e: MouseEvent) => {
      const p = panRef.current;
      if (!p.panning) return;
      const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) p.dragged = true;
      const ctm = svg.getScreenCTM();
      const px = ctm ? Math.sqrt(ctm.a ** 2 + ctm.b ** 2) : 1;
      tfRef.current = { ...tfRef.current, x: p.ox + dx / px, y: p.oy + dy / px };
      applyTf();
    };
    const onUp = () => { panRef.current.panning = false; svg.style.cursor = 'grab'; };
    const onClickCapture = (e: MouseEvent) => {
      if (panRef.current.dragged) { e.stopPropagation(); panRef.current.dragged = false; }
    };
    svg.style.cursor = 'grab';
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    svg.addEventListener('click', onClickCapture, true);
    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      svg.removeEventListener('click', onClickCapture, true);
    };
  }, [applyTf]);

  const routeIds = useMemo(() => {
    if (!route) return new Set<string>();
    const s = new Set<string>();
    s.add(fromStation); s.add(toStation);
    route.legs.forEach(l => { s.add(l.from.id); s.add(l.to.id); });
    return s;
  }, [route, fromStation, toStation]);

  const routeKeys = useMemo(() => {
    if (!route) return new Set<string>();
    const s = new Set<string>();
    route.legs.forEach(l => {
      s.add(`${l.line.id}:${l.from.id}|${l.to.id}`);
      s.add(`${l.line.id}:${l.to.id}|${l.from.id}`);
    });
    return s;
  }, [route]);

  const filteredStns = useMemo(() =>
    mapFilter === 'all' ? stations : stations.filter(s => s.region === mapFilter),
  [mapFilter]);

  const showLabel = (s: Station) => {
    if (s.id === fromStation || s.id === toStation) return true;
    if (route && routeIds.has(s.id)) return true;
    if (zoomScale >= 2) return s.importance !== 'local';
    if (zoomScale >= 4) return true;
    return LABEL_IMPORTANCE[s.importance];
  };

  const stationR = (s: Station) => {
    if (s.id === fromStation || s.id === toStation) return 9;
    if (route && routeIds.has(s.id)) return 7;
    if (s.importance === 'hub') return 6;
    if (s.importance === 'major') return 5;
    if (s.importance === 'regional') return 3.5;
    return 2;
  };

  const stationColor = (s: Station) => {
    if (s.id === fromStation) return '#F59E0B';
    if (s.id === toStation) return '#3B82F6';
    if (route && routeIds.has(s.id)) return '#FBBF24';
    return IMPORTANCE_COLORS[s.importance];
  };

  const curvePath = (x1: number, y1: number, x2: number, y2: number, bend = 0) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  // Bend offsets per line to avoid complete overlap
  const BENDS: Record<string, number> = {
    L1: 0, L2: 20, L3: -20, L4: 25, L5: -25, L6: 14, L7: -14,
    L8: 30, L10: 0, L11: 0, L12: 16,
  };

  return (
    <div className="w-full overflow-x-auto relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg px-2 py-1">
        <span className="text-[10px] text-slate-400 tabular-nums w-9 text-right">{zoomPct}%</span>
        <Button variant="outline" size="sm" onClick={resetView}
                className="h-6 px-1.5 border-slate-600 text-slate-300 hover:bg-slate-800" title="Reset">
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${svgWidth} ${svgHeight}`}
           className="w-full min-w-[800px] select-none touch-none" style={{ background: '#080F1E' }}>
        <defs>
          <filter id="neonGlow" x="-75%" y="-75%" width="250%" height="250%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b2" />
            <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="panelShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.6" />
          </filter>

          {/* Region gradients */}
          <radialGradient id="gC" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0D3D38" stopOpacity="0.85" /><stop offset="100%" stopColor="#0A2520" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="gN" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0B2E1A" stopOpacity="0.85" /><stop offset="100%" stopColor="#071A0E" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="gP" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0D2A40" stopOpacity="0.85" /><stop offset="100%" stopColor="#061520" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="gI" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1E1035" stopOpacity="0.85" /><stop offset="100%" stopColor="#0E0820" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="gE" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#2A0A0A" stopOpacity="0.9" /><stop offset="100%" stopColor="#150505" stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id="gS" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#2A1A04" stopOpacity="0.85" /><stop offset="100%" stopColor="#150D02" stopOpacity="0.5" />
          </radialGradient>

          <pattern id="hatchM" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="12" stroke="#1E3A5A" strokeWidth="0.8" strokeOpacity="0.4" />
          </pattern>
          <pattern id="dotF" patternUnits="userSpaceOnUse" width="14" height="14">
            <circle cx="7" cy="7" r="1.2" fill="#1A3D22" fillOpacity="0.5" />
          </pattern>
        </defs>

        <g ref={zoomRef}>
          {/* Region zones */}
          <polygon points="260,510 700,510 720,830 240,830" fill="url(#gC)" stroke="#1A5C55" strokeWidth="1.5" strokeOpacity="0.5" />
          <polygon points="20,60 560,60 560,520 260,520 240,620 20,620" fill="url(#gN)" stroke="#1A4A2A" strokeWidth="1.5" strokeOpacity="0.5" />
          <polygon points="20,60 560,60 560,520 260,520 240,620 20,620" fill="url(#dotF)" />
          <polygon points="520,0 1060,0 1060,230 400,230 400,65 520,65" fill="url(#gP)" stroke="#1A3D5C" strokeWidth="1.5" strokeOpacity="0.5" />
          <polygon points="520,0 1060,0 1060,230 400,230 400,65 520,65" fill="url(#hatchM)" />
          <polygon points="0,300 240,300 260,520 20,620 0,620" fill="url(#gI)" stroke="#3D2870" strokeWidth="1.5" strokeOpacity="0.5" />
          <polygon points="0,0 320,0 320,300 0,300" fill="url(#gE)" stroke="#5A1010" strokeWidth="1.5" strokeOpacity="0.6" />
          <polygon points="540,720 820,720 820,840 540,840" fill="url(#gS)" stroke="#5C3D10" strokeWidth="1.5" strokeOpacity="0.5" />

          {/* Region labels */}
          {[
            { x: 460, y: 752, text: 'CENTRAL LANDS', col: '#2A9D8F' },
            { x: 246, y: 184, text: 'NORTHERN LANDS', col: '#22C55E' },
            { x: 774, y: 80, text: 'N. PLATEAU', col: '#7DD3FC' },
            { x: 98, y: 420, text: 'IMPERIAL TERR.', col: '#A78BFA' },
            { x: 110, y: 30, text: 'ENDE', col: '#EF4444' },
            { x: 660, y: 776, text: 'SOUTHERN LANDS', col: '#F59E0B' },
          ].map(({ x, y, text, col }) => (
            <text key={text} x={x} y={y} fill={col} fontSize="12" fontWeight="bold"
                  textAnchor="middle" fontFamily="monospace" letterSpacing="1" opacity="0.85">{text}</text>
          ))}

          {/* Rail lines */}
          {railLines.map(line =>
            line.segments.map((seg, si) => {
              const from = stations.find(s => s.id === seg.from);
              const to   = stations.find(s => s.id === seg.to);
              if (!from || !to) return null;
              const isFiltered = mapFilter !== 'all' && from.region !== mapFilter && to.region !== mapFilter;
              const isActive = route ? routeKeys.has(`${line.id}:${seg.from}|${seg.to}`) : false;
              const bend = BENDS[line.id] ?? 0;
              const d = curvePath(from.x, from.y, to.x, to.y, bend);
              const opacity = isFiltered ? 0.04
                : route ? (isActive ? 1 : 0.2)
                : hoveredLine && hoveredLine !== line.id ? 0.1
                : hoveredLine === line.id ? 1 : 0.55;
              const sw = isActive ? 6 : line.serviceCategory === 'local' ? 1.5 : line.freightOnly ? 2 : 2.5;
              return (
                <path key={`${line.id}-${si}`} d={d}
                      stroke={route ? (isActive ? line.color : '#1E2D3D') : line.color}
                      strokeWidth={sw} fill="none" opacity={opacity} strokeLinecap="round"
                      strokeDasharray={line.freightOnly ? '8 5' : line.serviceCategory === 'local' ? '4 3' : undefined}
                      filter={isActive ? 'url(#neonGlow)' : undefined}
                      onMouseEnter={() => onLineHover(line.id)} onMouseLeave={() => onLineHover(null)}
                      style={{ cursor: 'pointer' }} />
              );
            })
          )}

          {/* Route pulse */}
          {route && route.legs.map((leg, i) => {
            const d = curvePath(leg.from.x, leg.from.y, leg.to.x, leg.to.y, BENDS[leg.line.id] ?? 0);
            return (
              <path key={`rp-${i}`} d={d} stroke="#FFFFFF" strokeWidth="2" fill="none"
                    opacity="0.65" strokeLinecap="round" strokeDasharray="6 14">
                <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="1.1s" repeatCount="indefinite" />
              </path>
            );
          })}

          {/* Stations */}
          {filteredStns.map(s => {
            const inRoute = !!route && routeIds.has(s.id);
            const isEp = s.id === fromStation || s.id === toStation;
            const r = stationR(s);
            const col = stationColor(s);
            const op = mapFilter !== 'all' && s.region !== mapFilter ? 0.12
                     : route && !inRoute ? 0.25 : 1;
            const showLbl = showLabel(s);
            return (
              <g key={s.id} onClick={() => onStationClick(s.id)}
                 style={{ cursor: 'pointer' }} opacity={op}
                 filter={inRoute ? 'url(#neonGlow)' : undefined}>
                {(isEp || inRoute || s.importance === 'hub') && (
                  <circle cx={s.x} cy={s.y} r={r + (isEp ? 9 : 5)} fill={col} opacity={isEp ? 0.25 : 0.12} />
                )}
                {s.importance === 'hub' && !isEp ? (
                  <polygon points={`${s.x},${s.y - r - 2} ${s.x + r + 2},${s.y} ${s.x},${s.y + r + 2} ${s.x - r - 2},${s.y}`}
                           fill={col} stroke="#080F1E" strokeWidth="2" />
                ) : (
                  <circle cx={s.x} cy={s.y} r={r} fill={col} stroke="#080F1E" strokeWidth={r > 3 ? 1.5 : 0.8} />
                )}
                {showLbl && (
                  <text x={s.x} y={s.y - r - 4} fill={isEp ? '#F1F5F9' : inRoute ? '#E2E8F0' : '#64748B'}
                        fontSize={s.importance === 'hub' || isEp ? 10 : 8}
                        fontWeight={s.importance === 'hub' || isEp ? 'bold' : 'normal'}
                        textAnchor="middle" fontFamily="monospace">
                    {s.name.english.length > 20 ? s.name.english.slice(0, 20) + '…' : s.name.english}
                  </text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(16,${svgHeight - 210})`} filter="url(#panelShadow)">
            <rect x={0} y={0} width={200} height={200} fill="#0D1B2A" rx={10} stroke="#1E3A5C" strokeWidth="1" />
            <text x={12} y={18} fill="#7DD3FC" fontSize={10} fontWeight="bold" fontFamily="monospace">MAPA – LEGENDA</text>
            <line x1={12} x2={188} y1={24} y2={24} stroke="#1E3A5C" strokeWidth="0.8" />

            {/* Station types */}
            <text x={12} y={38} fill="#475569" fontSize={9} fontFamily="monospace">STANICE</text>
            {[
              { y: 52, r: 7, diamond: true, col: '#EF4444', lbl: 'Hlavní uzel (hub)' },
              { y: 68, r: 5, diamond: false, col: '#F97316', lbl: 'Velká stanice' },
              { y: 82, r: 3.5, diamond: false, col: '#60A5FA', lbl: 'Regionální' },
              { y: 94, r: 2, diamond: false, col: '#6B7280', lbl: 'Místní zastávka' },
            ].map(({ y, r, diamond, col, lbl }) => (
              <g key={lbl}>
                {diamond
                  ? <polygon points={`22,${y-r-1} ${22+r+1},${y} 22,${y+r+1} ${22-r-1},${y}`} fill={col} />
                  : <circle cx={22} cy={y} r={r} fill={col} />
                }
                <text x={36} y={y+4} fill="#CBD5E1" fontSize={10} fontFamily="monospace">{lbl}</text>
              </g>
            ))}

            {/* Line types */}
            <line x1={12} x2={188} y1={108} y2={108} stroke="#1E3A5C" strokeWidth="0.8" />
            <text x={12} y={120} fill="#475569" fontSize={9} fontFamily="monospace">TYPY LINEK</text>
            {[
              { y: 134, dash: undefined, col: '#E63946', lbl: 'Rychlovlak / Expresní' },
              { y: 148, dash: '4 3', col: '#A8DADC', lbl: 'Regionální / S-Bahn' },
              { y: 162, dash: '8 5', col: '#6C4E31', lbl: 'Nákladní (bez cestujících)' },
            ].map(({ y, dash, col, lbl }) => (
              <g key={lbl}>
                <line x1={12} x2={60} y1={y} y2={y} stroke={col} strokeWidth={2} strokeDasharray={dash} />
                <text x={68} y={y+4} fill="#CBD5E1" fontSize={9} fontFamily="monospace">{lbl}</text>
              </g>
            ))}

            {/* Route */}
            <line x1={12} x2={188} y1={176} y2={176} stroke="#1E3A5C" strokeWidth="0.8" />
            <line x1={12} x2={60} y1={190} y2={190} stroke="#FFF" strokeWidth={2} strokeDasharray="5 8" strokeOpacity="0.7" />
            <text x={68} y={194} fill="#CBD5E1" fontSize={9} fontFamily="monospace">Aktivní trasa</text>
          </g>

          {/* Compass */}
          <g transform="translate(930,760)" filter="url(#panelShadow)">
            <circle cx={0} cy={0} r={34} fill="#0D1B2A" stroke="#1E3A5C" strokeWidth="1" />
            <polygon points="0,-28 5,-10 0,-16 -5,-10" fill="#7DD3FC" opacity="0.9" />
            <polygon points="0,28 5,10 0,16 -5,10" fill="#334155" />
            <polygon points="28,0 10,-5 16,0 10,5" fill="#334155" />
            <polygon points="-28,0 -10,-5 -16,0 -10,5" fill="#334155" />
            <circle cx={0} cy={0} r={3} fill="#7DD3FC" />
            <text x={0} y={-32} fill="#7DD3FC" fontSize={9} fontWeight="bold" textAnchor="middle" fontFamily="monospace">N</text>
            <text x={0} y={42} fill="#475569" fontSize={8} textAnchor="middle" fontFamily="monospace">S</text>
            <text x={38} y={3} fill="#475569" fontSize={8} textAnchor="middle" fontFamily="monospace">E</text>
            <text x={-38} y={3} fill="#475569" fontSize={8} textAnchor="middle" fontFamily="monospace">W</text>
          </g>
        </g>
      </svg>

      <div className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-slate-800 bg-slate-900/60">
        Scroll = zoom · Tažení = posun · Kliknutí na stanici = nastavit odkud/kam
        {' · '}Přerušované linie = nákladní tratě
        {' · '}Diamant = hlavní uzel
        {' · '}Nákladní stanice nelze vybrat jako cíl cesty
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ROUTE RESULTS  (IDOS-style timeline, unchanged from v1)
// ────────────────────────────────────────────────────────────────────────────

function RouteResults({ route, fromStation, toStation }: {
  route: RouteResult; fromStation: string; toStation: string;
}) {
  const from = getStationById(fromStation);
  const to = getStationById(toStation);
  const segments = useMemo(() => buildJourneySegments(route), [route]);
  if (!from || !to) return null;

  const fmt = (t?: string) => t ?? '--:--';
  const dur = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m/60)}h${m%60 ? ` ${m%60}m` : ''}`;
  const getTimes = (seg: JourneySegment, sid: string) => {
    const e = seg.trainService?.schedule.find(s => s.stationId === sid);
    return e ? { arr: e.arrivalTime, dep: e.departureTime } : null;
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
          <Route className="w-5 h-5 text-amber-400" />Výsledky hledání trasy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { lbl: 'Vzdálenost', val: `${route.totalDistance}`, unit: 'km' },
            { lbl: 'Jízdní doba', val: `${Math.floor(route.totalTravelTime/60)}h ${route.totalTravelTime%60}m`, unit: '' },
            { lbl: 'Přestupy', val: `${route.transfers.length}`, unit: route.transfers.length===1?'přestup':'přestupů' },
            { lbl: 'Celkem', val: `${Math.floor(route.totalTime/60)}h ${route.totalTime%60}m`, unit: '', amber: true },
          ].map(({ lbl, val, unit, amber }) => (
            <div key={lbl} className="p-3 rounded-lg bg-slate-800 border border-slate-700">
              <div className="text-xs text-slate-400">{lbl}</div>
              <div className={`text-xl font-bold ${amber ? 'text-amber-400' : 'text-slate-100'}`}>
                {val} {unit && <span className="text-sm font-normal text-slate-400">{unit}</span>}
              </div>
            </div>
          ))}
        </div>
        <Separator className="bg-slate-700" />

        {/* Category warning for freight */}
        {route.legs.some(l => l.line.freightOnly) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Upozornění: trasa obsahuje nákladní úsek – za normálních okolností není přístupný cestujícím.
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2">
          {segments.map((seg, si) => {
            const isFirst = si === 0, isLast = si === segments.length - 1;
            return (
              <div key={si}>
                <div className="rounded-lg border overflow-hidden"
                     style={{ borderColor: seg.line.color + '35', background: `linear-gradient(180deg,${seg.line.color}12,transparent 55%)` }}>
                  {/* Segment header */}
                  <div className="flex items-center justify-between flex-wrap gap-2 px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Train className="w-4 h-4 shrink-0" style={{ color: seg.line.color }} />
                      <Badge variant="outline" className="text-xs"
                             style={{ borderColor: seg.line.color+'60', color: seg.line.color, background: seg.line.color+'15' }}>
                        {seg.line.id}: {seg.line.name.split('(')[0].trim()}
                      </Badge>
                      <Badge variant="outline" className="text-xs"
                             style={{ borderColor: seg.line.color+'60', color: seg.line.color, background: seg.line.color+'15' }}>
                        {seg.line.trainSet} · {seg.line.maxSpeed} km/h
                      </Badge>
                      {seg.line.freightOnly && (
                        <Badge variant="outline" className="text-xs border-orange-500/40 text-orange-400">
                          <Package className="w-3 h-3 mr-1" />NÁKLADNÍ
                        </Badge>
                      )}
                      {seg.trainService && (
                        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                          {seg.trainService.serviceName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{dur(seg.travelTime)}</span>
                      <span className="flex items-center gap-1"><Route className="w-3 h-3" />{seg.distance} km</span>
                    </div>
                  </div>

                  {/* Stops */}
                  <div className="px-4 pb-3">
                    {seg.stops.map((stop, stopIdx) => {
                      const next = seg.stops[stopIdx + 1];
                      const connActive = stop.isActive && !!next?.isActive;
                      const isEp = stop.role === 'board' || stop.role === 'alight';
                      const isTStart = isFirst && stop.role === 'board';
                      const isTEnd = isLast && stop.role === 'alight';
                      const times = getTimes(seg, stop.station.id);
                      const dotCol = isTStart ? '#F59E0B' : isTEnd ? '#3B82F6'
                                   : stop.isActive ? seg.line.color : '#475569';
                      const ds = isEp ? 12 : stop.isActive ? 8 : 5;
                      return (
                        <div key={`${stop.station.id}-${stopIdx}`} className="relative flex gap-2 items-start">
                          <div className={`w-[72px] shrink-0 text-right ${stop.isActive ? '' : 'opacity-30 grayscale'}`}>
                            <div className="h-[20px] flex items-center justify-end">
                              {times && (
                                <span className="font-mono tabular-nums text-[10px] text-slate-400 whitespace-nowrap leading-none">
                                  {times.arr === times.dep ? fmt(times.dep) : `${fmt(times.arr)} – ${fmt(times.dep)}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-center w-4 shrink-0">
                            <div className="h-[20px] flex items-center justify-center">
                              <div className="rounded-full" style={{
                                width: ds, height: ds, backgroundColor: dotCol,
                                boxShadow: stop.isActive ? `0 0 8px ${dotCol}AA` : 'none',
                                opacity: stop.isActive ? 1 : 0.3,
                              }} />
                            </div>
                            {stopIdx < seg.stops.length - 1 && (
                              <div className="flex-1 w-0.5" style={{
                                minHeight: isEp ? 26 : 18,
                                backgroundColor: connActive ? seg.line.color : '#334155',
                                opacity: connActive ? 0.9 : 0.3,
                              }} />
                            )}
                          </div>
                          <div className={`flex-1 pb-1 ${stop.isActive ? '' : 'opacity-30 grayscale'}`}>
                            <div className="h-[20px] flex items-center gap-2 flex-wrap">
                              <span className={isEp ? 'text-sm font-semibold text-slate-100'
                                             : stop.isActive ? 'text-sm text-slate-300' : 'text-xs text-slate-500'}>
                                {stop.station.name.english}
                              </span>
                              {isTStart && <Badge variant="outline" className="text-[10px] py-0 border-amber-500/30 text-amber-400">ODJEZD</Badge>}
                              {isTEnd && <Badge variant="outline" className="text-[10px] py-0 border-sky-500/30 text-sky-400">PŘÍJEZD</Badge>}
                              {stop.role === 'board' && !isTStart && <Badge variant="outline" className="text-[10px] py-0 border-slate-600 text-slate-400">NÁSTUP</Badge>}
                              {stop.role === 'alight' && !isTEnd && <Badge variant="outline" className="text-[10px] py-0 border-slate-600 text-slate-400">VÝSTUP</Badge>}
                            </div>
                            {stop.isActive && (
                              <div className="text-[11px] text-slate-500">
                                {stop.station.name.kanji} / {stop.station.name.romaji}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Transfer */}
                {seg.transferAfter && (
                  <div className="flex items-start gap-3 my-2 ml-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Repeat className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-amber-400">Přestup v {seg.transferAfter.at.name.english}</div>
                      <div className="text-xs text-slate-500">
                        {seg.transferAfter.fromLine.name.split('(')[0].trim()} → {seg.transferAfter.toLine.name.split('(')[0].trim()}
                      </div>
                      <div className={`text-xs mt-0.5 flex items-center gap-1 ${seg.transferAfter.waitTime >= 120 ? 'text-orange-400 font-medium' : 'text-slate-500'}`}>
                        <Clock className="w-3 h-3" />čekání {dur(seg.transferAfter.waitTime)}
                        {seg.transferAfter.waitTime >= 120 && (
                          <Badge variant="outline" className="ml-1 text-[10px] py-0 border-orange-500/30 text-orange-400">DLOUHÉ ČEKÁNÍ</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// STATION DIRECTORY  (collapsible by region, searchable, with importance badges)
// ────────────────────────────────────────────────────────────────────────────

function StationDirectory({ onSelectStation }: { onSelectStation: (id: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');

  const regions = useMemo(() => {
    const r = new Map<string, Station[]>();
    stations.forEach(s => { const l = r.get(s.region) ?? []; l.push(s); r.set(s.region, l); });
    return r;
  }, []);

  const filtered = useMemo(() => {
    const out = new Map<string, Station[]>();
    regions.forEach((list, region) => {
      const m = list.filter(s => {
        if (importanceFilter !== 'all' && s.importance !== importanceFilter) return false;
        if (!term.trim()) return true;
        const q = term.toLowerCase();
        return s.name.english.toLowerCase().includes(q)
            || s.name.czech.toLowerCase().includes(q)
            || s.name.romaji.toLowerCase().includes(q)
            || s.name.kanji.includes(term)
            || s.id.toLowerCase().includes(q);
      });
      if (m.length) out.set(region, m);
    });
    return out;
  }, [regions, term, importanceFilter]);

  const icons: Record<string, React.ReactNode> = {
    'Central Lands': <Building2 className="w-4 h-4" />,
    'Northern Lands': <TreePine className="w-4 h-4" />,
    'Northern Plateau': <Mountain className="w-4 h-4" />,
    'Imperial Territory': <Castle className="w-4 h-4" />,
    'Ende': <MapPin className="w-4 h-4" />,
    'Southern Lands': <MapPin className="w-4 h-4" />,
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
          <MapPin className="w-5 h-5 text-sky-400" />Adresář stanic
        </CardTitle>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Input placeholder="Hledat stanici (EN/CZ/romaji/kanji/ID)…"
                 value={term} onChange={e => setTerm(e.target.value)}
                 className="bg-slate-800 border-slate-600 text-slate-100 flex-1 min-w-48" />
          <select value={importanceFilter} onChange={e => setImportanceFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded px-2 text-xs text-slate-200">
            <option value="all">Všechny typy</option>
            <option value="hub">● Hlavní uzly</option>
            <option value="major">◉ Velké stanice</option>
            <option value="regional">○ Regionální</option>
            <option value="local">· Místní zastávky</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from(filtered.entries()).map(([region, list]) => (
            <div key={region} className="rounded-lg border border-slate-700 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                onClick={() => setExpanded(expanded === region ? null : region)}>
                <div className="flex items-center gap-2">
                  <span style={{ color: getRegionColor(region) }}>{icons[region] ?? <MapPin className="w-4 h-4" />}</span>
                  <span className="font-medium text-slate-200">{region}</span>
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{list.length}</Badge>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded === region ? 'rotate-180' : ''}`} />
              </button>
              {expanded === region && (
                <div className="p-2 bg-slate-900/50 grid grid-cols-1 md:grid-cols-2 gap-1">
                  {list.map(s => (
                    <div key={s.id}
                         onClick={() => onSelectStation(s.id)}
                         className="p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs" style={{ color: IMPORTANCE_COLORS[s.importance] }}>
                            {getImportanceBadge(s.importance)}
                          </span>
                          <span className="text-sm font-medium text-slate-200 truncate">{s.name.english}</span>
                        </div>
                        <div className="flex gap-0.5 shrink-0 flex-wrap justify-end max-w-20">
                          {s.lines.slice(0, 3).map(lid => {
                            const ln = getLineById(lid);
                            return ln ? (
                              <span key={lid} className="w-2.5 h-2.5 rounded-full inline-block"
                                    style={{ backgroundColor: ln.color }} title={ln.name} />
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {s.name.kanji} · {s.name.czech}
                      </div>
                      <div className="text-xs text-slate-600">{s.subRegion}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
