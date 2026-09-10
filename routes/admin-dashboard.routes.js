"use strict";

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const requireAdmin = require("../middleware/admin-auth");


/* =====================================================
   ADMIN DASHBOARD
   GET /api/admin/dashboard
===================================================== */

router.get(
    "/",
    requireAdmin,
    async (req, res) => {

        try {

            /* =================================================
               1. BASIC COUNTS
            ================================================= */

            const usersResult = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM users
            `);


            const offersResult = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM offers
            `);


            const activeOffersResult = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM offers
                WHERE
                    status IS NULL
                    OR status IN ('active', 'published')
            `);


            const ordersResult = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM orders
                WHERE status <> 'cancelled'
            `);


            /* =================================================
               2. REVENUE
               
               Revenue = all non-cancelled orders
            ================================================= */

            const revenueResult = await pool.query(`
                SELECT
                    COALESCE(
                        SUM(total),
                        0
                    )::numeric AS total
                FROM orders
                WHERE status <> 'cancelled'
            `);


            /* =================================================
               3. CURRENT / PREVIOUS 30 DAYS
            ================================================= */

            const currentPeriodResult = await pool.query(`
                SELECT
                    COALESCE(SUM(total), 0)::numeric AS revenue,
                    COUNT(*)::int AS orders
                FROM orders
                WHERE
                    status <> 'cancelled'
                    AND created_at >= NOW() - INTERVAL '30 days'
            `);


            const previousPeriodResult = await pool.query(`
                SELECT
                    COALESCE(SUM(total), 0)::numeric AS revenue,
                    COUNT(*)::int AS orders
                FROM orders
                WHERE
                    status <> 'cancelled'
                    AND created_at >= NOW() - INTERVAL '60 days'
                    AND created_at < NOW() - INTERVAL '30 days'
            `);


            /* =================================================
               4. USER GROWTH
            ================================================= */

            const currentUsersResult = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM users
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `);


            const previousUsersResult = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM users
                WHERE
                    created_at >= NOW() - INTERVAL '60 days'
                    AND created_at < NOW() - INTERVAL '30 days'
            `);


            /* =================================================
               5. GROWTH CALCULATION
            ================================================= */

            const currentRevenue =
                Number(
                    currentPeriodResult.rows[0].revenue
                );


            const previousRevenue =
                Number(
                    previousPeriodResult.rows[0].revenue
                );


            const currentOrders =
                Number(
                    currentPeriodResult.rows[0].orders
                );


            const previousOrders =
                Number(
                    previousPeriodResult.rows[0].orders
                );


            const currentUsers =
                Number(
                    currentUsersResult.rows[0].total
                );


            const previousUsers =
                Number(
                    previousUsersResult.rows[0].total
                );


            function calculateGrowth(
                current,
                previous
            ) {

                if (previous === 0) {

                    if (current === 0) {
                        return 0;
                    }

                    return 100;
                }


                return Number(
                    (
                        (
                            (current - previous) /
                            previous
                        ) * 100
                    ).toFixed(1)
                );

            }


            const revenueGrowth =
                calculateGrowth(
                    currentRevenue,
                    previousRevenue
                );


            const ordersGrowth =
                calculateGrowth(
                    currentOrders,
                    previousOrders
                );


            const usersGrowth =
                calculateGrowth(
                    currentUsers,
                    previousUsers
                );


            /* =================================================
               6. DAILY CHART - LAST 30 DAYS
            ================================================= */

            const chartResult = await pool.query(`
                WITH days AS (

                    SELECT
                        generate_series(
                            CURRENT_DATE - INTERVAL '29 days',
                            CURRENT_DATE,
                            INTERVAL '1 day'
                        )::date AS day

                )

                SELECT

                    days.day,

                    COALESCE(
                        COUNT(
                            CASE
                                WHEN orders.status <> 'cancelled'
                                THEN orders.id
                            END
                        ),
                        0
                    )::int AS orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN orders.status <> 'cancelled'
                                THEN orders.total
                                ELSE 0
                            END
                        ),
                        0
                    )::numeric AS revenue

                FROM days

                LEFT JOIN orders
                    ON DATE(orders.created_at) = days.day

                GROUP BY days.day

                ORDER BY days.day ASC
            `);


            /* =================================================
               7. CATEGORIES
            ================================================= */

            const categoriesResult = await pool.query(`
                SELECT
                    c.id,
                    c.name,
                    COUNT(o.id)::int AS offers
                FROM categories c

                LEFT JOIN offers o
                    ON o.category_id = c.id

                GROUP BY
                    c.id,
                    c.name

                ORDER BY offers DESC
            `);


            /* =================================================
               8. RECENT ORDERS
            ================================================= */

            const recentOrdersResult = await pool.query(`
                SELECT

                    o.id,
                    o.reference,
                    o.first_name,
                    o.last_name,
                    o.phone,
                    o.email,
                    o.total,
                    o.status,
                    o.payment_method,
                    o.delivery_method,
                    o.created_at

                FROM orders o

                ORDER BY o.created_at DESC

                LIMIT 10
            `);


            /* =================================================
               9. RECENT USERS
            ================================================= */

            const recentUsersResult = await pool.query(`
                SELECT

                    id,
                    full_name,
                    phone,
                    email,
                    role,
                    profile_image,
                    is_active,
                    created_at

                FROM users

                ORDER BY created_at DESC

                LIMIT 10
            `);


            /* =================================================
               10. STOCK
            ================================================= */

            let totalStock = 0;

            try {

                const stockResult = await pool.query(`
                    SELECT
                        COALESCE(
                            SUM(quantity),
                            0
                        )::int AS total
                    FROM offers
                `);

                totalStock =
                    Number(
                        stockResult.rows[0].total
                    );

            }

            catch (stockError) {

                console.warn(
                    "STOCK QUERY WARNING:",
                    stockError.message
                );

                totalStock = 0;

            }


            /* =================================================
               11. RESPONSE
            ================================================= */

            return res.json({

                success: true,

                stats: {

                    /* BASIC */

                    users:
                        Number(
                            usersResult.rows[0].total
                        ),

                    offers:
                        Number(
                            offersResult.rows[0].total
                        ),

                    activeOffers:
                        Number(
                            activeOffersResult.rows[0].total
                        ),

                    orders:
                        Number(
                            ordersResult.rows[0].total
                        ),

                    revenue:
                        Number(
                            revenueResult.rows[0].total
                        ),

                    totalStock,


                    /* GROWTH */

                    revenueGrowth,

                    ordersGrowth,

                    usersGrowth,


                    /* CHART */

                    chart:
                        chartResult.rows.map(row => ({

                            date:
                                row.day,

                            orders:
                                Number(row.orders),

                            revenue:
                                Number(row.revenue)

                        })),


                    /* CATEGORIES */

                    categories:
                        categoriesResult.rows.map(row => ({

                            id:
                                Number(row.id),

                            name:
                                row.name,

                            offers:
                                Number(row.offers)

                        })),


                    /* ORDERS */

                    ordersList:
                        recentOrdersResult.rows.map(order => ({

                            id:
                                Number(order.id),

                            reference:
                                order.reference,

                            customer:
                                `${order.first_name || ""} ${order.last_name || ""}`.trim(),

                            phone:
                                order.phone,

                            email:
                                order.email,

                            total:
                                Number(order.total),

                            status:
                                order.status,

                            payment:
                                order.payment_method,

                            delivery:
                                order.delivery_method,

                            created_at:
                                order.created_at

                        })),


                    /* USERS */

                    usersList:
                        recentUsersResult.rows.map(user => ({

                            id:
                                Number(user.id),

                            full_name:
                                user.full_name,

                            phone:
                                user.phone,

                            email:
                                user.email,

                            role:
                                user.role,

                            profile_image:
                                user.profile_image,

                            is_active:
                                user.is_active,

                            created_at:
                                user.created_at

                        }))

                }

            });

        }


        catch (error) {

            console.error(
                "ADMIN DASHBOARD ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de charger les données du tableau de bord.",

                error:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined

            });

        }

    }
);


module.exports = router;