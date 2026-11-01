const pool = require("../config/db");

const bcrypt = require("bcrypt");

const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const cloudinary = require("../services/cloudinary.service");

const streamifier = require("streamifier");

const {
    sendPasswordResetCode
} = require("../services/email.service");



/* =====================================================
   VALIDATION DES NUMÉROS SÉNÉGALAIS
===================================================== */

function normalizeSenegalPhone(value) {
    if (typeof value !== "string") {
        return null;
    }

    let phone = value.trim();

    // Autoriser les espaces, tirets et parenthèses.
    phone = phone.replace(/[\s().-]/g, "");

    // Accepter +221 ou 00221.
    if (phone.startsWith("+221")) {
        phone = phone.slice(4);
    } else if (phone.startsWith("00221")) {
        phone = phone.slice(5);
    }

    // Refuser tout autre caractère ou indicatif international.
    if (!/^\d+$/.test(phone)) {
        return null;
    }

    // Format mobile sénégalais : 9 chiffres commençant par 7.
    if (!/^7\d{8}$/.test(phone)) {
        return null;
    }

    // Stocker tous les numéros sous le même format.
    return phone;
}


/* =====================================================
   REGISTER — VALIDATION EMAIL / TÉLÉPHONE SÉNÉGAL
===================================================== */

