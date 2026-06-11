import { describe, it, expect } from 'vitest'
import {
  parseAsBuiltFile,
  parseDesignFile,
} from '@/src/lib/parseSurveyFile'

// =============================================================================
// Test Data - Realistic Survey File Formats
// =============================================================================

/**
 * Creates a CSV formatted survey file with header
 */
function makeCsvWithHeader(rows: string[], delimiter = ','): string {
  return rows.join('\n')
}

/**
 * Creates a headerless survey file (4 or 5 column format)
 */
function makeHeaderless(rows: string[]): string {
  return rows.join('\n')
}

// =============================================================================
// CSV/Comma Delimited Tests
// =============================================================================

describe('parseAsBuiltFile - CSV Format', () => {
  it('should parse standard CSV with comma delimiter', () => {
    const content = `Point ID,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500
P2,1001.123,2001.456,101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
    expect(result.points[0]).toEqual({
      pointId: 'P1',
      northing: 1000.123,
      easting: 2000.456,
      asBuiltElevation: 100.5,
    })
  })

  it('should handle spaces after commas', () => {
    const content = `Point ID, Northing, Easting, As-Built Elev
P1, 1000.123, 2000.456, 100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(1)
    expect(result.points[0].northing).toBe(1000.123)
  })

  it('should handle CRLF line endings', () => {
    const content = `Point ID,Northing,Easting,As-Built Elev\r\nP1,1000.123,2000.456,100.500\r\nP2,1001.123,2001.456,101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
  })

  it('should handle CR-only line endings', () => {
    const content = `Point ID,Northing,Easting,As-Built Elev\rP1,1000.123,2000.456,100.500\rP2,1001.123,2001.456,101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
  })

  it('should skip empty lines', () => {
    const content = `Point ID,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500

P2,1001.123,2001.456,101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
  })
})

// =============================================================================
// Tab Delimited Tests
// =============================================================================

describe('parseAsBuiltFile - Tab Delimited', () => {
  it('should parse tab-delimited file', () => {
    const content = `Point ID\tNorthing\tEasting\tAs-Built Elev
P1\t1000.123\t2000.456\t100.500
P2\t1001.123\t2001.456\t101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
    expect(result.points[0].pointId).toBe('P1')
    expect(result.points[0].northing).toBe(1000.123)
  })

  it('should handle tabs with spaces', () => {
    const content = `Point ID \t Northing \t Easting \t As-Built Elev
P1 \t 1000.123 \t 2000.456 \t 100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].pointId).toBe('P1')
  })
})

// =============================================================================
// Semicolon Delimited Tests
// =============================================================================

describe('parseAsBuiltFile - Semicolon Delimited', () => {
  it('should parse semicolon-delimited file (European format)', () => {
    const content = `Point ID;Northing;Easting;As-Built Elev
P1;1000.123;2000.456;100.500
P2;1001.123;2001.456;101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
  })
})

// =============================================================================
// Header Alias Mapping Tests
// =============================================================================

describe('parseAsBuiltFile - Header Aliases', () => {
  it('should recognize "point id" alias', () => {
    const content = `point id,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].pointId).toBe('P1')
  })

  it('should recognize "pt" alias for point ID', () => {
    const content = `pt,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].pointId).toBe('P1')
  })

  it('should recognize "name" alias for point ID', () => {
    const content = `name,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].pointId).toBe('P1')
  })

  it('should recognize "north" alias for northing', () => {
    const content = `Point ID,north,Easting,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].northing).toBe(1000.123)
  })

  it('should recognize "y" alias for northing', () => {
    const content = `Point ID,y,Easting,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].northing).toBe(1000.123)
  })

  it('should recognize "east" alias for easting', () => {
    const content = `Point ID,Northing,east,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].easting).toBe(2000.456)
  })

  it('should recognize "x" alias for easting', () => {
    const content = `Point ID,Northing,x,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].easting).toBe(2000.456)
  })

  it('should recognize "as-built elevation" alias', () => {
    const content = `Point ID,Northing,Easting,as-built elevation
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].asBuiltElevation).toBe(100.5)
  })

  it('should recognize "field elev" alias for as-built', () => {
    const content = `Point ID,Northing,Easting,field elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].asBuiltElevation).toBe(100.5)
  })

  it('should recognize "measured elev" alias for as-built', () => {
    const content = `Point ID,Northing,Easting,measured elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].asBuiltElevation).toBe(100.5)
  })

  it('should recognize "elev" generic alias', () => {
    const content = `Point ID,Northing,Easting,elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].asBuiltElevation).toBe(100.5)
  })

  it('should recognize "z" generic alias for elevation', () => {
    const content = `Point ID,Northing,Easting,z
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].asBuiltElevation).toBe(100.5)
  })
})

