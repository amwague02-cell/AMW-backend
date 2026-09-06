const express = require("express");
const router = express.Router();

const pool = require("../config/db");


// =====================================================
// POST /api/contact
// =====================================================

router.post("/", async (req, res) => {

    try {

        const {
            firstName,
            lastName,
            email,
            phone,
            subject,
            message
        } = req.body;


        // =================================================
        // VALIDATION
        // =================================================

        if (
            !firstName ||
            !lastName ||
            !email ||
            !subject ||
            !message
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Tous les champs obligatoires doivent être remplis."
            });

        }


        // =================================================
        // NOM COMPLET
        // =================================================

        const fullName =
            `${firstName} ${lastName}`.trim();


        // =================================================
        // ENREGISTREMENT POSTGRESQL
        // =================================================

        const result = await pool.query(
            `
            INSERT INTO contact_messages
            (
                name,
                email,
                phone,
                subject,
                message
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                fullName,
                email,
                phone ,
                subject,
                message
            ]
        );


        // =================================================
        // RESPONSE
        // =================================================

        res.status(201).json({

            success: true,

            message:
                "Votre message a bien été envoyé.",

            data:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "❌ Contact message error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur serveur lors de l'envoi du message."

        });

    }

});


module.exports = router;