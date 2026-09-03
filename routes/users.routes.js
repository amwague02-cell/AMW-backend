"use strict";

const express = require("express");
const pool = require("../config/db");
const requireAdmin = require("../middleware/admin.auth");

const router = express.Router();


// =====================================================
// GET ALL USERS
// GET /api/admin/users
// =====================================================

router.get("/", requireAdmin, async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id,
                full_name,
                phone,
                email,
                role,
                profile_image,
                is_active,
                created_at,
                updated_at
            FROM users
            ORDER BY created_at DESC
        `);

        return res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {

        console.error("❌ Get users error:", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des utilisateurs."
        });

    }

});


// =====================================================
// GET USER BY ID
// GET /api/admin/users/:id
// =====================================================

router.get("/:id", requireAdmin, async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                id,
                full_name,
                phone,
                email,
                role,
                profile_image,
                is_active,
                created_at,
                updated_at
            FROM users
            WHERE id = $1
            LIMIT 1
        `, [id]);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });

        }

        return res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        console.error("❌ Get user error:", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération de l'utilisateur."
        });

    }

});


module.exports = router;