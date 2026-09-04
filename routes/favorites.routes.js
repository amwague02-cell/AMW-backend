const express = require("express");

const router = express.Router();

const pool = require("../config/db");

const jwt = require("jsonwebtoken");


// =====================================================
// AUTHENTICATION
// =====================================================

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    const token =
        authHeader &&
        authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;


    if (!token) {

        return res.status(401).json({
            success: false,
            message: "Veuillez vous connecter."
        });

    }


    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        req.user = decoded;

        next();


    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Session expirée. Veuillez vous reconnecter."

        });

    }

}



// =====================================================
// GET FAVORITES
// GET /api/favorites
// =====================================================

router.get("/", authenticateToken, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                f.id AS favorite_id,
                f.created_at,

                o.*

            FROM favorites f

            INNER JOIN offers o
                ON o.id = f.offer_id

            WHERE f.user_id = $1

            ORDER BY f.created_at DESC
            `,
            [req.user.id]
        );


        res.json({

            success: true,

            favorites:
                result.rows

        });


    } catch (error) {

        console.error(
            "❌ Get favorites error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur lors du chargement des favoris."

        });

    }

});



// =====================================================
// ADD FAVORITE
// POST /api/favorites
// =====================================================

router.post("/", authenticateToken, async (req, res) => {

    try {

        const {
            offerId
        } = req.body;


        if (!offerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Identifiant du produit manquant."

            });

        }


        const result =
            await pool.query(
                `
                INSERT INTO favorites
                (
                    user_id,
                    offer_id
                )

                VALUES
                (
                    $1,
                    $2
                )

                ON CONFLICT
                (
                    user_id,
                    offer_id
                )

                DO NOTHING

                RETURNING *
                `,
                [
                    req.user.id,
                    offerId
                ]
            );


        res.status(201).json({

            success: true,

            added:
                result.rows.length > 0,

            message:
                "Produit ajouté aux favoris."

        });


    } catch (error) {

        console.error(
            "❌ Add favorite error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'ajout aux favoris."

        });

    }

});



// =====================================================
// DELETE FAVORITE
// DELETE /api/favorites/:offerId
// =====================================================

router.delete(
    "/:offerId",
    authenticateToken,
    async (req, res) => {

        try {

            await pool.query(
                `
                DELETE FROM favorites

                WHERE user_id = $1
                AND offer_id = $2
                `,
                [
                    req.user.id,
                    req.params.offerId
                ]
            );


            res.json({

                success: true,

                message:
                    "Produit retiré des favoris."

            });


        } catch (error) {

            console.error(
                "❌ Delete favorite error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la suppression."

            });

        }

    }
);



// =====================================================
// DELETE ALL FAVORITES
// DELETE /api/favorites
// =====================================================

router.delete(
    "/",
    authenticateToken,
    async (req, res) => {

        try {

            await pool.query(
                `
                DELETE FROM favorites
                WHERE user_id = $1
                `,
                [req.user.id]
            );


            res.json({

                success: true,

                message:
                    "Tous les favoris ont été supprimés."

            });


        } catch (error) {

            console.error(
                "❌ Clear favorites error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la suppression."

            });

        }

    }
);


module.exports = router;