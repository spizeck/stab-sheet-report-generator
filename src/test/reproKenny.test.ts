import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseLandXmlAlignment } from '@/src/lib/parseLandXml'
import { applyStationOffsets } from '@/src/lib/stationOffset'
import { parseAsBuiltFile, parseDesignFile } from '@/src/lib/parseSurveyFile'
import { matchAndCalculate } from '@/src/lib/stabSheetCalculations'

const SAMPLES = path.resolve(__dirname, '../../samples')

function load(file: string): string {
  return fs.readFileSync(path.join(SAMPLES, file), 'utf-8')
}

describe('Kenny Road reproduction', () => {
  it('calculates station/offset for all matched points', () => {
    const xmlText = load('KENNY ROAD 2 REPORTS.XML')
    const xmlResult = parseLandXmlAlignment(xmlText)
    expect(xmlResult.error).toBeNull()

    const alignment = xmlResult.alignments[0]

    const designText = load('KENNY RD STB DESIGN Continuation .txt')
    const asbuiltText = load('KENNY RD STB Continuation .txt')

    const design = parseDesignFile(designText)
    const asbuilt = parseAsBuiltFile(asbuiltText)

    const match = matchAndCalculate(asbuilt.points, design.points, 0.5)

    const withSO = applyStationOffsets(match.matched, alignment)

    // All 129 points should fall on the alignment (curve + final tangent) and
    // produce small, consistent offsets.
    expect(withSO.length).toBe(129)

    const warnings = withSO.filter(r => r.stationOffset.warning !== 'OK')
    expect(warnings).toHaveLength(0)

    for (const row of withSO) {
      expect(row.stationOffset.station).toBeGreaterThanOrEqual(5050)
      expect(row.stationOffset.station).toBeLessThanOrEqual(5050 + alignment.length)
      expect(row.stationOffset.offset).toBeLessThan(20)
      expect(['L', 'R']).toContain(row.stationOffset.side)
      expect(row.stationOffset.segmentType).toBeOneOf(['Line', 'Curve'])
    }

    // Spot check first point TS0001 and last point TS0129.
    const p0 = withSO.find(r => r.pointId === 'TS0001')
    const pLast = withSO.find(r => r.pointId === 'TS0129')
    expect(p0).toBeDefined()
    expect(pLast).toBeDefined()

    if (p0) {
      // TS0001 is near the beginning of the curve, so its station should be
      // close to the curve start (≈5907 + a small swept distance).
      expect(p0.stationOffset.station).toBeGreaterThan(5900)
      expect(p0.stationOffset.station).toBeLessThan(6150)
      expect(p0.stationOffset.offset).toBeLessThan(15)
      expect(p0.stationOffset.segmentType).toBe('Curve')
    }

    if (pLast) {
      // TS0129 is further along the curve.
      expect(pLast.stationOffset.station).toBeGreaterThan(6900)
      expect(pLast.stationOffset.station).toBeLessThan(7300)
      expect(pLast.stationOffset.offset).toBeLessThan(15)
      expect(pLast.stationOffset.segmentType).toBe('Curve')
    }
  })
})
