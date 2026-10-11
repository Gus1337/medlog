import { describe, expect, it } from 'vitest'
import { generateSampleData } from '../dev/sampleData'
import { buildCsvFiles, csvCell, csvTime, toCsv } from './csv'

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(3)).toBe('3')
  })

  it('defuses spreadsheet formulas in text', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell(-2)).toBe('-2')
  })

  it('builds rows with CRLF line endings', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n')
  })

  it('formats local times', () => {
    expect(csvTime(new Date(2026, 0, 5, 7, 3).getTime())).toBe('2026-01-05 07:03')
  })

  it('exports every kind of record', () => {
    const sample = generateSampleData(new Date(2026, 9, 10, 20).getTime())
    const files = buildCsvFiles({ ...sample, summaries: [] })
    expect(files.map((f) => f.name)).toEqual([
      'medications.csv',
      'dose_changes.csv',
      'doses.csv',
      'effects.csv',
      'notes.csv',
      'check_ins.csv',
      'summaries.csv',
      'habits.csv',
      'habit_log.csv',
    ])
    const effects = files.find((f) => f.name === 'effects.csv')!.content.trim().split('\r\n')
    expect(effects).toHaveLength(sample.effects.length + 1)
    expect(effects[1]).toMatch(/after (Lisdexamfetamine|Sertraline)/)
    const habitLog = files.find((f) => f.name === 'habit_log.csv')!.content.trim().split('\r\n')
    expect(habitLog).toHaveLength(sample.habitLogs.length + 1)
    expect(habitLog[1]).toMatch(/^\d{4}-\d{2}-\d{2},(Read|Workout|Steps),/)
  })
})
