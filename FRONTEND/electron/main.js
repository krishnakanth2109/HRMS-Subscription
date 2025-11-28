
const { app, BrowserWindow, powerMonitor, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow;
let currentEmployeeId = null;
let isIdle = false;
let idleStartTime = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Point to the preload file we will create in Step 4
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  // ---------------------------------------------------------
  // IMPORTANT: HOW TO LOAD THE APP
  // ---------------------------------------------------------
  // 1. If you are running React in development (npm run dev), use localhost:
  mainWindow.loadURL('http://localhost:5173'); 
  // (Make sure your React app is running on port 5173. Check your terminal.)
  
  // 2. If you have built the app (npm run build), use this instead:
  // mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.webContents.openDevTools(); // Opens the debug console
}

// --- IDLE TRACKING LOGIC ---

// Listen for the User ID from React (Login Page)
ipcMain.on('set-user-id', (event, id) => {
  currentEmployeeId = id;
  console.log('✅ Employee Logged In:', currentEmployeeId);
});

// Function to send data to backend
const sendIdleDataToBackend = async (start, end) => {
  if (!currentEmployeeId) return;

  try {
    // 👇 UPDATE THIS URL TO YOUR BACKEND
    await axios.post('http://localhost:5000/api/attendance/log-idle', {
      employeeId: currentEmployeeId,
      idleStart: start,
      idleEnd: end
    });
    console.log('📡 Idle data sent to server');
  } catch (err) {
    console.error('❌ Error sending idle data:', err.message);
  }
};

app.whenReady().then(() => {
  createWindow();

  // CHECK IDLE STATUS EVERY 5 SECONDS
  setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();

    if (idleSeconds >= 60 && !isIdle) {
      // User is now IDLE
      isIdle = true;
      idleStartTime = new Date(Date.now() - idleSeconds * 1000);
      console.log('⚠️ User is IDLE');
    } 
    else if (idleSeconds < 60 && isIdle) {
      // User is ACTIVE again
      isIdle = false;
      const idleEndTime = new Date();
      console.log('🟢 User is ACTIVE');
      
      if (idleStartTime) {
        sendIdleDataToBackend(idleStartTime, idleEndTime);
      }
    }
  }, 5000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
