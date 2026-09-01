const pool = require("../config/db");

const bcrypt = require("bcrypt");

const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const {
    sendPasswordResetCode
} = require("../services/email.service");


/* =====================================================
   REGISTER
===================================================== */

exports.register = async (req, res) => {

    try {

        const {
            fullName,
            identifier,
            password
        } = req.body;


        if (
            !fullName ||
            !identifier ||
            !password
        ) {

            return res.status(400).json({
                message:
                    "Tous les champs sont obligatoires."
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                message:
                    "Le mot de passe doit contenir au moins 6 caractères."
            });

        }


        const identifierValue =
            identifier.trim().toLowerCase();


        /* =============================================
           CHECK USER
        ============================================= */

        const existingUser =
            await pool.query(

                `
                SELECT id
                FROM users
                WHERE email = $1
                OR phone = $1
                `,

                [identifierValue]

            );


        if (existingUser.rows.length > 0) {

            return res.status(409).json({

                message:
                    "Un compte existe déjà avec cet identifiant."

            });

        }


        /* =============================================
           HASH PASSWORD
        ============================================= */

        const passwordHash =
            await bcrypt.hash(password, 12);


        /* =============================================
           EMAIL OR PHONE
        ============================================= */

        const isEmail =
            identifierValue.includes("@");


        let email = null;

        let phone = null;


        if (isEmail) {

            email = identifierValue;

        } else {

            phone = identifier.trim();

        }


        /* =============================================
           CREATE USER
        ============================================= */

        const result =
            await pool.query(

                `
                INSERT INTO users (

                    full_name,
                    email,
                    phone,
                    password_hash,
                    role

                )

                VALUES (

                    $1,
                    $2,
                    $3,
                    $4,
                    'user'

                )

                RETURNING
                    id,
                    full_name,
                    email,
                    phone,
                    role,
                    created_at
                `,

                [

                    fullName.trim(),
                    email,
                    phone,
                    passwordHash

                ]

            );


        const user =
            result.rows[0];


        res.status(201).json({

            message:
                "Compte créé avec succès.",

            user

        });


    } catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors de la création du compte."

        });

    }

};


/* =====================================================
   LOGIN
===================================================== */

exports.login = async (req, res) => {

    try {

        const {
            identifier,
            password
        } = req.body;


        if (
            !identifier ||
            !password
        ) {

            return res.status(400).json({

                message:
                    "Téléphone/e-mail et mot de passe requis."

            });

        }


        const identifierValue =
            identifier.trim().toLowerCase();


        /* =============================================
           FIND USER
        ============================================= */

        const result =
            await pool.query(

                `
                SELECT *
                FROM users

                WHERE email = $1
                OR phone = $1

                LIMIT 1
                `,

                [identifierValue]

            );


        if (result.rows.length === 0) {

            return res.status(401).json({

                message:
                    "Identifiant ou mot de passe incorrect."

            });

        }


        const user =
            result.rows[0];


        /* =============================================
           CHECK PASSWORD
        ============================================= */

        const passwordValid =
            await bcrypt.compare(

                password,

                user.password_hash

            );


        if (!passwordValid) {

            return res.status(401).json({

                message:
                    "Identifiant ou mot de passe incorrect."

            });

        }


        /* =============================================
           CREATE TOKEN
        ============================================= */

        const token =
            jwt.sign(

                {

                    id: user.id,

                    role: user.role

                },

                process.env.JWT_SECRET,

                {

                    expiresIn: "7d"

                }

            );


        res.json({

            message:
                "Connexion réussie.",

            token,

            user: {

                id:
                    user.id,

                fullName:
                    user.full_name,

                email:
                    user.email,

                phone:
                    user.phone,

                role:
                    user.role,

                profileImage:
                    user.profile_image

            }

        });


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors de la connexion."

        });

    }

};


/* =====================================================
   FORGOT PASSWORD
===================================================== */

exports.forgotPassword = async (req, res) => {

    try {

        const {
            identifier
        } = req.body;


        if (!identifier) {

            return res.status(400).json({

                message:
                    "Identifiant requis."

            });

        }


        const identifierValue =
            identifier.trim().toLowerCase();


        /* =============================================
           FIND USER
        ============================================= */

        const result =
            await pool.query(

                `
                SELECT
                    id,
                    email,
                    phone

                FROM users

                WHERE email = $1
                OR phone = $1

                LIMIT 1
                `,

                [identifierValue]

            );


        /*
           Security:
           Do not reveal whether account exists.
        */

        if (result.rows.length === 0) {

            return res.json({

                message:
                    "Si ce compte existe, le code de vérification a été envoyé."

            });

        }


        const user =
            result.rows[0];


        /* =============================================
           CREATE 6 DIGIT CODE
        ============================================= */

        const code =
            crypto
                .randomInt(100000, 1000000)
                .toString();


        /* =============================================
           CODE EXPIRATION
           10 MINUTES
        ============================================= */

        const expiresAt =
            new Date(
                Date.now() + 10 * 60 * 1000
            );


        /* =============================================
           DELETE OLD TOKENS
        ============================================= */

        await pool.query(

            `
            DELETE FROM password_reset_tokens

            WHERE user_id = $1
            `,

            [user.id]

        );


        /* =============================================
           SAVE CODE
        ============================================= */

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(code)
                .digest("hex");


        await pool.query(

            `
            INSERT INTO password_reset_tokens (

                user_id,
                token_hash,
                expires_at

            )

            VALUES (

                $1,
                $2,
                $3

            )
            `,

            [

                user.id,
                tokenHash,
                expiresAt

            ]

        );


        /* =============================================
           SEND CODE
        ============================================= */

        if (user.email) {

            await sendPasswordResetCode(

                user.email,

                code

            );

        }


        /*
           PHONE:
           SMS will be added after connecting
           an SMS provider.
        */


        if (user.phone) {

            console.log(
                `PASSWORD RESET CODE FOR ${user.phone}: ${code}`
            );

        }


        /* =============================================
           RESPONSE
        ============================================= */

        res.json({

            message:
                user.email

                    ? "Un code de vérification a été envoyé à votre adresse e-mail."

                    : "Un code de vérification a été envoyé à votre numéro de téléphone."

        });


    } catch (error) {

        console.error(
            "FORGOT PASSWORD ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors de l'envoi du code de vérification."

        });

    }

};

