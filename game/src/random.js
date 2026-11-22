// A small seeded random number generator (mulberry32): the same seed gives the
// same city and the same traffic, which is what makes the screenshot scenes
// repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** An integer in [min, max). */
    int(min, max) {
      return min + Math.floor(next() * (max - min));
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
