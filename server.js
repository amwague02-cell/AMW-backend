require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/db");

const adminAuthRoutes =
    require("./routes/admin-auth.routes");

const offersRoutes =
    require("./routes/offers.routes");

const app = express();

const authRoutes = require("./routes/auth.routes");

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
    cors({
        origin: [
            process.env.FRONTEND_URL,
            "http://127.0.0.1:5500",
            "https://amwague.netlify.app"
        ],
        credentials: true
    })
);

app.use(helmet());
app.use(express.urlencoded({ extended: true }));

app.use(
    "/api/admin/auth",
    adminAuthRoutes
);




app.use(express.json());



// =========================================================
// TEST ROUTE
// =========================================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "A.M.W Backend fonctionne correctement."
    });

});


// =========================================================
// DATABASE TEST
// =========================================================

app.get("/api/test-db", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT NOW() AS time"
        );

        res.json({
            success: true,
            database: "connected",
            time: result.rows[0].time
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur PostgreSQL."
        });

    }

});


// =========================================================
// SERVER
// =========================================================
app.use(
    "/api/offers",
    offersRoutes
);

app.use(
    "/api/auth",
    authRoutes
);






const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `🚀 A.M.W Backend running on port ${PORT}`
    );

});