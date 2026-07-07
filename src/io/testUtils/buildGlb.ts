// テスト専用: 最小の glTF 2.0 バイナリ（GLB）を手組みするユーティリティ。
// three の GLTFExporter が node（jsdom 無し）で FileReader 依存により動かないため、
// GLTFLoader.parse の入力を自前で組み立てて既知寸法の GLB を再現する。

export interface GlbPrimitiveSpec {
  /** 三角形の頂点座標（xyz 連続, Y-up 前提） */
  positions: number[]
  /** 三角形インデックス（省略時は positions を順に 0,1,2,... で使う） */
  indices?: number[]
  /** 頂点ごとの RGB（0-1, 連続）。float（componentType 5126）で格納する。省略可 */
  colors?: number[]
  /**
   * 頂点ごとの RGB を UNSIGNED_BYTE(0-255) + normalized で格納したい場合に使う。
   * glTF 仕様上 COLOR_0 の整数型は normalized 必須（denormalize 後に 0-1 になることの回帰確認用）
   */
  colorsUnsignedByte?: number[]
  /** マテリアルの baseColorFactor（RGBA, 0-1）。省略時はマテリアル未指定 */
  materialColor?: [number, number, number, number]
  /** true で KHR_materials_unlit 拡張を付与する（GLTFLoader は MeshBasicMaterial を生成） */
  unlit?: boolean
  /** ノードの平行移動（省略時は原点） */
  translation?: [number, number, number]
  /** ノード名（非 ASCII を含む名前で JSON チャンクの 4byte アラインを確認する用途にも使う） */
  nodeName?: string
}

function pad4(len: number): number {
  return (4 - (len % 4)) % 4
}

