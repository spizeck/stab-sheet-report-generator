import { describe, it, expect } from 'vitest'
import {
  coordKey,
  matchAndCalculate,
  buildSummary,
  round3,
} from '@/src/lib/stabSheetCalculations'
import type { RawAsBuiltPoint, RawDesignPoint } from '@/src/types/stabSheet'

// =============================================================================
// Test Data - Realistic Paving/Concrete Survey Scenarios
// =============================================================================

/**
 * Creates a standard As-Built point
 */
function makeAsBuilt(
  pointId: string,
  northing: number,
  easting: number,
  elevation: number
): RawAsBuiltPoint {
  return { pointId, northing, easting, asBuiltElevation: elevation }
}

/**
 * Creates a standard Design point
 */
function makeDesign(
  pointId: string,
  northing: number,
  easting: number,
  elevation: number
): RawDesignPoint {
  return { pointId, northing, easting, designElevation: elevation }
}

// =============================================================================
// Coordinate Key Tests
// =============================================================================

describe('coordKey', () => {
  it('should round to 3 decimal places', () => {
    expect(coordKey(668030.0914, 1242096.3139)).toBe('668030.091|1242096.314')
  })

  it('should handle exact 3 decimal values', () => {
    expect(coordKey(100.123, 200.456)).toBe('100.123|200.456')
  })

  it('should pad shorter decimals', () => {
    expect(coordKey(100.1, 200.2)).toBe('100.100|200.200')
  })

  it('should handle negative coordinates', () => {
    expect(coordKey(-668030.0914, -1242096.3139)).toBe('-668030.091|-1242096.314')
  })

  it('should handle zero coordinates', () => {
    expect(coordKey(0, 0)).toBe('0.000|0.000')
  })

  it('should create different keys for different coordinates', () => {
    const key1 = coordKey(100.123, 200.456)
    const key2 = coordKey(100.124, 200.456)
    expect(key1).not.toBe(key2)
  })

  it('should create same key for coordinates within 0.0005 difference', () => {
    // These should round to the same 3-decimal value
    const key1 = coordKey(100.1234, 200.5678)
    const key2 = coordKey(100.123499, 200.567899)
    expect(key1).toBe(key2)
  })
})

// =============================================================================
// Cut/Fill/On Grade Calculation Tests
// =============================================================================

describe('matchAndCalculate - Cut/Fill/On Grade Logic', () => {
  const designThickness = 0.5 // 0.5 ft pavement thickness

  it('should calculate CUT when as-built is above adjusted design', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 100.2 → Difference: +0.7 = CUT
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 100.2)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, designThickness)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('Cut')
    expect(result.matched[0].difference).toBeCloseTo(0.7, 3)
    expect(result.matched[0].absDifference).toBeCloseTo(0.7, 3)
  })

  it('should calculate FILL when as-built is below adjusted design', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.0 → Difference: -0.5 = FILL
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.0)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, designThickness)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('Fill')
    expect(result.matched[0].difference).toBeCloseTo(-0.5, 3)
    expect(result.matched[0].absDifference).toBeCloseTo(0.5, 3)
  })

  it('should calculate ON GRADE when as-built equals adjusted design', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.5 → Difference: 0.0 = On Grade
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.5)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, designThickness)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('On Grade')
    expect(result.matched[0].difference).toBe(0)
    expect(result.matched[0].absDifference).toBe(0)
  })

  it('should handle very small positive differences as Cut', () => {
    // Tiny elevation difference should still be Cut
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.5001)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, designThickness)

    expect(result.matched[0].status).toBe('Cut')
    expect(result.matched[0].difference).toBeCloseTo(0.0001, 4)
  })

  it('should handle very small negative differences as Fill', () => {
    // Tiny elevation difference should still be Fill
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.4999)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, designThickness)

    expect(result.matched[0].status).toBe('Fill')
    expect(result.matched[0].difference).toBeCloseTo(-0.0001, 4)
  })
})

// =============================================================================
// Design Thickness Adjustment Tests
// =============================================================================

