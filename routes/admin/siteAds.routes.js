"use strict";

const express = require("express");
const router = express.Router();

const {
    authenticate,
    requireAdmin
} = require("../../middleware/auth.middleware");

const upload = require("../../middleware/upload.middleware");

const {
    getAllAds,
    createAd,
    updateAd,
    deleteAd
} = require("../../controllers/admin/siteAds.controller");


router.get("/", authenticate, requireAdmin, getAllAds);

router.post(
    "/",
    authenticate,
    requireAdmin,
    upload.single("image"),
    createAd
);

router.put(
    "/:id",
    authenticate,
    requireAdmin,
    upload.single("image"),
    updateAd
);

router.delete(
    "/:id",
    authenticate,
    requireAdmin,
    deleteAd
);


module.exports = router;