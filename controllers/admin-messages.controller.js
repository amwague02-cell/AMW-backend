"use strict";

const pool = require("../config/db");


// =====================================================
// GET ALL ADMIN MESSAGES
// GET /api/admin/messages
// =====================================================

async function getAdminMessages(req, res) {

    try {

        const result = await pool.query(`
            
            SELECT
                'contact' AS type,

                'contact-' || c.id AS id,

                c.id AS source_id,

                c.first_name,
                c.last_name,
                c.email,
                c.phone,

                c.subject,
                c.message,

                c.status,

                c.created_at,

                c.replied_at,
                c.admin_reply,

                NULL::INTEGER AS product_id,
                NULL::TEXT AS product_name,
                NULL::TEXT AS product_reference

            FROM contact_messages c


            UNION ALL


            SELECT

                'negotiation' AS type,

                'negotiation-' || n.id AS id,

                n.id AS source_id,

                u.first_name,
                u.last_name,
                u.email,
                u.phone,

                'Négociation en quantité' AS subject,

                n.message,

                n.message_status AS status,

                n.created_at,

                n.replied_at,
                n.admin_reply,

                o.id AS product_id,
                o.product_name,
                o.reference AS product_reference

            FROM negotiation_requests n

            INNER JOIN users u
                ON u.id = n.user_id

            INNER JOIN offers o
                ON o.id = n.offer_id


            ORDER BY created_at DESC

        `);


        return res.json({

            success: true,

            messages: result.rows

        });


    } catch (error) {

        console.error(
            "❌ Admin messages error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Erreur lors du chargement des messages."

        });

    }

}


// =====================================================
// MARK AS READ
// PATCH /api/admin/messages/:id/read
// =====================================================

async function markMessageAsRead(req, res) {

    try {

        const { id } = req.params;


        // CONTACT

        if (id.startsWith("contact-")) {

            const sourceId =
                id.replace("contact-", "");


            await pool.query(
                `
                UPDATE contact_messages

                SET status = 'read'

                WHERE id = $1
                `,
                [sourceId]
            );

        }


        // NEGOTIATION

        else if (id.startsWith("negotiation-")) {

            const sourceId =
                id.replace("negotiation-", "");


            await pool.query(
                `
                UPDATE negotiation_requests

                SET message_status = 'read'

                WHERE id = $1
                `,
                [sourceId]
            );

        }


        return res.json({

            success: true,

            message:
                "Message marqué comme lu."

        });


    } catch (error) {

        console.error(
            "❌ Mark message read error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la mise à jour."

        });

    }

}


// =====================================================
// MARK AS REPLIED
// PATCH /api/admin/messages/:id/reply
// =====================================================

async function markMessageAsReplied(req, res) {

    try {

        const { id } = req.params;

        const {
            reply,
            channel
        } = req.body;


        // CONTACT

        if (id.startsWith("contact-")) {

            const sourceId =
                id.replace("contact-", "");


            await pool.query(
                `
                UPDATE contact_messages

                SET
                    status = 'replied',
                    admin_reply = $1,
                    replied_at = CURRENT_TIMESTAMP

                WHERE id = $2
                `,
                [
                    reply || null,
                    sourceId
                ]
            );

        }


        // NEGOTIATION

        else if (id.startsWith("negotiation-")) {

            const sourceId =
                id.replace("negotiation-", "");


            await pool.query(
                `
                UPDATE negotiation_requests

                SET
                    message_status = 'replied',
                    admin_reply = $1,
                    replied_at = CURRENT_TIMESTAMP

                WHERE id = $2
                `,
                [
                    reply || null,
                    sourceId
                ]
            );

        }


        return res.json({

            success: true,

            message:
                "Réponse enregistrée.",

            channel:
                channel || null

        });


    } catch (error) {

        console.error(
            "❌ Reply message error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'enregistrement de la réponse."

        });

    }

}


// =====================================================
// DELETE MESSAGE
// DELETE /api/admin/messages/:id
// =====================================================

async function deleteAdminMessage(req, res) {

    try {

        const { id } = req.params;


        // CONTACT

        if (id.startsWith("contact-")) {

            const sourceId =
                id.replace("contact-", "");


            await pool.query(
                `
                DELETE FROM contact_messages
                WHERE id = $1
                `,
                [sourceId]
            );

        }


        // NEGOTIATION

        else if (id.startsWith("negotiation-")) {

            const sourceId =
                id.replace("negotiation-", "");


            await pool.query(
                `
                DELETE FROM negotiation_requests
                WHERE id = $1
                `,
                [sourceId]
            );

        }


        return res.json({

            success: true,

            message:
                "Message supprimé."

        });


    } catch (error) {

        console.error(
            "❌ Delete message error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la suppression."

        });

    }

}


module.exports = {

    getAdminMessages,

    markMessageAsRead,

    markMessageAsReplied,

    deleteAdminMessage

};