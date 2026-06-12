import { describe, it, expect } from 'vitest'
import { matchAndCalculate, buildSummary, formatSignedVariance } from '@/src/lib/stabSheetCalculations'
import type { RawAsBuiltPoint, RawDesignPoint, ToleranceConfig } from '@/src/types/stabSheet'

// =============================================================================
// Test Data Helpers
// =============================================================================

function makeAsBuilt(
  pointId: string,
  northing: number,
  easting: number,
  elevation: number
): RawAsBuiltPoint {
  return { pointId, northing, easting, asBuiltElevation: elevation }
}

function makeDesign(
  pointId: string,
  northing: number,
  easting: number,
  elevation: number
): RawDesignPoint {
  return { pointId, northing, easting, designElevation: elevation }
}

// =============================================================================
// Tolerance Logic Tests
// =============================================================================

describe('Tolerance Logic - Cut Below Tolerance becomes On Grade', () => {
  const defaultTolerance: ToleranceConfig = {
    cutTolerance: 0.020,
    fillTolerance: 0.040,
    cutHighlightColor: '#ffcccc',
    fillHighlightColor: '#fff4cc',
  }

  it('should classify cut below tolerance as On Grade', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.505 (high by 0.005) → Variance: -0.005 = Cut (but below 0.020 tolerance)
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.505)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0.5, defaultTolerance)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('On Grade')
    expect(result.matched[0].variance).toBeCloseTo(-0.005, 3)
    expect(result.matched[0].absVariance).toBeCloseTo(0.005, 3)
  })

  it('should keep cut equal to tolerance as Cut', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.520 (high by 0.020) → Variance: -0.020 = Cut (equal to 0.020 tolerance)
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.52)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0.5, defaultTolerance)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('Cut')
    expect(result.matched[0].variance).toBeCloseTo(-0.02, 3)
  })

  it('should keep cut greater than tolerance as Cut', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.550 (high by 0.050) → Variance: -0.050 = Cut (greater than 0.020 tolerance)
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.55)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0.5, defaultTolerance)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('Cut')
    expect(result.matched[0].variance).toBeCloseTo(-0.05, 3)
  })
})

describe('Tolerance Logic - Fill Below Tolerance becomes On Grade', () => {
  const defaultTolerance: ToleranceConfig = {
    cutTolerance: 0.020,
    fillTolerance: 0.040,
    cutHighlightColor: '#ffcccc',
    fillHighlightColor: '#fff4cc',
  }

  it('should classify fill below tolerance as On Grade', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.485 (low by 0.015) → Variance: +0.015 = Fill (but below 0.040 tolerance)
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.485)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0.5, defaultTolerance)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('On Grade')
    expect(result.matched[0].variance).toBeCloseTo(0.015, 3)
    expect(result.matched[0].absVariance).toBeCloseTo(0.015, 3)
  })

  it('should keep fill equal to tolerance as Fill', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.460 (low by 0.040) → Variance: +0.040 = Fill (equal to 0.040 tolerance)
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.46)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0.5, defaultTolerance)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('Fill')
    expect(result.matched[0].variance).toBeCloseTo(0.04, 3)
  })

  it('should keep fill greater than tolerance as Fill', () => {
    // Design: 100.0, Thickness: 0.5 → Adjusted: 99.5
    // As-Built: 99.400 (low by 0.100) → Variance: +0.100 = Fill (greater than 0.040 tolerance)
    const asBuilt = [makeAsBuilt('P1', 1000.0, 2000.0, 99.4)]
    const design = [makeDesign('D1', 1000.0, 2000.0, 100.0)]

    const result = matchAndCalculate(asBuilt, design, 0.5, defaultTolerance)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].status).toBe('Fill')
    expect(result.matched[0].variance).toBeCloseTo(0.1, 3)
  })
})

