const pool = require("../config/db");
const cloudinary = require("../services/cloudinary.service");
const { Readable } = require("stream");
const bcrypt = require("bcrypt");


function generateReference(id) {

    const year = new Date().getFullYear();

    return `AMW-${year}-${String(id).padStart(6, "0")}`;

}


function uploadToCloudinary(file) {

    return new Promise((resolve, reject) => {

        const stream =
            cloudinary.uploader.upload_stream(

                {
                    folder: "amw/offers",
                    resource_type: "image"
                },

                (error, result) => {

                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }

                }

            );

        Readable
            .from(file.buffer)
            .pipe(stream);

    });

}


async function createOffer(req, res) {

    const client = await pool.connect();

    try {

        const {
            productName,
            category,
            description,
            oldPrice,
            discount,
            newPrice,
            wholesalePrice,
            quantity,
            status
        } = req.body;


        if (!productName ||
            !category ||
            !description ||
            !newPrice) {

            return res.status(400).json({

                success: false,
                message: "Informations obligatoires manquantes."

            });

        }


        if (!req.files || req.files.length === 0) {

            return res.status(400).json({

                success: false,
                message: "Au moins une photo est obligatoire."

            });

        }


        await client.query("BEGIN");


        /*
         * 1. Créer l'offre
         */

        const offerResult = await client.query(

            `
           INSERT INTO offers (
                reference,
                product_name,
                category,
                description,
                old_price,
                discount,
                new_price,
                wholesale_price,
                quantity,
                status
            )

            VALUES (
                'TEMP',
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9
            )

            RETURNING id
            `,

            [
                productName,
                category,
                description,
                oldPrice || null,
                discount || null,
                newPrice,
                wholesalePrice || null,
                quantity || 1,
                status || "active"
            ]

        );


        const offerId =
            offerResult.rows[0].id;


        /*
         * 2. Générer Reference
         */

        const reference =
            generateReference(offerId);


        await client.query(

            `
            UPDATE offers

            SET reference = $1

            WHERE id = $2
            `,

            [
                reference,
                offerId
            ]

        );


        /*
         * 3. رفع الصور إلى Cloudinary
         */

        for (
            let i = 0;
            i < req.files.length;
            i++
        ) {

            const file =
                req.files[i];


            const result =
                await uploadToCloudinary(file);


            await client.query(

                `
                INSERT INTO offer_images (
                    offer_id,
                    cloudinary_public_id,
                    image_url,
                    resource_type,
                    is_main,
                    sort_order
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                `,

                [
                    offerId,
                    result.public_id,
                    result.secure_url,
                    result.resource_type,
                    i === 0,
                    i
                ]

            );

        }


        await client.query("COMMIT");


        res.status(201).json({

            success: true,

            message:
                "Offre créée avec succès.",

            offer: {

                id: offerId,

                reference,

                productName,

                category,

                quantity,

                status:
                    status || "active"

            }

        });

    }

    catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "❌ Create offer error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur lors de la création de l'offre."

        });

    }

    finally {

        client.release();

    }

}

async function getOffers(req, res) {
    try {
        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            30,
            Math.max(
                1,
                parseInt(req.query.limit, 10) || 16
            )
        );

        const offset = (page - 1) * limit;

        const search = String(req.query.search || "").trim();
        const category = String(req.query.category || "").trim();
        const sort = String(req.query.sort || "newest");

        const allowedSorts = {
            newest: "o.created_at DESC, o.id DESC",
            "price-low": "o.new_price ASC, o.id DESC",
            "price-high": "o.new_price DESC, o.id DESC",
            discount: "o.discount DESC NULLS LAST, o.created_at DESC, o.id DESC"
        };

        const orderBy = allowedSorts[sort] || allowedSorts.newest;

        const conditions = [
            "o.status = 'active'",
            "o.quantity > 0"
        ];

        const params = [];

        if (category && category !== "all") {
            params.push(category);
            conditions.push(`o.category = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            const index = params.length;

            conditions.push(`
                (
                    o.product_name ILIKE $${index}
                    OR o.category ILIKE $${index}
                    OR o.description ILIKE $${index}
                )
            `);
        }

        const whereClause = conditions.join(" AND ");

        // Nombre total des résultats correspondant aux filtres
        const countResult = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM offers o
            WHERE ${whereClause}
            `,
            params
        );

        const total = Number(countResult.rows[0].total);

        // Charger uniquement la page demandée
        const result = await pool.query(
            `
            SELECT
                o.id,
                o.reference,
                o.product_name,
                o.category,
                o.description,
                o.old_price,
                o.discount,
                o.new_price,
                o.wholesale_price,
                o.quantity,
                o.status,
                o.created_at,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', oi.id,
                            'image_url', oi.image_url,
                            'is_main', oi.is_main,
                            'sort_order', oi.sort_order
                        )
                        ORDER BY oi.sort_order ASC
                    ) FILTER (WHERE oi.id IS NOT NULL),
                    '[]'::json
                ) AS images

            FROM offers o

            LEFT JOIN offer_images oi
                ON oi.offer_id = o.id

            WHERE ${whereClause}

            GROUP BY o.id

            ORDER BY ${orderBy}

            LIMIT $${params.length + 1}
            OFFSET $${params.length + 2}
            `,
            [...params, limit, offset]
        );

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            offers: result.rows,
            pagination: {
                page,
                limit,
                total,
                hasMore: offset + result.rows.length < total
            }
        });

    } catch (error) {
        console.error("Get offers error:", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors du chargement des offres."
        });
    }
}

