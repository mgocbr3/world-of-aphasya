// The Quaternius cast switch. Direction adopted the new cast (2026-08-29), so
// the heroic-proportion bodies are the DEFAULT everywhere a browser draws the
// game; `?charspike=off` keeps the original KayKit chibi cast reachable as the
// comparison arm. Outside a browser (tests, the headless RL env) the flag
// reads OFF so Node imports keep their original behavior and no spike preload
// fires where no renderer exists.
//
// Deliberately its OWN flag module rather than an entry in render_dev_flags.ts:
// that file's contract is `?<name>=off` for shipped LAYERS, and this swaps a
// whole cast. Read once at module load, so the default path costs one boolean.
const spike = ((): string | null => {
  if (typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('charspike');
})();

/** True when the Quaternius cast draws (the default in a browser). */
export function quaterniusSpikeOn(): boolean {
  if (typeof location === 'undefined') return false;
  return spike !== 'off';
}
