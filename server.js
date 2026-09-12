require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/db");

const adminAuthRoutes =
    require("./routes/admin-auth.routes");

const offersRoutes =
    require("./routes/offers.routes");

const usersRoutes =
    require("./routes/users.routes");

const contactRoutes =
    require("./routes/contact.routes");

const favoritesRoutes =
    require("./routes/favorites.routes");

const app = express();

const ordersRoutes =
    require("./routes/orders.routes");

const adminDashboardRoutes =
    require("./routes/admin-dashboard.routes");

const adminOrdersRoutes =
    require("./routes/admin-orders.routes");

const negotiationsRoutes =
    require("./routes/negotiations.routes");

const adminMessagesRoutes =
    require("./routes/admin-messages.routes");

const adminAnalyticsRoutes =
    require("./routes/admin-analytics.routes");






const cartRoutes = require("./routes/cart.routes");

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


app.use(express.json());





app.use(
    "/api/admin/auth",
    adminAuthRoutes
);


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
    "/api/admin/users",
    usersRoutes
);

app.use(
    "/api/contact",
    contactRoutes
);

app.use(
    "/api/favorites",
    favoritesRoutes
);

app.use(
    "/api/cart", 
    cartRoutes
);

app.use(
    "/api/orders",
    ordersRoutes
);

app.use(
    "/api/admin/orders",
    adminOrdersRoutes
);

app.use(
    "/api/negotiations",
    negotiationsRoutes
);

app.use(
    "/api/admin/messages",
    adminMessagesRoutes
);

app.use(
    "/api/admin/dashboard",
    adminDashboardRoutes
);

app.use(
    "/api/admin/analytics",
    adminAnalyticsRoutes
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