describe('matchAndCalculate - Design Thickness Adjustments', () => {
  it('should correctly adjust with zero thickness', () => {
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 100.0)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0)

    expect(result.matched[0].adjustedDesignElevation).toBe(100.0)
    expect(result.matched[0].status).toBe('On Grade')
  })

  it('should correctly adjust with typical pavement thickness (0.583 ft = 7 inches)', () => {
    // Common 7-inch concrete = 0.583 feet
    const thickness = 0.583
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.417)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched[0].adjustedDesignElevation).toBeCloseTo(99.417, 3)
    expect(result.matched[0].status).toBe('On Grade')
  })

  it('should correctly adjust with large thickness values', () => {
    const thickness = 2.0 // 2 feet
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 98.0)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched[0].adjustedDesignElevation).toBe(98.0)
    expect(result.matched[0].status).toBe('On Grade')
  })

  it('should handle fractional inch conversions', () => {
    // 6.5 inches = 0.5417 feet
    const thickness = 6.5 / 12
    const designElev = 100.0
    const expectedAdjusted = designElev - thickness

    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, expectedAdjusted)]
    const design = [makeDesign('D1', 1000.0, 2000.0, designElev)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched[0].adjustedDesignElevation).toBeCloseTo(expectedAdjusted, 3)
    expect(result.matched[0].status).toBe('On Grade')
  })
})

// =============================================================================
// Coordinate Matching Tests
// =============================================================================

describe('matchAndCalculate - Coordinate Matching', () => {
  const thickness = 0.5

  it('should match points with exact coordinates', () => {
    const asBuilt = [
      makeAsBuilt('AB1', 1000.123, 2000.456, 100.0),
      makeAsBuilt('AB2', 1001.123, 2001.456, 101.0),
    ]
    const design = [
      makeDesign('D1', 1000.123, 2000.456, 100.5),
      makeDesign('D2', 1001.123, 2001.456, 101.5),
    ]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(2)
    expect(result.matched[0].pointId).toBe('AB1') // As-Built name used
    expect(result.matched[1].pointId).toBe('AB2')
  })

  it('should match points within 3-decimal rounding tolerance', () => {
    // Coordinates differ in 4th decimal place - should still match
    const asBuilt = [makeAsBuilt('AB1', 1000.1234, 2000.4567, 100.0)]
    const design = [makeDesign('D1', 1000.123499, 2000.456799, 100.5)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(1)
  })

  it('should NOT match points outside 3-decimal tolerance', () => {
    // Coordinates differ in 3rd decimal place - should NOT match
    const asBuilt = [makeAsBuilt('AB1', 1000.123, 2000.456, 100.0)]
    const design = [makeDesign('D1', 1000.124, 2000.456, 100.5)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedAsBuilt).toHaveLength(1)
    expect(result.unmatchedDesign).toHaveLength(1)
  })

  it('should handle many points efficiently', () => {
    const asBuilt: RawAsBuiltPoint[] = []
    const design: RawDesignPoint[] = []

    // Generate 1000 points
    for (let i = 0; i < 1000; i++) {
      const n = 1000 + i * 10
      const e = 2000 + i * 10
      asBuilt.push(makeAsBuilt(`AB${i}`, n, e, 100 + i * 0.1))
      design.push(makeDesign(`D${i}`, n, e, 100.5 + i * 0.1))
    }

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(1000)
    expect(result.unmatchedAsBuilt).toHaveLength(0)
    expect(result.unmatchedDesign).toHaveLength(0)
  })
})

// =============================================================================
// Unmatched Point Detection Tests
// =============================================================================

describe('matchAndCalculate - Unmatched Point Detection', () => {
  const thickness = 0.5

  it('should detect unmatched as-built points', () => {
    const asBuilt = [
      makeAsBuilt('AB1', 1000.0, 2000.0, 100.0),
      makeAsBuilt('AB2', 9999.0, 9999.0, 100.0), // No design match
    ]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.5)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(1)
    expect(result.unmatchedAsBuilt).toHaveLength(1)
    expect(result.unmatchedAsBuilt[0].pointId).toBe('AB2')
    expect(result.unmatchedDesign).toHaveLength(0)
  })

  it('should detect unmatched design points', () => {
    const asBuilt = [makeAsBuilt('AB1', 1000.0, 2000.0, 100.0)]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, 100.5),
      makeDesign('D2', 9999.0, 9999.0, 100.5), // No as-built match
    ]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(1)
    expect(result.unmatchedAsBuilt).toHaveLength(0)
    expect(result.unmatchedDesign).toHaveLength(1)
    expect(result.unmatchedDesign[0].pointId).toBe('D2')
  })

  it('should handle completely disjoint point sets', () => {
    const asBuilt = [
      makeAsBuilt('AB1', 1000.0, 2000.0, 100.0),
      makeAsBuilt('AB2', 1001.0, 2001.0, 101.0),
    ]
    const design = [
      makeDesign('D1', 9998.0, 9998.0, 100.5),
      makeDesign('D2', 9999.0, 9999.0, 101.5),
    ]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedAsBuilt).toHaveLength(2)
    expect(result.unmatchedDesign).toHaveLength(2)
  })

  it('should handle empty as-built array', () => {
    const asBuilt: RawAsBuiltPoint[] = []
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.5)]

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedAsBuilt).toHaveLength(0)
    expect(result.unmatchedDesign).toHaveLength(1)
  })

  it('should handle empty design array', () => {
    const asBuilt = [makeAsBuilt('AB1', 1000.0, 2000.0, 100.0)]
    const design: RawDesignPoint[] = []

    const result = matchAndCalculate(asBuilt, design, thickness)

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedAsBuilt).toHaveLength(1)
    expect(result.unmatchedDesign).toHaveLength(0)
  })

  it('should handle both arrays empty', () => {
    const result = matchAndCalculate([], [], thickness)

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedAsBuilt).toHaveLength(0)
    expect(result.unmatchedDesign).toHaveLength(0)
  })
})

