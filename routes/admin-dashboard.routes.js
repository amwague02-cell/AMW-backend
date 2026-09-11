"use strict";

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const requireAdmin = require("../middleware/admin-auth");


router.get(
    "/",
    requireAdmin,
    async (req, res) => {

        try {

            /* ============================================
               STATISTIQUES GÉNÉRALES
            ============================================ */

            const statsResult = await pool.query(`
                SELECT

                    (
                        SELECT COUNT(*)
                        FROM orders
                    ) AS total_orders,

                    (
                        SELECT COUNT(*)
                        FROM users
                    ) AS total_users,

                    (
                        SELECT COUNT(*)
                        FROM offers
                        WHERE is_active = true
                    ) AS total_offers,

                    (
                        SELECT COALESCE(
                            SUM(total),
                            0
                        )
                        FROM orders
                        WHERE status != 'cancelled'
                    ) AS revenue

            `);


            const stats = statsResult.rows[0];


            /* ============================================
               DERNIÈRES COMMANDES
            ============================================ */

            const ordersResult = await pool.query(`
                SELECT
                    o.id,
                    o.reference,
                    o.first_name,
                    o.last_name,
                    o.total,
                    o.status,
                    o.created_at

                FROM orders o

                ORDER BY
                    o.created_at DESC

                LIMIT 6
            `);


            const ordersList =
                ordersResult.rows.map(order => ({

                    id:
                        order.reference ||
                        order.id,

                    customer:
                        [
                            order.first_name,
                            order.last_name
                        ]
                        .filter(Boolean)
                        .join(" ") ||
                        "Client",

                    total:
                        Number(
                            order.total || 0
                        ),

                    status:
                        order.status,

                    created_at:
                        order.created_at

                }));


            /* ============================================
               NOUVEAUX UTILISATEURS
            ============================================ */

            const usersResult = await pool.query(`
                SELECT
                    id,
                    full_name,
                    email,
                    created_at

                FROM users

                ORDER BY
                    created_at DESC

                LIMIT 6
            `);


            const usersList =
                usersResult.rows.map(user => ({

                    id:
                        user.id,

                    full_name:
                        user.full_name ||
                        "Utilisateur",

                    email:
                        user.email ||
                        "",

                    created_at:
                        user.created_at

                }));


            /* ============================================
               RÉPONSE
            ============================================ */

            res.json({

                success: true,

                stats: {

                    revenue:
                        Number(
                            stats.revenue || 0
                        ),

                    orders:
                        Number(
                            stats.total_orders || 0
                        ),

                    users:
                        Number(
                            stats.total_users || 0
                        ),

                    offers:
                        Number(
                            stats.total_offers || 0
                        ),

                    ordersList,

                    usersList

                }

            });

        }

        catch (error) {

            console.error(
                "Erreur dashboard admin:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur lors du chargement du dashboard."

            });

        }

    }
);


module.exports = router;