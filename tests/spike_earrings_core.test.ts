// The spike earring set ships every legacy piercing style re-based into the
// head-bone frame (scripts/assets/build_spike_earrings.mjs). The contract worth
// pinning is style -> node: the picker mounts by NAME, and a style whose node
// is missing from the shipped GLB fails silently at runtime (the character just
// has bare ears), so the gate reads the file the way the clipmap gate does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EARRING_STYLES } from '../src/render/characters/modular';
import { SPIKE_EARRINGS_URL, spikeEarringNode } from '../src/render/characters/spike_earrings_core';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'

/** Minimal glTF-binary reader (the character_clipmaps.test.ts pattern):
 *  dependency-free so the gate cannot be fooled by the runtime loader stack. */
function glbNodeNames(publicPath: string): Set<string> {
  const buf = readFileSync(publicPath);
  expect(buf.readUInt32LE(0), `${publicPath} magic`).toBe(GLB_MAGIC);
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    if (type === CHUNK_JSON) {
      const json = JSON.parse(buf.toString('utf8', offset + 8, offset + 8 + length)) as {
        nodes?: { name?: string }[];
      };
      return new Set(
        (json.nodes ?? []).map((n) => n.name).filter((name): name is string => !!name),
      );
    }
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  throw new Error(`${publicPath} has no JSON chunk`);
}

describe('spike earring set', () => {
  it('mounts nothing for bare ears', () => {
    expect(spikeEarringNode('none')).toBeNull();
  });

  it('has a shipped node for every pickable style', () => {
    const nodes = glbNodeNames(`public/${SPIKE_EARRINGS_URL}`);
    for (const style of EARRING_STYLES) {
      if (style === 'none') continue;
      const node = spikeEarringNode(style);
      expect(node, style).not.toBeNull();
      expect(nodes.has(node as string), `${style} -> ${node} missing from GLB`).toBe(true);
    }
  });
});
