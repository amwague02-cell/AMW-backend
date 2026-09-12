"use strict";

const express = require("express");

const router =
    express.Router();

const pool =
    require("../config/db");

const requireAdmin =
    require("../middleware/admin-auth");

const {
    getDashboardActivity
} = require(
    "../controllers/admin-dashboard.controller"
);

router.get(
    "/activity",
    requireAdmin,
    getDashboardActivity
);


router.get(
    "/",
    requireAdmin,
    async (req, res) => {

        try {

            /* ============================================
               STATISTIQUES
            ============================================ */

            const statsResult =
                await pool.query(`
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


            const stats =
                statsResult.rows[0];


            /* ============================================
               DERNIÈRES COMMANDES
            ============================================ */

            const ordersResult =
                await pool.query(`
                    SELECT

                        id,
                        reference,
                        first_name,
                        last_name,
                        total,
                        status,
                        created_at

                    FROM orders

                    ORDER BY created_at DESC

                    LIMIT 6
                `);


            const ordersList =
                ordersResult.rows.map(
                    order => ({

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

                    })
                );


            /* ============================================
               NOUVEAUX UTILISATEURS
            ============================================ */

            const usersResult =
                await pool.query(`
                    SELECT

                        id,
                        full_name,
                        email,
                        created_at

                    FROM users

                    ORDER BY created_at DESC

                    LIMIT 6
                `);


            const usersList =
                usersResult.rows.map(
                    user => ({

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

                    })
                );


            /* ============================================
               RESPONSE
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

                    ordersList:
                        ordersList,

                    usersList:
                        usersList

                }

            });

        }

        catch (error) {

    console.error(
        "ADMIN DASHBOARD ERROR:",
        error.message
    );

    console.error(
        error.stack
    );

    res.status(500).json({

        success: false,

        message:
            "Erreur lors du chargement du dashboard.",

        error:
            error.message

    });

}

    }
);


module.exports = router;