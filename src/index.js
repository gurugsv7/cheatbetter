if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupProviderRuntimeIpcHandlers, stopMacOSAudioCapture, sendToRenderer, clearRuntimeProviderSecrets } = require('./utils/providerRuntime');
const storage = require('./storage');

let autoUpdater = null;
try {
    ({ autoUpdater } = require('electron-updater'));
} catch (error) {
    autoUpdater = null;
}

const providerSessionRef = { current: null };
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, providerSessionRef);
    return mainWindow;
}

function setupAutoUpdates() {
    if (!app.isPackaged || !autoUpdater) {
        return;
    }

    const updateFeedUrl = process.env.AUTO_UPDATE_URL;
    if (!updateFeedUrl) {
        return;
    }

    try {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });

        autoUpdater.on('checking-for-update', () => sendToRenderer('update-status', 'Checking for updates...'));
        autoUpdater.on('update-available', () => sendToRenderer('update-status', 'Update available. Downloading...'));
        autoUpdater.on('update-not-available', () => sendToRenderer('update-status', 'App up to date'));
        autoUpdater.on('download-progress', () => sendToRenderer('update-status', 'Downloading update...'));
        autoUpdater.on('update-downloaded', () => sendToRenderer('update-status', 'Update downloaded. Will install on quit.'));
        autoUpdater.on('error', err => {
            console.error('Auto-update error:', err);
            sendToRenderer('update-status', 'Auto-update failed');
        });

        autoUpdater.checkForUpdates().catch(err => {
            console.error('Auto-update check failed:', err);
        });
    } catch (error) {
        console.error('Error configuring auto updates:', error);
    }
}

