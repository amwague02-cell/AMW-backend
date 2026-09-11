"use strict";

const express = require("express");

const router = express.Router();

const requireAdmin =
    require("../middleware/admin-auth");

const {

    getAdminMessages,

    markMessageAsRead,

    markMessageAsReplied,

    deleteAdminMessage

} = require("../controllers/admin-messages.controller");


// =====================================================
// GET ALL
// =====================================================

router.get(
    "/",
    requireAdmin,
    getAdminMessages
);


// =====================================================
// READ
// =====================================================

router.patch(
    "/:id/read",
    requireAdmin,
    markMessageAsRead
);


// =====================================================
// REPLY
// =====================================================

router.patch(
    "/:id/reply",
    requireAdmin,
    markMessageAsReplied
);


// =====================================================
// DELETE
// =====================================================

router.delete(
    "/:id",
    requireAdmin,
    deleteAdminMessage
);


module.exports = router;