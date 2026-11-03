// HLS (RFC 8216 / draft-pantos-hls-rfc8216bis) playlist parsing: a master playlist's variants, or
// a media playlist's segments, keys and byte ranges. Pure and string-in, so it is checked against
// exact playlists rather than a live stream. Fetching and downloading live elsewhere.

export interface HlsVariant {
  url: string
  /** BANDWIDTH attribute: the peak bitrate in bits a second, when the playlist states it. */
  bandwidth: number | null
  width: number | null
  height: number | null
  codecs: string | null
}

export interface HlsByteRange {
  /** Inclusive, as the playlist states them. */
  start: number
  end: number
}

export interface HlsSegment {
  url: string
  /** EXTINF duration in seconds, when known. */
  duration: number | null
  byteRange: HlsByteRange | null
}

export interface HlsKey {
  /** e.g. AES-128, or NONE. */
  method: string
  uri: string | null
  iv: string | null
}

export interface HlsMediaPlaylist {
  segments: HlsSegment[]
  /** EXT-X-MAP: an initialisation segment (fMP4) fetched before the rest. */
  initSegment: HlsSegment | null
  key: HlsKey | null
  /** EXT-X-ENDLIST: a finished (VOD) playlist, rather than a live one. */
  endList: boolean
  totalDurationSeconds: number
  /** Sum of the segment byte sizes the playlist states (byte-range playlists, or a known length).
   * Null when the playlist doesn't say how big the media is. */
  knownBytes: number | null
}

export type HlsPlaylist =
  { kind: 'master'; variants: HlsVariant[] } | { kind: 'media'; playlist: HlsMediaPlaylist }

/** Splits `<KEY=VALUE,...>` into a map, honouring quoted values that themselves contain commas
 * (CODECS often does). */
function parseAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const pattern = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/gi
  for (const match of value.matchAll(pattern)) {
    attributes[match[1].toUpperCase()] = match[3] ?? match[2]
  }
  return attributes
}

function resolve(baseUrl: string, reference: string): string {
  try {
    return new URL(reference.trim(), baseUrl).toString()
  } catch {
    return reference.trim()
  }
}

/** `#EXT-X-BYTERANGE:1000@2000` (length @ offset). The offset may be omitted, meaning "right after
 * the previous segment". */
function parseByteRange(value: string, previous: HlsByteRange | null): HlsByteRange | null {
  const [lengthText, offsetText] = value.trim().split('@')
  const length = Number(lengthText)
  if (!Number.isSafeInteger(length) || length <= 0) return null
  const start = offsetText !== undefined ? Number(offsetText) : (previous?.end ?? -1) + 1
  if (!Number.isSafeInteger(start) || start < 0) return null
  return { start, end: start + length - 1 }
}

/** Parses a playlist. `baseUrl` is where it was fetched, for resolving its relative URIs. */
export function parseHlsPlaylist(text: string, baseUrl: string): HlsPlaylist {
  const lines = text.split(/\r?\n/)
  if (!lines.some((line) => line.trim().startsWith('#EXTM3U'))) {
    throw new Error('Not an HLS playlist (no #EXTM3U)')
  }

  const variants: HlsVariant[] = []
  const segments: HlsSegment[] = []
  let initSegment: HlsSegment | null = null
  let key: HlsKey | null = null
  let endList = false
  let totalDurationSeconds = 0
  let knownBytes = 0
  let bytesKnown = true
  let pendingDuration: number | null = null
  let pendingByteRange: HlsByteRange | null = null
  let lastByteRange: HlsByteRange | null = null
  let pendingVariant: Omit<HlsVariant, 'url'> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    if (!line.startsWith('#')) {
      // A URI line: it belongs to whatever the last tag announced.
      if (pendingVariant) {
        variants.push({ ...pendingVariant, url: resolve(baseUrl, line) })
        pendingVariant = null
      } else if (pendingByteRange) {
        segments.push({
          url: resolve(baseUrl, line),
          duration: pendingDuration,
          byteRange: pendingByteRange
        })
        knownBytes += pendingByteRange.end - pendingByteRange.start + 1
        lastByteRange = pendingByteRange
        pendingByteRange = null
        pendingDuration = null
      } else {
        // A plain segment (no byte range): its size isn't stated.
        segments.push({ url: resolve(baseUrl, line), duration: pendingDuration, byteRange: null })
        bytesKnown = false
        pendingDuration = null
      }
      continue
    }

    const separator = line.indexOf(':')
    const tag = (separator === -1 ? line : line.slice(0, separator)).toUpperCase()
    const value = separator === -1 ? '' : line.slice(separator + 1)

    if (tag === '#EXT-X-STREAM-INF') {
      const attributes = parseAttributes(value)
      const resolution = attributes.RESOLUTION?.split('x') ?? []
      pendingVariant = {
        bandwidth: attributes.BANDWIDTH ? Number(attributes.BANDWIDTH) : null,
        width: resolution[0] ? Number(resolution[0]) : null,
        height: resolution[1] ? Number(resolution[1]) : null,
        codecs: attributes.CODECS ?? null
      }
    } else if (tag === '#EXTINF') {
      const seconds = Number(value.split(',')[0])
      pendingDuration = Number.isFinite(seconds) ? seconds : null
      if (pendingDuration !== null) totalDurationSeconds += pendingDuration
    } else if (tag === '#EXT-X-BYTERANGE') {
      pendingByteRange = parseByteRange(value, lastByteRange)
    } else if (tag === '#EXT-X-KEY') {
      const attributes = parseAttributes(value)
      const method = attributes.METHOD ?? 'NONE'
      key =
        method === 'NONE'
          ? null
          : {
              method,
              uri: attributes.URI ? resolve(baseUrl, attributes.URI) : null,
              iv: attributes.IV ?? null
            }
    } else if (tag === '#EXT-X-MAP') {
      const attributes = parseAttributes(value)
      if (attributes.URI) {
        const range = attributes.BYTERANGE ? parseByteRange(attributes.BYTERANGE, null) : null
        initSegment = { url: resolve(baseUrl, attributes.URI), duration: null, byteRange: range }
      }
    } else if (tag === '#EXT-X-ENDLIST') {
      endList = true
    }
  }

  if (variants.length > 0 && segments.length === 0) {
    return { kind: 'master', variants }
  }
  if (variants.length === 0 && segments.length === 0) {
    throw new Error('The playlist has neither variants nor segments')
  }
  return {
    kind: 'media',
    playlist: {
      segments,
      initSegment,
      key,
      endList,
      totalDurationSeconds,
      knownBytes: bytesKnown && segments.length > 0 ? knownBytes : null
    }
  }
}

/** The variant to download by default: the highest-bandwidth one, or the first when none states a
 * bandwidth. */
export function bestVariant(variants: readonly HlsVariant[]): HlsVariant | null {
  if (variants.length === 0) return null
  return variants.reduce((best, variant) =>
    (variant.bandwidth ?? 0) > (best.bandwidth ?? 0) ? variant : best
  )
}
