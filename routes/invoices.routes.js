"use strict";

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const requireAdmin = require("../middleware/admin-auth");


/* =========================================================
   CREATE INVOICE
========================================================= */

router.post("/", requireAdmin, async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            number,
            customer = {},
            products = [],
            subtotal = 0,
            discount = 0,
            total = 0,
            amountReceived = 0,
            change = 0,
            payment = "Espèces",
            note = ""
        } = req.body;


        if (!number) {

            return res.status(400).json({
                success: false,
                message: "Numéro de facture manquant."
            });

        }


        if (!Array.isArray(products) || products.length === 0) {

            return res.status(400).json({
                success: false,
                message: "La facture ne contient aucun produit."
            });

        }


        await client.query("BEGIN");


        /* =====================================================
           CHECK STOCK
        ===================================================== */

        const stockAlerts = [];


        for (const item of products) {

            const result = await client.query(
                `
                SELECT
                    id,
                    product_name,
                    quantity,
                    new_price
                FROM offers
                WHERE id = $1
                FOR UPDATE
                `,
                [item.offerId]
            );


            if (result.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({
                    success: false,
                    message: `Produit introuvable : ${item.name || item.offerId}`
                });

            }


            const offer = result.rows[0];


            const requested = Math.max(
                1,
                Number(item.quantity) || 1
            );


            const available = Math.max(
                0,
                Number(offer.quantity) || 0
            );


            if (requested > available) {

                const missing = requested - available;


                stockAlerts.push({

                    offerId: offer.id,

                    productName: offer.product_name,

                    requested,

                    available,

                    missing,

                    resolved: false

                });

            }

        }


        const hasStockAlert = stockAlerts.length > 0;


        /* =====================================================
           ADMIN NOTE
        ===================================================== */

        let adminNote = null;


        if (hasStockAlert) {

            adminNote = stockAlerts
                .map(alert => {

                    return (
                        `⚠️ Stock insuffisant — ` +
                        `${alert.productName} : ` +
                        `${alert.available} disponible(s), ` +
                        `${alert.requested} demandé(s), ` +
                        `manque ${alert.missing}. ` +
                        `Stock final : 0.`
                    );

                })
                .join("\n");

        }


        /* =====================================================
           INSERT INVOICE
        ===================================================== */

        const invoiceResult = await client.query(
            `
            INSERT INTO invoices (

                invoice_number,
                customer_name,
                customer_phone,
                customer_address,

                subtotal,
                discount,
                total,

                amount_received,
                change_amount,

                payment_method,

                note,
                admin_note,

                stock_status,
                stock_alerts,

                stock_alert_resolved,
                status

            )

            VALUES (
                $1,$2,$3,$4,
                $5,$6,$7,
                $8,$9,
                $10,
                $11,$12,
                $13,$14,
                $15,$16
            )

            RETURNING
                id,
                invoice_number,
                created_at
            `,
            [

                number,

                customer.name || null,
                customer.phone || null,
                customer.address || null,

                Number(subtotal) || 0,
                Number(discount) || 0,
                Number(total) || 0,

                Number(amountReceived) || 0,
                Number(change) || 0,

                payment || "Espèces",

                /*
                 * NOTE CLIENT
                 * Ne contient PAS le stock.
                 */
                note || null,

                /*
                 * NOTE ADMIN
                 */
                adminNote,

                hasStockAlert
                    ? "stock_insuffisant"
                    : "verified",

                JSON.stringify(stockAlerts),

                !hasStockAlert,

                "confirmed"

            ]
        );


        const invoice = invoiceResult.rows[0];


        /* =====================================================
           INSERT ITEMS
        ===================================================== */

        for (const item of products) {

            const quantity = Math.max(
                1,
                Number(item.quantity) || 1
            );


            const unitPrice = Math.max(
                0,
                Number(item.unitPrice) || 0
            );


            const totalPrice =
                unitPrice * quantity;


            await client.query(
                `
                INSERT INTO invoice_items (

                    invoice_id,
                    offer_id,
                    product_name,
                    quantity,
                    unit_price,
                    total_price

                )

                VALUES ($1,$2,$3,$4,$5,$6)
                `,
                [

                    invoice.id,

                    item.offerId,

                    item.name || "Produit",

                    quantity,

                    unitPrice,

                    totalPrice

                ]
            );

        }


        /* =====================================================
           UPDATE STOCK
           
           IMPORTANT:
           Même si le stock est insuffisant,
           on retire ce qui existe.
           
           Exemple:
           stock = 3
           demandé = 5

           résultat:
           stock = 0
           manque = 2
        ===================================================== */

        for (const item of products) {

            const quantity = Math.max(
                1,
                Number(item.quantity) || 1
            );


            await client.query(
                `
                UPDATE offers

                SET quantity =
                    GREATEST(quantity - $1, 0)

                WHERE id = $2
                `,
                [
                    quantity,
                    item.offerId
                ]
            );

        }


        await client.query("COMMIT");


        return res.status(201).json({

            success: true,

            message: hasStockAlert
                ? "Facture enregistrée avec avertissement de stock."
                : "Facture enregistrée et stock mis à jour.",

            invoice: {

                id: invoice.id,

                number: invoice.invoice_number,

                createdAt: invoice.created_at

            },

            stockStatus:
                hasStockAlert
                    ? "stock_insuffisant"
                    : "verified",

            stockAlerts,

            adminNote

        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "❌ CREATE INVOICE ERROR:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({

                success: false,

                message:
                    "Ce numéro de facture existe déjà."

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'enregistrement de la facture."

        });

    } finally {

        client.release();

    }

});


