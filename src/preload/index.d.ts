import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      windowControl: (action: 'min' | 'max' | 'close' | 'show' | 'showInactive') => void
    }
    api: unknown
  }
}