// =============================================================================
// Summary Count Tests
// =============================================================================

describe('buildSummary', () => {
  it('should correctly count all status types', () => {
    const matchResult = {
      matched: [
        { status: 'Cut' as const },
        { status: 'Cut' as const },
        { status: 'Fill' as const },
        { status: 'Fill' as const },
        { status: 'Fill' as const },
        { status: 'On Grade' as const },
      ],
      unmatchedAsBuilt: [{}, {}],
      unmatchedDesign: [{}],
    }

    const summary = buildSummary(matchResult as any)

    expect(summary.matchedCount).toBe(6)
    expect(summary.cutCount).toBe(2)
    expect(summary.fillCount).toBe(3)
    expect(summary.onGradeCount).toBe(1)
    expect(summary.unmatchedAsBuiltCount).toBe(2)
    expect(summary.unmatchedDesignCount).toBe(1)
  })

  it('should handle all Cut scenario', () => {
    const matchResult = {
      matched: Array(5).fill({ status: 'Cut' as const }),
      unmatchedAsBuilt: [],
      unmatchedDesign: [],
    }

    const summary = buildSummary(matchResult as any)

    expect(summary.cutCount).toBe(5)
    expect(summary.fillCount).toBe(0)
    expect(summary.onGradeCount).toBe(0)
  })

  it('should handle all Fill scenario', () => {
    const matchResult = {
      matched: Array(5).fill({ status: 'Fill' as const }),
      unmatchedAsBuilt: [],
      unmatchedDesign: [],
    }

    const summary = buildSummary(matchResult as any)

    expect(summary.cutCount).toBe(0)
    expect(summary.fillCount).toBe(5)
    expect(summary.onGradeCount).toBe(0)
  })

  it('should handle all On Grade scenario', () => {
    const matchResult = {
      matched: Array(5).fill({ status: 'On Grade' as const }),
      unmatchedAsBuilt: [],
      unmatchedDesign: [],
    }

    const summary = buildSummary(matchResult as any)

    expect(summary.cutCount).toBe(0)
    expect(summary.fillCount).toBe(0)
    expect(summary.onGradeCount).toBe(5)
  })

  it('should handle empty result', () => {
    const summary = buildSummary({
      matched: [],
      unmatchedAsBuilt: [],
      unmatchedDesign: [],
    })

    expect(summary.matchedCount).toBe(0)
    expect(summary.cutCount).toBe(0)
    expect(summary.fillCount).toBe(0)
    expect(summary.onGradeCount).toBe(0)
    expect(summary.unmatchedAsBuiltCount).toBe(0)
    expect(summary.unmatchedDesignCount).toBe(0)
  })
})

// =============================================================================
// Round3 Display Helper Tests
// =============================================================================

describe('round3', () => {
  it('should round to 3 decimal places', () => {
    expect(round3(100.123456)).toBe('100.123')
    expect(round3(100.123999)).toBe('100.124')
  })

  it('should pad with zeros', () => {
    expect(round3(100)).toBe('100.000')
    expect(round3(100.1)).toBe('100.100')
    expect(round3(100.12)).toBe('100.120')
  })

  it('should handle negative numbers', () => {
    expect(round3(-100.123456)).toBe('-100.123')
  })

  it('should handle zero', () => {
    expect(round3(0)).toBe('0.000')
  })
})
