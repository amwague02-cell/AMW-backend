"use strict";

const express =
    require("express");

const router =
    express.Router();


const requireAdmin =
    require(
        "../middleware/admin-auth"
    );


const {
    getAnalytics
} =
    require(
        "../controllers/admin-analytics.controller"
    );


/* =====================================================
   ADMIN ANALYTICS
===================================================== */

router.get(
    "/",
    requireAdmin,
    getAnalytics
);


module.exports =
    router;