describe('Tolerance Logic - Summary Counts Use Tolerance-Adjusted Statuses', () => {
  const tolerance: ToleranceConfig = {
    cutTolerance: 0.030,
    fillTolerance: 0.050,
    cutHighlightColor: '#ffcccc',
    fillHighlightColor: '#fff4cc',
  }

  it('should count only cuts >= tolerance in summary', () => {
    // Mix of cuts: one below, one equal, one above tolerance
    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Below tolerance: high by 0.020, variance -0.020 → Should become On Grade
    const cutBelow = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign + 0.020)
    // Equal to tolerance: high by 0.030, variance -0.030 → Should stay Cut
    const cutEqual = makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign + 0.030)
    // Above tolerance: high by 0.040, variance -0.040 → Should stay Cut
    const cutAbove = makeAsBuilt('P3', 1002.0, 2002.0, adjustedDesign + 0.040)

    const asBuilt = [cutBelow, cutEqual, cutAbove]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
      makeDesign('D3', 1002.0, 2002.0, designElev),
    ]

    const result = matchAndCalculate(asBuilt, design, designThickness, tolerance)
    const summary = buildSummary(result)

    expect(result.matched).toHaveLength(3)
    // Only 2 cuts meet or exceed tolerance
    expect(summary.cutCount).toBe(2)
    // 1 point is On Grade (the one below tolerance)
    expect(summary.onGradeCount).toBe(1)
    expect(summary.fillCount).toBe(0)
  })

  it('should count only fills >= tolerance in summary', () => {
    // Mix of fills: one below, one equal, one above tolerance
    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Below tolerance: low by 0.040, variance +0.040 → Should become On Grade
    const fillBelow = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign - 0.040)
    // Equal to tolerance: low by 0.050, variance +0.050 → Should stay Fill
    const fillEqual = makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign - 0.050)
    // Above tolerance: low by 0.060, variance +0.060 → Should stay Fill
    const fillAbove = makeAsBuilt('P3', 1002.0, 2002.0, adjustedDesign - 0.060)

    const asBuilt = [fillBelow, fillEqual, fillAbove]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
      makeDesign('D3', 1002.0, 2002.0, designElev),
    ]

    const result = matchAndCalculate(asBuilt, design, designThickness, tolerance)
    const summary = buildSummary(result)

    expect(result.matched).toHaveLength(3)
    expect(summary.cutCount).toBe(0)
    // Only 2 fills meet or exceed tolerance
    expect(summary.fillCount).toBe(2)
    // 1 point is On Grade (the one below tolerance)
    expect(summary.onGradeCount).toBe(1)
  })

  it('should properly count mixed statuses with tolerance', () => {
    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Zero variance: On Grade
    const onGrade = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign)
    // Below cut tolerance: high by 0.010, variance -0.010 → becomes On Grade
    const cutBelowTol = makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign + 0.010)
    // Above cut tolerance: high by 0.030, variance -0.030 → stays Cut
    const cutAboveTol = makeAsBuilt('P3', 1002.0, 2002.0, adjustedDesign + 0.030)
    // Below fill tolerance: low by 0.020, variance +0.020 → becomes On Grade
    const fillBelowTol = makeAsBuilt('P4', 1003.0, 2003.0, adjustedDesign - 0.020)
    // Above fill tolerance: low by 0.050, variance +0.050 → stays Fill
    const fillAboveTol = makeAsBuilt('P5', 1004.0, 2004.0, adjustedDesign - 0.050)

    const asBuilt = [onGrade, cutBelowTol, cutAboveTol, fillBelowTol, fillAboveTol]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
      makeDesign('D3', 1002.0, 2002.0, designElev),
      makeDesign('D4', 1003.0, 2003.0, designElev),
      makeDesign('D5', 1004.0, 2004.0, designElev),
    ]

    const tolerance: ToleranceConfig = {
      cutTolerance: 0.020,
      fillTolerance: 0.040,
      cutHighlightColor: '#ffcccc',
      fillHighlightColor: '#fff4cc',
    }

    const result = matchAndCalculate(asBuilt, design, designThickness, tolerance)
    const summary = buildSummary(result)

    expect(result.matched).toHaveLength(5)
    // Check individual statuses and variance signs
    expect(result.matched.find(p => p.pointId === 'P1')?.status).toBe('On Grade') // zero variance
    expect(result.matched.find(p => p.pointId === 'P2')?.status).toBe('On Grade') // below cut tol
    expect(result.matched.find(p => p.pointId === 'P2')?.variance).toBeCloseTo(-0.010, 3)
    expect(result.matched.find(p => p.pointId === 'P3')?.status).toBe('Cut')      // above cut tol
    expect(result.matched.find(p => p.pointId === 'P3')?.variance).toBeCloseTo(-0.030, 3)
    expect(result.matched.find(p => p.pointId === 'P4')?.status).toBe('On Grade') // below fill tol
    expect(result.matched.find(p => p.pointId === 'P4')?.variance).toBeCloseTo(0.020, 3)
    expect(result.matched.find(p => p.pointId === 'P5')?.status).toBe('Fill')     // above fill tol
    expect(result.matched.find(p => p.pointId === 'P5')?.variance).toBeCloseTo(0.050, 3)

    // Summary counts
    expect(summary.cutCount).toBe(1)      // only P3
    expect(summary.fillCount).toBe(1)     // only P5
    expect(summary.onGradeCount).toBe(3)  // P1, P2, P4
  })
})

