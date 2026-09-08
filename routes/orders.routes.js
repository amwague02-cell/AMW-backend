const express = require("express");
const router = express.Router();

const pool = require("../config/db");

const jwt = require("jsonwebtoken");

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
   CREATE ORDER
   POST /api/orders
===================================================== */

router.post(
    "/",
    authenticateToken,
    async (req, res) => {

        const client = await pool.connect();

        try {

            const userId = req.user.id;

            const {
                firstName,
                lastName,
                phone,
                email,
                deliveryMethod,
                address,
                city,
                district,
                paymentMethod
            } = req.body;


            /* =========================================
               VALIDATION
            ========================================== */

            if (
                !firstName ||
                !lastName ||
                !phone ||
                !deliveryMethod ||
                !paymentMethod
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Veuillez remplir les informations obligatoires."
                });

            }


            if (
                deliveryMethod === "home" &&
                (!address || !city)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Veuillez renseigner votre adresse de livraison."
                });

            }


            /* =========================================
               GET CART
            ========================================== */

            const cartResult = await client.query(
                `
                SELECT
                    c.offer_id,
                    c.quantity,
                    o.product_name,
                    o.new_price,
                    o.image_url
                FROM cart_items c

                INNER JOIN offers o
                    ON o.id = c.offer_id

                WHERE c.user_id = $1

                ORDER BY c.created_at ASC
                `,
                [userId]
            );


            const cart = cartResult.rows;


            if (!cart.length) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Votre panier est vide."
                });

            }


            /* =========================================
               CALCUL TOTAL
            ========================================== */

            const subtotal = cart.reduce(
                (total, item) => {

                    return total +
                        Number(item.new_price || 0) *
                        Number(item.quantity || 1);

                },
                0
            );


            const deliveryPrice =
                deliveryMethod === "pickup"
                    ? 0
                    : 0;


            const total =
                subtotal + deliveryPrice;


            /* =========================================
               REFERENCE
            ========================================== */

            const referenceResult =
                await client.query(
                    `
                    SELECT
                        COALESCE(
                            MAX(id),
                            0
                        ) + 1 AS next_id
                    FROM orders
                    `
                );


            const nextId =
                Number(
                    referenceResult.rows[0].next_id
                );


            const year =
                new Date().getFullYear();


            const reference =
                `AMW-${year}-${String(nextId).padStart(6, "0")}`;


            /* =========================================
               TRANSACTION
            ========================================== */

            await client.query("BEGIN");


            /* =========================================
               CREATE ORDER
            ========================================== */

            const orderResult =
                await client.query(
                    `
                    INSERT INTO orders (
                        user_id,
                        reference,
                        first_name,
                        last_name,
                        phone,
                        email,
                        delivery_method,
                        address,
                        city,
                        district,
                        payment_method,
                        subtotal,
                        delivery_price,
                        total,
                        status
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13,
                        $14,
                        'pending'
                    )

                    RETURNING *
                    `,
                    [
                        userId,
                        reference,
                        firstName,
                        lastName,
                        phone,
                        email || null,
                        deliveryMethod,
                        deliveryMethod === "home"
                            ? address
                            : null,
                        deliveryMethod === "home"
                            ? city
                            : null,
                        deliveryMethod === "home"
                            ? district || null
                            : null,
                        paymentMethod,
                        subtotal,
                        deliveryPrice,
                        total
                    ]
                );


            const order =
                orderResult.rows[0];


            /* =========================================
               CREATE ORDER ITEMS
            ========================================== */

            for (const item of cart) {

                await client.query(
                    `
                    INSERT INTO order_items (
                        order_id,
                        offer_id,
                        product_name,
                        quantity,
                        unit_price,
                        image_url
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
                        order.id,
                        item.offer_id,
                        item.product_name,
                        item.quantity,
                        item.new_price,
                        item.image_url
                    ]
                );

            }


            /* =========================================
               CLEAR CART
            ========================================== */

            await client.query(
                `
                DELETE FROM cart_items
                WHERE user_id = $1
                `,
                [userId]
            );


            await client.query("COMMIT");


            /* =========================================
               RESPONSE
            ========================================== */

            res.status(201).json({

                success: true,

                message:
                    "Votre commande a été enregistrée avec succès.",

                order: {

                    id: order.id,

                    reference:
                        order.reference,

                    status:
                        order.status,

                    total:
                        Number(order.total),

                    created_at:
                        order.created_at

                }

            });

        }


        catch (error) {

            await client.query("ROLLBACK");

            console.error(
                "CREATE ORDER ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la création de la commande."

            });

        }


        finally {

            client.release();

        }

    }
);


/* =====================================================
   GET MY ORDERS
   GET /api/orders/my-orders
===================================================== */

router.get(
    "/my-orders",
    authenticateToken,
    async (req, res) => {

        try {

            const userId =
                req.user.id;


            const ordersResult =
                await pool.query(
                    `
                    SELECT
                        *
                    FROM orders

                    WHERE user_id = $1

                    ORDER BY created_at DESC
                    `,
                    [userId]
                );


            const orders =
                ordersResult.rows;


            const result = [];


            for (const order of orders) {


                const itemsResult =
                    await pool.query(
                        `
                        SELECT
                            oi.id,
                            oi.offer_id,
                            oi.product_name,
                            oi.quantity,
                            oi.unit_price,
                            oi.image_url

                        FROM order_items oi

                        WHERE oi.order_id = $1

                        ORDER BY oi.id ASC
                        `,
                        [order.id]
                    );


                result.push({

                    id:
                        Number(order.id),

                    reference:
                        order.reference,

                    date:
                        order.created_at,

                    status:
                        order.status,

                    total:
                        Number(order.total),

                    subtotal:
                        Number(order.subtotal),

                    deliveryPrice:
                        Number(order.delivery_price),

                    payment:
                        order.payment_method,

                    delivery:
                        order.delivery_method === "pickup"
                            ? "Retrait en magasin"
                            : "Livraison à domicile",

                    address:
                        order.delivery_method === "pickup"
                            ? "Retrait en magasin"
                            : [
                                order.city,
                                order.district,
                                order.address
                            ]
                            .filter(Boolean)
                            .join(", "),

                    customer: {

                        firstName:
                            order.first_name,

                        lastName:
                            order.last_name,

                        phone:
                            order.phone,

                        email:
                            order.email

                    },

                    products:
                        itemsResult.rows.map(item => ({

                            id:
                                Number(item.id),

                            offerId:
                                item.offer_id
                                    ? Number(item.offer_id)
                                    : null,

                            name:
                                item.product_name,

                            quantity:
                                Number(item.quantity),

                            price:
                                Number(item.unit_price),

                            image:
                                item.image_url ||
                                "amw.png"

                        }))

                });

            }


            res.json(result);

        }


        catch (error) {

            console.error(
                "GET MY ORDERS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Impossible de charger vos commandes."

            });

        }

    }
);


module.exports = router;