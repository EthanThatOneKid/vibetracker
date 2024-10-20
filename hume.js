const fs = require("node:fs");
const { HumeClient } = require("hume");

const configString = fs.readFileSync("vibetracker.json", "utf8");
const config = JSON.parse(configString);

// https://doc.deno.land/https://esm.sh/hume
const hume = new HumeClient({
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
  if (response.ok) {
    const data = await response.json();
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
async function pollJob(jobID) {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const predictions =
        await hume.expressionMeasurement.batch.getJobPredictions(jobID);
      return predictions;
    } catch (error) {}
  }
}

/**
 * getTopNEmotions returns the top n emotions from the given data.
 */
function getTopNEmotions(data, n = 3) {
  // Create an empty object to store the emotion counts
  const emotionCounts = {};

  // Iterate over each prediction in the data
  for (const prediction of data) {
    console.log({ prediction });
    // {
    //   prediction: {
    //     source: {
    //       type: 'file',
    //       filename: 'blob',
    //       contentType: 'image/png',
    //       md5Sum: '3ea8d8ec998fd97bd4a8e68d927e9a2e'
    //     },
    //     results: { predictions: [Array], errors: [] }
    //   }
    // }
    throw new Error("stop");

    // Access the emotions array for each prediction
    const emotions =
      prediction.results.predictions[0].models.face.groupedPredictions[0]
        .predictions[0].emotions;

    // Iterate over each emotion in the array
    for (const emotion of emotions) {
      // Increment the count for the current emotion in the emotionCounts object
      emotionCounts[emotion.name] = (emotionCounts[emotion.name] || 0) + 1;
    }
  }

  // Convert the emotionCounts object into an array of tuples
  const emotionTuples = Object.entries(emotionCounts);

  // Sort the array of tuples by the count in descending order
  emotionTuples.sort((a, b) => b[1] - a[1]);

  // Extract the top n emotions and their counts
  const topNEmotions = emotionTuples.slice(0, n);

  return topNEmotions;
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
