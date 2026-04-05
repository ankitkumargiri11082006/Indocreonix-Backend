import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ADMIN_PERMISSIONS,
  FULL_ADMIN_PERMISSIONS,
} from "../constants/adminPermissions.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "editor", "viewer"],
      default: "viewer",
    },
    permissions: {
      dashboard: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: false },
      projects: { type: Boolean, default: false },
      clients: { type: Boolean, default: false },
      services: { type: Boolean, default: false },
      content: { type: Boolean, default: false },
      media: { type: Boolean, default: false },
      leads: { type: Boolean, default: false },
      orders: { type: Boolean, default: false },
      openings: { type: Boolean, default: false },
      applications: { type: Boolean, default: false },
      users: { type: Boolean, default: false },
      portalControl: { type: Boolean, default: false },
      integrations: { type: Boolean, default: false },
      settings: { type: Boolean, default: false },
      profile: { type: Boolean, default: false },
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    avatarPublicId: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    passwordResetRequired: {
      type: Boolean,
      default: false,
    },
    passwordResetOtpHash: {
      type: String,
      default: "",
      select: false,
    },
    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    passwordResetTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.pre("save", async function preSave(next) {
  if (this.isNew) {
    const superadminCount = await this.constructor.countDocuments({
      role: "superadmin",
    });
    if (superadminCount === 0) {
      this.role = "superadmin";
    }
  }

  if (!this.permissions) {
    this.permissions = { ...DEFAULT_ADMIN_PERMISSIONS };
  }

  if (this.role === "superadmin") {
    this.permissions = { ...FULL_ADMIN_PERMISSIONS };
  }

  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);
