import type { DownloadState, FinishedDownload } from '@shared/types'
import type { DownloadCategory } from '../store/useAppStore'

// What a download is by its file type, so the list can be grouped and filtered the way IDM does.
// Pure and extension-based: there is no magic-byte inspection, only the name the server or torrent
// already gave it. A torrent's folder (or any name without a usable extension) reads as `other`.

type Item = DownloadState | FinishedDownload

/** The extensions each category owns. A `.ts` file reads as video (an MPEG transport stream),
 * not TypeScript — this list is about what people download, not what developers write. */
const EXTENSIONS: Record<Exclude<DownloadCategory, 'all' | 'other'>, readonly string[]> = {
  video: [
    'mp4',
    'm4v',
    'mkv',
    'avi',
    'mov',
    'wmv',
    'flv',
    'webm',
    'mpg',
    'mpeg',
    'm2ts',
    'ts',
    '3gp',
    'ogv'
  ],
  audio: [
    'mp3',
    'm4a',
    'aac',
    'flac',
    'wav',
    'ogg',
    'oga',
    'opus',
    'wma',
    'aiff',
    'aif',
    'alac',
    'mka'
  ],
  images: [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'webp',
    'svg',
    'tif',
    'tiff',
    'heic',
    'heif',
    'avif',
    'ico',
    'raw',
    'cr2',
    'nef',
    'arw',
    'dng'
  ],
  documents: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'rtf',
    'csv',
    'md',
    'epub',
    'mobi',
    'odt',
    'ods',
    'odp',
    'pages',
    'numbers',
    'key'
  ],
  archives: [
    'zip',
    'rar',
    '7z',
    'tar',
    'gz',
    'tgz',
    'bz2',
    'xz',
    'zst',
    'lz',
    'lzma',
    'iso',
    'dmg',
    'cab',
    'ace',
    'z'
  ],
  programs: [
    'exe',
    'msi',
    'msix',
    'appx',
    'deb',
    'rpm',
    'appimage',
    'pkg',
    'apk',
    'ipa',
    'jar',
    'bin',
    'run',
    'app'
  ]
}

/** Every category, `all` first, as the menu lists them. */
export const CATEGORIES: { value: DownloadCategory; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'images', label: 'Images' },
  { value: 'documents', label: 'Documents' },
  { value: 'archives', label: 'Archives' },
  { value: 'programs', label: 'Programs' },
  { value: 'other', label: 'Other' }
]

// One lookup from extension to category, built once. A name is read by its last dot, so
// "archive.tar.gz" is gzip, and a dotfile like ".env" (dot at index 0) has no extension at all.
const BY_EXTENSION = new Map<string, Exclude<DownloadCategory, 'all'>>()
for (const [category, extensions] of Object.entries(EXTENSIONS)) {
  for (const extension of extensions) {
    BY_EXTENSION.set(extension, category as Exclude<DownloadCategory, 'all'>)
  }
}

/** The category a file name falls in, by its extension, or `other` when nothing about it says. */
export function categoryOfName(fileName: string): Exclude<DownloadCategory, 'all'> {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return 'other'
  return BY_EXTENSION.get(fileName.slice(dot + 1).toLowerCase()) ?? 'other'
}

/** The kind of file a download is. A torrent's folder has no extension: `other`. */
export function categoryOf(item: Item): Exclude<DownloadCategory, 'all'> {
  if (item.kind === 'torrent' && item.folder) return 'other'
  return categoryOfName(item.fileName)
}
