
const {
    googleAI,
    IMAGE_MODEL
} = require("./google-ai.service");

const cloudinary = require("./cloudinary.service");
const { Readable } = require("stream");


const angles = [
    "Professional front product photography",
    "Three-quarter perspective product photography",
    "Side angle showing product details",
    "Premium studio advertising photography",
    "Close-up showing material and craftsmanship",
    "Elegant commercial lifestyle scene",
    "Minimal luxury product photography",
    "Product displayed in a realistic environment",
    "Top-down commercial photography",
    "Premium catalog photography"
];


/* =========================================
   CLOUDINARY UPLOAD
========================================= */

function uploadBuffer(buffer) {

    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "amw/ai-generated",
                resource_type: "image"
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        Readable.from([buffer]).pipe(stream);
    });
}


/* =========================================
   GENERATE ONE IMAGE WITH GEMINI
========================================= */

async function generateOneImage(
    imageFile,
    productName,
    direction,
    index
) {

    if (!imageFile?.buffer || !imageFile?.mimetype) {
        throw new Error("Product reference image is required.");
    }

    const angle = angles[
        ((index % angles.length) + angles.length) % angles.length
    ];

    const prompt = `
Create a premium commercial advertising photograph
of the exact product shown in the reference image.

Product: ${productName}

Photography direction:
${angle}

Additional instructions:
${direction || "Elegant professional commercial presentation."}

PRODUCT IDENTITY PRESERVATION:

- Use the uploaded photograph as the primary reference.
- Preserve the actual product identity.
- Preserve its original shape and proportions.
- Preserve its real colors and visible materials.
- Preserve distinctive design details.
- Do not change the brand or model.
- Do not invent accessories or specifications.
- Do not replace the product with a similar product.

PHOTOGRAPHY:

- Professional commercial studio lighting.
- Realistic shadows and reflections.
- Premium advertising composition.
- Clean elegant background.
- Product must remain the main subject.
- High-quality realistic product photography.

No text, no watermark, no fake logos.
`;


    const response = await googleAI.models.generateContent({

        model: IMAGE_MODEL,

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
                            data: imageFile.buffer.toString("base64")
                        }
                    }
                ]
            }
        ],

        config: {
            responseModalities: ["IMAGE"],

            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "2K"
            }
        }
    });


    // Extract generated image from Gemini response.

    const parts =
        response.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
        part => part.inlineData?.data
    );

    if (!imagePart) {
        const reason =
            response.candidates?.[0]?.finishReason;

        throw new Error(
            `Gemini did not return an image. Reason: ${reason || "Unknown"}`
        );
    }


    const buffer = Buffer.from(
        imagePart.inlineData.data,
        "base64"
    );


    // Upload generated image to Cloudinary.

    const uploaded = await uploadBuffer(buffer);

    return {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        angle
    };
}


/* =========================================
   GENERATE MULTIPLE IMAGES
========================================= */

async function generateImages(
    imageFile,
    productName,
    count = 5,
    direction = ""
) {

    count = Math.min(
        10,
        Math.max(5, Number(count) || 5)
    );

    if (!productName) {
        throw new Error("Product name is required.");
    }

    const results = new Array(count);

    let nextIndex = 0;

    async function worker() {

        while (true) {

            const index = nextIndex++;

            if (index >= count) break;

            try {

                const image = await generateOneImage(
                    imageFile,
                    productName,
                    direction,
                    index
                );

                results[index] = {
                    success: true,
                    ...image
                };

            } catch (error) {

                console.error(
                    `Gemini image generation error [${index}]:`,
                    error.message
                );

                results[index] = {
                    success: false,
                    angle: angles[index % angles.length],
                    error: error.message
                };
            }
        }
    }


    // Keep the original 3 parallel workers.

    await Promise.all([
        worker(),
        worker(),
        worker()
    ]);

    return results;
}


module.exports = {
    generateImages,
    generateOneImage,
};
