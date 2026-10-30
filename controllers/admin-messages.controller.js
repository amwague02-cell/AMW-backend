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

                CONCAT(c.first_name, ' ', c.last_name) AS name,

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

                NULL::BIGINT AS product_id,
                NULL::TEXT AS product_name,
                NULL::TEXT AS product_reference

            FROM contact_messages c


            UNION ALL


            SELECT

                'negotiation' AS type,

                'negotiation-' || n.id AS id,

                n.id AS source_id,

                COALESCE(
                    NULLIF(
                        CONCAT_WS(
                            ' ',
                            NULLIF(n.first_name, ''),
                            NULLIF(n.last_name, '')
                        ),
                        ''
                    ),
                    NULLIF(u.full_name, ''),
                    'Visiteur'
                ) AS name,

                COALESCE(
                    NULLIF(n.first_name, ''),
                    SPLIT_PART(COALESCE(u.full_name, ''), ' ', 1),
                    'Visiteur'
                ) AS first_name,

                COALESCE(
                    NULLIF(n.last_name, ''),
                    CASE
                        WHEN POSITION(' ' IN COALESCE(u.full_name, '')) > 0
                        THEN SUBSTRING(
                            u.full_name
                            FROM POSITION(' ' IN u.full_name) + 1
                        )
                        ELSE ''
                    END
                ) AS last_name,

                COALESCE(n.email, u.email) AS email,

                COALESCE(n.phone, u.phone) AS phone,

                'Négociation en quantité' AS subject,

                n.message,

                n.status,

                n.created_at,

                n.replied_at,
                n.admin_reply,

                o.id AS product_id,
                o.product_name,
                o.reference AS product_reference

            FROM negotiation_requests n

            LEFT JOIN users u
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
// MARK MESSAGE AS READ
// =====================================================

async function markMessageAsRead(req, res) {

    try {

        const { id } = req.params;

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

        } else if (id.startsWith("negotiation-")) {

            const sourceId =
                id.replace("negotiation-", "");

            await pool.query(
                `
                UPDATE negotiation_requests
                SET status = 'read'
                WHERE id = $1
                `,
                [sourceId]
            );

        } else {

            return res.status(400).json({
                success: false,
                message: "Identifiant invalide."
            });

        }

        return res.json({
            success: true,
            message: "Message marqué comme lu."
        });

    } catch (error) {

        console.error(
            "❌ Mark message read error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la mise à jour."
        });

    }

}

// =====================================================
// MARK MESSAGE AS REPLIED
// =====================================================

async function markMessageAsReplied(req, res) {

    try {

        const { id } = req.params;

        const { reply, channel } = req.body;

        if (
            typeof reply !== "string" ||
            !reply.trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Réponse vide."
            });

        }

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
                [reply.trim(), sourceId]
            );

        } else if (id.startsWith("negotiation-")) {

            const sourceId =
                id.replace("negotiation-", "");

            await pool.query(
                `
                UPDATE negotiation_requests
                SET
                    status = 'replied',
                    admin_reply = $1,
                    replied_at = CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [reply.trim(), sourceId]
            );

        } else {

            return res.status(400).json({
                success: false,
                message: "Identifiant invalide."
            });

        }

        return res.json({

            success: true,

            message: "Réponse enregistrée.",

            channel: channel || null

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
// =====================================================

async function deleteAdminMessage(req, res) {

    try {

        const { id } = req.params;


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


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    getAdminMessages,

    markMessageAsRead,

    markMessageAsReplied,

    deleteAdminMessage

};