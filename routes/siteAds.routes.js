"use strict";

const express = require("express");

const router =
    express.Router();

const controller =
    require("../controllers/admin/siteAds.controller");


router.get(
    "/",
    controller.getActiveAds
);


module.exports = router;