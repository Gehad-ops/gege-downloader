import {
  AppWindow,
  Archive,
  File,
  FileText,
  Film,
  Image,
  Music,
  type LucideIcon
} from 'lucide-react'
import type { DownloadCategory } from '../store/useAppStore'

export type FileType = Exclude<DownloadCategory, 'all'>

interface FileTypeMeta {
  /** The sidebar's name for the group. */
  label: string
  /** The singular shown on a row's type chip. */
  singular: string
  icon: LucideIcon
  /** The sidebar dot and the tile/chip tones, all drawn from the theme's token pairs. */
  dot: string
  tileBg: string
  tileText: string
  chipBg: string
  chipText: string
}

export const FILE_TYPES: Record<FileType, FileTypeMeta> = {
  video: {
    label: 'Video',
    singular: 'Video',
    icon: Film,
    dot: 'var(--type-video)',
    tileBg: 'var(--type-video-bg)',
    tileText: 'var(--type-video-text)',
    chipBg: 'var(--type-video-bg)',
    chipText: 'var(--type-video-text)'
  },
  audio: {
    label: 'Audio',
    singular: 'Audio',
    icon: Music,
    dot: 'var(--type-audio)',
    tileBg: 'var(--type-audio-bg)',
    tileText: 'var(--type-audio-text)',
    chipBg: 'var(--type-audio-bg)',
    chipText: 'var(--type-audio-text)'
  },
  images: {
    label: 'Images',
    singular: 'Image',
    icon: Image,
    dot: 'var(--type-images)',
    tileBg: 'var(--type-images-bg)',
    tileText: 'var(--type-images-text)',
    chipBg: 'var(--type-images-bg)',
    chipText: 'var(--type-images-text)'
  },
  documents: {
    label: 'Documents',
    singular: 'Document',
    icon: FileText,
    dot: 'var(--type-documents)',
    tileBg: 'var(--type-documents-bg)',
    tileText: 'var(--type-documents-text)',
    chipBg: 'var(--type-documents-bg)',
    chipText: 'var(--type-documents-text)'
  },
  archives: {
    label: 'Archives',
    singular: 'Archive',
    icon: Archive,
    dot: 'var(--type-archives)',
    tileBg: 'var(--type-archives-bg)',
    tileText: 'var(--type-archives-text)',
    chipBg: 'var(--type-archives-bg)',
    chipText: 'var(--type-archives-text)'
  },
  programs: {
    label: 'Programs',
    singular: 'Program',
    icon: AppWindow,
    dot: 'var(--type-programs)',
    tileBg: 'var(--type-programs-bg)',
    tileText: 'var(--type-programs-text)',
    chipBg: 'var(--type-programs-bg)',
    chipText: 'var(--type-programs-text)'
  },
  other: {
    label: 'Other',
    singular: 'Other',
    icon: File,
    dot: 'var(--type-other)',
    tileBg: 'var(--type-other-bg)',
    tileText: 'var(--type-other-text)',
    chipBg: 'var(--type-other-bg)',
    chipText: 'var(--type-other-text)'
  }
}
