const express = require("express");

const router = express.Router();

const upload =
    require("../middleware/upload.middleware");

const requireAdmin =
    require("../middleware/admin-auth");

const {
    createOffer,
    getOffers,
    getOfferById,
    getCategories,
    updateOffer,
    deleteOffer
} = require("../controllers/offers.controller");


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