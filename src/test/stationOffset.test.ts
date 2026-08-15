import { describe, it, expect } from 'vitest'
import {
  formatStation,
  formatOffset,
  calculateStationOffset,
  applyStationOffsets,
} from '@/src/lib/stationOffset'
import type { ParsedAlignment, CalculatedPoint } from '@/src/types/stabSheet'

// =============================================================================
// formatStation
// =============================================================================

describe('formatStation', () => {
  it('formats 1000.00 as 10+00.00', () => {
    expect(formatStation(1000)).toBe('10+00.00')
  })

  it('formats 1245.67 as 12+45.67', () => {
    expect(formatStation(1245.67)).toBe('12+45.67')
  })

  it('formats 500.5 as 5+00.50', () => {
    expect(formatStation(500.5)).toBe('5+00.50')
  })

  it('formats 0 as 0+00.00', () => {
    expect(formatStation(0)).toBe('0+00.00')
  })

  it('formats 99.99 as 0+99.99', () => {
    expect(formatStation(99.99)).toBe('0+99.99')
  })

  it('formats 1771.63 correctly', () => {
    expect(formatStation(1771.63)).toBe('17+71.63')
  })
})

// =============================================================================
// formatOffset
// =============================================================================

describe('formatOffset', () => {
  it('formats left offset', () => {
    expect(formatOffset(12.34, 'L')).toBe('L 12.34')
  })

  it('formats right offset', () => {
    expect(formatOffset(25.18, 'R')).toBe('R 25.18')
  })

  it('formats zero offset', () => {
    expect(formatOffset(0, 'R')).toBe('R 0.00')
  })
})

// =============================================================================
// Helper: build a simple two-segment alignment (Line → Line)
// =============================================================================

/**
 * Creates a simple N-S running alignment starting at (N=1000, E=2000),
 * going north 500 ft, then east 300 ft.
 * staStart = 1000.
 *
 * Segment 1: Line from (1000,2000) to (1500,2000), length=500, staStart=1000
 * Segment 2: Line from (1500,2000) to (1500,2300), length=300, staStart=1500
 */
function makeTwoLineAlignment(): ParsedAlignment {
  return {
    name: 'TEST ROAD',
    staStart: 1000,
    length: 800,
    segments: [
      {
        type: 'Line',
        startN: 1000,
        startE: 2000,
        endN: 1500,
        endE: 2000,
        length: 500,
        staStart: 1000,
      },
      {
        type: 'Line',
        startN: 1500,
        startE: 2000,
        endN: 1500,
        endE: 2300,
        length: 300,
        staStart: 1500,
      },
    ],
  }
}

// =============================================================================
// calculateStationOffset – Line segment
// =============================================================================

describe('calculateStationOffset – Line segment', () => {
  const alignment = makeTwoLineAlignment()

  it('returns station+offset for a point exactly on the centerline (segment 1)', () => {
    // Point at N=1250, E=2000 → on segment 1, 250 ft from start
    const result = calculateStationOffset(1250, 2000, alignment)
    expect(result.warning).toBe('OK')
    expect(result.station).toBeCloseTo(1250, 3)
    expect(result.stationFormatted).toBe('12+50.00')
    expect(result.offset).toBeCloseTo(0, 6)
    expect(result.segmentType).toBe('Line')
  })

  it('returns correct offset for a point to the right of segment 1 (higher easting)', () => {
    // Segment 1 runs north (N direction). Right of northward travel = higher easting.
    // Point at N=1250, E=2020 → 20 ft to the right of seg1.
    // Note: this point may also project onto seg2 (runs east from N=1500),
    // so AMBIGUOUS_PROJECTION is possible. Station and offset should still be correct.
    const result = calculateStationOffset(1250, 2020, alignment)
    expect(['OK', 'AMBIGUOUS_PROJECTION']).toContain(result.warning)
    // The minimum-offset candidate should be the seg1 projection (offset=20)
    // vs seg2 projection (offset=250), so seg1 wins
    expect(result.station).toBeCloseTo(1250, 3)
    expect(result.offset).toBeCloseTo(20, 3)
    expect(result.side).toBe('R')
  })

  it('returns correct offset for a point to the left of segment 1 (lower easting)', () => {
    // Left of northward travel = lower easting.
    // Point at N=1250, E=1980 → 20 ft to the left of seg1.
    // This point cannot project onto seg2 (E=1980 < seg2 start E=2000), so OK.
    const result = calculateStationOffset(1250, 1980, alignment)
    expect(result.warning).toBe('OK')
    expect(result.station).toBeCloseTo(1250, 3)
    expect(result.offset).toBeCloseTo(20, 3)
    expect(result.side).toBe('L')
  })

  it('returns station+offset for a point on segment 2', () => {
    // Segment 2 runs east (E direction). Point at N=1500, E=2150 → 150 ft from seg 2 start
    const result = calculateStationOffset(1500, 2150, alignment)
    expect(result.warning).toBe('OK')
    expect(result.station).toBeCloseTo(1650, 3)   // 1500 + 150
    expect(result.offset).toBeCloseTo(0, 6)
    expect(result.segmentType).toBe('Line')
  })

  it('returns OUTSIDE_ALIGNMENT_LIMITS for a point beyond the end', () => {
    // Point well past the end of both segments
    const result = calculateStationOffset(3000, 5000, alignment)
    expect(result.warning).toBe('OUTSIDE_ALIGNMENT_LIMITS')
  })

  it('station-formats the result correctly', () => {
    const result = calculateStationOffset(1250, 2000, alignment)
    expect(result.stationFormatted).toBe('12+50.00')
  })
})

