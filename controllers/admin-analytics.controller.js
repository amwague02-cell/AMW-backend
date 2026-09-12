"use strict";

const pool = require("../config/db");


/* =========================================================
   HELPERS
========================================================= */

function normalizeDays(value) {

    const days =
        Number(value) || 30;

    return Math.min(
        Math.max(days, 7),
        365
    );
}


/* =========================================================
   MAIN ANALYTICS
========================================================= */

exports.getAnalytics = async (req, res) => {

    try {

        const days =
            normalizeDays(
                req.query.period
            );


        /* =================================================
           DATE RANGES
        ================================================== */

        /*
         * Current period:
         * today - days + 1
         *
         * Previous period:
         * same number of days immediately before it.
         */

        const periodStartQuery = `
            CURRENT_DATE
            - ($1 - 1) * INTERVAL '1 day'
        `;

        const previousStartQuery = `
            CURRENT_DATE
            - ($1 * 2 - 1) * INTERVAL '1 day'
        `;


        /* =================================================
           OVERVIEW
        ================================================== */

        const overviewResult =
            await pool.query(
                `
                SELECT

                    /* ===============================
                       REVENUE
                    ================================ */

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    o.created_at >=
                                    ${periodStartQuery}
                                AND
                                    o.created_at < CURRENT_DATE + INTERVAL '1 day'
                                AND
                                    LOWER(
                                        COALESCE(
                                            o.status,
                                            ''
                                        )
                                    ) != 'cancelled'
                                THEN o.total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS revenue,


                    /* ===============================
                       ORDERS
                    ================================ */

                    COUNT(
                        CASE
                            WHEN
                                o.created_at >=
                                ${periodStartQuery}
                            AND
                                o.created_at < CURRENT_DATE + INTERVAL '1 day'
                            THEN 1
                        END
                    ) AS orders,


                    /* ===============================
                       CANCELLED ORDERS
                    ================================ */

                    COUNT(
                        CASE
                            WHEN
                                o.created_at >=
                                ${periodStartQuery}
                            AND
                                o.created_at < CURRENT_DATE + INTERVAL '1 day'
                            AND
                                LOWER(
                                    COALESCE(
                                        o.status,
                                        ''
                                    )
                                ) = 'cancelled'
                            THEN 1
                        END
                    ) AS cancelled_orders,


                    /* ===============================
                       DELIVERED
                    ================================ */

                    COUNT(
                        CASE
                            WHEN
                                o.created_at >=
                                ${periodStartQuery}
                            AND
                                LOWER(
                                    COALESCE(
                                        o.status,
                                        ''
                                    )
                                ) IN (
                                    'delivered',
                                    'livree',
                                    'livré',
                                    'completed',
                                    'complete'
                                )
                            THEN 1
                        END
                    ) AS delivered_orders,


                    /* ===============================
                       SHIPPING
                    ================================ */

                    COUNT(
                        CASE
                            WHEN
                                o.created_at >=
                                ${periodStartQuery}
                            AND
                                LOWER(
                                    COALESCE(
                                        o.status,
                                        ''
                                    )
                                ) IN (
                                    'shipping',
                                    'shipped',
                                    'in_delivery',
                                    'in delivery',
                                    'transit',
                                    'en_livraison',
                                    'en livraison'
                                )
                            THEN 1
                        END
                    ) AS shipping_orders,


                    /* ===============================
                       FAILED DELIVERY
                    ================================ */

                    COUNT(
                        CASE
                            WHEN
                                o.created_at >=
                                ${periodStartQuery}
                            AND
                                LOWER(
                                    COALESCE(
                                        o.status,
                                        ''
                                    )
                                ) IN (
                                    'failed',
                                    'delivery_failed',
                                    'non_livree',
                                    'non livrée',
                                    'undelivered'
                                )
                            THEN 1
                        END
                    ) AS failed_orders


                FROM orders o
                `,
                [days]
            );


        const stats =
            overviewResult.rows[0] || {};


        /* =================================================
           PREVIOUS PERIOD
        ================================================== */

        const previousResult =
            await pool.query(
                `
                SELECT

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    created_at >=
                                    ${previousStartQuery}
                                AND
                                    created_at <
                                    ${periodStartQuery}
                                AND
                                    LOWER(
                                        COALESCE(
                                            status,
                                            ''
                                        )
                                    ) != 'cancelled'
                                THEN total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS revenue,


                    COUNT(
                        CASE
                            WHEN
                                created_at >=
                                ${previousStartQuery}
                            AND
                                created_at <
                                ${periodStartQuery}
                            THEN 1
                        END
                    ) AS orders,


                    COUNT(
                        CASE
                            WHEN
                                created_at >=
                                ${previousStartQuery}
                            AND
                                created_at <
                                ${periodStartQuery}
                            AND
                                LOWER(
                                    COALESCE(
                                        status,
                                        ''
                                    )
                                ) = 'cancelled'
                            THEN 1
                        END
                    ) AS cancelled_orders

                FROM orders
                `,
                [days]
            );


        const previous =
            previousResult.rows[0] || {};


        /* =================================================
           USERS
        ================================================== */

        const usersResult =
            await pool.query(
                `
                SELECT

                    COUNT(*) FILTER (
                        WHERE
                            created_at >=
                            ${periodStartQuery}
                    ) AS new_users,

                    COUNT(*) AS total_users

                FROM users
                `,
                [days]
            );


        const userStats =
            usersResult.rows[0] || {};


        /* =================================================
           PRODUCTS / OFFERS
        ================================================== */

        const offersResult =
            await pool.query(
                `
                SELECT

                    COUNT(*) FILTER (
                        WHERE
                            created_at >=
                            ${periodStartQuery}
                    ) AS products_added,

                    COUNT(*) FILTER (
                        WHERE
                            created_at >=
                            ${periodStartQuery}
                        AND
                            LOWER(
                                COALESCE(
                                    status,
                                    ''
                                )
                            ) IN (
                                'cancelled',
                                'cancelled_offer',
                                'deleted',
                                'inactive'
                            )
                    ) AS offers_cancelled

                FROM offers
                `,
                [days]
            );


        const offerStats =
            offersResult.rows[0] || {};


        /* =================================================
           ITEMS SOLD
        ================================================== */

        /*
         * A.M.W currently stores quantities inside
         * cart_items. If an order_items table exists,
         * we use it.
         *
         * Otherwise we safely return 0 instead of
         * inventing quantities.
         */

        let itemsSold = 0;


        const orderItemsCheck =
            await pool.query(
                `
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'order_items'
                ) AS exists
                `
            );


        if (
            orderItemsCheck.rows[0]?.exists
        ) {

            const itemsResult =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(
                                oi.quantity
                            ),
                            0
                        ) AS items_sold

                    FROM order_items oi

                    INNER JOIN orders o
                        ON o.id = oi.order_id

                    WHERE
                        o.created_at >=
                        ${periodStartQuery}

                    AND
                        LOWER(
                            COALESCE(
                                o.status,
                                ''
                            )
                        ) != 'cancelled'
                    `,
                    [days]
                );


            itemsSold =
                Number(
                    itemsResult.rows[0]
                        ?.items_sold || 0
                );

        }


        /* =================================================
           TIMELINE
        ================================================== */

        const timelineResult =
            await pool.query(
                `
                WITH dates AS (

                    SELECT generate_series(
                        CURRENT_DATE
                        - ($1 - 1) * INTERVAL '1 day',

                        CURRENT_DATE,

                        INTERVAL '1 day'

                    )::date AS date

                ),

                daily_orders AS (

                    SELECT

                        DATE(
                            created_at
                        ) AS date,

                        COUNT(*) AS orders,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN
                                        LOWER(
                                            COALESCE(
                                                status,
                                                ''
                                            )
                                        ) !=
                                        'cancelled'
                                    THEN total
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS revenue,

                        COUNT(
                            CASE
                                WHEN
                                    LOWER(
                                        COALESCE(
                                            status,
                                            ''
                                        )
                                    ) = 'cancelled'
                                THEN 1
                            END
                        ) AS cancelled_orders,

                        COUNT(
                            CASE
                                WHEN
                                    LOWER(
                                        COALESCE(
                                            status,
                                            ''
                                        )
                                    ) IN (
                                        'delivered',
                                        'livree',
                                        'livré',
                                        'completed',
                                        'complete'
                                    )
                                THEN 1
                            END
                        ) AS delivered_orders,

                        COUNT(
                            CASE
                                WHEN
                                    LOWER(
                                        COALESCE(
                                            status,
                                            ''
                                        )
                                    ) IN (
                                        'shipping',
                                        'shipped',
                                        'in_delivery',
                                        'in delivery',
                                        'transit',
                                        'en_livraison',
                                        'en livraison'
                                    )
                                THEN 1
                            END
                        ) AS shipping_orders

                    FROM orders

                    WHERE
                        created_at >=
                        CURRENT_DATE
                        - ($1 - 1) * INTERVAL '1 day'

                    GROUP BY
                        DATE(created_at)

                )

                SELECT

                    dates.date,

                    COALESCE(
                        daily_orders.orders,
                        0
                    ) AS orders,

                    COALESCE(
                        daily_orders.revenue,
                        0
                    ) AS revenue,

                    COALESCE(
                        daily_orders.cancelled_orders,
                        0
                    ) AS cancelled_orders,

                    COALESCE(
                        daily_orders.delivered_orders,
                        0
                    ) AS delivered_orders,

                    COALESCE(
                        daily_orders.shipping_orders,
                        0
                    ) AS shipping_orders

                FROM dates

                LEFT JOIN daily_orders
                    ON daily_orders.date =
                       dates.date

                ORDER BY
                    dates.date ASC
                `,
                [days]
            );


        const timeline =
            timelineResult.rows.map(
                row => ({

                    date:
                        row.date,

                    orders:
                        Number(
                            row.orders || 0
                        ),

                    revenue:
                        Number(
                            row.revenue || 0
                        ),

                    cancelledOrders:
                        Number(
                            row.cancelled_orders || 0
                        ),

                    deliveredOrders:
                        Number(
                            row.delivered_orders || 0
                        ),

                    shippingOrders:
                        Number(
                            row.shipping_orders || 0
                        ),

                    /*
                     * These remain 0 until the
                     * appropriate analytics/order_items
                     * source exists.
                     */

                    productsAdded:
                        0,

                    itemsSold:
                        0,

                    visitors:
                        0,

                    newUsers:
                        0,

                    activeUsers:
                        0,

                    offersCancelled:
                        0

                })
            );


        /* =================================================
           DAILY NEW USERS
        ================================================== */

        const dailyUsersResult =
            await pool.query(
                `
                SELECT

                    DATE(
                        created_at
                    ) AS date,

                    COUNT(*) AS users

                FROM users

                WHERE
                    created_at >=
                    CURRENT_DATE
                    - ($1 - 1) * INTERVAL '1 day'

                GROUP BY
                    DATE(created_at)

                ORDER BY
                    date ASC
                `,
                [days]
            );


        const usersByDate =
            new Map(
                dailyUsersResult.rows.map(
                    row => [
                        String(row.date),
                        Number(
                            row.users || 0
                        )
                    ]
                )
            );


        timeline.forEach(
            item => {

                item.newUsers =
                    usersByDate.get(
                        String(item.date)
                    ) || 0;

            }
        );


        /* =================================================
           CATEGORY PERFORMANCE
        ================================================== */

        let categories = [];


        const categoryCheck =
            await pool.query(
                `
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE
                        table_name = 'offers'
                    AND
                        column_name = 'category_id'
                ) AS exists
                `
            );


        if (
            categoryCheck.rows[0]?.exists
        ) {

            const categoryResult =
                await pool.query(
                    `
                    SELECT

                        COALESCE(
                            c.name,
                            'Sans catégorie'
                        ) AS name,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN
                                        LOWER(
                                            COALESCE(
                                                o.status,
                                                ''
                                            )
                                        ) !=
                                        'cancelled'
                                    THEN
                                        o.price
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS revenue,

                        COUNT(o.id) AS offers

                    FROM offers o

                    LEFT JOIN categories c
                        ON c.id =
                           o.category_id

                    GROUP BY
                        c.name

                    ORDER BY
                        revenue DESC

                    LIMIT 10
                    `
                );


            categories =
                categoryResult.rows.map(
                    row => ({

                        name:
                            row.name,

                        revenue:
                            Number(
                                row.revenue || 0
                            ),

                        offers:
                            Number(
                                row.offers || 0
                            )

                    })
                );

        }


        /* =================================================
           DELIVERY SUMMARY
        ================================================== */

        const deliveryResult =
            await pool.query(
                `
                SELECT

                    COUNT(
                        CASE
                            WHEN LOWER(
                                COALESCE(
                                    status,
                                    ''
                                )
                            ) IN (
                                'delivered',
                                'livree',
                                'livré',
                                'completed',
                                'complete'
                            )
                            THEN 1
                        END
                    ) AS delivered,

                    COUNT(
                        CASE
                            WHEN LOWER(
                                COALESCE(
                                    status,
                                    ''
                                )
                            ) IN (
                                'shipping',
                                'shipped',
                                'in_delivery',
                                'in delivery',
                                'transit',
                                'en_livraison',
                                'en livraison'
                            )
                            THEN 1
                        END
                    ) AS shipping,

                    COUNT(
                        CASE
                            WHEN LOWER(
                                COALESCE(
                                    status,
                                    ''
                                )
                            ) IN (
                                'pending',
                                'processing',
                                'confirmed',
                                'en_attente',
                                'en attente'
                            )
                            THEN 1
                        END
                    ) AS pending,

                    COUNT(
                        CASE
                            WHEN LOWER(
                                COALESCE(
                                    status,
                                    ''
                                )
                            ) IN (
                                'failed',
                                'delivery_failed',
                                'non_livree',
                                'non livrée',
                                'undelivered'
                            )
                            THEN 1
                        END
                    ) AS failed,

                    COUNT(
                        CASE
                            WHEN LOWER(
                                COALESCE(
                                    status,
                                    ''
                                )
                            ) = 'cancelled'
                            THEN 1
                        END
                    ) AS cancelled

                FROM orders

                WHERE
                    created_at >=
                    ${periodStartQuery}
                `,
                [days]
            );


        const delivery =
            deliveryResult.rows[0] || {};


        const deliveryTotal =
            Number(
                delivery.delivered || 0
            )
            +
            Number(
                delivery.shipping || 0
            )
            +
            Number(
                delivery.pending || 0
            )
            +
            Number(
                delivery.failed || 0
            );


        const deliveryRate =
            deliveryTotal > 0
                ? (
                    Number(
                        delivery.delivered || 0
                    )
                    /
                    deliveryTotal
                ) * 100
                : 0;


        /* =================================================
           RECENT ORDERS
        ================================================== */

        const recentOrdersResult =
            await pool.query(
                `
                SELECT

                    id,
                    reference,
                    first_name,
                    last_name,
                    total,
                    status,
                    created_at

                FROM orders

                ORDER BY
                    created_at DESC

                LIMIT 12
                `
            );


        const recentOrders =
            recentOrdersResult.rows.map(
                order => ({

                    id:
                        order.id,

                    reference:
                        order.reference ||
                        order.id,

                    customer:
                        [
                            order.first_name,
                            order.last_name
                        ]
                        .filter(Boolean)
                        .join(" ")
                        ||
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


        /* =================================================
           FINAL METRICS
        ================================================== */

        const revenue =
            Number(
                stats.revenue || 0
            );


        const orders =
            Number(
                stats.orders || 0
            );


        const averageOrder =
            orders > 0
                ? revenue / orders
                : 0;


        const averageDailyRevenue =
            days > 0
                ? revenue / days
                : 0;


        const users =
            Number(
                userStats.total_users || 0
            );


        const newUsers =
            Number(
                userStats.new_users || 0
            );


        /*
         * Visitors are intentionally NOT invented.
         * There is currently no analytics/visits table.
         */

        const conversionRate =
            0;


        /* =================================================
           RESPONSE
        ================================================== */

        res.json({

            success: true,

            period: {
                days
            },


            overview: {

                revenue,

                orders,

                users,

                newUsers,

                itemsSold,

                productsAdded:
                    Number(
                        offerStats.products_added || 0
                    ),

                offersCancelled:
                    Number(
                        offerStats.offers_cancelled || 0
                    ),

                cancelledOrders:
                    Number(
                        stats.cancelled_orders || 0
                    ),

                deliveredOrders:
                    Number(
                        stats.delivered_orders || 0
                    ),

                shippingOrders:
                    Number(
                        stats.shipping_orders || 0
                    ),

                failedOrders:
                    Number(
                        stats.failed_orders || 0
                    ),

                averageOrder,

                averageDailyRevenue,

                conversionRate,

                deliveryRate

            },


            previous: {

                revenue:
                    Number(
                        previous.revenue || 0
                    ),

                orders:
                    Number(
                        previous.orders || 0
                    ),

                users: 0,

                itemsSold: 0,

                productsAdded: 0,

                offersCancelled:
                    Number(
                        previous.cancelled_orders || 0
                    )

            },


            timeline,


            delivery: {

                delivered:
                    Number(
                        delivery.delivered || 0
                    ),

                shipping:
                    Number(
                        delivery.shipping || 0
                    ),

                pending:
                    Number(
                        delivery.pending || 0
                    ),

                failed:
                    Number(
                        delivery.failed || 0
                    ),

                cancelled:
                    Number(
                        delivery.cancelled || 0
                    ),

                rate:
                    deliveryRate

            },


            categories,


            recentOrders

        });

    }

    catch (error) {

        console.error(
            "ADMIN ANALYTICS ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur lors du chargement des statistiques.",

            error:
                error.message

        });

    }

};