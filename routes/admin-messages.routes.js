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


// GET ALL MESSAGES
router.get(
    "/",
    requireAdmin,
    getAdminMessages
);


// MARK AS READ
router.patch(
    "/:id/read",
    requireAdmin,
    markMessageAsRead
);


// MARK AS REPLIED
router.patch(
    "/:id/reply",
    requireAdmin,
    markMessageAsReplied
);


// DELETE
router.delete(
    "/:id",
    requireAdmin,
    deleteAdminMessage
);


module.exports = router;