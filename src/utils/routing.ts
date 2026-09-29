import {
  stations,
  railLines,
  getStationById,
  allTrainServices,
} from '@/data/railwayData';
import type { Station, RailLine, LineSegment, TrainService } from '@/data/railwayData';

// ============================================================
// ROUTING ALGORITHM - schedule-true earliest-arrival search
//
// This is a Connection Scan Algorithm (CSA): every individual hop of
// every real scheduled train (a "connection") is expanded across several
// days, sorted by departure time, and scanned once. A station's
// earliest-arrival label only ever improves when an actually-catchable
// train gets it there sooner - so the search is correct by construction
// against the REAL timetable. There's no separate "estimate now, resolve
// the real schedule later" pass, which is what previously let the search
// pick a route requiring a pointless transfer-and-back: the estimate
// phase used a flat 15-minute guess per transfer and had no visibility
// into the fact that these are rare expresses (as few as 4 trips/day per
// line), so a connection that looked good on paper could actually mean
// hours of real waiting. Scanning real departures directly means a
// pointless detour can never beat just staying on the through train,
// because the through-train option is one of the connections being
// scanned too, and whichever path actually arrives earliest wins.
// ============================================================

export interface RouteLeg {
  from: Station;
  to: Station;
  line: RailLine;
  segment: LineSegment;
  travelTime: number; // minutes
  distance: number; // km
  trainNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
}

export interface TransferInfo {
  at: Station;
  fromLine: RailLine;
  toLine: RailLine;
  waitTime: number; // minutes
}

export interface RouteResult {
  legs: RouteLeg[];
  transfers: TransferInfo[];
  totalDistance: number;
  totalTravelTime: number;
  totalWaitTime: number;
  totalTime: number; // travel + wait
  trainServices: { legIndex: number; service: TrainService }[];
}

// Minimum realistic time to physically change platforms/services at a
// large transcontinental interchange.
const MIN_TRANSFER_CONNECTION = 10;

// How many days ahead to expand each daily-repeating service. These are
// rare expresses (as few as 4 trips/day), so a multi-leg cross-continent
// itinerary can genuinely need to wait for "tomorrow's" departure more
// than once - this window is generous enough to always find a path on a
// connected network without the connections list getting unreasonably
// large (still only a few thousand entries for this size of network).
const SEARCH_DAYS = 10;

interface Connection {
  trainNumber: string;
  tripId: string; // trainNumber + day - identifies one specific physical run, since the same trainNumber repeats daily
  lineId: string;
  fromId: string;
  toId: string;
  depMin: number; // absolute minutes from the search's day-0 00:00
  arrMin: number;
  segment: LineSegment;
}

interface ConnectionScanResult {
  arrivalMin: number;
  // chain of connections actually ridden, in travel order
  hops: Connection[];
}

function buildLineSegmentLookup(): Map<string, LineSegment> {
  const lookup = new Map<string, LineSegment>();
  for (const line of railLines) {
    for (const seg of line.segments) {
      lookup.set(`${line.id}:${seg.from}:${seg.to}`, seg);
      lookup.set(`${line.id}:${seg.to}:${seg.from}`, seg);
    }
  }
  return lookup;
}

const lineSegmentLookup = buildLineSegmentLookup();
const trainServiceByNumber = new Map(allTrainServices.map((s) => [s.trainNumber, s]));

// Finds the smallest absolute minute >= `atOrAfter` whose time-of-day
// matches `clockTime` - i.e. "the next time the clock reads this value,
// no earlier than this absolute moment". Used to walk a service's
// schedule sequentially so any number of midnight crossings (mid-hop, or
// during a layover between a stop's arrival and departure) are handled
// correctly and absolute times stay monotonically non-decreasing.
function alignClockTimeForward(clockTime: string, atOrAfter: number): number {
  const clockMin = timeToMinutes(clockTime);
  let candidate = Math.floor(atOrAfter / 1440) * 1440 + clockMin;
  while (candidate < atOrAfter) candidate += 1440;
  return candidate;
}

function buildConnections(): Connection[] {
  const conns: Connection[] = [];

  for (const service of allTrainServices) {
    if (service.schedule.length < 2) continue;

    for (let day = 0; day < SEARCH_DAYS; day++) {
      const dayOffset = day * 1440;
      const tripId = `${service.trainNumber}@${day}`;

      // Running absolute clock for this specific day's run, advanced
      // monotonically stop by stop so the whole journey's times stay
      // internally consistent even across midnight.
      let cursorAbs = timeToMinutes(service.schedule[0].departureTime) + dayOffset;

      for (let i = 0; i < service.schedule.length - 1; i++) {
        const a = service.schedule[i];
        const b = service.schedule[i + 1];
        const segment = lineSegmentLookup.get(`${service.lineId}:${a.stationId}:${b.stationId}`);
        if (!segment) continue;

        const depMin = cursorAbs;
        const arrMin = alignClockTimeForward(b.arrivalTime, depMin);

        conns.push({
          trainNumber: service.trainNumber,
          tripId,
          lineId: service.lineId,
          fromId: a.stationId,
          toId: b.stationId,
          depMin,
          arrMin,
          segment,
        });

        // Advance the cursor to this stop's departure (handles a layover
        // that itself crosses midnight, e.g. arrive 23:57, depart 00:00).
        cursorAbs = alignClockTimeForward(b.departureTime, arrMin);
      }
    }
  }

  conns.sort((x, y) => x.depMin - y.depMin);
  return conns;
}

