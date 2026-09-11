"use strict";

const express = require("express");

const router =
    express.Router();

const {
    createNegotiation
} = require(
    "../controllers/negotiations.controller"
);


// =====================================================
// CREATE NEGOTIATION
// =====================================================

router.post(
    "/",
    createNegotiation
);


module.exports = router;