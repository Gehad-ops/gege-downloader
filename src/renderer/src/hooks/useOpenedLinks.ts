import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { acceptedLinks } from '../utils/format'

/** Opens New download with links handed to Plexo, for the user to look at and start. */
export function useOpenedLinks(): void {
  const receiveLinks = useAppStore((store) => store.receiveLinks)

  useEffect(() => {
    const unsubscribe = window.plexo.onLinkReceived(() => void receiveLinks())
    // Some may have arrived before the window was listening.
    void receiveLinks()
    return unsubscribe
  }, [receiveLinks])
}

const isMac = window.plexo.platform === 'darwin'

/** The ways into New download from anywhere in the window, as download managers have them:
 * pasting a link (outside a text field), ⌘N / Ctrl+N, and dropping a link or a .torrent. */
export function useNewDownloadShortcuts(): void {
  const openNewDownload = useAppStore((store) => store.openNewDownload)

  useEffect(() => {
    const busy = (target: EventTarget | null): boolean =>
      useAppStore.getState().newDownloadOpen ||
      (target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)))

    const onPaste = (event: ClipboardEvent): void => {
      if (busy(event.target)) return
      const text = event.clipboardData?.getData('text') ?? ''
      const links = acceptedLinks(text)
      if (links.length === 0) return
      // A pasted list opens New download with every link in it; a single link as before.
      openNewDownload(links.length > 1 ? text.trim() : links[0])
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'n' || !(isMac ? event.metaKey : event.ctrlKey)) return
      if (useAppStore.getState().newDownloadOpen) return
      event.preventDefault()
      openNewDownload()
    }
    // Never let a drop navigate the window to what was dropped.
    const onDragOver = (event: DragEvent): void => event.preventDefault()
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (file) {
        if (/\.torrent$/i.test(file.name)) openNewDownload(window.plexo.pathForFile(file))
        return
      }
      const text = event.dataTransfer?.getData('text') ?? ''
      const links = acceptedLinks(text)
      if (links.length > 0) openNewDownload(links.length > 1 ? text.trim() : links[0])
    }

    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openNewDownload])
}