// =============================================================================
// calculateStationOffset – Curve segment
// =============================================================================

/**
 * Builds an alignment with a single 90° CCW circular arc.
 * Center at (0, 0). Start at angle 0° on the +E axis, end at 90° on the +N axis.
 * Start  = (N=0, E=100)
 * End    = (N=100, E=0)
 * Center = (N=0, E=0)
 * Arc length = 100 * π/2 ≈ 157.08
 */
function makeCurveAlignment(): ParsedAlignment {
  const radius = 100
  const arcLength = radius * Math.PI / 2  // 90° arc
  return {
    name: 'CURVE ROAD',
    staStart: 1000,
    length: arcLength,
    segments: [
      {
        type: 'Curve',
        startN: 0,
        startE: 100,
        endN: 100,
        endE: 0,
        centerN: 0,
        centerE: 0,
        radius,
        length: arcLength,
        rot: 'ccw',
        staStart: 1000,
      },
    ],
  }
}

describe('calculateStationOffset – Curve segment', () => {
  const alignment = makeCurveAlignment()

  it('returns OK for a point exactly on the curve', () => {
    // Point on the 45° point of the arc: (E=100*cos(45°), N=100*sin(45°)) ≈ (70.71, 70.71)
    const midAngle = Math.PI / 4
    const pE = 100 * Math.cos(midAngle)
    const pN = 100 * Math.sin(midAngle)
    const result = calculateStationOffset(pN, pE, alignment)
    expect(result.warning).toBe('OK')
    expect(result.offset).toBeCloseTo(0, 2)
    expect(result.station).toBeCloseTo(1000 + alignment.segments[0].length / 2, 1)
    expect(result.segmentType).toBe('Curve')
    // Inside a CCW curve is to the LEFT of travel
    expect(result.side).toBe('L')
  })

  it('returns a positive offset for a point outside the curve', () => {
    // Point 10 ft outside the arc (dist = 110)
    const midAngle = Math.PI / 4
    const pE = 110 * Math.cos(midAngle)
    const pN = 110 * Math.sin(midAngle)
    const result = calculateStationOffset(pN, pE, alignment)
    expect(result.warning).toBe('OK')
    expect(result.offset).toBeCloseTo(10, 1)
    // Outside a CCW curve is to the RIGHT of travel
    expect(result.side).toBe('R')
  })

  it('returns a positive offset for a point inside the curve', () => {
    // Point 10 ft inside the arc (dist = 90)
    const midAngle = Math.PI / 4
    const pE = 90 * Math.cos(midAngle)
    const pN = 90 * Math.sin(midAngle)
    const result = calculateStationOffset(pN, pE, alignment)
    expect(result.warning).toBe('OK')
    expect(result.offset).toBeCloseTo(10, 1)
    // Inside a CCW curve is to the LEFT of travel
    expect(result.side).toBe('L')
  })

  it('returns OUTSIDE_ALIGNMENT_LIMITS for a point outside the arc angular range', () => {
    // The arc spans 0° to 90°. (500, -500) is at -45°, outside that range.
    const result = calculateStationOffset(500, -500, alignment)
    expect(result.warning).toBe('OUTSIDE_ALIGNMENT_LIMITS')
  })
})

// =============================================================================
// CW arc
// =============================================================================

describe('calculateStationOffset – CW Curve segment', () => {
  // 90° CW arc: start at +N (E=0, N=100), end at +E (E=100, N=0), center at origin.
  const alignment: ParsedAlignment = {
    name: 'CW CURVE',
    staStart: 1000,
    length: 100 * Math.PI / 2,
    segments: [
      {
        type: 'Curve',
        startN: 100,
        startE: 0,
        endN: 0,
        endE: 100,
        centerN: 0,
        centerE: 0,
        radius: 100,
        length: 100 * Math.PI / 2,
        rot: 'cw',
        staStart: 1000,
      },
    ],
  }

  it('returns OK for a point on the CW arc', () => {
    // Midpoint at 45° (E=70.71, N=70.71)
    const pE = 100 * Math.cos(Math.PI / 4)
    const pN = 100 * Math.sin(Math.PI / 4)
    const result = calculateStationOffset(pN, pE, alignment)
    expect(result.warning).toBe('OK')
    expect(result.offset).toBeCloseTo(0, 2)
    expect(result.station).toBeCloseTo(1000 + alignment.segments[0].length / 2, 1)
    expect(result.segmentType).toBe('Curve')
    // Inside a CW curve is to the RIGHT of travel
    expect(result.side).toBe('R')
  })

  it('returns outside offset for a point outside the CW arc', () => {
    const pE = 110 * Math.cos(Math.PI / 4)
    const pN = 110 * Math.sin(Math.PI / 4)
    const result = calculateStationOffset(pN, pE, alignment)
    expect(result.warning).toBe('OK')
    expect(result.offset).toBeCloseTo(10, 1)
    // Outside a CW curve is to the LEFT of travel
    expect(result.side).toBe('L')
  })
})

