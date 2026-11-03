// Alternating downloads across networks: each download takes one network, in turn — the first
// network 1, the next network 2, then back to network 1. Pure, so the order is checked exactly.

export interface NetworkTurn {
  /** The network this download takes. */
  network: string
  /** Where the alternation stands afterwards — feed this back in for the next download. */
  next: number
}

/** The network `rotation` names out of `pool`, and the rotation to use next. */
export function rotatedNetwork(pool: readonly string[], rotation: number): NetworkTurn {
  const index = ((rotation % pool.length) + pool.length) % pool.length
  return { network: pool[index], next: rotation + 1 }
}
