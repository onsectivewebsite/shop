/**
 * Hand-curated query-time synonym expansion. Cheap to keep — the catalog
 * doesn't need full WordNet to be useful; just the handful of pairs that
 * cover the most common "I searched X but they call it Y" misses.
 *
 * Bidirectional: if "headphones" is grouped with "earphones", a search for
 * either expands to include the other.
 *
 * Lookup is exact-match against single lowercased tokens. Multi-word
 * synonyms aren't supported in v1 — the tokenizer hands us individual
 * words and we expand each.
 */

const GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  // Audio
  ['headphones', 'earphones', 'earbuds', 'headset'],
  ['speaker', 'speakers', 'soundbar'],
  // Computing
  ['laptop', 'notebook', 'macbook'],
  ['monitor', 'display', 'screen'],
  ['keyboard', 'keypad'],
  ['mouse', 'mice', 'trackpad'],
  ['charger', 'adapter', 'powerbrick'],
  ['cable', 'cord', 'wire', 'lead'],
  ['hub', 'dock', 'docking'],
  // Photography
  ['camera', 'cam', 'dslr', 'mirrorless'],
  ['lens', 'lenses'],
  ['tripod', 'monopod'],
  // Apparel / accessories
  ['hoodie', 'hoody', 'sweatshirt', 'pullover'],
  ['jacket', 'coat', 'parka'],
  ['shoes', 'sneakers', 'trainers', 'kicks'],
  ['bag', 'backpack', 'rucksack', 'tote'],
  ['glasses', 'eyewear', 'sunglasses', 'shades'],
  ['watch', 'timepiece', 'wristwatch'],
  // Home
  ['mug', 'cup', 'tumbler'],
  ['bottle', 'flask', 'thermos'],
  ['lamp', 'light', 'sconce'],
  ['rug', 'carpet', 'mat'],
  ['blanket', 'throw', 'duvet', 'comforter'],
  ['plant', 'planter', 'pot'],
  // Beauty / personal care
  ['lipstick', 'lipgloss', 'lipbalm'],
  ['cream', 'lotion', 'moisturizer', 'moisturiser'],
  ['perfume', 'fragrance', 'cologne', 'scent'],
  ['shampoo', 'conditioner'],
  // Books / media
  ['book', 'novel', 'paperback', 'hardcover'],
  // Fitness
  ['mat', 'yogamat'],
  ['weights', 'dumbbells', 'kettlebell'],
];

const EXPAND: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const group of GROUPS) {
    for (const word of group) {
      const others = group.filter((w) => w !== word);
      const existing = m.get(word) ?? [];
      m.set(word, Array.from(new Set([...existing, ...others])));
    }
  }
  return m;
})();

/**
 * Returns a `to_tsquery`-compatible OR expression of every synonym for any
 * known token in the query, or null when nothing matches. Caller composes
 * `searchVector @@ websearch_to_tsquery(orig) OR searchVector @@ to_tsquery(<this>)`
 * to broaden the result set without losing rank.
 *
 * Tokens are filtered to alphanumerics only (defence-in-depth — to_tsquery
 * is parameterized but the lexer is unforgiving of stray punctuation).
 */
export function expandQuerySynonyms(q: string): string | null {
  if (!q || q.length === 0) return null;
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 1);

  const synonyms = new Set<string>();
  for (const t of tokens) {
    const list = EXPAND.get(t);
    if (!list) continue;
    for (const s of list) synonyms.add(s);
  }
  if (synonyms.size === 0) return null;

  return Array.from(synonyms).join(' | ');
}
