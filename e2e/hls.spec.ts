import { expect, test } from '@playwright/test'
import { bestVariant, parseHlsPlaylist } from '../src/main/download/media/hls'

// The HLS parser is pure, so it's checked against exact playlists rather than a live stream.

const BASE = 'https://cdn.example.com/media/playlist.m3u8'

test.describe('HLS playlist parsing', () => {
  test('a master playlist resolves its variants and the best one is the highest bandwidth', () => {
    const playlist = parseHlsPlaylist(
      [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2"',
        'low/index.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720',
        'high/index.m3u8'
      ].join('\n'),
      BASE
    )
    expect(playlist.kind).toBe('master')
    if (playlist.kind !== 'master') return
    expect(playlist.variants).toEqual([
      {
        url: 'https://cdn.example.com/media/low/index.m3u8',
        bandwidth: 800000,
        width: 640,
        height: 360,
        codecs: 'avc1.4d401e,mp4a.40.2'
      },
      {
        url: 'https://cdn.example.com/media/high/index.m3u8',
        bandwidth: 2400000,
        width: 1280,
        height: 720,
        codecs: null
      }
    ])
    expect(bestVariant(playlist.variants)?.url).toBe(
      'https://cdn.example.com/media/high/index.m3u8'
    )
  })

  test('a media playlist reads segments, duration, key and init segment', () => {
    const playlist = parseHlsPlaylist(
      [
        '#EXTM3U',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1234',
        '#EXT-X-MAP:URI="init.mp4"',
        '#EXTINF:6.0,',
        'seg0.m4s',
        '#EXTINF:6.0,',
        'seg1.m4s',
        '#EXT-X-ENDLIST'
      ].join('\n'),
      BASE
    )
    expect(playlist.kind).toBe('media')
    if (playlist.kind !== 'media') return
    const { playlist: media } = playlist
    expect(media.segments.map((segment) => segment.url)).toEqual([
      'https://cdn.example.com/media/seg0.m4s',
      'https://cdn.example.com/media/seg1.m4s'
    ])
    expect(media.totalDurationSeconds).toBe(12)
    expect(media.endList).toBe(true)
    expect(media.key).toEqual({
      method: 'AES-128',
      uri: 'https://cdn.example.com/media/key.bin',
      iv: '0x1234'
    })
    expect(media.initSegment?.url).toBe('https://cdn.example.com/media/init.mp4')
    // No byte ranges, so the media's size isn't stated.
    expect(media.knownBytes).toBeNull()
  })

  test('byte ranges chain a segment after the previous one and give a known total', () => {
    const playlist = parseHlsPlaylist(
      [
        '#EXTM3U',
        '#EXTINF:6,',
        '#EXT-X-BYTERANGE:1000@0',
        'file.ts',
        '#EXTINF:6,',
        '#EXT-X-BYTERANGE:1000',
        'file.ts',
        '#EXT-X-ENDLIST'
      ].join('\n'),
      BASE
    )
    expect(playlist.kind).toBe('media')
    if (playlist.kind !== 'media') return
    expect(playlist.playlist.segments.map((segment) => segment.byteRange)).toEqual([
      { start: 0, end: 999 },
      { start: 1000, end: 1999 }
    ])
    expect(playlist.playlist.knownBytes).toBe(2000)
  })

  test('a playlist that is neither master nor media is refused', () => {
    expect(() => parseHlsPlaylist('#EXTM3U\n#EXT-X-TARGETDURATION:6', BASE)).toThrow()
    expect(() => parseHlsPlaylist('not a playlist at all', BASE)).toThrow()
  })
})
