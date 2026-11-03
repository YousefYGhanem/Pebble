import { contextBridge, ipcRenderer } from 'electron'

// The focus guard's calm screen: one thing to send back, your choice.
contextBridge.exposeInMainWorld('guard', {
  choose: (choice: 'back' | 'anyway') => ipcRenderer.send('guard:choose', choice)
})