describe('parseDesignFile - Header Aliases', () => {
  it('should recognize "design elevation" alias', () => {
    const content = `Point ID,Northing,Easting,design elevation
P1,1000.123,2000.456,100.500`

    const result = parseDesignFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].designElevation).toBe(100.5)
  })

  it('should recognize "finished grade" alias for design', () => {
    const content = `Point ID,Northing,Easting,finished grade
P1,1000.123,2000.456,100.500`

    const result = parseDesignFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].designElevation).toBe(100.5)
  })

  it('should recognize "fg" alias for design', () => {
    const content = `Point ID,Northing,Easting,fg
P1,1000.123,2000.456,100.500`

    const result = parseDesignFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].designElevation).toBe(100.5)
  })

  it('should recognize "fg elev" alias for design', () => {
    const content = `Point ID,Northing,Easting,fg elev
P1,1000.123,2000.456,100.500`

    const result = parseDesignFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].designElevation).toBe(100.5)
  })

  it('should recognize "design ht" alias for design', () => {
    const content = `Point ID,Northing,Easting,design ht
P1,1000.123,2000.456,100.500`

    const result = parseDesignFile(content)

    expect(result.error).toBeNull()
    expect(result.points[0].designElevation).toBe(100.5)
  })
})

// =============================================================================
// Headerless File Tests (4-column PNED format)
// =============================================================================

describe('parseAsBuiltFile - Headerless 4-Column', () => {
  it('should parse headerless 4-column file (Point, N, E, Elev)', () => {
    const content = `P1,1000.123,2000.456,100.500
P2,1001.123,2001.456,101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
    expect(result.points[0]).toEqual({
      pointId: 'P1',
      northing: 1000.123,
      easting: 2000.456,
      asBuiltElevation: 100.5,
    })
  })

  it('should handle headerless with tab delimiter', () => {
    const content = `P1\t1000.123\t2000.456\t100.500
P2\t1001.123\t2001.456\t101.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
  })

})

// =============================================================================
// Headerless 5-Column Format Tests
// =============================================================================

describe('parseAsBuiltFile - Headerless 5-Column', () => {
  it('should parse 5-column as-built (uses 5th column for elevation)', () => {
    // 5-col format: Point | N | E | Design Elev | As-Built Elev
    const content = `P1,1000.123,2000.456,100.500,99.800
P2,1001.123,2001.456,101.500,100.800`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
    expect(result.points[0].asBuiltElevation).toBe(99.8) // 5th column
  })
})

describe('parseDesignFile - Headerless 5-Column', () => {
  it('should parse 5-column design (uses 4th column for elevation)', () => {
    // 5-col format for design: Point | N | E | Design Elev | As-Built Elev
    // Design file uses 4th column (index 3)
    const content = `P1,1000.123,2000.456,100.500,99.800
P2,1001.123,2001.456,101.500,100.800`

    const result = parseDesignFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
    expect(result.points[0].designElevation).toBe(100.5) // 4th column
  })
})

// =============================================================================
// Swap N/E Tests
// =============================================================================

