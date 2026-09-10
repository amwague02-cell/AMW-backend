"use strict";

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const requireAdmin = require("../middleware/admin-auth");


/* =====================================================
   GET ALL ORDERS
   GET /api/admin/orders
===================================================== */

router.get("/", requireAdmin, async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                o.id,
                o.reference,
                o.user_id,

                o.first_name,
                o.last_name,
                o.phone,
                o.email,

                o.delivery_method,
                o.address,
                o.city,
                o.district,

                o.payment_method,

                o.subtotal,
                o.delivery_price,
                o.total,

                o.status,

                o.created_at,
                o.updated_at,

                COUNT(oi.id)::int AS items_count

            FROM orders o

            LEFT JOIN order_items oi
                ON oi.order_id = o.id

            GROUP BY o.id

            ORDER BY o.created_at DESC
        `);


        res.json({

            success: true,

            orders: result.rows.map(order => ({

                id: Number(order.id),

                reference: order.reference,

                userId:
                    order.user_id
                        ? Number(order.user_id)
                        : null,

                customer: {

                    firstName: order.first_name,

                    lastName: order.last_name,

                    phone: order.phone,

                    email: order.email

                },

                delivery: {

                    method: order.delivery_method,

                    address: order.address,

                    city: order.city,

                    district: order.district

                },

                payment: order.payment_method,

                subtotal:
                    Number(order.subtotal || 0),

                deliveryPrice:
                    Number(order.delivery_price || 0),

                total:
                    Number(order.total || 0),

                status: order.status,

                itemsCount:
                    Number(order.items_count || 0),

                createdAt: order.created_at,

                updatedAt: order.updated_at

            }))

        });

    }

    catch (error) {

        console.error(
            "ADMIN ORDERS ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Impossible de charger les commandes."

        });

    }

});


/* =====================================================
   GET ONE ORDER
   GET /api/admin/orders/:id
===================================================== */

router.get("/:id", requireAdmin, async (req, res) => {

    try {

        const orderId =
            Number(req.params.id);


        if (!Number.isInteger(orderId)) {

            return res.status(400).json({

                success: false,

                message:
                    "Identifiant invalide."

            });

        }


        const orderResult = await pool.query(
            `
            SELECT *
            FROM orders
            WHERE id = $1
            `,
            [orderId]
        );


        if (!orderResult.rows.length) {

            return res.status(404).json({

                success: false,

                message:
                    "Commande introuvable."

            });

        }


        const order =
            orderResult.rows[0];


        const itemsResult = await pool.query(
            `
            SELECT
                id,
                offer_id,
                product_name,
                quantity,
                unit_price,
                image_url

            FROM order_items

            WHERE order_id = $1

            ORDER BY id ASC
            `,
            [orderId]
        );


        res.json({

            success: true,

            order: {

                id: Number(order.id),

                reference: order.reference,

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

                delivery: {

                    method:
                        order.delivery_method,

                    address:
                        order.address,

                    city:
                        order.city,

                    district:
                        order.district

                },

                payment:
                    order.payment_method,

                subtotal:
                    Number(order.subtotal || 0),

                deliveryPrice:
                    Number(order.delivery_price || 0),

                total:
                    Number(order.total || 0),

                status:
                    order.status,

                createdAt:
                    order.created_at,

                updatedAt:
                    order.updated_at,

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

                        unitPrice:
                            Number(item.unit_price),

                        image:
                            item.image_url ||
                            "amw.png"

                    }))

            }

        });

    }

    catch (error) {

        console.error(
            "ADMIN ORDER DETAILS ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Impossible de charger la commande."

        });

    }

});


/* =====================================================
   UPDATE STATUS
   PATCH /api/admin/orders/:id/status
===================================================== */

router.patch(
    "/:id/status",
    requireAdmin,
    async (req, res) => {

        try {

            const orderId =
                Number(req.params.id);

            const { status } =
                req.body;


            const allowedStatuses = [

                "pending",
                "confirmed",
                "processing",
                "shipped",
                "delivered",
                "cancelled"

            ];


            if (!allowedStatuses.includes(status)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Statut invalide."

                });

            }


            const result = await pool.query(
                `
                UPDATE orders

                SET
                    status = $1,
                    updated_at = NOW()

                WHERE id = $2

                RETURNING
                    id,
                    reference,
                    status,
                    updated_at
                `,
                [
                    status,
                    orderId
                ]
            );


            if (!result.rows.length) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Commande introuvable."

                });

            }


            res.json({

                success: true,

                message:
                    "Statut mis à jour.",

                order:
                    result.rows[0]

            });

        }

        catch (error) {

            console.error(
                "ADMIN UPDATE ORDER ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Impossible de modifier le statut."

            });

        }

    }
);


module.exports = router;