const express = require("express");

const router = express.Router();

const upload =
    require("../middleware/upload.middleware");

const requireAdmin =
    require("../middleware/admin-auth");

const {
    createOffer,
    createAIOffer,
    getOffers,
    getOfferById,
    getCategories,
    updateOffer,
    deleteOffer
} = require("../controllers/offers.controller");

const multer = require("multer");

const {
    searchByImage,
    createImageSearchAlert
} = require("../controllers/image-search.controller");

const imageSearchUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 8 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed."));
        }
        cb(null, true);
    }
});

/* =====================================================
   GET ALL OFFERS
===================================================== */

router.get(
    "/",
    getOffers
);


/* =====================================================
   GET ALL CATEGORIES
===================================================== */

router.get(
    "/categories",
    getCategories
);


/* =====================================================
   CREATE OFFER
===================================================== */

router.post(
    "/",
    upload.array("images", 8),
    createOffer
);


/* =====================================================
   CREATE AI OFFER — ADMIN
===================================================== */

router.post(
    "/ai",
    requireAdmin,
    upload.array("images", 8),
    createAIOffer
);

router.post(
    "/search-by-image",
    imageSearchUpload.single("image"),
    searchByImage
);

router.post(
    "/image-search-alerts",
    createImageSearchAlert
);

/* =====================================================
   GET OFFER BY ID
===================================================== */

router.get(
    "/:id",
    getOfferById
);


/* =====================================================
   UPDATE OFFER — ADMIN
===================================================== */

router.put(
    "/:id",
    requireAdmin,
    updateOffer
);


/* =====================================================
   DELETE OFFER — ADMIN + PASSWORD
===================================================== */

router.delete(
    "/:id",
    requireAdmin,
    deleteOffer
);


module.exports = router;