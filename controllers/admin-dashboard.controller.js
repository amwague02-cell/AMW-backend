"use strict";

const pool = require("../config/db");


/* =====================================================
   GET DASHBOARD ACTIVITY
===================================================== */

exports.getDashboardActivity = async (req, res) => {

    try {

        const days =
            Math.min(
                Math.max(
                    Number(req.query.days) || 30,
                    1
                ),
                90
            );


        const result =
            await pool.query(
                `
                WITH dates AS (

                    SELECT generate_series(
                        CURRENT_DATE - ($1 - 1) * INTERVAL '1 day',
                        CURRENT_DATE,
                        INTERVAL '1 day'
                    )::date AS date

                ),

                daily_orders AS (

                    SELECT
                        DATE(created_at) AS date,

                        COUNT(*) AS orders,

                        COALESCE(
                            SUM(total),
                            0
                        ) AS revenue

                    FROM orders

                    WHERE
                        created_at >=
                        CURRENT_DATE -
                        ($1 - 1) * INTERVAL '1 day'

                        AND status != 'cancelled'

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
                    ) AS revenue

                FROM dates

                LEFT JOIN daily_orders
                    ON daily_orders.date =
                       dates.date

                ORDER BY
                    dates.date ASC
                `,
                [days]
            );


        res.json({

            success: true,

            activity:
                result.rows.map(row => ({

                    date:
                        row.date,

                    orders:
                        Number(
                            row.orders || 0
                        ),

                    revenue:
                        Number(
                            row.revenue || 0
                        )

                }))

        });


    } catch (error) {

        console.error(
            "ADMIN DASHBOARD ACTIVITY ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur lors du chargement de l'activité.",

            error:
                error.message

        });

    }

};