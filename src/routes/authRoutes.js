import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  login,
  loginWithGoogle,
  me,
  resetPassword,
  verifyForgotOtp,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { authLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.post("/login", authLimiter, login);
router.post("/google", authLimiter, loginWithGoogle);

router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-forgot-otp", authLimiter, verifyForgotOtp);
router.post("/reset-password", authLimiter, resetPassword);

router.get("/me", protect, me);
router.patch("/change-password", protect, changePassword);

export default router;
