
const { GoogleGenAI } = require("@google/genai");

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
}

const googleAI = new GoogleGenAI({
    apiKey: API_KEY,
    apiVersion: "v1beta"
});

const TEXT_MODEL =
    process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";

const IMAGE_MODEL =
    process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

module.exports = {
    googleAI,
    TEXT_MODEL,
    IMAGE_MODEL
};
