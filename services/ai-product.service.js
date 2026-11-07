
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

    return JSON.parse(cleaned.slice(start, end + 1));
}


function validateImage(imageFile) {
    if (!imageFile?.buffer || !imageFile?.mimetype) {
        throw new Error("Image du produit obligatoire.");
    }

    if (!imageFile.mimetype.startsWith("image/")) {
        throw new Error("Format d'image invalide.");
    }
}


// Extract real citations returned by Google Search.
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


/* =========================================
   ANALYSER UN PRODUIT
========================================= */

async function analyzeProduct(imageFile, categories = []) {

    validateImage(imageFile);

    const imageBase64 =
        imageFile.buffer.toString("base64");

    const prompt = `
You are an expert e-commerce product analyst for A.M.W,
a commercial business based in Senegal.

Analyze the uploaded product photograph.

TASKS:

1. Identify the product accurately.
2. Research its identity and characteristics online
   using Google Search when possible.
3. Suggest the most appropriate category.
4. Write a professional French marketing description.
5. The description MUST contain at least 100 French words.
6. Never invent technical specifications, brands or features.
7. Do not claim unverified characteristics as facts.
8. Use natural professional French suitable for
   an e-commerce store in Senegal.
9. Distinguish visually observed features from
   information verified online.

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

    // Gemini Interactions API
    const response = await googleAI.models.generateContent({

    model: TEXT_MODEL,

    contents: [
        {
            role: "user",
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: imageFile.mimetype,
                        data: imageBase64
                    }
                }
            ]
        }
    ],

    config: {
        tools: [
            {
                googleSearch: {}
            }
        ]
    }
});

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

    result.sources = getSources(response);

    return result;
}


/* =========================================
   IDENTIFIER UN PRODUIT POUR LA RECHERCHE
========================================= */

async function analyzeImageForSearch(imageFile) {

    validateImage(imageFile);

    const imageBase64 =
        imageFile.buffer.toString("base64");

    const prompt = `
Identify the product in this image for an e-commerce search.

Rules:
- Identify the product accurately.
- Do not invent brands.
- Do not invent technical specifications.
- Use French product terminology.
- Generate useful shopping search terms.

Return ONLY valid JSON:

{
  "productName": "French product name",
  "category": "Category",
  "searchTerms": ["term 1", "term 2", "term 3"],
  "description": "Short visual description in French"
}
`;

    // Gemini Interactions API
    const response = await googleAI.models.generateContent({

    model: TEXT_MODEL,

    contents: [
        {
            role: "user",
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: imageFile.mimetype,
                        data: imageBase64
                    }
                }
            ]
        }
    ]
});

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
