import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectPDF: () => ipcRenderer.invoke('select-pdf'),
  saveSettings: (settings: { apiKey: string; model: string; language: string }) =>
    ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  analyzePaper: (pdfPath: string) => ipcRenderer.invoke('analyze-paper', pdfPath),
  downloadCoreCode: () => ipcRenderer.invoke('download-core-code'),
  onAnalysisProgress: (callback: (progress: { stage: string; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { stage: string; message: string }) => callback(progress)
    ipcRenderer.on('analysis-progress', handler)
    return () => ipcRenderer.removeListener('analysis-progress', handler)
  },
  onSummaryChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
    ipcRenderer.on('analysis-summary-chunk', handler)
    return () => ipcRenderer.removeListener('analysis-summary-chunk', handler)
  },
})