/** 複数プリミティブ（各々 1 ノード + 1 メッシュ）を持つ GLB を組み立てる */
export function buildGlb(specs: GlbPrimitiveSpec[]): ArrayBuffer {
  const buffers: Uint8Array[] = []
  let byteOffset = 0
  const bufferViews: { buffer: 0; byteOffset: number; byteLength: number; target?: number }[] = []
  const accessors: Record<string, unknown>[] = []
  const materials: Record<string, unknown>[] = []
  const meshes: Record<string, unknown>[] = []
  const nodes: Record<string, unknown>[] = []

  function pushBuffer(bytes: Uint8Array, target?: number): number {
    const padding = pad4(bytes.byteLength)
    buffers.push(bytes)
    if (padding > 0) buffers.push(new Uint8Array(padding))
    const viewIndex = bufferViews.length
    bufferViews.push({ buffer: 0, byteOffset: byteOffset, byteLength: bytes.byteLength, target })
    byteOffset += bytes.byteLength + padding
    return viewIndex
  }

  let usesUnlit = false

  specs.forEach((spec) => {
    const positions = new Float32Array(spec.positions)
    const vertexCount = positions.length / 3
    const indices = new Uint32Array(spec.indices ?? [...Array(vertexCount).keys()])

    const posView = pushBuffer(new Uint8Array(positions.buffer), 34962)
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity
    for (let v = 0; v < vertexCount; v++) {
      minX = Math.min(minX, positions[v * 3])
      maxX = Math.max(maxX, positions[v * 3])
      minY = Math.min(minY, positions[v * 3 + 1])
      maxY = Math.max(maxY, positions[v * 3 + 1])
      minZ = Math.min(minZ, positions[v * 3 + 2])
      maxZ = Math.max(maxZ, positions[v * 3 + 2])
    }
    const posAccessor = accessors.length
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    })

    const idxView = pushBuffer(new Uint8Array(indices.buffer), 34963)
    const idxAccessor = accessors.length
    accessors.push({
      bufferView: idxView,
      componentType: 5125,
      count: indices.length,
      type: 'SCALAR',
    })

    const attributes: Record<string, number> = { POSITION: posAccessor }

    if (spec.colors) {
      const colors = new Float32Array(spec.colors)
      const colorView = pushBuffer(new Uint8Array(colors.buffer))
      const colorAccessor = accessors.length
      accessors.push({
        bufferView: colorView,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
      })
      attributes.COLOR_0 = colorAccessor
    } else if (spec.colorsUnsignedByte) {
      // COLOR_0 を UNSIGNED_BYTE(5121) + normalized: true で格納する
      const colors = new Uint8Array(spec.colorsUnsignedByte)
      const colorView = pushBuffer(colors)
      const colorAccessor = accessors.length
      accessors.push({
        bufferView: colorView,
        componentType: 5121,
        normalized: true,
        count: vertexCount,
        type: 'VEC3',
      })
      attributes.COLOR_0 = colorAccessor
    }

    let materialIndex: number | undefined
    if (spec.materialColor || spec.unlit) {
      materialIndex = materials.length
      materials.push({
        ...(spec.materialColor
          ? { pbrMetallicRoughness: { baseColorFactor: spec.materialColor } }
          : {}),
        ...(spec.unlit ? { extensions: { KHR_materials_unlit: {} } } : {}),
      })
      if (spec.unlit) usesUnlit = true
    }

    const meshIndex = meshes.length
    meshes.push({
      primitives: [
        {
          attributes,
          indices: idxAccessor,
          mode: 4,
          ...(materialIndex !== undefined ? { material: materialIndex } : {}),
        },
      ],
    })

    nodes.push({
      mesh: meshIndex,
      ...(spec.translation ? { translation: spec.translation } : {}),
      ...(spec.nodeName ? { name: spec.nodeName } : {}),
    })
  })

  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    ...(materials.length > 0 ? { materials } : {}),
    ...(usesUnlit ? { extensionsUsed: ['KHR_materials_unlit'] } : {}),
    buffers: [{ byteLength: byteOffset }],
    bufferViews,
    accessors,
  }

  // 4byte アラインは UTF-8 エンコード後のバイト長基準で計算する（非 ASCII は 1 文字が複数byte になるため、
  // JS 文字列の length＝UTF-16 コードユニット数を基準にすると 4byte アラインが崩れ、glTF 仕様違反の GLB になる）
  const jsonStr = JSON.stringify(json)
  const jsonStrBytes = new TextEncoder().encode(jsonStr)
  const jsonPadding = pad4(jsonStrBytes.byteLength)
  const jsonBuf = new Uint8Array(jsonStrBytes.byteLength + jsonPadding)
  jsonBuf.set(jsonStrBytes, 0)
  jsonBuf.fill(0x20, jsonStrBytes.byteLength) // glTF 仕様: JSON チャンクの末尾パディングは半角スペース(0x20)

  const bin = new Uint8Array(byteOffset)
  let cursor = 0
  for (const chunk of buffers) {
    bin.set(chunk, cursor)
    cursor += chunk.byteLength
  }

  const totalLength = 12 + 8 + jsonBuf.byteLength + 8 + bin.byteLength
  const out = new ArrayBuffer(totalLength)
  const dv = new DataView(out)
  let offset = 0
  dv.setUint32(offset, 0x46546c67, true) // magic 'glTF'
  offset += 4
  dv.setUint32(offset, 2, true) // version
  offset += 4
  dv.setUint32(offset, totalLength, true)
  offset += 4

  dv.setUint32(offset, jsonBuf.byteLength, true)
  offset += 4
  dv.setUint32(offset, 0x4e4f534a, true) // 'JSON'
  offset += 4
  new Uint8Array(out, offset, jsonBuf.byteLength).set(jsonBuf)
  offset += jsonBuf.byteLength

  dv.setUint32(offset, bin.byteLength, true)
  offset += 4
  dv.setUint32(offset, 0x004e4942, true) // 'BIN\0'
  offset += 4
  new Uint8Array(out, offset, bin.byteLength).set(bin)

  return out
}