describe('Tolerance Logic - Zero Tolerance', () => {
  it('should classify all non-zero values as Cut/Fill with zero tolerance', () => {
    const zeroTolerance: ToleranceConfig = {
      cutTolerance: 0,
      fillTolerance: 0,
      cutHighlightColor: '#ffcccc',
      fillHighlightColor: '#fff4cc',
    }

    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Very tiny positive difference - should be Cut with zero tolerance
    const tinyCut = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign + 0.0001)
    // Very tiny negative difference - should be Fill with zero tolerance
    const tinyFill = makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign - 0.0001)
    // Exact match
    const exact = makeAsBuilt('P3', 1002.0, 2002.0, adjustedDesign)

    const asBuilt = [tinyCut, tinyFill, exact]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
      makeDesign('D3', 1002.0, 2002.0, designElev),
    ]

    const result = matchAndCalculate(asBuilt, design, designThickness, zeroTolerance)

    expect(result.matched).toHaveLength(3)
    expect(result.matched.find(p => p.pointId === 'P1')?.status).toBe('Cut')
    expect(result.matched.find(p => p.pointId === 'P2')?.status).toBe('Fill')
    expect(result.matched.find(p => p.pointId === 'P3')?.status).toBe('On Grade')
  })
})

describe('Tolerance Logic - Default Tolerance (backward compatibility)', () => {
  it('should work without tolerance parameter (defaults to zero tolerance)', () => {
    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    const asBuilt = [
      makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign + 0.001),
      makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign - 0.001),
    ]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
    ]

    // Call without tolerance parameter
    const result = matchAndCalculate(asBuilt, design, designThickness)

    expect(result.matched).toHaveLength(2)
    // With zero tolerance (default), tiny differences are still Cut/Fill
    expect(result.matched.find(p => p.pointId === 'P1')?.status).toBe('Cut')
    expect(result.matched.find(p => p.pointId === 'P2')?.status).toBe('Fill')
  })
})