/* =========================================================
   GET ALL INVOICES
========================================================= */

router.get("/", requireAdmin, async (req, res) => {

    const client = await pool.connect();

    try {

        const invoicesResult = await client.query(
            `
            SELECT
                i.*,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ii.id,
                                'offerId', ii.offer_id,
                                'productName', ii.product_name,
                                'quantity', ii.quantity,
                                'unitPrice', ii.unit_price,
                                'totalPrice', ii.total_price,
                                'currentStock',
                                    COALESCE(o.quantity, 0)
                            )
                            ORDER BY ii.id ASC
                        )
                        FROM invoice_items ii
                        LEFT JOIN offers o
                            ON o.id = ii.offer_id
                        WHERE ii.invoice_id = i.id
                    ),
                    '[]'::json
                ) AS items

            FROM invoices i

            ORDER BY i.created_at DESC
            `
        );


        const invoices = invoicesResult.rows;


        /* =====================================================
           AUTOMATICALLY RESOLVE STOCK WARNINGS
        ===================================================== */

        for (const invoice of invoices) {

            if (
                invoice.stock_alert_resolved ||
                !Array.isArray(invoice.stock_alerts) ||
                invoice.stock_alerts.length === 0
            ) {
                continue;
            }


            let allResolved = true;


            for (const alert of invoice.stock_alerts) {

                const result = await client.query(
                    `
                    SELECT quantity
                    FROM offers
                    WHERE id = $1
                    `,
                    [alert.offerId]
                );


                if (result.rows.length === 0) {

                    allResolved = false;

                    continue;

                }


                const currentStock =
                    Number(result.rows[0].quantity) || 0;


                /*
                 * Le stock a été suffisamment réapprovisionné.
                 */

                if (currentStock < Number(alert.missing)) {

                    allResolved = false;

                }

            }


            if (allResolved) {

                const updatedAlerts =
                    invoice.stock_alerts.map(alert => ({

                        ...alert,

                        resolved: true

                    }));


                await client.query(
                    `
                    UPDATE invoices

                    SET

                        stock_alert_resolved = TRUE,

                        stock_alert_resolved_at =
                            CURRENT_TIMESTAMP,

                        stock_alerts = $1::jsonb

                    WHERE id = $2
                    `,
                    [
                        JSON.stringify(updatedAlerts),
                        invoice.id
                    ]
                );


                invoice.stock_alert_resolved = true;

                invoice.stock_alert_resolved_at =
                    new Date();

                invoice.stock_alerts =
                    updatedAlerts;

            }

        }


        return res.json({

            success: true,

            total: invoices.length,

            invoices

        });


    } catch (error) {

        console.error(
            "❌ GET INVOICES ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer les factures."

        });

    } finally {

        client.release();

    }

});


/* =========================================================
   GET INVOICE COUNT
========================================================= */

router.get("/count", requireAdmin, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM invoices
            `
        );


        res.json({

            success: true,

            total: result.rows[0].total

        });


    } catch (error) {

        console.error(
            "❌ INVOICE COUNT ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer le nombre de factures."

        });

    }

});


/* =========================================================
   GET ONE INVOICE
========================================================= */

router.get("/:id", requireAdmin, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                i.*,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ii.id,
                                'offerId', ii.offer_id,
                                'productName', ii.product_name,
                                'quantity', ii.quantity,
                                'unitPrice', ii.unit_price,
                                'totalPrice', ii.total_price
                            )
                            ORDER BY ii.id
                        )

                        FROM invoice_items ii

                        WHERE ii.invoice_id = i.id

                    ),
                    '[]'::json
                ) AS items

            FROM invoices i

            WHERE i.id = $1
            `,
            [req.params.id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Facture introuvable."

            });

        }


        res.json({

            success: true,

            invoice: result.rows[0]

        });


    } catch (error) {

        console.error(
            "❌ GET INVOICE ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer la facture."

        });

    }

});


module.exports = router;