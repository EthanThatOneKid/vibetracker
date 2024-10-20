const fs = require("node:fs");
const { HumeClient } = require("hume");

const configString = fs.readFileSync("vibetracker.json", "utf8");
const config = JSON.parse(configString);

// https://doc.deno.land/https://esm.sh/hume
const humeClient = new HumeClient({
  apiKey: config.humeApiKey,
  secretKey: config.humeApiSecret,
});

/**
 * createJob creates a new Hume job with the given blobs.
 */
async function createJob(
  blobs,
  apiKey = config.humeApiKey,
  apiURL = HUME_API_URL
) {
  // Create a FormData object.
  const formData = new FormData();

  // Add the JSON data.
  formData.append("json", JSON.stringify({ models: { face: {} } }));

  // Append blobs to the FormData object.
  for (const blob of blobs) {
    formData.append("file", blob);
  }

  // Define the headers.
  const headers = new Headers({
    "X-Hume-Api-Key": apiKey,
    accept: "application/json; charset=utf-8",
  });

  // Make the fetch request.
  const url = makeCreateJobURL(apiURL);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  console.log({ response });
  if (response.ok) {
    const data = await response.json();
    console.log({ data });
    return { jobID: data.job_id };
  }

  throw new Error("Failed to create Hume job: " + (await response.text()));
}

/**
 * base64UriToBlob converts a Base64-encoded data URI to a Blob.
 */
function base64UriToBlob(base64Uri) {
  // Remove the data URI scheme prefix if present
  const base64String = base64Uri.replace(/^data:image\/png;base64,/, "");

  // Decode the Base64 string into a Uint8Array
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create a Blob from the Uint8Array
  const blob = new Blob([bytes], { type: "image/png" }); // Adjust the type as needed
  return blob;
}

/**
 * pollJob polls the Hume API for the predictions of a job.
 */
async function pollJob(jobID, sleep = 5e3) {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, sleep));

    try {
      const predictions =
        await humeClient.expressionMeasurement.batch.getJobPredictions(jobID);
      const emotions = getTopNEmotions(predictions);
      fs.writeFileSync("emotions.json", JSON.stringify(emotions, null, 2));
      return emotions;
    } catch (error) {
      console.error("Failed to get predictions:", error);
    }
  }
}

/**
 * getTopNEmotions returns the top n emotions from the given data.
 */
function getTopNEmotions(data, n = 3) {
  return data.map((prediction) => {
    fs.writeFileSync("prediction.json", JSON.stringify(prediction, null, 2));
    throw new Error("Failed to get predictions");
    return prediction.results.predictions.models?.face.groupedPredictions?.[0]?.map(
      (groupedPrediction) => {
        return {
          emotion: groupedPrediction.emotion,
          probability: groupedPrediction.probability,
        };
      }
    );
  });
}

function makeCreateJobURL(apiURL = HUME_API_URL) {
  return `${apiURL}/batch/jobs`;
}

const HUME_API_URL = "https://api.hume.ai/v0";

module.exports = {
  createJob,
  base64UriToBlob,
  pollJob,
  makeCreateJobURL,
  getTopNEmotions,
  HUME_API_URL,
};