describe('Tolerance Logic - Signed Variance Display', () => {
  it('should display negative variance for cuts', () => {
    const tolerance: ToleranceConfig = {
      cutTolerance: 0.020,
      fillTolerance: 0.040,
      cutHighlightColor: '#ffcccc',
      fillHighlightColor: '#fff4cc',
    }

    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Cut: high by 0.030 → variance -0.030
    const cutPoint = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign + 0.030)
    const asBuilt = [cutPoint]
    const design = [makeDesign('D1', 1000.0, 2000.0, designElev)]

    const result = matchAndCalculate(asBuilt, design, designThickness, tolerance)

    expect(result.matched[0].status).toBe('Cut')
    expect(result.matched[0].variance).toBeCloseTo(-0.030, 3)
    expect(formatSignedVariance(result.matched[0].variance)).toBe('-0.030')
  })

  it('should display positive variance for fills', () => {
    const tolerance: ToleranceConfig = {
      cutTolerance: 0.020,
      fillTolerance: 0.040,
      cutHighlightColor: '#ffcccc',
      fillHighlightColor: '#fff4cc',
    }

    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Fill: low by 0.050 → variance +0.050
    const fillPoint = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign - 0.050)
    const asBuilt = [fillPoint]
    const design = [makeDesign('D1', 1000.0, 2000.0, designElev)]

    const result = matchAndCalculate(asBuilt, design, designThickness, tolerance)

    expect(result.matched[0].status).toBe('Fill')
    expect(result.matched[0].variance).toBeCloseTo(0.050, 3)
    expect(formatSignedVariance(result.matched[0].variance)).toBe('+0.050')
  })

  it('should display signed variance for On Grade points', () => {
    const tolerance: ToleranceConfig = {
      cutTolerance: 0.020,
      fillTolerance: 0.040,
      cutHighlightColor: '#ffcccc',
      fillHighlightColor: '#fff4cc',
    }

    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // On Grade but slightly high: variance -0.011 (below cut tolerance)
    const onGradeHigh = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign + 0.011)
    // On Grade but slightly low: variance +0.008 (below fill tolerance)
    const onGradeLow = makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign - 0.008)

    const asBuilt = [onGradeHigh, onGradeLow]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
    ]

    const result = matchAndCalculate(asBuilt, design, designThickness, tolerance)

    expect(result.matched.find(p => p.pointId === 'P1')?.status).toBe('On Grade')
    expect(result.matched.find(p => p.pointId === 'P1')?.variance).toBeCloseTo(-0.011, 3)
    expect(formatSignedVariance(result.matched.find(p => p.pointId === 'P1')!.variance)).toBe('-0.011')

    expect(result.matched.find(p => p.pointId === 'P2')?.status).toBe('On Grade')
    expect(result.matched.find(p => p.pointId === 'P2')?.variance).toBeCloseTo(0.008, 3)
    expect(formatSignedVariance(result.matched.find(p => p.pointId === 'P2')!.variance)).toBe('+0.008')
  })

  it('should format variance with three decimal places and sign', () => {
    expect(formatSignedVariance(-0.02)).toBe('-0.020')
    expect(formatSignedVariance(0.04)).toBe('+0.040')
    expect(formatSignedVariance(0)).toBe('+0.000')
    expect(formatSignedVariance(-0.005)).toBe('-0.005')
    expect(formatSignedVariance(0.1234)).toBe('+0.123')
  })
})

describe('Tolerance Logic - Different Cut and Fill Tolerances', () => {
  it('should allow asymmetric tolerances for cut vs fill', () => {
    const asymmetricTolerance: ToleranceConfig = {
      cutTolerance: 0.010,  // Very strict for cuts
      fillTolerance: 0.100, // Very lenient for fills
      cutHighlightColor: '#ffcccc',
      fillHighlightColor: '#fff4cc',
    }

    const designThickness = 0.5
    const designElev = 100.0
    const adjustedDesign = designElev - designThickness // 99.5

    // Cut: high by 0.020, variance -0.020 → exceeds cut tolerance (0.010) → Cut
    const cutPoint = makeAsBuilt('P1', 1000.0, 2000.0, adjustedDesign + 0.020)
    // Fill: low by 0.050, variance +0.050 → below fill tolerance (0.100) → On Grade
    const fillPoint = makeAsBuilt('P2', 1001.0, 2001.0, adjustedDesign - 0.050)

    const asBuilt = [cutPoint, fillPoint]
    const design = [
      makeDesign('D1', 1000.0, 2000.0, designElev),
      makeDesign('D2', 1001.0, 2001.0, designElev),
    ]

    const result = matchAndCalculate(asBuilt, design, designThickness, asymmetricTolerance)
    const summary = buildSummary(result)

    expect(result.matched.find(p => p.pointId === 'P1')?.status).toBe('Cut')
    expect(result.matched.find(p => p.pointId === 'P2')?.status).toBe('On Grade')
    expect(summary.cutCount).toBe(1)
    expect(summary.fillCount).toBe(0)
    expect(summary.onGradeCount).toBe(1)
  })
})
