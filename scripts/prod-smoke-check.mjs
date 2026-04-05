import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// Minimal env to allow imports (no DB calls are performed in this script)
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/indocreonix_smoke";
process.env.JWT_SECRET ||= "x".repeat(48);

// 1) Cookie flags in production mode
process.env.NODE_ENV = "production";
const antiAbuseCookieUrl = pathToFileURL(
  path.join(repoRoot, "src", "middlewares", "antiAbuseCookie.js"),
).href;
const { antiAbuseCookie } = await import(antiAbuseCookieUrl);

{
  let captured = null;
  const req = { cookies: {}, ip: "127.0.0.1", get: () => "UA" };
  const res = {
    cookie: (name, value, options) => {
      captured = { name, value, options };
    },
  };
  antiAbuseCookie(req, res, () => {});

  if (!captured) fail("antiAbuseCookie did not set a cookie");
  else {
    if (captured.name !== "ic_ab") fail("antiAbuseCookie cookie name is not ic_ab");
    if (!captured.options?.httpOnly) fail("ic_ab must be httpOnly");
    if (captured.options?.sameSite !== "none") fail("ic_ab must use SameSite=None in production");
    if (!captured.options?.secure) fail("ic_ab must be Secure in production");
    pass("antiAbuseCookie sets httpOnly + SameSite=None + Secure in production");
  }
}

// 2) Ensure admin users list excludes reset hashes/tokens
const userControllerPath = path.join(repoRoot, "src", "controllers", "userController.js");
const userControllerSource = fs.readFileSync(userControllerPath, "utf8");
const mustExclude = [
  "-passwordResetOtpHash",
  "-passwordResetOtpExpiresAt",
  "-passwordResetTokenHash",
  "-passwordResetTokenExpiresAt",
];

for (const needle of mustExclude) {
  if (!userControllerSource.includes(needle)) {
    fail(`getUsers response should exclude ${needle}`);
  }
}
if (!process.exitCode) {
  pass("getUsers excludes password reset hashes/tokens");
}

// 3) Ensure admin portal list/detail excludes reset hashes/tokens
const portalControllerPath = path.join(repoRoot, "src", "controllers", "portalController.js");
const portalControllerSource = fs.readFileSync(portalControllerPath, "utf8");
const portalMustExclude = [
  "-passwordResetOtpHash",
  "-passwordResetOtpExpiresAt",
  "-passwordResetTokenHash",
  "-passwordResetTokenExpiresAt",
];

for (const needle of portalMustExclude) {
  if (!portalControllerSource.includes(needle)) {
    fail(`portal admin queries should exclude ${needle}`);
  }
}
if (!process.exitCode) {
  pass("portal admin queries exclude password reset hashes/tokens");
}

// 4) Frontend fetch should include credentials by default
const apiClientPath = path.resolve(repoRoot, "..", "Indocreonix-Frontend", "src", "lib", "apiClient.js");
if (fs.existsSync(apiClientPath)) {
  const apiClientSource = fs.readFileSync(apiClientPath, "utf8");
  if (!apiClientSource.includes("credentials: credentials ?? 'include'")) {
    fail("frontend apiClient should default fetch credentials to include");
  } else {
    pass("frontend apiClient defaults credentials to include");
  }
} else {
  fail("could not find frontend apiClient.js to verify credentials setting");
}

if (!process.exitCode) {
  console.log("\nAll smoke checks passed.");
}
