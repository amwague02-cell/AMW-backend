const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const jwt = require("jsonwebtoken");


// =====================================================
// AUTHENTICATION
// =====================================================

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    const token =
        authHeader &&
        authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

    if (!token) {

        return res.status(401).json({
            success: false,
            message: "Veuillez vous connecter."
        });

    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, user) => {

            if (err) {

                return res.status(403).json({
                    success: false,
                    message: "Session invalide."
                });

            }

            req.user = user;

            next();

        }
    );

}


/* =====================================================
   GET CART
===================================================== */

router.get("/", authenticateToken, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                c.id AS cart_item_id,
                c.offer_id,
                c.quantity,
                c.created_at,
                c.updated_at,

                o.id,
                o.product_name,
                o.category,
                o.new_price,
                o.old_price,

                COALESCE(
                    (
                        SELECT oi.image_url
                        FROM offer_images oi
                        WHERE oi.offer_id = o.id
                        ORDER BY
                            oi.is_main DESC,
                            oi.sort_order ASC
                        LIMIT 1
                    ),
                    'amw.png'
                ) AS image_url

            FROM cart_items c

            INNER JOIN offers o
                ON o.id = c.offer_id

            WHERE c.user_id = $1

            ORDER BY c.created_at DESC
            `,
            [req.user.id]
        );


        res.json({
            success: true,
            cart: result.rows
        });


    } catch (error) {

        console.error(
            "❌ Get cart error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement du panier."
        });

    }

});



/* =====================================================
   ADD TO CART
===================================================== */

router.post("/", authenticateToken, async (req, res) => {

    try {

        const {
            offerId,
            quantity = 1
        } = req.body;


        if (!offerId) {

            return res.status(400).json({
                success: false,
                message: "offerId est obligatoire."
            });

        }


        const result = await pool.query(
            `
            INSERT INTO cart_items
            (
                user_id,
                offer_id,
                quantity
            )

            VALUES ($1, $2, $3)

            ON CONFLICT (user_id, offer_id)

            DO UPDATE SET
                quantity =
                    cart_items.quantity +
                    EXCLUDED.quantity,

                updated_at =
                    CURRENT_TIMESTAMP

            RETURNING *
            `,
            [
                req.user.id,
                offerId,
                Math.max(1, Number(quantity))
            ]
        );


        res.status(201).json({
            success: true,
            message: "Produit ajouté au panier.",
            item: result.rows[0]
        });


    } catch (error) {

        console.error(
            "❌ Add cart error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout au panier."
        });

    }

});



/* =====================================================
   UPDATE QUANTITY
===================================================== */

router.put("/:offerId", authenticateToken, async (req, res) => {

    try {

        const {
            quantity
        } = req.body;


        const newQuantity =
            Number(quantity);


        if (
            !Number.isInteger(newQuantity) ||
            newQuantity < 1
        ) {

            return res.status(400).json({
                success: false,
                message: "Quantité invalide."
            });

        }


        const result = await pool.query(
            `
            UPDATE cart_items

            SET
                quantity = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE
                user_id = $2
                AND offer_id = $3

            RETURNING *
            `,
            [
                newQuantity,
                req.user.id,
                req.params.offerId
            ]
        );


        if (!result.rows.length) {

            return res.status(404).json({
                success: false,
                message: "Produit non trouvé dans le panier."
            });

        }


        res.json({
            success: true,
            item: result.rows[0]
        });


    } catch (error) {

        console.error(
            "❌ Update cart error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Erreur lors de la modification."
        });

    }

});



/* =====================================================
   REMOVE ONE PRODUCT
===================================================== */

router.delete("/:offerId", authenticateToken, async (req, res) => {

    try {

        const result = await pool.query(
            `
            DELETE FROM cart_items

            WHERE
                user_id = $1
                AND offer_id = $2

            RETURNING *
            `,
            [
                req.user.id,
                req.params.offerId
            ]
        );


        res.json({
            success: true,
            message: "Produit retiré du panier."
        });


    } catch (error) {

        console.error(
            "❌ Remove cart error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression."
        });

    }

});



/* =====================================================
   CLEAR CART
===================================================== */

router.delete("/", authenticateToken, async (req, res) => {

    try {

        await pool.query(
            `
            DELETE FROM cart_items
            WHERE user_id = $1
            `,
            [req.user.id]
        );


        res.json({
            success: true,
            message: "Panier vidé."
        });


    } catch (error) {

        console.error(
            "❌ Clear cart error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Erreur lors du vidage du panier."
        });

    }

});


module.exports = router;