app.whenReady().then(async () => {
    const forceFreshStart = !app.isPackaged && process.env.HINTIO_DEBUG_FRESH_START !== '0';
    if (forceFreshStart) {
        storage.clearAllData();
    }

    // Initialize storage (checks version, resets if needed)
    storage.initializeStorage();

    // Trigger screen recording permission prompt on macOS if not already granted
    if (process.platform === 'darwin') {
        const { desktopCapturer } = require('electron');
        desktopCapturer.getSources({ types: ['screen'] }).catch(() => {});
    }

    createMainWindow();
    setupProviderRuntimeIpcHandlers(providerSessionRef);
    setupStorageIpcHandlers();
    setupGeneralIpcHandlers();
    setupAutoUpdates();
});

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
    clearRuntimeProviderSecrets();
    try {
        const creds = storage.getCredentials();
        if ((creds.cloudToken || '').trim()) {
            storage.clearProviderSecrets();
        }
    } catch (error) {
        console.error('Failed to clear provider secrets on quit:', error);
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupStorageIpcHandlers() {
    // ============ CONFIG ============
    ipcMain.handle('storage:get-config', async () => {
        try {
            return { success: true, data: storage.getConfig() };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-config', async (event, config) => {
        try {
            storage.setConfig(config);
            return { success: true };
        } catch (error) {
            console.error('Error setting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-config', async (event, key, value) => {
        try {
            storage.updateConfig(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CREDENTIALS ============
    ipcMain.handle('storage:get-credentials', async () => {
        try {
            return { success: true, data: storage.getCredentials() };
        } catch (error) {
            console.error('Error getting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-credentials', async (event, credentials) => {
        try {
            storage.setCredentials(credentials);
            return { success: true };
        } catch (error) {
            console.error('Error setting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:clear-provider-secrets', async () => {
        try {
            storage.clearProviderSecrets();
            return { success: true };
        } catch (error) {
            console.error('Error clearing provider secrets:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-api-key', async () => {
        try {
            return { success: true, data: storage.getApiKey() };
        } catch (error) {
            console.error('Error getting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-api-key', async (event, apiKey) => {
        try {
            storage.setApiKey(apiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-groq-api-key', async () => {
        try {
            return { success: true, data: storage.getGroqApiKey() };
        } catch (error) {
            console.error('Error getting Groq API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-groq-api-key', async (event, groqApiKey) => {
        try {
            storage.setGroqApiKey(groqApiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting Groq API key:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ AZURE ============
    ipcMain.handle('storage:get-azure-api-key', async () => {
        try {
            return { success: true, data: storage.getAzureApiKey() };
        } catch (error) {
            console.error('Error getting Azure API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-azure-api-key', async (event, azureApiKey) => {
        try {
            storage.setAzureApiKey(azureApiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting Azure API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-azure-endpoint', async () => {
        try {
            return { success: true, data: storage.getAzureEndpoint() };
        } catch (error) {
            console.error('Error getting Azure endpoint:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-azure-endpoint', async (event, azureEndpoint) => {
        try {
            storage.setAzureEndpoint(azureEndpoint);
            return { success: true };
        } catch (error) {
            console.error('Error setting Azure endpoint:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-azure-deployment', async () => {
        try {
            return { success: true, data: storage.getAzureDeployment() };
        } catch (error) {
            console.error('Error getting Azure deployment:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-azure-deployment', async (event, azureDeployment) => {
        try {
            storage.setAzureDeployment(azureDeployment);
            return { success: true };
        } catch (error) {
            console.error('Error setting Azure deployment:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PREFERENCES ============
    ipcMain.handle('storage:get-preferences', async () => {
        try {
            return { success: true, data: storage.getPreferences() };
        } catch (error) {
            console.error('Error getting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-preferences', async (event, preferences) => {
        try {
            storage.setPreferences(preferences);
            return { success: true };
        } catch (error) {
            console.error('Error setting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-preference', async (event, key, value) => {
        try {
            storage.updatePreference(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating preference:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ KEYBINDS ============
    ipcMain.handle('storage:get-keybinds', async () => {
        try {
            return { success: true, data: storage.getKeybinds() };
        } catch (error) {
            console.error('Error getting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-keybinds', async (event, keybinds) => {
        try {
            storage.setKeybinds(keybinds);
            return { success: true };
        } catch (error) {
            console.error('Error setting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ HISTORY ============
    ipcMain.handle('storage:get-all-sessions', async () => {
        try {
            return { success: true, data: storage.getAllSessions() };
        } catch (error) {
            console.error('Error getting sessions:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-session', async (event, sessionId) => {
        try {
            return { success: true, data: storage.getSession(sessionId) };
        } catch (error) {
            console.error('Error getting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:save-session', async (event, sessionId, data) => {
        try {
            storage.saveSession(sessionId, data);
            return { success: true };
        } catch (error) {
            console.error('Error saving session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-session', async (event, sessionId) => {
        try {
            storage.deleteSession(sessionId);
            return { success: true };
        } catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-all-sessions', async () => {
        try {
            storage.deleteAllSessions();
            return { success: true };
        } catch (error) {
            console.error('Error deleting all sessions:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ LIMITS ============
    ipcMain.handle('storage:get-today-limits', async () => {
        try {
            return { success: true, data: storage.getTodayLimits() };
        } catch (error) {
            console.error('Error getting today limits:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ VOICE PROFILE ============
    ipcMain.handle('storage:get-voice-profile', async () => {
        try {
            return { success: true, data: storage.getVoiceProfile() };
        } catch (error) {
            console.error('Error getting voice profile:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:save-voice-profile', async (event, profile) => {
        try {
            storage.saveVoiceProfile(profile);
            return { success: true };
        } catch (error) {
            console.error('Error saving voice profile:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-voice-profile', async () => {
        try {
            storage.deleteVoiceProfile();
            return { success: true };
        } catch (error) {
            console.error('Error deleting voice profile:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CLEAR ALL ============
    ipcMain.handle('storage:clear-all', async () => {
        try {
            storage.clearAllData();
            return { success: true };
        } catch (error) {
            console.error('Error clearing all data:', error);
            return { success: false, error: error.message };
        }
    });
}

function setupGeneralIpcHandlers() {
    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (mainWindow) {
            // Also save to storage
            storage.setKeybinds(newKeybinds);
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, providerSessionRef);
        }
    });

    // Debug logging from renderer
    ipcMain.on('log-message', (event, msg) => {
        console.log(msg);
    });

    // Open a native file picker filtered to PDF / DOCX
    ipcMain.handle('open-file-dialog', async (event, options) => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options || {});
        if (canceled || filePaths.length === 0) return null;
        return filePaths[0];
    });

    // Parse PDF or DOCX and return raw text
    ipcMain.handle('parse-document', async (event, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.docx') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            return { text: result.value, fileName: path.basename(filePath) };
        } else if (ext === '.pdf') {
            const pdfParse = require('pdf-parse');
            const buffer = fs.readFileSync(filePath);
            const result = await pdfParse(buffer);
            return { text: result.text, fileName: path.basename(filePath) };
        }
        throw new Error('Unsupported file type. Please use PDF or DOCX.');
    });

    ipcMain.handle('save-text-file', async (event, payload = {}) => {
        try {
            const text = typeof payload.text === 'string' ? payload.text : '';
            const defaultName = typeof payload.defaultName === 'string' && payload.defaultName.trim()
                ? payload.defaultName.trim()
                : 'session-export.txt';

            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Session Export',
                defaultPath: defaultName,
                filters: [
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
                properties: ['createDirectory', 'showOverwriteConfirmation'],
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            fs.writeFileSync(filePath, text, 'utf8');
            return { success: true, filePath };
        } catch (error) {
            console.error('Error saving text file:', error);
            return { success: false, error: error.message };
        }
    });
}
