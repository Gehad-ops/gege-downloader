import type { GegeApi } from './index'

declare global {
  interface Window {
    gege: GegeApi
  }
}
