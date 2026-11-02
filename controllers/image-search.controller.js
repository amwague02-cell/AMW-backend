"use strict";

const pool = require("../config/db");
const cloudinary = require("../services/cloudinary.service");
const { Readable } = require("stream");
const { analyzeImageForSearch } = require("../services/ai-product.service");

function uploadSearchImage(file) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "amw/image-search",
                resource_type: "image"
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        Readable.from(file.buffer).pipe(stream);
    });
}

async function searchByImage(req, res) {
    try {
        if (!req.file || !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({
                success: false,
                message: "Veuillez choisir une image valide."
            });
        }

        const product = await analyzeImageForSearch(req.file);
        const uploaded = await uploadSearchImage(req.file);

        const terms = [
            product.productName,
            product.category,
            ...(product.searchTerms || [])
        ]
            .filter(Boolean)
            .map(term => String(term).trim())
            .filter(term => term.length >= 2)
            .slice(0, 10);

        const conditions = [];
        const params = [];

        for (const term of terms) {
            params.push(`%${term}%`);
            const n = params.length;

            conditions.push(`
                (
                    o.product_name ILIKE $${n}
                    OR o.category ILIKE $${n}
                    OR o.description ILIKE $${n}
                )
            `);
        }

        if (!conditions.length) {
            return res.json({
                success: true,
                offers: [],
                imageUrl: uploaded.secure_url,
                product
            });
        }

        const result = await pool.query(
            `
            SELECT
                o.id,
                o.reference,
                o.product_name,
                o.category,
                o.description,
                o.new_price,
                o.old_price,
                o.discount,
                o.quantity,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', oi.id,
                                'image_url', oi.image_url,
                                'is_main', oi.is_main,
                                'sort_order', oi.sort_order
                            )
                            ORDER BY oi.sort_order
                        )
                        FROM offer_images oi
                        WHERE oi.offer_id = o.id
                    ),
                    '[]'::json
                ) AS images
            FROM offers o
            WHERE o.status = 'active'
              AND o.quantity > 0
              AND (${conditions.join(" OR ")})
            ORDER BY o.created_at DESC
            LIMIT 20
            `,
            params
        );

        return res.json({
            success: true,
            offers: result.rows,
            imageUrl: uploaded.secure_url,
            product
        });

    } catch (error) {
        console.error("Image search error:", error);

        return res.status(500).json({
            success: false,
            message: "Erreur pendant la recherche par image."
        });
    }
}

async function createImageSearchAlert(req, res) {
    try {
        const { imageUrl, productDescription, contact } = req.body;

        if (!imageUrl || !contact) {
            return res.status(400).json({
                success: false,
                message: "Image et coordonnées obligatoires."
            });
        }

        let parsedUrl;

        try {
            parsedUrl = new URL(imageUrl);
        } catch (_) {
            return res.status(400).json({
                success: false,
                message: "Adresse de l'image invalide."
            });
        }

        if (
            parsedUrl.protocol !== "https:" ||
            parsedUrl.hostname !== "res.cloudinary.com" ||
            !parsedUrl.pathname.includes("/amw/image-search/")
        ) {
            return res.status(400).json({
                success: false,
                message: "Image non autorisée."
            });
        }

        const cleanContact = String(contact).trim();

        if (cleanContact.length < 5 || cleanContact.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Numéro ou adresse e-mail invalide."
            });
        }

        const contactType = cleanContact.includes("@") ? "email" : "phone";

        await pool.query(
            `
            INSERT INTO image_search_alerts (
                image_url,
                product_description,
                contact,
                contact_type
            )
            VALUES ($1, $2, $3, $4)
            `,
            [
                imageUrl,
                String(productDescription || "").slice(0, 2000),
                cleanContact,
                contactType
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Votre demande d'alerte a été enregistrée."
        });

    } catch (error) {
        console.error("Image alert error:", error);

        return res.status(500).json({
            success: false,
            message: "Impossible d'enregistrer votre demande."
        });
    }
}

module.exports = {
    searchByImage,
    createImageSearchAlert
};