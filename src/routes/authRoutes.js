import { Router } from "express";
import {
  changePassword,
  login,
  loginWithGoogle,
  me,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/login", login);
router.post("/google", loginWithGoogle);
router.get("/me", protect, me);
router.patch("/change-password", protect, changePassword);

export default router;
