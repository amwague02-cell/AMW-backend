
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const cloudinary = require("./cloudinary.service");
const { Readable } = require("stream");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

        Readable.from(buffer).pipe(stream);
    });
}

async function generateOneImage(
    imageFile,
    productName,
    direction,
    index
) {

    const reference = await toFile(
        imageFile.buffer,
        "product-reference.jpg",
        { type: imageFile.mimetype }
    );

    const angle = angles[index % angles.length];

    const prompt = `
Create a premium commercial advertising photograph
of the exact product shown in the reference image.

Product: ${productName}

Photography direction:
${angle}

Additional instructions:
${direction || "Elegant professional commercial presentation."}

IMPORTANT:
- Preserve the real product identity.
- Preserve its actual shape and main design.
- Do not invent accessories or specifications.
- Do not change the brand or product model.
- Use realistic professional lighting.
- Create a clean premium advertising composition.
- No text, no watermark, no fake logos.
- High-quality commercial photography.
`;

    const result = await openai.images.edit({

        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",

        image: reference,

        prompt,

        size: "1024x1024",

        quality: "high"

    });

    const base64 = result.data?.[0]?.b64_json;

    if (!base64) {
        throw new Error("Image generation failed.");
    }

    const buffer = Buffer.from(base64, "base64");

    const uploaded = await uploadBuffer(buffer);

    return {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        angle
    };
}

async function generateImages(
    imageFile,
    productName,
    count = 5,
    direction = ""
) {

    count = Math.min(10, Math.max(5, Number(count) || 5));

    const results = [];
    let nextIndex = 0;

    async function worker() {

        while (nextIndex < count) {

            const index = nextIndex++;

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
                    "Image generation error:",
                    error.message
                );

                results[index] = {
                    success: false,
                    angle: angles[index]
                };

            }
        }
    }

    await Promise.all([
        worker(),
        worker(),
        worker()
    ]);

    return results;
}

module.exports = {
    generateImages,
    generateOneImage
};