async function getOfferById(req, res) {

    try {

        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                o.id,
                o.reference,
                o.product_name,
                o.category,
                o.description,
                o.old_price,
                o.discount,
                o.new_price,
                o.wholesale_price,
                o.quantity,
                o.status,
                o.created_at,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', oi.id,
                            'image_url', oi.image_url,
                            'is_main', oi.is_main,
                            'sort_order', oi.sort_order
                        )
                        ORDER BY oi.sort_order ASC
                    )
                    FILTER (WHERE oi.id IS NOT NULL),
                    '[]'
                ) AS images

            FROM offers o

            LEFT JOIN offer_images oi
                ON oi.offer_id = o.id

            WHERE o.id = $1
              AND o.status = 'active'
              AND o.quantity > 0

            GROUP BY o.id
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Offre introuvable."

            });

        }


        res.json({

            success: true,
            offer: result.rows[0]

        });

    }

    catch (error) {

        console.error(
            "❌ Get offer error:",
            error
        );

        res.status(500).json({

            success: false,
            message:
                "Erreur PostgreSQL."

        });

    }

}

async function getCategories(req, res) {

    try {

        const result =
            await pool.query(`

                SELECT DISTINCT
                    category

                FROM offers

                WHERE category IS NOT NULL
                  AND TRIM(category) <> ''

                ORDER BY category ASC

            `);


        const categories =
            result.rows.map(
                row => row.category
            );


        res.json({

            success: true,

            categories

        });


    } catch (error) {

        console.error(
            "❌ Get categories error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur lors du chargement des catégories."

        });

    }

}



/* =====================================================
   UPDATE OFFER
===================================================== */

async function updateOffer(req, res) {

    const client = await pool.connect();

    try {

        const { id } = req.params;

        const {
            product_name,
            category,
            description,
            old_price,
            discount,
            new_price,
            wholesale_price,
            quantity,
            status
        } = req.body;


        if (!product_name || !category || !new_price) {

            return res.status(400).json({
                success: false,
                message: "Informations obligatoires manquantes."
            });

        }


        const existingOffer =
            await client.query(
                `
                SELECT id
                FROM offers
                WHERE id = $1
                `,
                [id]
            );


        if (existingOffer.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Offre introuvable."
            });

        }


        const result =
            await client.query(
                `
                UPDATE offers

                SET
                    product_name = $1,
                    category = $2,
                    description = $3,
                    old_price = $4,
                    discount = $5,
                    new_price = $6,
                    wholesale_price = $7,
                    quantity = $8,
                    status = $9

                WHERE id = $10

                RETURNING
                    id,
                    reference,
                    product_name,
                    category,
                    description,
                    old_price,
                    discount,
                    new_price,
                    wholesale_price,
                    quantity,
                    status,
                    created_at
                `,
                [
                    product_name,
                    category,
                    description || "",
                    old_price || null,
                    discount || 0,
                    new_price,
                    wholesale_price || null,
                    quantity || 0,
                    status || "active",
                    id
                ]
            );


        return res.json({
            success: true,
            message: "Offre modifiée avec succès.",
            offer: result.rows[0]
        });

    }

    catch (error) {

        console.error(
            "❌ Update offer error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Erreur lors de la modification de l'offre."
        });

    }

    finally {

        client.release();

    }

}


/* =====================================================
   DELETE OFFER
===================================================== */

async function deleteOffer(req, res) {

    const client = await pool.connect();

    try {

        const { id } = req.params;

        const { password } =
            req.body;


        if (!password) {

            return res.status(400).json({
                success: false,
                message:
                    "Mot de passe administrateur requis."
            });

        }


        /* -------------------------------------------------
           Vérifier l'administrateur connecté
        ------------------------------------------------- */

        const adminResult =
            await client.query(
                `
                SELECT
                    id,
                    password_hash
                FROM admin_users
                WHERE id = $1
                LIMIT 1
                `,
                [req.admin.id]
            );


        if (adminResult.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message:
                    "Administrateur introuvable."
            });

        }


        const admin =
            adminResult.rows[0];


        const passwordValid =
            await bcrypt.compare(
                password,
                admin.password_hash
            );


        if (!passwordValid) {

            return res.status(401).json({
                success: false,
                message:
                    "Mot de passe administrateur incorrect."
            });

        }


        /* -------------------------------------------------
           Vérifier l'offre
        ------------------------------------------------- */

        const offerResult =
            await client.query(
                `
                SELECT id
                FROM offers
                WHERE id = $1
                `,
                [id]
            );


        if (offerResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Offre introuvable."
            });

        }


        await client.query("BEGIN");


        /* -------------------------------------------------
           Supprimer les images
        ------------------------------------------------- */

        await client.query(
            `
            DELETE FROM offer_images
            WHERE offer_id = $1
            `,
            [id]
        );


        /* -------------------------------------------------
           Supprimer l'offre
        ------------------------------------------------- */

        await client.query(
            `
            DELETE FROM offers
            WHERE id = $1
            `,
            [id]
        );


        await client.query("COMMIT");


        return res.json({
            success: true,
            message:
                "Offre supprimée avec succès."
        });

    }

    catch (error) {

        try {
            await client.query("ROLLBACK");
        }
        catch (_) {}


        console.error(
            "❌ Delete offer error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Erreur lors de la suppression de l'offre."
        });

    }

    finally {

        client.release();

    }

}


module.exports = {
    createOffer,
    getOffers,
    getOfferById,
    getCategories,
    updateOffer,
    deleteOffer
};