describe('parseAsBuiltFile - Swap Northing/Easting', () => {
  it('should swap N and E when swapNE is true for headerless file', () => {
    // File has E,N order: Point | Easting | Northing | Elev
    const content = `P1,2000.456,1000.123,100.500`

    const result = parseAsBuiltFile(content, true)

    expect(result.error).toBeNull()
    expect(result.points[0].northing).toBe(1000.123) // Should be 2nd value after swap
    expect(result.points[0].easting).toBe(2000.456) // Should be 1st value after swap
    expect(result.warnings).toContain(
      'Headerless file: Northing and Easting columns were swapped (E, N order assumed).'
    )
  })

  it('should not swap when swapNE is false', () => {
    // Standard N,E order
    const content = `P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content, false)

    expect(result.error).toBeNull()
    expect(result.points[0].northing).toBe(1000.123)
    expect(result.points[0].easting).toBe(2000.456)
    expect(result.warnings).not.toContain(
      'Headerless file: Northing and Easting columns were swapped (E, N order assumed).'
    )
  })

  it('should ignore swapNE for headered files', () => {
    const content = `Point ID,Easting,Northing,As-Built Elev
P1,2000.456,1000.123,100.500`

    // Even with swapNE=true, headered files use column names
    const result = parseAsBuiltFile(content, true)

    expect(result.error).toBeNull()
    // Should parse correctly based on column headers, not position
    expect(result.points[0].northing).toBe(1000.123)
    expect(result.points[0].easting).toBe(2000.456)
  })
})

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('parseAsBuiltFile - Error Handling', () => {
  it('should return error for empty file', () => {
    const result = parseAsBuiltFile('')

    expect(result.error).toBe('The uploaded file appears to be empty.')
    expect(result.points).toHaveLength(0)
  })

  it('should return error for whitespace-only file', () => {
    const result = parseAsBuiltFile('   \n\n   ')

    expect(result.error).toBe('The uploaded file appears to be empty.')
  })

  it('should return error when required columns are missing', () => {
    const content = `Point ID,Random Column,Another Column
P1,1000.123,2000.456`

    const result = parseAsBuiltFile(content)

    expect(result.error).toContain('Could not find required column(s)')
    expect(result.error).toContain('Northing')
    expect(result.error).toContain('Easting')
  })

  it('should return error for unrecognizable format (not 4 or 5 columns)', () => {
    const content = `P1,1000.123,2000.456`

    const result = parseAsBuiltFile(content)

    expect(result.error).toContain('Unrecognised file format')
  })

  it('should skip rows with invalid numeric values and report warnings', () => {
    const content = `Point ID,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500
P2,invalid,2000.456,100.500
P3,1001.123,invalid,100.500
P4,1002.123,2002.456,invalid`

    const result = parseAsBuiltFile(content)

    expect(result.points).toHaveLength(1) // Only first row valid
    expect(result.warnings).toHaveLength(3)
    expect(result.warnings[0]).toContain('Row 3')
    expect(result.warnings[1]).toContain('Row 4')
    expect(result.warnings[2]).toContain('Row 5')
  })

  it('should return error when no valid data rows found', () => {
    const content = `Point ID,Northing,Easting,As-Built Elev
P1,invalid,2000.456,100.500
P2,1001.123,invalid,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBe(
      'No valid data rows were found. Check that the file contains numeric values.'
    )
  })
})

// =============================================================================
// Realistic Paving Workflow Tests
// =============================================================================

describe('Realistic Paving Survey Workflows', () => {
  it('should handle typical DOT paving survey format', () => {
    // Common state DOT format: Point, Station, Offset, Northing, Easting, Elevation
    // But we'll use a simplified version they might export
    const content = `Point,Northing,Easting,Elev
CL01,334567.123,1987654.456,892.345
CL02,334568.123,1987655.456,892.445
CL03,334569.123,1987656.456,892.545`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(3)
    expect(result.points[1].pointId).toBe('CL02')
  })

  it('should handle FAA airfield paving survey', () => {
    // FAA projects often use precise coordinates
    const content = `Point ID,Northing,Easting,Observed Elev
RWY15-001,1756234.123456,5421987.654321,1045.123456
RWY15-002,1756235.123456,5421988.654321,1045.234567`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(2)
    // Should preserve precision in raw values
    expect(result.points[0].northing).toBe(1756234.123456)
    expect(result.points[0].easting).toBe(5421987.654321)
  })

  it('should handle commercial site paving with many points', () => {
    // Generate 50 parking lot points
    const rows: string[] = ['Point,Northing,Easting,Elev']
    for (let i = 1; i <= 50; i++) {
      const n = 500000 + i * 25
      const e = 2100000 + i * 25
      const elev = 100 + i * 0.01
      rows.push(`PL${i.toString().padStart(3, '0')},${n.toFixed(3)},${e.toFixed(3)},${elev.toFixed(3)}`)
    }

    const result = parseAsBuiltFile(rows.join('\n'))

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(50)
    expect(result.points[0].pointId).toBe('PL001')
    expect(result.points[49].pointId).toBe('PL050')
  })

  it('should handle mixed point ID formats', () => {
    const content = `Point,Northing,Easting,Elev
1,1000,2000,100
A-1,1001,2001,101
STATION_001,1002,2002,102
001-A,1003,2003,103
P-001-R,1004,2004,104`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(5)
    expect(result.points[0].pointId).toBe('1')
    expect(result.points[1].pointId).toBe('A-1')
    expect(result.points[2].pointId).toBe('STATION_001')
  })
})

// =============================================================================
// Case Insensitivity Tests
// =============================================================================

describe('Header Case Insensitivity', () => {
  it('should handle uppercase headers', () => {
    const content = `POINT ID,NORTHING,EASTING,AS-BUILT ELEV
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(1)
  })

  it('should handle mixed case headers', () => {
    const content = `Point Id,Northing,Easting,As-Built Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(1)
  })

  it('should handle headers with extra spaces', () => {
    const content = `Point  ID,  Northing  ,  Easting  ,  As-Built  Elev
P1,1000.123,2000.456,100.500`

    const result = parseAsBuiltFile(content)

    expect(result.error).toBeNull()
    expect(result.points).toHaveLength(1)
  })
})
