// Batch links, the way IDM's wildcard numbers work: one link with a numbered range becomes many
// downloads. `https://host/img-[001-100].jpg` is a hundred links, `.../part-[1-4].zip` four.
// Pure, so the expansion can be checked against exact inputs.

/** A numbered placeholder: `[start-end]`, with an optional `:step`. */
const RANGE = /\[(\d+)-(\d+)(?::(\d+))?\]/g

/** The most links one pattern may stand for. A typo like `[1-100000000]` would otherwise queue a
 * hundred million probes; past this the pattern is refused and the field kept as typed. */
export const MAX_BATCH_LINKS = 100

/** Expands every numbered range in `pattern` into one link each, or null when there is none (or
 * the expansion is larger than MAX_BATCH_LINKS). Zero-padding comes from the start number's own
 * width, so `[001-100]` reads `001`…`100` and `[1-100]` reads `1`…`100`; a descending range counts
 * down (`[9-1]`), and `:step` sets the stride. Several ranges multiply: `[1-2]-[a-c]` isn't
 * supported (digits only), but `x[1-2]y[3-4]` yields the four combinations. */
export function expandBatchUrl(pattern: string): string[] | null {
  const groups: string[][] = []
  // A unique marker per range, so two identical ranges in one link don't collide while the
  // combinations are built. NUL can't appear in a real link.
  const marked = pattern.replace(
    RANGE,
    (whole, startText: string, endText: string, stepText?: string) => {
      const start = Number(startText)
      const end = Number(endText)
      const step = stepText ? Math.abs(Number(stepText)) : 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || step === 0) {
        // Leave the placeholder untouched; it simply won't expand.
        return whole
      }
      const numbers: string[] = []
      const width = startText.length
      if (start <= end)
        for (let n = start; n <= end; n += step) numbers.push(String(n).padStart(width, '0'))
      else for (let n = start; n >= end; n -= step) numbers.push(String(n).padStart(width, '0'))
      if (numbers.length === 0) return whole
      const index = groups.push(numbers) - 1
      return `\u0000${index}\u0000`
    }
  )

  if (groups.length === 0) return null
  const total = groups.reduce((product, group) => product * group.length, 1)
  if (!Number.isSafeInteger(total) || total > MAX_BATCH_LINKS) return null

  let results = [marked]
  for (let index = 0; index < groups.length; index += 1) {
    const marker = `\u0000${index}\u0000`
    const next: string[] = []
    for (const partial of results) {
      for (const value of groups[index]) next.push(partial.replace(marker, value))
    }
    results = next
  }
  return results
}