/* =====================================================
   VERIFY RESET CODE
===================================================== */

exports.verifyResetCode = async (req, res) => {

    try {

        const {
            identifier,
            code
        } = req.body;


        /* =============================================
           VALIDATION
        ============================================= */

        if (
            !identifier ||
            !code
        ) {

            return res.status(400).json({

                message:
                    "Identifiant et code de vérification requis."

            });

        }


        const identifierValue =
            identifier.trim().toLowerCase();


        const codeValue =
            code.trim();


        /* =============================================
           CODE FORMAT
        ============================================= */

        if (
            !/^\d{6}$/.test(codeValue)
        ) {

            return res.status(400).json({

                message:
                    "Le code doit contenir 6 chiffres."

            });

        }


        /* =============================================
           FIND USER
        ============================================= */

        const userResult =
            await pool.query(

                `
                SELECT id
                FROM users

                WHERE email = $1
                OR phone = $1

                LIMIT 1
                `,

                [identifierValue]

            );


        if (
            userResult.rows.length === 0
        ) {

            return res.status(400).json({

                message:
                    "Code de vérification invalide ou expiré."

            });

        }


        const user =
            userResult.rows[0];


        /* =============================================
           HASH CODE
        ============================================= */

        const codeHash =
            crypto
                .createHash("sha256")
                .update(codeValue)
                .digest("hex");


        /* =============================================
           VERIFY CODE
        ============================================= */

        const tokenResult =
            await pool.query(

                `
                SELECT id

                FROM password_reset_tokens

                WHERE user_id = $1

                AND token_hash = $2

                AND expires_at > NOW()

                LIMIT 1
                `,

                [
                    user.id,
                    codeHash
                ]

            );


        if (
            tokenResult.rows.length === 0
        ) {

            return res.status(400).json({

                message:
                    "Code de vérification invalide ou expiré."

            });

        }


        /* =============================================
           CREATE RESET TOKEN
        ============================================= */

        const resetToken =
            crypto
                .randomBytes(32)
                .toString("hex");


        const resetTokenHash =
            crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");


        const expiresAt =
            new Date(
                Date.now() + 10 * 60 * 1000
            );


        /* =============================================
           REPLACE CODE WITH RESET TOKEN
        ============================================= */

        await pool.query(

            `
            UPDATE password_reset_tokens

            SET
                token_hash = $1,
                expires_at = $2

            WHERE user_id = $3
            `,

            [
                resetTokenHash,
                expiresAt,
                user.id
            ]

        );


        /* =============================================
           RESPONSE
        ============================================= */

        res.json({

            message:
                "Code vérifié avec succès.",

            resetToken

        });


    } catch (error) {

        console.error(
            "VERIFY RESET CODE ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors de la vérification du code."

        });

    }

};


/* =====================================================
   RESET PASSWORD
===================================================== */

exports.resetPassword = async (req, res) => {

    try {

        const {

            token,
            password

        } = req.body;


        if (
            !token ||
            !password
        ) {

            return res.status(400).json({

                message:
                    "Informations manquantes."

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                message:
                    "Le mot de passe doit contenir au moins 6 caractères."

            });

        }


        const tokenHash =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");


        const result =
            await pool.query(

                `
                SELECT *

                FROM password_reset_tokens

                WHERE token_hash = $1

                AND expires_at > NOW()

                LIMIT 1
                `,

                [tokenHash]

            );


        if (result.rows.length === 0) {

            return res.status(400).json({

                message:
                    "Le lien de récupération est invalide ou expiré."

            });

        }


        const resetData =
            result.rows[0];


        const passwordHash =
            await bcrypt.hash(

                password,

                12

            );


        await pool.query(

            `
            UPDATE users

            SET password_hash = $1

            WHERE id = $2
            `,

            [

                passwordHash,

                resetData.user_id

            ]

        );


        await pool.query(

            `
            DELETE FROM password_reset_tokens

            WHERE user_id = $1
            `,

            [

                resetData.user_id

            ]

        );


        res.json({

            message:
                "Mot de passe modifié avec succès."

        });


    } catch (error) {

        console.error(
            "RESET PASSWORD ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors de la modification."

        });

    }

};