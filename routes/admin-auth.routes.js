"use strict";

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

const pool = require("../config/db");


// =====================================================
// ADMIN LOGIN
// =====================================================

router.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Nom d'utilisateur et mot de passe requis."
            });

        }


        const result = await pool.query(
            `
            SELECT
                id,
                username,
                password_hash,
                full_name,
                is_active
            FROM admin_users
            WHERE username = $1
            LIMIT 1
            `,
            [username]
        );


        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Identifiants incorrects."
            });

        }


        const admin = result.rows[0];


        if (!admin.is_active) {

            return res.status(403).json({
                success: false,
                message: "Ce compte administrateur est désactivé."
            });

        }

        console.log("USERNAME:", JSON.stringify(username));
        console.log("DB USERNAME:", JSON.stringify(admin.username));
        console.log("HASH:", admin.password_hash);
        console.log("ACTIVE:", admin.is_active);

        const passwordValid = await bcrypt.compare(
            password,
            admin.password_hash
        );


        if (!passwordValid) {

            return res.status(401).json({
                success: false,
                message: "Identifiants incorrects."
            });

        }


        if (!process.env.JWT_SECRET) {

            console.error("❌ JWT_SECRET manquant.");

            return res.status(500).json({
                success: false,
                message: "Erreur de configuration du serveur."
            });

        }


        const token = jwt.sign(
            {
                id: admin.id,
                username: admin.username,
                role: "admin"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );


        await pool.query(
            `
            UPDATE admin_users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [admin.id]
        );


        return res.json({

            success: true,

            message: "Connexion administrateur réussie.",

            token,

            admin: {
                id: admin.id,
                username: admin.username,
                full_name: admin.full_name,
                role: "admin"
            }

        });

    }

    catch (error) {

        console.error("❌ Admin login error:", error);

        return res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });

    }

});


// =====================================================
// VERIFY ADMIN TOKEN
// =====================================================

router.get("/me", async (req, res) => {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {

            return res.status(401).json({
                success: false,
                message: "Non authentifié."
            });

        }


        const token = authHeader.split(" ")[1];


        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        if (decoded.role !== "admin") {

            return res.status(403).json({
                success: false,
                message: "Accès administrateur requis."
            });

        }


        const result = await pool.query(
            `
            SELECT
                id,
                username,
                full_name,
                is_active,
                last_login
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


        const admin = result.rows[0];


        if (!admin.is_active) {

            return res.status(403).json({
                success: false,
                message: "Compte administrateur désactivé."
            });

        }


        return res.json({

            success: true,

            admin: {
                id: admin.id,
                username: admin.username,
                full_name: admin.full_name,
                role: "admin"
            }

        });

    }

    catch (error) {

        return res.status(401).json({
            success: false,
            message: "Session administrateur invalide ou expirée."
        });

    }

});


module.exports = router;