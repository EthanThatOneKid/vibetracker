// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { default: ActiveWindow } = require("@paymoapp/active-window");
const { createJob, pollJob } = require("./hume.js");

let batch = [];

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-1-renderer-to-main-one-way
  ipcMain.on("incoming-capture", async (_event, capture) => {
    await addCaptureToQueue(capture);
  });

  // and load the index.html of the app.
  mainWindow.loadFile("index.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// ActiveWindow.initialize();

// if (!ActiveWindow.requestPermissions()) {
//   console.log(
//     "Error: You need to grant screen recording permission in System Preferences > Security & Privacy > Privacy > Screen Recording"
//   );
//   process.exit(0);
// }

// setInterval(() => {
//   const activeWin = ActiveWindow.getActiveWindow();
//   console.log("Window title:", activeWin.title);
//   console.log("Application:", activeWin.application);
//   console.log("Application path:", activeWin.path);
//   console.log("Application PID:", activeWin.pid);
// }, 1000);

// axios
//   .get("https://jsonplaceholder.typicode.com/todos/1")
//   .then((response) => {
//     console.log(response.data); // Handle the response data
//   })
//   .catch((error) => {
//     console.error("Error making request:", error);
//   });

async function addCaptureToQueue(capture, threshold = 10) {
  batch.push(capture);

  if (batch.length >= threshold) {
    console.log("Batch is full, sending to Hume");
    await sendBatchToHume();
  }
}

async function sendBatchToHume() {
  const data = batch.map((capture) => base64UriToBlob(capture));
  batch = [];

  console.log(`Sending ${data.length} captures to Hume`);
  const humeJob = await createJob(data, config.humeApiKey);
  console.log({ humeJob });

  const result = await pollJob(humeJob.jobID);
  console.log(JSON.stringify(result, null, 2));
}
