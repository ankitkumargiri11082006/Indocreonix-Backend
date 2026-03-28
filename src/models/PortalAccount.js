import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const portalAccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      default: "",
      select: false,
    },
    googleId: {
      type: String,
      default: "",
      index: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    organization: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    roleTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    location: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    access: {
      career: { type: Boolean, default: true },
      project: { type: Boolean, default: true },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    otpCodeHash: {
      type: String,
      default: "",
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

portalAccountSchema.pre("save", async function preSave(next) {
  if (!this.isModified("password")) return next();

  if (!this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

portalAccountSchema.methods.comparePassword = async function comparePassword(
  candidatePassword,
) {
  if (!this.password || !candidatePassword) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const PortalAccount = mongoose.model(
  "PortalAccount",
  portalAccountSchema,
);
