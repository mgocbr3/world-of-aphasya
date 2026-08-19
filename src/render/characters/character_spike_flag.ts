// Opt-in URL switch for the character-proportion spike (throwaway, lives on
// spike/quaternius-characters): `?charspike=quaternius` draws every player as
// the Quaternius humanoid instead of its KayKit class body, so heroic and chibi
// proportions can be judged in the same town, at the same camera, minutes apart.
//
// Deliberately its OWN flag module rather than an entry in render_dev_flags.ts:
// that file's contract is `?<name>=off` (turn a shipped layer off for an A/B
// bench), and this is the opposite shape, an opt-in that turns an asset ON that
// nothing else can reach. Read once at module load, guarded for headless hosts,
// so the default path costs one boolean and no asset.
const spike = ((): string | null => {
  if (typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('charspike');
})();

/** True when the Quaternius proportion spike is requested via URL. */
export function quaterniusSpikeOn(): boolean {
  return spike === 'quaternius';
}
