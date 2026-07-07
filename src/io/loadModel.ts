// GLB ファイルのブラウザ内ロード → MeshData への変換（FR-M1, docs/07 §9 M1）。
// three.js の GLTFLoader でパースし、シーン内の全メッシュを 1 つの MeshData に統合する。
// 座標系・単位の正規化は行わない（domain/normalize.ts の責務）。対象は GLB のみ（STL/OBJ は別 Issue）。

import { BufferGeometry, Color, Material, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { MeshData } from '../types'

/** .color（three.Color）を持つマテリアル。MeshStandardMaterial に限らず
 *  KHR_materials_unlit 等で GLTFLoader が生成する MeshBasicMaterial も対象に含める */
type ColoredMaterial = Material & { color: Color }

function hasColorProperty(material: Material): material is ColoredMaterial {
  return 'color' in material && (material as { color?: unknown }).color instanceof Color
}

export type LoadModelResult = { ok: true; mesh: MeshData } | { ok: false; error: string }

interface GltfPrimitiveDef {
  material?: number
}
interface GltfDocument {
  meshes?: { primitives?: GltfPrimitiveDef[] }[]
}

// @types/three の GLTFReference には primitives が定義されていないが、
// GLTFLoader の実装（three/examples/jsm/loaders/GLTFLoader.js）は
// associations.set(mesh, { meshes: meshIndex, primitives: primitiveIndex }) を行う。
// 型定義とランタイムの差分を吸収するためのローカル型。
interface MeshGltfAssociation {
  meshes?: number
  primitives?: number
}

/**
 * このメッシュに glTF 上のマテリアル定義があるか判定する。
 * GLTFLoader はマテリアル未指定のプリミティブにも既定の白マテリアルを割り当てるため、
 * Mesh.material の有無だけでは「無色」を区別できない。
 * `gltf.parser.associations`（GLTFLoader が公開する three オブジェクト⇔glTF 要素の対応表）
 * から元の meshes[].primitives[].material の有無を逆引きする。
 */
function hasGltfMaterial(gltf: GLTF, doc: GltfDocument, mesh: Mesh): boolean {
  const assoc = gltf.parser.associations.get(mesh) as MeshGltfAssociation | undefined
  if (!assoc || assoc.meshes === undefined || assoc.primitives === undefined) return false
  const primitive = doc.meshes?.[assoc.meshes]?.primitives?.[assoc.primitives]
  return primitive?.material !== undefined
}

/** three.Mesh から頂点ごとの RGB（0-1）を取り出す。頂点色があれば優先、無ければマテリアル色 */
function extractVertexColors(geometry: BufferGeometry, material: ColoredMaterial): Float32Array {
  const colorAttr = geometry.getAttribute('color')
  const vertexCount = geometry.getAttribute('position').count
  const out = new Float32Array(vertexCount * 3)
  if (colorAttr) {
    for (let i = 0; i < vertexCount; i++) {
      out[i * 3] = colorAttr.getX(i)
      out[i * 3 + 1] = colorAttr.getY(i)
      out[i * 3 + 2] = colorAttr.getZ(i)
    }
    return out
  }
  const c = material.color
  for (let i = 0; i < vertexCount; i++) {
    out[i * 3] = c.r
    out[i * 3 + 1] = c.g
    out[i * 3 + 2] = c.b
  }
  return out
}

/**
 * GLTFLoader の結果（シーングラフ）から全 Mesh を集め、1 つの MeshData へ統合する。
 * ワールド変換を各頂点へ適用してから結合する（domain 側では素直な座標配列として扱えるように）。
 */
function meshDataFromGltf(gltf: GLTF, doc: GltfDocument): MeshData {
  const meshes: Mesh[] = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((obj) => {
    if (obj instanceof Mesh) meshes.push(obj)
  })

  let vertexTotal = 0
  let indexTotal = 0
  let anyVertexColor = false
  for (const mesh of meshes) {
    const geo = mesh.geometry
    vertexTotal += geo.getAttribute('position').count
    indexTotal += geo.index ? geo.index.count : geo.getAttribute('position').count
    if (geo.hasAttribute('color') || hasGltfMaterial(gltf, doc, mesh)) anyVertexColor = true
  }

  const positions = new Float32Array(vertexTotal * 3)
  const indices = new Uint32Array(indexTotal)
  const vertexColors = anyVertexColor ? new Float32Array(vertexTotal * 3) : undefined

  let vertexOffset = 0
  let indexOffset = 0
  const v = new Vector3()
  for (const mesh of meshes) {
    const geo = mesh.geometry
    const posAttr = geo.getAttribute('position')
    const count = posAttr.count
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    const meshHasColor = geo.hasAttribute('color') || hasGltfMaterial(gltf, doc, mesh)
    const colors =
      vertexColors && meshHasColor && hasColorProperty(material)
        ? extractVertexColors(geo, material)
        : undefined

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld)
      positions[(vertexOffset + i) * 3] = v.x
      positions[(vertexOffset + i) * 3 + 1] = v.y
      positions[(vertexOffset + i) * 3 + 2] = v.z
      if (vertexColors) {
        // 色を持たないメッシュは 0 埋め（白で塗りつぶさない。頂点単位で色有無が混在する場合の妥協）
        vertexColors[(vertexOffset + i) * 3] = colors ? colors[i * 3] : 0
        vertexColors[(vertexOffset + i) * 3 + 1] = colors ? colors[i * 3 + 1] : 0
        vertexColors[(vertexOffset + i) * 3 + 2] = colors ? colors[i * 3 + 2] : 0
      }
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices[indexOffset + i] = geo.index.getX(i) + vertexOffset
      }
      indexOffset += geo.index.count
    } else {
      for (let i = 0; i < count; i++) indices[indexOffset + i] = vertexOffset + i
      indexOffset += count
    }
    vertexOffset += count
  }

  return { positions, indices, vertexColors }
}

