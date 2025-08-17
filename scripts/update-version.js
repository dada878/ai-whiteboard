#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const versionPath = path.join(__dirname, '../version.json');
const publicVersionPath = path.join(__dirname, '../public/version.json');

try {
  // Simple version info with only commit and build date
  let versionInfo = {
    commit: "",
    buildDate: ""
  };

  // Get current git commit hash (short version)
  try {
    const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    versionInfo.commit = gitCommit;
  } catch (error) {
    console.log('Warning: Could not get git commit hash, using fallback');
    
    // Use environment variables for production builds
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      versionInfo.commit = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
    } else if (process.env.GIT_COMMIT) {
      versionInfo.commit = process.env.GIT_COMMIT.substring(0, 7);
    } else {
      versionInfo.commit = 'unknown';
    }
  }

  // Set build date
  versionInfo.buildDate = new Date().toISOString();

  // Write to both locations
  fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  fs.writeFileSync(publicVersionPath, JSON.stringify(versionInfo, null, 2));

  console.log(`Commit: ${versionInfo.commit}`);
  console.log(`Build date: ${versionInfo.buildDate}`);

} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}