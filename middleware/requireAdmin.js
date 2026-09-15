"use strict";

const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function requireAdmin(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Authentification administrateur requise."
            });
        }

        const token =
            authHeader.split(" ")[1];

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    username,
                    full_name,
                    is_active
                FROM admin_users
                WHERE id = $1
                LIMIT 1
                `,
                [decoded.id]
            );

        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Administrateur introuvable."
            });

        }

        const admin =
            result.rows[0];

        if (!admin.is_active) {

            return res.status(403).json({
                success: false,
                message: "Compte administrateur désactivé."
            });

        }

        req.admin = admin;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Session administrateur invalide ou expirée."
        });

    }

}

module.exports = requireAdmin;