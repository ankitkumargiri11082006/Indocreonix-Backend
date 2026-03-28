import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { PortalAccount } from "../models/PortalAccount.js";
import { ApiError } from "../utils/apiError.js";

export function signPortalToken(accountId) {
  return jwt.sign({ sub: accountId, tokenType: "portal" }, env.jwtSecret, {
    expiresIn: "30m",
  });
}

export async function protectPortalUser(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return next(new ApiError(401, "Portal authentication required"));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded?.tokenType !== "portal") {
      return next(new ApiError(401, "Invalid portal token"));
    }

    const account = await PortalAccount.findById(decoded.sub);
    if (!account || !account.isActive) {
      return next(new ApiError(401, "Portal user not found or disabled"));
    }

    req.portalUser = account;
    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired portal token"));
  }
}
