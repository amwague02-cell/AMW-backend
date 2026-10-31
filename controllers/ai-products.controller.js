
const pool = require("../config/db");

const {
    analyzeProduct
} = require("../services/ai-product.service");

const {
    generateImages,
    generateOneImage
} = require("../services/ai-image.service");


function validateImage(req, res) {

    if (!req.file) {
        res.status(400).json({
            success: false,
            message: "Veuillez ajouter une photo du produit."
        });

        return false;
    }

    if (!req.file.mimetype.startsWith("image/")) {
        res.status(400).json({
            success: false,
            message: "Format d'image invalide."
        });

        return false;
    }

    return true;
}


/* =========================================
   ANALYSER LE PRODUIT
========================================= */

async function analyze(req, res) {

    try {

        if (!validateImage(req, res)) return;

        const categoryResult = await pool.query(`
            SELECT DISTINCT category
            FROM offers
            WHERE category IS NOT NULL
        `);

        const categories = categoryResult.rows.map(
            row => row.category
        );

        const result = await analyzeProduct(
            req.file,
            categories
        );

        return res.json({
            success: true,
            product: result
        });

    } catch (error) {

        console.error("AI analysis:", error);

        return res.status(500).json({
            success: false,
            message: error.message ||
                "Erreur pendant l'analyse du produit."
        });
    }
}


/* =========================================
   GENERER LES IMAGES
========================================= */

async function generate(req, res) {

    try {

        if (!validateImage(req, res)) return;

        const {
            productName,
            count,
            direction
        } = req.body;

        if (!productName) {
            return res.status(400).json({
                success: false,
                message: "Nom du produit obligatoire."
            });
        }

        const requestedCount = Number(count);

        if (
            !Number.isInteger(requestedCount) ||
            requestedCount < 5 ||
            requestedCount > 10
        ) {
            return res.status(400).json({
                success: false,
                message: "Le nombre d'images doit être entre 5 et 10."
            });
        }

        const images = await generateImages(
            req.file,
            productName,
            requestedCount,
            direction
        );

        return res.json({
            success: true,
            images,
            generated: images.filter(
                image => image.success
            ).length
        });

    } catch (error) {

        console.error("AI image generation:", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de générer les images."
        });
    }
}


/* =========================================
   REGENERER UNE IMAGE
========================================= */

async function regenerate(req, res) {

    try {

        if (!validateImage(req, res)) return;

        const {
            productName,
            direction,
            index
        } = req.body;

        if (!productName || !direction) {
            return res.status(400).json({
                success: false,
                message: "Nom et instructions obligatoires."
            });
        }

        const image = await generateOneImage(
            req.file,
            productName,
            direction,
            Number(index) || 0
        );

        return res.json({
            success: true,
            image
        });

    } catch (error) {

        console.error("AI image regeneration:", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de recréer cette image."
        });
    }
}


module.exports = {
    analyze,
    generate,
    regenerate
};
