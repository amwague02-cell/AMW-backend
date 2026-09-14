"use strict";

const express = require("express");

const router =
    express.Router();

const authenticateToken =
    require("../../middleware/auth.middleware");

const upload =
    require("../../middleware/upload.middleware");

const controller =
    require("../../controllers/admin/siteAds.controller");


/* =========================================================
   ADMIN
========================================================= */

router.get(
    "/",
    authenticateToken,
    controller.getAllAds
);


router.post(
    "/",
    authenticateToken,
    upload.single("image"),
    controller.createAd
);


router.put(
    "/:id",
    authenticateToken,
    upload.single("image"),
    controller.updateAd
);


router.delete(
    "/:id",
    authenticateToken,
    controller.deleteAd
);


module.exports = router;