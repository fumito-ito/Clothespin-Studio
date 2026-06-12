import { describe, expect, it } from 'vitest'
import { parseProject, serializeProject } from './project'
import { bomToCsv } from './exportCsv'
import { buildBom } from '../domain/bom'
import { DEFAULT_PALETTE } from '../assets/palette'
import { PROJECT_VERSION } from '../types'
import type { Pin } from '../types'

const root: Pin = {
  id: 'root',
  colorId: 'blue',
  connection: null,
  transform: { position: [10, 20, 19.5], rotation: [0, 0, 0, 1] },
}
const child: Pin = {
  id: 'child',
  colorId: 'white',
  connection: { parentId: 'root', gripIndex: 4, roll: 30, pitch: 60 },
  // 実行時に transform が付いていても保存時に落とされること
  transform: { position: [99, 99, 99], rotation: [0, 0, 0, 1] },
}

describe('serializeProject / parseProject', () => {
  it('ラウンドトリップでピンが保存・復元される', () => {
    const project = serializeProject([root, child], DEFAULT_PALETTE, 'test')
    const result = parseProject(JSON.stringify(project))
    expect(result.errors).toEqual([])
    expect(result.project?.pins).toHaveLength(2)
    expect(result.project?.pins[0]).toEqual(root)
    expect(result.project?.pins[1]).toEqual({
      id: 'child',
      colorId: 'white',
      connection: { parentId: 'root', gripIndex: 4, roll: 30, pitch: 60 },
    })
    expect(result.project?.version).toBe(PROJECT_VERSION)
    expect(result.project?.meta.name).toBe('test')
  })

  it('connection を持つピンの transform は保存しない', () => {
    const project = serializeProject([root, child], DEFAULT_PALETTE)
    expect(project.pins[1].transform).toBeUndefined()
    expect(project.pins[0].transform).toBeDefined()
  })

  it('不正な入力を拒否する', () => {
    const cases: [string, string][] = [
      ['not json', 'JSON'],
      ['{}', 'format'],
      [JSON.stringify({ format: 'clothespin-studio-project' }), 'version'],
      [
        JSON.stringify({ format: 'clothespin-studio-project', version: 999, unit: 'mm' }),
        '未対応のバージョン',
      ],
      [
        JSON.stringify({
          format: 'clothespin-studio-project',
          version: 1,
          unit: 'cm',
        }),
        'unit',
      ],
    ]
    for (const [text, fragment] of cases) {
      const result = parseProject(text)
      expect(result.project).toBeUndefined()
      expect(result.errors.join(' / ')).toContain(fragment)
    }
  })

  it('構造違反（閉路・二重占有など）を拒否する', () => {
    const bad = serializeProject(
      [
        root,
        { id: 'a', colorId: 'blue', connection: { parentId: 'root', gripIndex: 0, roll: 0 } },
        { id: 'b', colorId: 'blue', connection: { parentId: 'root', gripIndex: 0, roll: 0 } },
      ],
      DEFAULT_PALETTE,
    )
    const result = parseProject(JSON.stringify(bad))
    expect(result.errors.join(' / ')).toContain('二重占有')
  })
})

describe('bomToCsv', () => {
  it('BOM 付き UTF-8 / CRLF / TOTAL 行の CSV を生成する', () => {
    const csv = bomToCsv(buildBom([root, child], DEFAULT_PALETTE))
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('color_id,color_name,hex,count')
    expect(lines[1]).toBe('blue,ブルー,#0C48A3,1')
    expect(lines[2]).toBe('white,ホワイト,#FFFFFF,1')
    expect(lines.at(-1)).toBe('TOTAL,,,2')
  })

  it('カンマ等を含むフィールドをクオートする', () => {
    const csv = bomToCsv({
      rows: [{ colorId: 'x', colorName: 'a,b', hex: '#000000', count: 1 }],
      total: 1,
    })
    expect(csv).toContain('x,"a,b",#000000,1')
  })
})