/**
 * GLB バイナリの JSON チャンクだけを取り出す（マテリアル有無の判定に使う glTF ドキュメント）。
 * glTF 2.0 バイナリ仕様: 12byte ヘッダ + チャンク列。チャンク0 は常に JSON。
 * ヘッダ/チャンク境界を検証してから切り出す（壊れたファイルで範囲外読み取りにならないように）。
 */
function extractGlbJsonChunk(data: ArrayBuffer): GltfDocument {
  const GLB_MAGIC = 0x46546c67 // 'glTF' の ASCII をリトルエンディアンの uint32 として見た値
  const JSON_CHUNK_TYPE = 0x4e4f534a // 'JSON' の ASCII をリトルエンディアンの uint32 として見た値
  // 12byte ヘッダ + チャンク0 のヘッダ（長さ4byte + 種別4byte）分は最低限必要
  if (data.byteLength < 20) throw new Error('GLB ヘッダが不足しています')
  const header = new DataView(data, 0, 12)
  if (header.getUint32(0, true) !== GLB_MAGIC) throw new Error('GLB マジックナンバーが一致しません')
  const chunkHeader = new DataView(data, 12, 8)
  const jsonChunkLength = chunkHeader.getUint32(0, true)
  const jsonChunkType = chunkHeader.getUint32(4, true)
  if (jsonChunkType !== JSON_CHUNK_TYPE) throw new Error('先頭チャンクが JSON ではありません')
  if (20 + jsonChunkLength > data.byteLength) throw new Error('JSON チャンクの長さが不正です')
  const jsonBytes = new Uint8Array(data, 20, jsonChunkLength)
  return JSON.parse(new TextDecoder().decode(jsonBytes)) as GltfDocument
}

/**
 * GLB ファイル（ArrayBuffer）を読み込み MeshData へ変換する。
 * 壊れたファイル・非 GLB は例外を投げず `{ ok: false, error }` を返す。
 */
export async function loadGlbModel(data: ArrayBuffer): Promise<LoadModelResult> {
  let doc: GltfDocument
  try {
    doc = extractGlbJsonChunk(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `GLB の解析に失敗しました: ${message}` }
  }

  let gltf: GLTF
  try {
    gltf = await new Promise<GLTF>((resolve, reject) => {
      new GLTFLoader().parse(data, '', resolve, reject)
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `GLB の読み込みに失敗しました: ${message}` }
  }

  try {
    const mesh = meshDataFromGltf(gltf, doc)
    if (mesh.positions.length === 0) {
      return { ok: false, error: 'GLB にメッシュが含まれていません' }
    }
    return { ok: true, mesh }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `メッシュの統合に失敗しました: ${message}` }
  }
}
