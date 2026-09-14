"use strict";

const pool = require("../../config/db");
const cloudinary = require("../../services/cloudinary.service");


/* =========================================================
   GET ALL ADS — ADMIN
========================================================= */

exports.getAllAds = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id,
                title,
                image_url,
                link_url,
                width,
                height,
                display_order,
                is_active,
                starts_at,
                ends_at,
                cloudinary_public_id,
                created_at,
                updated_at
            FROM site_ads
            ORDER BY display_order ASC, created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(
            "GET SITE ADS ERROR:",
            error
        );

        res.status(500).json({
            message: "Erreur serveur."
        });

    }

};


/* =========================================================
   GET ACTIVE ADS — PUBLIC
========================================================= */

exports.getActiveAds = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id,
                title,
                image_url,
                link_url,
                width,
                height,
                display_order
            FROM site_ads
            WHERE
                is_active = TRUE
                AND (
                    starts_at IS NULL
                    OR starts_at <= NOW()
                )
                AND (
                    ends_at IS NULL
                    OR ends_at >= NOW()
                )
            ORDER BY display_order ASC, created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(
            "GET ACTIVE SITE ADS ERROR:",
            error
        );

        res.status(500).json({
            message: "Erreur serveur."
        });

    }

};


/* =========================================================
   CREATE
========================================================= */

exports.createAd = async (req, res) => {

    try {

        const {
            title,
            link_url,
            width,
            height,
            display_order,
            is_active,
            starts_at,
            ends_at
        } = req.body;


        if (!title) {

            return res.status(400).json({
                message: "Le titre est obligatoire."
            });

        }


        if (!req.file) {

            return res.status(400).json({
                message: "L'image est obligatoire."
            });

        }


        const imageUrl =
            req.file.path ||
            req.file.secure_url;


        const publicId =
            req.file.filename ||
            req.file.public_id ||
            null;


        const result = await pool.query(
            `
            INSERT INTO site_ads (
                title,
                image_url,
                link_url,
                width,
                height,
                display_order,
                is_active,
                starts_at,
                ends_at,
                cloudinary_public_id
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
            )
            RETURNING *
            `,
            [
                title.trim(),
                imageUrl,
                link_url || null,
                Number(width) || 170,
                Number(height) || 108,
                Number(display_order) || 0,
                is_active !== "false",
                starts_at || null,
                ends_at || null,
                publicId
            ]
        );


        res.status(201).json(
            result.rows[0]
        );

    } catch (error) {

        console.error(
            "CREATE SITE AD ERROR:",
            error
        );

        res.status(500).json({
            message: "Erreur lors de la création."
        });

    }

};


/* =========================================================
   UPDATE
========================================================= */

exports.updateAd = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            title,
            link_url,
            width,
            height,
            display_order,
            is_active,
            starts_at,
            ends_at
        } = req.body;


        const oldResult = await pool.query(
            `
            SELECT *
            FROM site_ads
            WHERE id = $1
            `,
            [id]
        );


        if (!oldResult.rows.length) {

            return res.status(404).json({
                message: "Publicité introuvable."
            });

        }


        const oldAd =
            oldResult.rows[0];


        let imageUrl =
            oldAd.image_url;

        let publicId =
            oldAd.cloudinary_public_id;


        if (req.file) {

            imageUrl =
                req.file.path ||
                req.file.secure_url;

            publicId =
                req.file.filename ||
                req.file.public_id ||
                publicId;


            if (
                oldAd.cloudinary_public_id &&
                cloudinary.uploader
            ) {

                try {

                    await cloudinary.uploader.destroy(
                        oldAd.cloudinary_public_id
                    );

                } catch (cloudError) {

                    console.warn(
                        "Cloudinary old image deletion:",
                        cloudError.message
                    );

                }

            }

        }


        const result = await pool.query(
            `
            UPDATE site_ads

            SET
                title = $1,
                image_url = $2,
                link_url = $3,
                width = $4,
                height = $5,
                display_order = $6,
                is_active = $7,
                starts_at = $8,
                ends_at = $9,
                cloudinary_public_id = $10,
                updated_at = NOW()

            WHERE id = $11

            RETURNING *
            `,
            [
                title?.trim() || oldAd.title,
                imageUrl,
                link_url || null,
                Number(width) || oldAd.width,
                Number(height) || oldAd.height,
                Number(display_order) || 0,
                is_active !== "false",
                starts_at || null,
                ends_at || null,
                publicId,
                id
            ]
        );


        res.json(
            result.rows[0]
        );

    } catch (error) {

        console.error(
            "UPDATE SITE AD ERROR:",
            error
        );

        res.status(500).json({
            message: "Erreur lors de la modification."
        });

    }

};


/* =========================================================
   DELETE
========================================================= */

exports.deleteAd = async (req, res) => {

    try {

        const { id } = req.params;


        const result = await pool.query(
            `
            DELETE FROM site_ads
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );


        if (!result.rows.length) {

            return res.status(404).json({
                message: "Publicité introuvable."
            });

        }


        const ad =
            result.rows[0];


        if (
            ad.cloudinary_public_id &&
            cloudinary.uploader
        ) {

            try {

                await cloudinary.uploader.destroy(
                    ad.cloudinary_public_id
                );

            } catch (cloudError) {

                console.warn(
                    "Cloudinary deletion:",
                    cloudError.message
                );

            }

        }


        res.json({
            message: "Publicité supprimée.",
            id
        });

    } catch (error) {

        console.error(
            "DELETE SITE AD ERROR:",
            error
        );

        res.status(500).json({
            message: "Erreur lors de la suppression."
        });

    }

};