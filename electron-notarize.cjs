// electron-notarize.js
const path = require("path");
const { notarize } = require("@electron/notarize");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".dev.env") });

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
      teamId: process.env.CSC_TEAM_ID,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
    });
    console.log("Notarization completed successfully");
  } catch (error) {
    console.error("Notarization failed", error);
    throw error;
  }
};
