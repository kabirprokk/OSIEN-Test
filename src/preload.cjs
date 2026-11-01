const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('osien', {
  windowControl: (action) => ipcRenderer.invoke('window:control', action),
  chooseProject: () => ipcRenderer.invoke('project:choose'),
  inspectProject: (directory) => ipcRenderer.invoke('project:inspect', directory),
  runTests: (options) => ipcRenderer.invoke('tests:run', options),
  cancelRun: (id) => ipcRenderer.invoke('tests:cancel', id),
  analyze: (options) => ipcRenderer.invoke('ai:analyze', options),
  fix: (options) => ipcRenderer.invoke('ai:fix', options),
  aiStatus: () => ipcRenderer.invoke('ai:status'),
  onOutput: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('tests:output', listener)
    return () => ipcRenderer.removeListener('tests:output', listener)
  },
  onComplete: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('tests:complete', listener)
    return () => ipcRenderer.removeListener('tests:complete', listener)
  },
  onAIOutput: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('ai:output', listener)
    return () => ipcRenderer.removeListener('ai:output', listener)
  },
})
