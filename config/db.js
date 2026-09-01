const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("❌ DATABASE_URL is missing");
} else {
    try {
        const dbUrl = new URL(databaseUrl);

        console.log("🔎 PostgreSQL HOST:", dbUrl.hostname);
        console.log("🔎 PostgreSQL PORT:", dbUrl.port || "5432");
        console.log("🔎 PostgreSQL DATABASE:", dbUrl.pathname);
    } catch (error) {
        console.error("❌ Invalid DATABASE_URL");
    }
}

const pool = new Pool({
    connectionString: databaseUrl,

    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false
});

pool.on("connect", () => {
    console.log("✅ PostgreSQL connected");
});

pool.on("error", (error) => {
    console.error("❌ PostgreSQL error:", error);
});

module.exports = pool;