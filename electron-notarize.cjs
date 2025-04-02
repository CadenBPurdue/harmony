// electron-notarize.js
const path = require("path");
const { notarize } = require("@electron/notarize");
const dotenv = require("dotenv");

const isDev = process.env.NODE_ENV === "development";

const envPath = isDev ? ".dev.env" : ".env";

dotenv.config({ path: envPath });

// In base64decode function
function base64decode(base64) {
  if (!base64) {
    console.warn("[base64decode] Empty or undefined input");
    return null;
  }

  try {
    // In development, just return the raw value
    if (isDev) {
      return base64;
    }

    // For production/test, properly decode
    let decoded;
    try {
      decoded = Buffer.from(base64, "base64").toString("utf-8");
      // Trim whitespace and newlines
      decoded = decoded.trim();
      // console.log(`[base64decode] Decoded to length: ${decoded.length}`);
      return decoded;
    } catch (error) {
      console.error("[base64decode] Error decoding:", error.message);
      // Fallback: try to return the original if it's not actually base64
      return base64;
    }
  } catch (error) {
    console.error("[base64decode] Unexpected error:", error.message);
    return null;
  }
}

module.exports = async function (params) {
  // Only notarize on Mac OS
  if (process.platform !== "darwin") {
    return;
  }

  console.log("Notarizing application...");

  const appPath = path.join(
    params.appOutDir,
    `${params.packager.appInfo.productFilename}.app`,
  );

  if (
    !process.env.APPLE_ID ||
    !process.env.APPLE_ID_PASSWORD ||
    !process.env.CSC_TEAM_ID
  ) {
    console.log(
      "Skipping notarization: missing Apple credentials in environment",
    );
    return;
  }

  try {
    await notarize({
      appPath,
      tool: "notarytool",
      teamId: base64decode(process.env.CSC_TEAM_ID),
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
    });
    console.log("Notarization completed successfully");
  } catch (error) {
    console.error("Notarization failed", error);
    throw error;
  }
};
