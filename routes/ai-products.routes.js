
const express = require("express");
const multer = require("multer");

const router = express.Router();

const requireAdmin =
    require("../middleware/admin-auth");

const {
    analyze,
    generate,
    regenerate
} = require("../controllers/ai-products.controller");


const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 8 * 1024 * 1024,
        files: 1
    },

    fileFilter: (req, file, cb) => {

        if (!file.mimetype.startsWith("image/")) {
            return cb(
                new Error("Only image files are allowed.")
            );
        }

        cb(null, true);
    }
});


router.use(requireAdmin);

router.post(
    "/analyze",
    upload.single("image"),
    analyze
);

router.post(
    "/generate",
    upload.single("image"),
    generate
);

router.post(
    "/regenerate",
    upload.single("image"),
    regenerate
);

module.exports = router;
