const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {

            return res.status(401).json({
                success: false,
                message: "Authentification requise"
            });

        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Token invalide ou expiré"
        });

    }
}


function requireAdmin(req, res, next) {

    if (!req.user || req.user.role !== "admin") {

        return res.status(403).json({
            success: false,
            message: "Accès réservé à l'administrateur"
        });

    }

    next();
}


function requireUser(req, res, next) {

    if (
        !req.user ||
        (req.user.role !== "user" && req.user.role !== "admin")
    ) {

        return res.status(403).json({
            success: false,
            message: "Accès réservé aux utilisateurs connectés"
        });

    }

    next();
}


module.exports = {
    authenticate,
    requireAdmin,
    requireUser
};