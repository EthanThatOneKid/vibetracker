let emotionHistory = [];

// emotion is appID, timestamp, emotionType, and score.
function storeEmotion(emotion) {
  emotionHistory.push(emotion);
}

function getEmotionByAppID(appID) {
  return emotionHistory.filter((emotion) => emotion.appID === appID);
}

function clearEmotionHistory() {
  emotionHistory = [];
}

module.exports = {
  storeEmotion,
  getEmotionByAppID,
  clearEmotionHistory,
};
