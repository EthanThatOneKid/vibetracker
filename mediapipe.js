// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
} from "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

const demosSection = document.getElementById("demos");

// Global variables.
let slouchNotification;
let webcamStartedAt;
let slouchingMilliseconds = 0;
let slouching = false;
let poseLandmarker;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

let intervalID;

function startCaptureIntervalIfNotStarted() {
  if (intervalID !== undefined) {
    return;
  }

  webcamStartedAt = Date.now();
  intervalID = setInterval(async () => {
    const capture = await captureVideoFrameAsDataURI(video);
    window.electronAPI.incomingCapture(capture);
  }, 1000);
}

function captureVideoFrameAsDataURI(
  videoElement,
  format = "image/png",
  quality = 1.0
) {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const context = canvas.getContext("2d");
  return new Promise((resolve, reject) => {
    context.drawImage(videoElement, 0, 0);
    const dataURI = canvas.toDataURL(format, quality);
    resolve(dataURI);
  });
}

// Before we can use PoseLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "./node_modules/@mediapipe/tasks-vision/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode: runningMode,
    numPoses: 2,
  });
  demosSection.classList.remove("invisible");
};
createPoseLandmarker();

/********************************************************************
  // Demo 2: Continuously grab image from webcam stream and detect it.
  ********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(_event) {
  if (!poseLandmarker) {
    console.log("Wait! poseLandmaker not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "Start vibing";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "Stop vibing";
  }

  // Activate the webcam stream.
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
      startCaptureIntervalIfNotStarted();
    });
}

let lastVideoTime = -1;
async function predictWebcam() {
  canvasElement.style.height = videoHeight;
  video.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  video.style.width = videoWidth;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await poseLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
      if (result.landmarks.length === 0) {
        return;
      }

      const landmark = result.landmarks[0];
      if (landmark === undefined) {
        return;
      }

      // https://www.linkedin.com/pulse/daily-life-example-human-pose-estimation-serkan-erdonmez/
      const leftShoulder = result.landmarks[0][11];
      const rightShoulder = result.landmarks[0][12];
      const shoulderHeight = (leftShoulder.y + rightShoulder.y) * 0.5;

      const nose = result.landmarks[0][0];
      const noseToShoulderDistance = Math.abs(nose.y - shoulderHeight);

      updateSlouching(noseToShoulderDistance, 0.2, 1e3);
      console.log(noseToShoulderDistance);
      const resultContainer = document.querySelector(".result");
      if (slouching) {
        resultContainer.innerText = "Not straight!";
        slouchingMilliseconds;
        if (slouchNotification === undefined) {
          slouchNotification = new Notification("Unslouch", {
            body: "Sloucher!!!",
          });
        }
      } else {
        resultContainer.innerText = "Good!";
        if (slouchNotification !== undefined) {
          slouchNotification.close();
          slouchNotification = undefined;
        }
      }

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      for (const landmark of result.landmarks) {
        drawingUtils.drawLandmarks(landmark, {
          radius: (data) => DrawingUtils.lerp(data.from?.z, -0.15, 0.1, 5, 1),
        });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
      }
      canvasCtx.restore();
    });
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function updateSlouching(value, threshold, debounceDuration) {
  const debouncedUpdateFlag = debounce(
    () => (slouching = value <= threshold),
    debounceDuration
  );

  debouncedUpdateFlag(value);
}
