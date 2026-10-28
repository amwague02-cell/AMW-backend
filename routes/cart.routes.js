
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Veuillez vous connecter."
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: "Session invalide."
            });
        }

        req.user = user;
        next();
    });
}

async function getCartId(userId, client = pool) {
    const result = await client.query(
        `INSERT INTO carts (user_id)
         VALUES ($1)
         ON CONFLICT (user_id)
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [userId]
    );

    return result.rows[0].id;
}

// GET CART
router.get("/", authenticateToken, async (req, res) => {
    try {
        const cartId = await getCartId(req.user.id);

        const result = await pool.query(
            `SELECT
                ci.id AS cart_item_id,
                ci.offer_id,
                ci.quantity,
                ci.created_at,
                ci.updated_at,
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
                        ORDER BY oi.is_main DESC, oi.sort_order ASC
                        LIMIT 1
                    ),
                    'amw.png'
                ) AS image_url
             FROM cart_items ci
             JOIN offers o ON o.id = ci.offer_id
             WHERE ci.cart_id = $1
             ORDER BY ci.created_at DESC`,
            [cartId]
        );

        res.json({ success: true, cart: result.rows });
    } catch (error) {
        console.error("Get cart error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement du panier."
        });
    }
});

// ADD TO CART
router.post("/", authenticateToken, async (req, res) => {
    const quantity = Number(req.body.quantity ?? 1);
    const offerId = Number(req.body.offerId);

    if (!Number.isSafeInteger(offerId) || offerId <= 0 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({
            success: false,
            message: "Produit ou quantité invalide."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const offer = await client.query(
            `SELECT id FROM offers
             WHERE id = $1 AND status = 'active'`,
            [offerId]
        );

        if (!offer.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Offre introuvable ou inactive."
            });
        }

        const cartId = await getCartId(req.user.id, client);

        const result = await client.query(
            `INSERT INTO cart_items (cart_id, offer_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (cart_id, offer_id)
             WHERE offer_id IS NOT NULL
             DO UPDATE SET
                quantity = cart_items.quantity + EXCLUDED.quantity,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [cartId, offerId, quantity]
        );

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Produit ajouté au panier.",
            item: result.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Add cart error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout au panier."
        });
    } finally {
        client.release();
    }
});

// UPDATE QUANTITY
router.put("/:offerId", authenticateToken, async (req, res) => {
    const offerId = Number(req.params.offerId);
    const quantity = Number(req.body.quantity);

    if (!Number.isSafeInteger(offerId) || offerId <= 0 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({
            success: false,
            message: "Quantité ou produit invalide."
        });
    }

    try {
        const cartId = await getCartId(req.user.id);

        const result = await pool.query(
            `UPDATE cart_items
             SET quantity = $1, updated_at = CURRENT_TIMESTAMP
             WHERE cart_id = $2 AND offer_id = $3
             RETURNING *`,
            [quantity, cartId, offerId]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Produit non trouvé dans le panier."
            });
        }

        res.json({ success: true, item: result.rows[0] });
    } catch (error) {
        console.error("Update cart error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la modification."
        });
    }
});

// REMOVE ONE PRODUCT
router.delete("/:offerId", authenticateToken, async (req, res) => {
    try {
        const cartId = await getCartId(req.user.id);

        await pool.query(
            `DELETE FROM cart_items
             WHERE cart_id = $1 AND offer_id = $2`,
            [cartId, req.params.offerId]
        );

        res.json({
            success: true,
            message: "Produit retiré du panier."
        });
    } catch (error) {
        console.error("Remove cart error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression."
        });
    }
});

// CLEAR CART
router.delete("/", authenticateToken, async (req, res) => {
    try {
        const cartId = await getCartId(req.user.id);

        await pool.query(
            `DELETE FROM cart_items WHERE cart_id = $1`,
            [cartId]
        );

        res.json({ success: true, message: "Panier vidé." });
    } catch (error) {
        console.error("Clear cart error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors du vidage du panier."
        });
    }
});

module.exports = router;
