const express = require("express");

const router = express.Router();


const {
    authenticate
} = require("../middleware/auth.middleware");

const upload = require("../middleware/upload.middleware");


const {
    register,
    login,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    getProfile,
    updateProfile,
    changePassword,
    uploadProfileImage
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

/* =====================================================
   GET MY PROFILE
===================================================== */

router.get(
    "/profile",
    authenticate,
    getProfile
);


/* =====================================================
   UPDATE MY PROFILE
===================================================== */

router.put(
    "/profile",
    authenticate,
    updateProfile
);


/* =====================================================
   CHANGE PASSWORD
===================================================== */

router.put(
    "/change-password",
    authenticate,
    changePassword
);

router.post(
    "/profile/image",
    authenticate,
    upload.single("profileImage"),
    uploadProfileImage
);


module.exports = router;