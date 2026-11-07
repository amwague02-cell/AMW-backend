
const {
    googleAI,
    TEXT_MODEL
} = require("./google-ai.service");


function extractJSON(text) {
    if (!text) {
        throw new Error("Google returned an empty response.");
    }

    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error("Impossible de lire l'analyse du produit.");
    }

    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
        throw new Error("La réponse de Gemini contient un JSON invalide.");
    }
}


function validateImage(imageFile) {
    if (!imageFile?.buffer || !imageFile?.mimetype) {
        throw new Error("Image du produit obligatoire.");
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(imageFile.mimetype)) {
        throw new Error("Format accepté : JPEG, PNG ou WEBP.");
    }
}


function getSources(response) {
    const chunks =
        response.candidates?.[0]?.groundingMetadata
            ?.groundingChunks || [];

    return [
        ...new Map(
            chunks
                .filter(item => item.web?.uri)
                .map(item => [
                    item.web.uri,
                    {
                        title: item.web.title || "",
                        url: item.web.uri
                    }
                ])
        ).values()
    ];
}


// Centralized Gemini error handling
function handleGeminiError(error) {
    const status =
        error.status ||
        error.statusCode ||
        error.code;

    console.error("Gemini API error:", {
        status,
        message: error.message
    });

    if (Number(status) === 429 ||
        error.message?.includes("RESOURCE_EXHAUSTED")) {
        const quotaError = new Error(
            "Le quota Gemini est atteint. Veuillez réessayer plus tard ou vérifier votre forfait API."
        );

        quotaError.statusCode = 429;
        throw quotaError;
    }

    if (Number(status) === 503 ||
        Number(status) === 504) {
        const serviceError = new Error(
            "Le service Gemini est temporairement indisponible. Réessayez dans quelques instants."
        );

        serviceError.statusCode = 503;
        throw serviceError;
    }

    const apiError = new Error(
        "Impossible de communiquer avec le service Gemini."
    );

    apiError.statusCode = 502;
    throw apiError;
}


// Common image analysis request
async function requestGemini(imageFile, prompt, useSearch = false) {
    const imageBase64 = imageFile.buffer.toString("base64");

    const config = {};

    if (useSearch) {
        config.tools = [
            {
                googleSearch: {}
            }
        ];
    }

    try {
        return await googleAI.models.generateContent({
            model: TEXT_MODEL,

            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        },
                        {
                            inlineData: {
                                mimeType: imageFile.mimetype,
                                data: imageBase64
                            }
                        }
                    ]
                }
            ],

            config
        });

    } catch (error) {
        handleGeminiError(error);
    }
}


/* =========================================
   ANALYSER UN PRODUIT
========================================= */

async function analyzeProduct(imageFile, categories = []) {
    validateImage(imageFile);

    const prompt = `
You are an expert e-commerce product analyst for A.M.W,
a commercial business based in Senegal.

Analyze the uploaded product photograph.

TASKS:

1. Identify the product accurately.
2. Research its identity and characteristics online
   using Google Search when available.
3. Suggest the most appropriate category.
4. Write a professional French marketing description.
5. The description MUST contain at least 100 French words.
6. Never invent technical specifications, brands or features.
7. Never present unverified characteristics as facts.
8. Use natural professional French suitable for Senegal.
9. Distinguish visually observed features from verified information.
10. If the product identity is uncertain, explain the uncertainty.

Existing categories:
${categories.join(", ")}

Return ONLY valid JSON:

{
  "productName": "Product name in French",
  "category": "Best category",
  "description": "At least 100 French words",
  "confidence": 0.95,
  "identifiedFeatures": [],
  "sources": []
}

Confidence must be between 0 and 1.
Do not invent source URLs.
`;

    const response = await requestGemini(
        imageFile,
        prompt,
        true
    );

    const result = extractJSON(response.text);

    if (
        !result.productName ||
        !result.category ||
        !result.description ||
        result.description.trim().split(/\s+/).length < 100
    ) {
        throw new Error(
            "Analyse incomplète. Veuillez réessayer."
        );
    }

    result.confidence = Math.max(
        0,
        Math.min(1, Number(result.confidence) || 0)
    );

    result.identifiedFeatures =
        Array.isArray(result.identifiedFeatures)
            ? result.identifiedFeatures
            : [];

    // Only real sources returned by Google grounding
    result.sources = getSources(response);

    return result;
}


/* =========================================
   IDENTIFIER UN PRODUIT POUR LA RECHERCHE
========================================= */

async function analyzeImageForSearch(imageFile) {
    validateImage(imageFile);

    const prompt = `
Identify the product in this image for an e-commerce search.

Rules:
- Identify the product accurately.
- Do not invent brands.
- Do not invent technical specifications.
- Use French product terminology.
- Generate useful shopping search terms.
- Mention uncertainty when necessary.

Return ONLY valid JSON:

{
  "productName": "French product name",
  "category": "Category",
  "searchTerms": ["term 1", "term 2", "term 3"],
  "description": "Short visual description in French"
}
`;

    const response = await requestGemini(
        imageFile,
        prompt,
        false
    );

    const result = extractJSON(response.text);

    if (
        !result.productName ||
        !Array.isArray(result.searchTerms)
    ) {
        throw new Error("Analyse d'image incomplète.");
    }

    return result;
}


module.exports = {
    analyzeProduct,
    analyzeImageForSearch
};
