// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { default: ActiveWindow } = require("@paymoapp/active-window");
const { createJob, pollJob, base64UriToBlob } = require("./hume.js");
const { storeEmotion } = require("./emotion-history.js");

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

ActiveWindow.initialize();

if (!ActiveWindow.requestPermissions()) {
  console.log(
    "Error: You need to grant screen recording permission in System Preferences > Security & Privacy > Privacy > Screen Recording"
  );
  process.exit(0);
}

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

  console.log(`Sending ${data.length} captures to Hume!`);
  const humeJob = await createJob(data);

  // stuck on poll
  const jobResult = await pollJob(humeJob.jobID);

  // console.log({ jobResult, jrLen: jobResult.length });
  const emotionsPerFrame = jobResult
    .map((frameResults) => {
      return frameResults.flatMap((face) => {
        return face.emotions.map((emotion) => {
          const activeWindow = ActiveWindow.getActiveWindow();
          return {
            emotion: emotion.name,
            score: emotion.score,
            appID: activeWindow.application,
          };
        });
      });
    })
    .flat();

  // TODO: Select emotion IDs to include and exclude, or alias.
  for (const emotion of emotionsPerFrame) {
    console.log({ emotion });
    // storeEmotion(emotion);
  }
}
