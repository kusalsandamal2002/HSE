import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET;

if (
  isProduction &&
  (!jwtSecret || jwtSecret === "development-secret-change-me" || jwtSecret.length < 32)
) {
  throw new Error("JWT_SECRET must be set to a strong unique value with at least 32 characters in production.");
}

export const env = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: jwtSecret || "development-secret-change-me",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
};
