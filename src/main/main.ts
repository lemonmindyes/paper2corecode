import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as path from 'path'
import { getActiveSettings, saveSettingsPatch, SettingsPatch } from './backend/settingsStore'

let mainWindow: BrowserWindow | null = null
let currentAnalysisController: AbortController | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('save-settings', async (_event, settings: SettingsPatch) => {
  saveSettingsPatch(settings)
  return true
})

ipcMain.handle('get-settings', async () => {
  try {
    return getActiveSettings()
  } catch {
    return { apiKey: '', provider: 'deepseek', model: 'deepseek-v4-flash', language: 'zh-CN' }
  }
})

ipcMain.handle('analyze-paper', async (_event, pdfPath: string) => {
  if (!mainWindow) return { ok: false, error: { code: 'NO_WINDOW', message: 'Window not available' } }
  currentAnalysisController?.abort()
  const controller = new AbortController()
  currentAnalysisController = controller

  const sendProgress = (progress: { stage: string; message: string }) => {
    mainWindow?.webContents.send('analysis-progress', progress)
  }

  const sendSummaryChunk = (chunk: string) => {
    mainWindow?.webContents.send('analysis-summary-chunk', chunk)
  }

  const { analyzePaper } = await import('./backend/paperAnalyzer')
  try {
    return await analyzePaper(pdfPath, sendProgress, sendSummaryChunk, controller.signal)
  } finally {
    if (currentAnalysisController === controller) {
      currentAnalysisController = null
    }
  }
})

ipcMain.handle('cancel-analysis', async () => {
  currentAnalysisController?.abort()
  currentAnalysisController = null
  return true
})

ipcMain.handle('download-core-code', async () => {
  if (!mainWindow) return { ok: false, error: 'Window not available' }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Export Project Folder',
    properties: ['openDirectory', 'createDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'Export cancelled' }

  const { writeCodeFolder } = await import('./backend/exportCode')
  return writeCodeFolder(result.filePaths[0])
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