// =============================================================================
// No XML uploaded fallback – applyStationOffsets not called
// =============================================================================

describe('applyStationOffsets fallback', () => {
  it('returns the same points array with stationOffset attached', () => {
    const alignment = makeTwoLineAlignment()
    const points: CalculatedPoint[] = [
      {
        pointId: 'P1',
        northing: 1250,
        easting: 2000,
        asBuiltElevation: 99.5,
        designElevation: 100.0,
        adjustedDesignElevation: 99.5,
        variance: 0,
        absVariance: 0,
        status: 'On Grade',
      },
    ]

    const result = applyStationOffsets(points, alignment)
    expect(result).toHaveLength(1)
    expect(result[0].stationOffset).toBeDefined()
    expect(result[0].stationOffset.station).toBeCloseTo(1250, 3)
    // Original fields are untouched
    expect(result[0].pointId).toBe('P1')
    expect(result[0].variance).toBe(0)
  })
})

// =============================================================================
// Integration: real ACCESS ROAD 2 alignment + real design point
// =============================================================================

describe('calculateStationOffset – real ACCESS ROAD 2 alignment', () => {
  // Reproduce the actual parsed alignment from ACCES ROAD 2.XML
  const realAlignment: ParsedAlignment = {
    name: 'ACCESS ROAD 2',
    staStart: 1000,
    length: 1771.6297,
    segments: [
      {
        type: 'Line',
        startN: 667033.0295, startE: 1242212.5447,
        endN: 667078.5135,   endE: 1241095.7181,
        length: 1117.7524,
        staStart: 1000,
      },
      {
        type: 'Curve',
        startN: 667078.5135, startE: 1241095.7181,
        endN: 667153.3833,   endE: 1241026.7076,
        centerN: 667150.4539, centerE: 1241098.6480,
        radius: 72.0,
        length: 113.0969,
        rot: 'cw',
        staStart: 2117.7524,
      },
      {
        type: 'Line',
        startN: 667153.3833, startE: 1241026.7076,
        endN: 667693.7160,   endE: 1241048.7101,
        length: 540.7805,
        staStart: 2230.8493,
      },
    ],
  }

  it('calculates station/offset for a point on the first tangent (TS101)', () => {
    // TS101: N=667044.352, E=1241315.056 – lies on or near seg1
    const result = calculateStationOffset(667044.352, 1241315.056, realAlignment)
    // Should not be outside limits
    expect(result.warning).not.toBe('UNABLE_TO_CALCULATE')
    // Station should be between 1000 and 2117 (seg1 range)
    expect(result.station).toBeGreaterThanOrEqual(1000)
    expect(result.station).toBeLessThanOrEqual(2117.75)
    // Offset should be small (points are survey points ~13ft from centerline)
    expect(result.offset).toBeLessThan(30)
    // formatted station should contain '+'
    expect(result.stationFormatted).toContain('+')
  })

  it('calculates station/offset for a point on the second tangent (last segment)', () => {
    // A midpoint of the third segment: N=(667153+667693)/2=667423, E=(1241026+1241048)/2=1241037
    const midN = (667153.3833 + 667693.716) / 2
    const midE = (1241026.7076 + 1241048.7101) / 2
    const result = calculateStationOffset(midN, midE, realAlignment)
    expect(result.warning).not.toBe('OUTSIDE_ALIGNMENT_LIMITS')
    expect(result.segmentType).toBe('Line')
    // Station should be ~midpoint of seg3: 2230.85 + 540.78/2 ≈ 2501.24
    expect(result.station).toBeCloseTo(2501.24, 0)
    expect(result.offset).toBeCloseTo(0, 1)
  })
})

// =============================================================================
// AMBIGUOUS_PROJECTION – point near segment junction
// =============================================================================

describe('calculateStationOffset – junction handling', () => {
  it('handles a point very near a segment junction (slightly inside seg1)', () => {
    const alignment = makeTwoLineAlignment()
    // Point at N=1499, E=2000 – clearly on seg1, 499ft from start, 1ft before junction
    const result = calculateStationOffset(1499, 2000, alignment)
    expect(result.warning).toBe('OK')
    expect(result.station).toBeCloseTo(1499, 1)
    expect(result.offset).toBeCloseTo(0, 3)
    expect(result.segmentType).toBe('Line')
  })

  it('handles a point at the exact junction gracefully', () => {
    const alignment = makeTwoLineAlignment()
    // Exact junction N=1500, E=2000: with epsilon bounds, neither segment claims it
    const result = calculateStationOffset(1500, 2000, alignment)
    // Nearest endpoint fallback applies
    expect(['OK', 'AMBIGUOUS_PROJECTION', 'OUTSIDE_ALIGNMENT_LIMITS']).toContain(result.warning)
    expect(result.offset).toBeCloseTo(0, 3)
  })
})