exports.register = async (req, res) => {
    try {
        const {
            fullName,
            identifier,
            password
        } = req.body;

        // Vérification des champs obligatoires
        if (
            typeof fullName !== "string" ||
            typeof identifier !== "string" ||
            typeof password !== "string" ||
            !fullName.trim() ||
            !identifier.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Tous les champs sont obligatoires."
            });
        }

        // Validation du nom
        if (fullName.trim().length > 150) {
            return res.status(400).json({
                success: false,
                message: "Le nom complet est trop long."
            });
        }

        // Validation du mot de passe
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message:
                    "Le mot de passe doit contenir au moins 6 caractères."
            });
        }

        const identifierValue =
            identifier.trim().toLowerCase();

        let email = null;
        let phone = null;

        // Déterminer si l'identifiant est un e-mail
        if (identifierValue.includes("@")) {
            email = identifierValue;

            // Validation minimale du format e-mail
            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Veuillez saisir une adresse e-mail valide."
                });
            }
        } else {
            // Normaliser et valider le numéro sénégalais
            phone = normalizeSenegalPhone(identifier);

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Veuillez saisir un numéro de téléphone mobile sénégalais valide de 9 chiffres."
                });
            }
        }

        // Vérifier si l'e-mail ou le téléphone existe déjà
        const existingUser = await pool.query(
            `
            SELECT id
            FROM users
            WHERE
                (
                    $1::text IS NOT NULL
                    AND LOWER(email) = $1
                )
                OR
                (
                    $2::text IS NOT NULL
                    AND phone = $2
                )
            LIMIT 1
            `,
            [email, phone]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Un compte existe déjà avec cet e-mail ou ce numéro de téléphone."
            });
        }

        // Chiffrer le mot de passe
        const passwordHash =
            await bcrypt.hash(password, 12);

        // Créer le compte
        const result = await pool.query(
            `
            INSERT INTO users (
                full_name,
                email,
                phone,
                password_hash,
                role
            )
            VALUES ($1, $2, $3, $4, 'user')
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

        return res.status(201).json({
            success: true,
            message: "Compte créé avec succès.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("REGISTER ERROR:", error);

        // Protection supplémentaire contre les doublons concurrents
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "Cet e-mail ou ce numéro de téléphone est déjà utilisé."
            });
        }

        return res.status(500).json({
            success: false,
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


        const rawIdentifier = identifier.trim();

        let identifierValue;

        if (rawIdentifier.includes("@")) {

            // Connexion par e-mail
            identifierValue = rawIdentifier.toLowerCase();

        } else {

            // Connexion par numéro sénégalais
            identifierValue = normalizeSenegalPhone(rawIdentifier);

            if (!identifierValue) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Veuillez saisir un e-mail valide ou un numéro sénégalais valide."
                });
            }
        }


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


        const rawIdentifier = identifier.trim();

        let identifierValue;

        if (rawIdentifier.includes("@")) {

            identifierValue = rawIdentifier.toLowerCase();

        } else {

            identifierValue = normalizeSenegalPhone(rawIdentifier);

            if (!identifierValue) {
                // Ne pas révéler si un compte existe.
                return res.json({
                    message:
                        "Si ce compte existe, le code de vérification a été envoyé."
                });
            }
        }


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


        const rawIdentifier = identifier.trim();

        let identifierValue;

        if (rawIdentifier.includes("@")) {

            identifierValue = rawIdentifier.toLowerCase();

        } else {

            identifierValue = normalizeSenegalPhone(rawIdentifier);

            if (!identifierValue) {
                return res.status(400).json({
                    message:
                        "Code de vérification invalide ou expiré."
                });
            }
        }


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

/* =====================================================
   UPLOAD PROFILE IMAGE
===================================================== */

exports.uploadProfileImage = async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message:
                    "Aucune image sélectionnée."

            });

        }


        /*
         * Upload vers Cloudinary
         */

        const uploadResult =
            await new Promise((resolve, reject) => {

                const stream =
                    cloudinary.uploader.upload_stream(

                        {
                            folder: "amw/profiles",

                            resource_type: "image",

                            transformation: [
                                {
                                    width: 500,
                                    height: 500,
                                    crop: "fill",
                                    gravity: "face"
                                }
                            ]
                        },

                        (error, result) => {

                            if (error) {

                                reject(error);

                            } else {

                                resolve(result);

                            }

                        }

                    );


                streamifier
                    .createReadStream(req.file.buffer)
                    .pipe(stream);

            });


        /*
         * Enregistrer l'URL dans PostgreSQL
         */

        const result =
            await pool.query(

                `
                UPDATE users

                SET
                    profile_image = $1,
                    updated_at = NOW()

                WHERE id = $2

                RETURNING
                    id,
                    profile_image
                `,

                [

                    uploadResult.secure_url,

                    req.user.id

                ]

            );


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable."

            });

        }


        res.json({

            success: true,

            message:
                "Photo de profil mise à jour avec succès.",

            profileImage:
                result.rows[0].profile_image

        });


    } catch (error) {

        console.error(
            "UPLOAD PROFILE IMAGE ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'enregistrement de la photo."

        });

    }

};

/* =====================================================
   GET MY PROFILE
===================================================== */

exports.getProfile = async (req, res) => {

    try {

        const result = await pool.query(

            `
            SELECT
                id,
                full_name,
                email,
                phone,
                role,
                profile_image,
                gender,
                address,
                created_at,
                updated_at

            FROM users

            WHERE id = $1

            LIMIT 1
            `,

            [req.user.id]

        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                message: "Utilisateur introuvable."

            });

        }


        const user = result.rows[0];


        res.json({

            user: {

                id: user.id,

                fullName: user.full_name,

                email: user.email,

                phone: user.phone,

                role: user.role,

                profileImage: user.profile_image,

                gender: user.gender,

                address: user.address,

                createdAt: user.created_at,

                updatedAt: user.updated_at

            }

        });


    } catch (error) {

        console.error(
            "GET PROFILE ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors du chargement du profil."

        });

    }

};


/* =====================================================
   UPDATE MY PROFILE
===================================================== */

exports.updateProfile = async (req, res) => {

    try {

        const {
            fullName,
            phone,
            gender,
            address
        } = req.body;

        const normalizedPhone = phone
            ? normalizeSenegalPhone(phone)
            : null;

        if (phone && !normalizedPhone) {
            return res.status(400).json({
                success: false,
                message:
                    "Veuillez saisir un numéro de téléphone mobile sénégalais valide de 9 chiffres."
            });
        }


        if (!fullName || !fullName.trim()) {

            return res.status(400).json({

                message:
                    "Le nom complet est obligatoire."

            });

        }


        const result = await pool.query(

            `
            UPDATE users

            SET
                full_name = $1,
                phone = $2,
                gender = $3,
                address = $4,
                updated_at = NOW()

            WHERE id = $5

            RETURNING
                id,
                full_name,
                email,
                phone,
                role,
                profile_image,
                gender,
                address,
                created_at,
                updated_at
            `,

            [

                fullName.trim(),

                normalizedPhone,

                gender
                    ? gender.trim()
                    : null,

                address
                    ? address.trim()
                    : null,

                req.user.id

            ]

        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Utilisateur introuvable."

            });

        }


        const user = result.rows[0];


        res.json({

            message:
                "Profil mis à jour avec succès.",

            user: {

                id: user.id,

                fullName: user.full_name,

                email: user.email,

                phone: user.phone,

                role: user.role,

                profileImage: user.profile_image,

                gender: user.gender,

                address: user.address,

                createdAt: user.created_at,

                updatedAt: user.updated_at

            }

        });


    } catch (error) {

        console.error(
            "UPDATE PROFILE ERROR:",
            error
        );


        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "Ce numéro de téléphone est déjà utilisé par un autre compte."
            });
        }

        res.status(500).json({

            message:
                "Erreur lors de la mise à jour du profil."

        });

    }

};


/* =====================================================
   CHANGE PASSWORD
===================================================== */

exports.changePassword = async (req, res) => {

    try {

        const {
            currentPassword,
            newPassword
        } = req.body;


        if (
            !currentPassword ||
            !newPassword
        ) {

            return res.status(400).json({

                message:
                    "Tous les champs sont obligatoires."

            });

        }


        if (newPassword.length < 6) {

            return res.status(400).json({

                message:
                    "Le nouveau mot de passe doit contenir au moins 6 caractères."

            });

        }


        const result = await pool.query(

            `
            SELECT password_hash

            FROM users

            WHERE id = $1

            LIMIT 1
            `,

            [req.user.id]

        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Utilisateur introuvable."

            });

        }


        const passwordValid =
            await bcrypt.compare(

                currentPassword,

                result.rows[0].password_hash

            );


        if (!passwordValid) {

            return res.status(401).json({

                message:
                    "L'ancien mot de passe est incorrect."

            });

        }


        const newPasswordHash =
            await bcrypt.hash(

                newPassword,

                12

            );


        await pool.query(

            `
            UPDATE users

            SET
                password_hash = $1,
                updated_at = NOW()

            WHERE id = $2
            `,

            [

                newPasswordHash,

                req.user.id

            ]

        );


        res.json({

            message:
                "Mot de passe modifié avec succès."

        });


    } catch (error) {

        console.error(
            "CHANGE PASSWORD ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Erreur lors de la modification du mot de passe."

        });

    }

};
