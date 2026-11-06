
const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from environment.");
}

const googleAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const TEXT_MODEL =
    process.env.GEMINI_TEXT_MODEL || "gemini-3-flash-preview";

const IMAGE_MODEL =
    process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

module.exports = {
    googleAI,
    TEXT_MODEL,
    IMAGE_MODEL
};
