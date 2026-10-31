
const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function analyzeProduct(imageFile, categories = []) {

    const imageBase64 = imageFile.buffer.toString("base64");

    const imageUrl =
        `data:${imageFile.mimetype};base64,${imageBase64}`;

    const prompt = `
You are an expert e-commerce product analyst for A.M.W,
a commercial business based in Senegal.

Analyze the uploaded product photograph.

Tasks:
1. Identify the product accurately.
2. Research its identity and characteristics online when possible.
3. Suggest the most appropriate category.
4. Write a professional French marketing description.
5. The description must contain at least 100 French words.
6. Never invent technical specifications, brands or features.
7. If something cannot be verified, do not claim it as fact.

Existing categories:
${categories.join(", ")}

Return ONLY valid JSON in this exact structure:

{
  "productName": "Product name in French",
  "category": "Best category",
  "description": "At least 100 French words",
  "confidence": 0.95,
  "identifiedFeatures": [],
  "sources": []
}
`;

    const response = await openai.responses.create({

        model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",

        tools: [
            { type: "web_search" }
        ],

        input: [
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: prompt
                    },
                    {
                        type: "input_image",
                        image_url: imageUrl,
                        detail: "high"
                    }
                ]
            }
        ]

    });

    const output = response.output_text;

    const match = output.match(/\{[\s\S]*\}/);

    if (!match) {
        throw new Error("Impossible de lire l'analyse du produit.");
    }

    const result = JSON.parse(match[0]);

    if (
        !result.productName ||
        !result.category ||
        !result.description ||
        result.description.trim().split(/\s+/).length < 100
    ) {
        throw new Error("Analyse incomplète. Veuillez réessayer.");
    }

    return result;
}

module.exports = {
    analyzeProduct
};
