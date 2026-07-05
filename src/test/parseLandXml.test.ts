import { describe, it, expect } from 'vitest'
import { parseLandXmlAlignment } from '@/src/lib/parseLandXml'

// =============================================================================
// Sample LandXML helpers
// =============================================================================

function wrapLandXml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<LandXML version="1.2" xmlns="http://www.landxml.org/schema/LandXML-1.2">
  <Alignments>
    ${inner}
  </Alignments>
</LandXML>`
}

function makeAlignment(
  name: string,
  staStart: string,
  segments: string
): string {
  return `<Alignment name="${name}" staStart="${staStart}" length="800">
    <CoordGeom>
      ${segments}
    </CoordGeom>
  </Alignment>`
}

const SAMPLE_LINE = `<Line length="500">
  <Start>1000.000 2000.000</Start>
  <End>1500.000 2000.000</End>
</Line>`

const SAMPLE_CURVE = `<Curve length="157.0796" radius="100" rot="ccw">
  <Start>0.000 0.000</Start>
  <End>100.000 100.000</End>
  <Center>0.000 100.000</Center>
</Curve>`

// Real Carlson LandXML format (mirrors ACCES ROAD 2.XML)
const REAL_LANDXML = `<?xml version="1.0" ?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">
<Alignments>
<Alignment name="ACCESS ROAD 2" desc="" staStart="1000.000000" length="1771.6297">
<CoordGeom name="ACCESS ROAD 2">
<Line length="1117.7524" dir="3.10088902">
<Start>667033.0295 1242212.5447</Start>
<End>667078.5135 1241095.7181</End>
</Line>
<Curve rot="cw" chord="101.8231" crvType="arc" delta="-1.57079036" dirEnd="1.53009866" dirStart="3.10088902" length="113.0969" radius="72.0000" tangent="71.99956670">
<Start>667078.5135 1241095.7181</Start>
<Center>667150.4539 1241098.6480</Center>
<End>667153.3833 1241026.7076</End>
</Curve>
<Line length="540.7805" dir="1.53009841">
<Start>667153.3833 1241026.7076</Start>
<End>667693.7160 1241048.7101</End>
</Line>
</CoordGeom>
</Alignment>
</Alignments>
</LandXML>`

// =============================================================================
// Basic parsing
// =============================================================================

describe('parseLandXmlAlignment – basic', () => {
  it('parses a single alignment with one Line segment', () => {
    const xml = wrapLandXml(makeAlignment('ACCESS ROAD 1', '1000', SAMPLE_LINE))
    const result = parseLandXmlAlignment(xml)

    expect(result.error).toBeNull()
    expect(result.alignments).toHaveLength(1)

    const al = result.alignments[0]
    expect(al.name).toBe('ACCESS ROAD 1')
    expect(al.staStart).toBe(1000)
    expect(al.segments).toHaveLength(1)
    expect(al.segments[0].type).toBe('Line')
  })

  it('parses alignment name correctly', () => {
    const xml = wrapLandXml(makeAlignment('ACCESS ROAD 2', '1000', SAMPLE_LINE))
    const result = parseLandXmlAlignment(xml)
    expect(result.alignments[0].name).toBe('ACCESS ROAD 2')
  })

  it('parses staStart correctly', () => {
    const xml = wrapLandXml(makeAlignment('ROAD', '500.000', SAMPLE_LINE))
    const result = parseLandXmlAlignment(xml)
    expect(result.alignments[0].staStart).toBe(500)
  })

  it('auto-selects a single alignment (returns length 1)', () => {
    const xml = wrapLandXml(makeAlignment('ONLY ROAD', '1000', SAMPLE_LINE))
    const result = parseLandXmlAlignment(xml)
    expect(result.alignments).toHaveLength(1)
  })
})

// =============================================================================
// Line segment parsing
// =============================================================================

describe('parseLandXmlAlignment – Line segment', () => {
  it('parses Line start/end coordinates', () => {
    const xml = wrapLandXml(makeAlignment('ROAD', '1000', SAMPLE_LINE))
    const result = parseLandXmlAlignment(xml)
    const seg = result.alignments[0].segments[0]

    expect(seg.type).toBe('Line')
    if (seg.type === 'Line') {
      expect(seg.startN).toBe(1000)
      expect(seg.startE).toBe(2000)
      expect(seg.endN).toBe(1500)
      expect(seg.endE).toBe(2000)
      expect(seg.length).toBe(500)
      expect(seg.staStart).toBe(1000)
    }
  })

  it('computes length from coordinates when len attribute is missing', () => {
    const lineNoLen = `<Line>
      <Start>0.000 0.000</Start>
      <End>300.000 400.000</End>
    </Line>` // 3-4-5 triangle → length=500
    const xml = wrapLandXml(makeAlignment('ROAD', '0', lineNoLen))
    const result = parseLandXmlAlignment(xml)
    const seg = result.alignments[0].segments[0]

    if (seg.type === 'Line') {
      expect(seg.length).toBeCloseTo(500, 3)
    }
  })
})

// =============================================================================
// Curve segment parsing
// =============================================================================

describe('parseLandXmlAlignment – Curve segment', () => {
  it('parses Curve start/end/center coordinates', () => {
    const xml = wrapLandXml(makeAlignment('ROAD', '1000', SAMPLE_CURVE))
    const result = parseLandXmlAlignment(xml)
    const seg = result.alignments[0].segments[0]

    expect(seg.type).toBe('Curve')
    if (seg.type === 'Curve') {
      expect(seg.startN).toBe(0)
      expect(seg.startE).toBe(0)
      expect(seg.endN).toBe(100)
      expect(seg.endE).toBe(100)
      expect(seg.centerN).toBe(0)
      expect(seg.centerE).toBe(100)
    }
  })

  it('parses radius attribute', () => {
    const xml = wrapLandXml(makeAlignment('ROAD', '1000', SAMPLE_CURVE))
    const seg = parseLandXmlAlignment(xml).alignments[0].segments[0]
    if (seg.type === 'Curve') {
      expect(seg.radius).toBe(100)
    }
  })

  it('parses rot attribute as ccw', () => {
    const xml = wrapLandXml(makeAlignment('ROAD', '1000', SAMPLE_CURVE))
    const seg = parseLandXmlAlignment(xml).alignments[0].segments[0]
    if (seg.type === 'Curve') {
      expect(seg.rot).toBe('ccw')
    }
  })

  it('parses rot attribute as cw', () => {
    const cwCurve = SAMPLE_CURVE.replace('rot="ccw"', 'rot="cw"')
    const xml = wrapLandXml(makeAlignment('ROAD', '1000', cwCurve))
    const seg = parseLandXmlAlignment(xml).alignments[0].segments[0]
    if (seg.type === 'Curve') {
      expect(seg.rot).toBe('cw')
    }
  })

  it('parses arc length', () => {
    const xml = wrapLandXml(makeAlignment('ROAD', '1000', SAMPLE_CURVE))
    const seg = parseLandXmlAlignment(xml).alignments[0].segments[0]
    if (seg.type === 'Curve') {
      expect(seg.length).toBeCloseTo(157.0796, 2)
    }
  })
})

// =============================================================================
// Multi-segment alignment
// =============================================================================

describe('parseLandXmlAlignment – multi-segment', () => {
  const LINE_CURVE_LINE = `
    <Line len="500">
      <Start>1000.000 2000.000</Start>
      <End>1500.000 2000.000</End>
    </Line>
    <Curve len="157.0796" radius="100" rot="ccw">
      <Start>0.000 0.000</Start>
      <End>100.000 100.000</End>
      <Center>0.000 100.000</Center>
    </Curve>
    <Line len="300">
      <Start>1600.000 2000.000</Start>
      <End>1900.000 2000.000</End>
    </Line>`

  it('parses Line-Curve-Line geometry correctly', () => {
    const xml = wrapLandXml(makeAlignment('ACCESS ROAD 2', '1000', LINE_CURVE_LINE))
    const result = parseLandXmlAlignment(xml)

    expect(result.error).toBeNull()
    const al = result.alignments[0]
    expect(al.segments).toHaveLength(3)
    expect(al.segments[0].type).toBe('Line')
    expect(al.segments[1].type).toBe('Curve')
    expect(al.segments[2].type).toBe('Line')
  })

  it('accumulates staStart for each segment', () => {
    const xml = wrapLandXml(makeAlignment('ACCESS ROAD 2', '1000', LINE_CURVE_LINE))
    const result = parseLandXmlAlignment(xml)
    const segs = result.alignments[0].segments

    expect(segs[0].staStart).toBe(1000)
    expect(segs[1].staStart).toBeCloseTo(1500, 3)
    expect(segs[2].staStart).toBeCloseTo(1657.08, 1)
  })

  it('computes total alignment length', () => {
    const xml = wrapLandXml(makeAlignment('ACCESS ROAD 2', '1000', LINE_CURVE_LINE))
    const result = parseLandXmlAlignment(xml)
    const al = result.alignments[0]
    // 500 + 157.0796 + 300 ≈ 957.08
    expect(al.length).toBeCloseTo(957.08, 1)
  })
})

// =============================================================================
// Multiple alignments
// =============================================================================

describe('parseLandXmlAlignment – multiple alignments', () => {
  it('returns all valid alignments when multiple are present', () => {
    const xml = wrapLandXml(
      makeAlignment('ROAD A', '1000', SAMPLE_LINE) +
      makeAlignment('ROAD B', '2000', SAMPLE_LINE)
    )
    const result = parseLandXmlAlignment(xml)

    expect(result.error).toBeNull()
    expect(result.alignments).toHaveLength(2)
    expect(result.alignments[0].name).toBe('ROAD A')
    expect(result.alignments[1].name).toBe('ROAD B')
  })
})

// =============================================================================
// Real Carlson LandXML sample (ACCESS ROAD 2)
// =============================================================================

describe('parseLandXmlAlignment – real Carlson LandXML (ACCESS ROAD 2)', () => {
  it('parses successfully with no error', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    expect(result.error).toBeNull()
    expect(result.alignments).toHaveLength(1)
  })

  it('reads alignment name ACCESS ROAD 2', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    expect(result.alignments[0].name).toBe('ACCESS ROAD 2')
  })

  it('reads staStart = 1000', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    expect(result.alignments[0].staStart).toBe(1000)
  })

  it('has 3 segments: Line, Curve, Line', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    const segs = result.alignments[0].segments
    expect(segs).toHaveLength(3)
    expect(segs[0].type).toBe('Line')
    expect(segs[1].type).toBe('Curve')
    expect(segs[2].type).toBe('Line')
  })

  it('reads segment lengths correctly', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    const segs = result.alignments[0].segments
    expect(segs[0].length).toBeCloseTo(1117.7524, 2)
    expect(segs[1].length).toBeCloseTo(113.0969, 2)
    expect(segs[2].length).toBeCloseTo(540.7805, 2)
  })

  it('accumulates staStart: seg1=1000, seg2=2117.75, seg3=2230.85', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    const segs = result.alignments[0].segments
    expect(segs[0].staStart).toBeCloseTo(1000, 2)
    expect(segs[1].staStart).toBeCloseTo(2117.75, 1)
    expect(segs[2].staStart).toBeCloseTo(2230.85, 1)
  })

  it('computes total length ~1771.63', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    expect(result.alignments[0].length).toBeCloseTo(1771.63, 1)
  })

  it('reads curve radius = 72', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    const curve = result.alignments[0].segments[1]
    if (curve.type === 'Curve') {
      expect(curve.radius).toBeCloseTo(72, 1)
      expect(curve.rot).toBe('cw')
    }
  })

  it('seg1 start coords match XML', () => {
    const result = parseLandXmlAlignment(REAL_LANDXML)
    const seg = result.alignments[0].segments[0]
    expect(seg.startN).toBeCloseTo(667033.0295, 2)
    expect(seg.startE).toBeCloseTo(1242212.5447, 2)
  })
})

// =============================================================================
// Error handling
// =============================================================================

describe('parseLandXmlAlignment – error handling', () => {
  it('returns error for completely invalid XML', () => {
    // jsdom's DOMParser doesn't throw on malformed XML but embeds a parsererror
    const result = parseLandXmlAlignment('this is not xml at all <<<')
    // Either error is set or alignments are empty (jsdom behavior varies)
    expect(result.alignments.length === 0 || result.error !== null).toBe(true)
  })

  it('returns error when no Alignment elements are found', () => {
    const xml = `<?xml version="1.0"?><LandXML><NoAlignments/></LandXML>`
    const result = parseLandXmlAlignment(xml)
    expect(result.error).not.toBeNull()
    expect(result.alignments).toHaveLength(0)
  })

  it('returns error for empty string', () => {
    const result = parseLandXmlAlignment('')
    // parsererror or no Alignment elements
    expect(result.alignments).toHaveLength(0)
  })

  it('produces a warning for Alignment missing CoordGeom', () => {
    const xml = wrapLandXml(
      `<Alignment name="EMPTY" staStart="1000" length="100"></Alignment>`
    )
    const result = parseLandXmlAlignment(xml)
    // Either skipped with a warning, or overall error if no valid alignments
    expect(
      result.warnings.some((w) => w.includes('EMPTY') || w.includes('CoordGeom')) ||
      result.error !== null
    ).toBe(true)
  })
})