const connections = buildConnections();

// Earliest-arrival Connection Scan. `startMin` is the preferred departure
// time (in absolute minutes, day 0). Returns the chain of real
// connections that gets the rider to `toId` soonest.
function scanEarliestArrival(fromId: string, toId: string, startMin: number): ConnectionScanResult | null {
  // True earliest arrival at each station, and the connection that
  // produced it (for path reconstruction).
  const arrivalMin = new Map<string, number>();
  const arrivedVia = new Map<string, Connection>();
  // Once a specific day's run of a train becomes catchable, every later
  // hop of that SAME physical run is automatically reachable too (no new
  // boarding decision, no transfer wait - the rider is already aboard).
  // Keyed by tripId (trainNumber + day), NOT trainNumber alone, since the
  // same trainNumber repeats every day and those are different physical
  // trips - boarding today's 18:30 departure doesn't put you on
  // tomorrow's 18:30 departure for free.
  const tripBoarded = new Set<string>();

  arrivalMin.set(fromId, startMin);

  for (const conn of connections) {
    if (conn.depMin < startMin) continue;

    const continuingTrip = tripBoarded.has(conn.tripId);

    if (!continuingTrip) {
      const fromLabel = arrivalMin.get(conn.fromId);
      if (fromLabel === undefined) continue;
      // Boarding a NEW train requires the real platform-change buffer,
      // UNLESS this is the very origin (fromLabel === startMin AND no
      // connection has been ridden yet to reach it) where the rider is
      // assumed to already be present and ready.
      const isOrigin = conn.fromId === fromId && !arrivedVia.has(conn.fromId);
      const readyMin = isOrigin ? fromLabel : fromLabel + MIN_TRANSFER_CONNECTION;
      if (conn.depMin < readyMin) continue;
      tripBoarded.add(conn.tripId);
    }

    const existingArrival = arrivalMin.get(conn.toId);
    if (existingArrival === undefined || conn.arrMin < existingArrival) {
      arrivalMin.set(conn.toId, conn.arrMin);
      arrivedVia.set(conn.toId, conn);
    }
  }

  const finalArrival = arrivalMin.get(toId);
  if (finalArrival === undefined) return null;

  // Reconstruct the hop chain by walking `arrivedVia` backward. Bounded
  // defensively by the connection count - a correct CSA result can never
  // need more hops than there are connections, so this guards against an
  // infinite loop if some future change ever introduces an inconsistency.
  const hops: Connection[] = [];
  let cursor = toId;
  let guard = connections.length + 1;
  while (cursor !== fromId) {
    if (guard-- <= 0) return null;
    const conn = arrivedVia.get(cursor);
    if (!conn) return null; // shouldn't happen if finalArrival was set
    hops.unshift(conn);
    cursor = conn.fromId;
  }

  return { arrivalMin: finalArrival, hops };
}

export function findRoute(
  fromId: string,
  toId: string,
  preferredDepartureTime: string = '08:00'
): RouteResult | null {
  if (fromId === toId) return null;
  if (!getStationById(fromId) || !getStationById(toId)) return null;

  const startMin = timeToMinutes(preferredDepartureTime);
  const result = scanEarliestArrival(fromId, toId, startMin);
  if (!result || result.hops.length === 0) return null;

  const legs: RouteLeg[] = [];
  const transfers: TransferInfo[] = [];
  const trainServices: { legIndex: number; service: TrainService }[] = [];

  for (let i = 0; i < result.hops.length; i++) {
    const hop = result.hops[i];
    const fromStation = getStationById(hop.fromId);
    const toStation = getStationById(hop.toId);
    const line = railLines.find((l) => l.id === hop.lineId);
    const service = trainServiceByNumber.get(hop.trainNumber);
    if (!fromStation || !toStation || !line || !service) continue;

    legs.push({
      from: fromStation,
      to: toStation,
      line,
      segment: hop.segment,
      travelTime: hop.segment.travelTime,
      distance: hop.segment.distance,
      trainNumber: hop.trainNumber,
      departureTime: minutesToTime(hop.depMin),
              arrivalTime: minutesToTime(hop.arrMin),
    });
    trainServices.push({ legIndex: legs.length - 1, service });

    if (i > 0) {
      const prevHop = result.hops[i - 1];
      if (prevHop.tripId !== hop.tripId) {
        const prevLine = railLines.find((l) => l.id === prevHop.lineId)!;
        transfers.push({
          at: fromStation,
          fromLine: prevLine,
          toLine: line,
          waitTime: hop.depMin - prevHop.arrMin,
        });
      }
    }
  }

  const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
  const totalTravelTime = legs.reduce((sum, leg) => sum + leg.travelTime, 0);
  const totalWaitTime = transfers.reduce((sum, t) => sum + t.waitTime, 0);

  return {
    legs,
    transfers,
    totalDistance,
    totalTravelTime,
    totalWaitTime,
    totalTime: result.arrivalMin - startMin,
    trainServices,
  };
}

