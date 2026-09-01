const express = require("express");

const router = express.Router();


const {
    register,
    login,
    forgotPassword,
    verifyResetCode,
    resetPassword
} = require("../controllers/auth.controller");




/* =====================================================
   REGISTER
===================================================== */

router.post(
    "/register",
    register
);


/* =====================================================
   LOGIN
===================================================== */

router.post(
    "/login",
    login
);


/* =====================================================
   FORGOT PASSWORD
===================================================== */

router.post(
    "/forgot-password",
    forgotPassword
);

/* =====================================================
   VERIFY RESET CODE
===================================================== */

router.post(
    "/verify-reset-code",
    verifyResetCode
);


/* =====================================================
   RESET PASSWORD
===================================================== */

router.post(
    "/reset-password",
    resetPassword
);


module.exports = router;