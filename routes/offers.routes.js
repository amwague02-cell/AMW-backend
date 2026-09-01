const express = require("express");

const router = express.Router();

const upload =
    require("../middleware/upload.middleware");


const {
    createOffer,
    getOffers,
    getOfferById,
    getCategories
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


module.exports = router;