// Kept for backward compatibility with any external caller still using
// the old two-step pattern. findRoute() above already resolves the real
// schedule directly, so this is now a no-op passthrough.
export function findTrainServicesForRoute(route: RouteResult, _preferredDepartureTime: string): RouteResult {
  return route;
}

// ============================================================
// JOURNEY SEGMENTS - groups consecutive same-line legs into a single
// continuous ride. A "Transfer" only ever exists BETWEEN segments, never
// within one - so passing through intermediate stations on one line never
// counts as a transfer.
// ============================================================

export interface JourneyStop {
  station: Station;
  isActive: boolean; // within the rider's boarded-to-alighted range
  role: 'board' | 'alight' | 'pass-through' | 'context';
}

interface RawJourneySegment {
  line: RailLine;
  legs: RouteLeg[];
  legIndexStart: number;
  boardStation: Station;
  alightStation: Station;
  distance: number;
  travelTime: number;
  stops: JourneyStop[];
  transferAfter: TransferInfo | null;
}

export interface JourneySegment extends RawJourneySegment {
  trainService?: TrainService;
}

function groupLegsByLine(legs: RouteLeg[], transfers: TransferInfo[]): RawJourneySegment[] {
  const segments: RawJourneySegment[] = [];
  let i = 0;

  while (i < legs.length) {
    const lineId = legs[i].line.id;
    const group: RouteLeg[] = [legs[i]];
    let j = i + 1;
    while (j < legs.length && legs[j].line.id === lineId) {
      group.push(legs[j]);
      j++;
    }

    const line = group[0].line;
    const boardStation = group[0].from;
    const alightStation = group[group.length - 1].to;
    const distance = group.reduce((sum, leg) => sum + leg.distance, 0);
    const travelTime = group.reduce((sum, leg) => sum + leg.travelTime, 0);

    // Full station list for this line, oriented in the direction of travel,
    // so the timeline can show the entire route context (not just the
    // rider's portion) with the un-ridden ends dimmed out.
    const boardIdxInLine = line.stations.indexOf(boardStation.id);
    const alightIdxInLine = line.stations.indexOf(alightStation.id);
    const forward = boardIdxInLine <= alightIdxInLine;
    const orderedIds = forward ? line.stations : [...line.stations].reverse();
    const bIdx = orderedIds.indexOf(boardStation.id);
    const aIdx = orderedIds.indexOf(alightStation.id);

    const stops: JourneyStop[] = orderedIds
    .map((id) => getStationById(id))
    .filter((s): s is Station => !!s)
    .map((station, idx) => {
      const isActive = idx >= bIdx && idx <= aIdx;
      let role: JourneyStop['role'] = 'context';
      if (station.id === boardStation.id) role = 'board';
      else if (station.id === alightStation.id) role = 'alight';
      else if (isActive) role = 'pass-through';
      return { station, isActive, role };
    });

    const transferAfter =
    j < legs.length ? transfers.find((t) => t.at.id === alightStation.id) || null : null;

    segments.push({
      line,
      legs: group,
      legIndexStart: i,
      boardStation,
      alightStation,
      distance,
      travelTime,
      stops,
      transferAfter,
    });

    i = j;
  }

  return segments;
}

// Build the rider-facing journey segments for a resolved route, attaching
// the train service already resolved for each segment.
export function buildJourneySegments(route: RouteResult): JourneySegment[] {
  const raw = groupLegsByLine(route.legs, route.transfers);
  return raw.map((seg) => ({
    ...seg,
    trainService: route.trainServices.find((ts) => ts.legIndex === seg.legIndexStart)?.service,
  }));
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Converts absolute minutes (which may span several days, since
// connections are expanded across SEARCH_DAYS) back to a wall-clock
// "HH:MM" - i.e. just the time-of-day, with the day number discarded.
function minutesToTime(absoluteMin: number): string {
  const clockMin = ((absoluteMin % 1440) + 1440) % 1440;
  const h = Math.floor(clockMin / 60);
  const m = clockMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Get all stations sorted alphabetically by English name
export function getSortedStations(): Station[] {
  return [...stations].sort((a, b) =>
  a.name.english.localeCompare(b.name.english)
  );
}

// Get region color for map display
export function getRegionColor(region: string): string {
  const colors: Record<string, string> = {
    'Central Lands': '#F4A261',
    'Northern Lands': '#A8DADC',
    'Northern Plateau': '#E76F51',
    'Imperial Territory': '#2A9D8F',
    'Ende': '#E63946',
    'Southern Lands': '#E9C46A',
  };
  return colors[region] || '#6C757D';
}
