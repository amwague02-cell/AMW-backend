"use strict";

const jwt = require("jsonwebtoken");
const pool = require("../config/db");


// =====================================================
// CREATE NEGOTIATION REQUEST
// =====================================================

async function createNegotiation(req, res) {

    try {

        // =================================================
        // AUTHENTICATION
        // =================================================

        // =================================================
// OPTIONAL AUTHENTICATION
// =================================================

let userId = null;

const authHeader = req.headers.authorization;

if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        userId = decoded.id || null;

    } catch (error) {
        // Un visiteur peut envoyer une demande sans compte.
        // Un jeton invalide ne bloque pas la demande.
        userId = null;
    }
}


        // =================================================
        // DATA
        // =================================================

        const {
            offerId,
            quantity,
            message,
            firstName,
            lastName,
            phone,
            email
        } = req.body;


        const parsedQuantity =
            Number(quantity);


        if (
            !offerId ||
            !Number.isInteger(parsedQuantity) ||
            parsedQuantity < 51
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "La quantité minimale pour une négociation est de 51 unités."
            });

        }


        if (
            typeof message !== "string" ||
            !message.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Veuillez écrire votre demande."
            });

        }


        // =====================================================
        // CHECK USER — OPTIONAL
        // =====================================================

        if (userId) {

            const userResult = await pool.query(
                `
                SELECT id
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [userId]
            );

            if (userResult.rows.length === 0) {
                userId = null;
            }

        }
        // =================================================
        // CHECK OFFER
        // =================================================

        const offerResult =
            await pool.query(
                `
                SELECT
                    id,
                    reference,
                    product_name,
                    status,
                    quantity
                FROM offers
                WHERE id = $1
                LIMIT 1
                `,
                [offerId]
            );


        if (offerResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Offre introuvable."
            });

        }


        const offer =
            offerResult.rows[0];


        if (offer.status !== "active") {

            return res.status(400).json({
                success: false,
                message:
                    "Cette offre n'est plus disponible."
            });

        }


        // =================================================
        // INSERT NEGOTIATION
        // =================================================

        const result =
            await pool.query(
                `
                INSERT INTO negotiation_requests (
                    user_id,
                    offer_id,
                    quantity,
                    message,
                    first_name,
                    last_name,
                    phone,
                    email
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING
                    id,
                    user_id,
                    offer_id,
                    quantity,
                    message,
                    first_name,
                    last_name,
                    phone,
                    email,
                    status,
                    created_at
                `,
                [
                    userId,
                    offerId,
                    parsedQuantity,
                    message.trim(),
                    firstName.trim(),
                    lastName.trim(),
                    phone ? phone.trim() : null,
                    email.trim()
                ]
            );


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(201).json({

            success: true,

            message:
                "Votre demande de négociation a été envoyée avec succès.",

            negotiation:
                result.rows[0],

            offer: {
                id: offer.id,
                reference: offer.reference,
                product_name: offer.product_name
            }

        });

    }

    catch (error) {

        console.error(
            "❌ Create negotiation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Erreur lors de l'envoi de la demande."
        });

    }

}


module.exports = {
    createNegotiation
};