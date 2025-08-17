#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const versionPath = path.join(__dirname, '../version.json');
const publicVersionPath = path.join(__dirname, '../public/version.json');
const packagePath = path.join(__dirname, '../package.json');

try {
  // Read version from package.json
  let packageInfo = { version: "1.0.0" };
  if (fs.existsSync(packagePath)) {
    packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  }

  // Read current version info
  let versionInfo = {
    version: packageInfo.version,
    build: 1,
    lastCommit: "",
    buildDate: ""
  };

  if (fs.existsSync(versionPath)) {
    const existingInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    versionInfo = {
      ...existingInfo,
      version: packageInfo.version // Always use package.json version
    };
  }

  // Get current git commit hash
  try {
    const gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    versionInfo.lastCommit = gitCommit;
  } catch (error) {
    console.log('Warning: Could not get git commit hash, using fallback');
    
    // Use environment variables for production builds
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      versionInfo.lastCommit = process.env.VERCEL_GIT_COMMIT_SHA;
    } else if (process.env.GIT_COMMIT) {
      versionInfo.lastCommit = process.env.GIT_COMMIT;
    } else {
      versionInfo.lastCommit = versionInfo.lastCommit || 'unknown';
    }
  }

  // Get current git commit count for build number
  try {
    const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    versionInfo.build = parseInt(commitCount, 10);
  } catch (error) {
    console.log('Warning: Could not get git commit count, using fallback mechanism');
    
    // In production or environments without git, use environment variable or increment
    if (process.env.BUILD_NUMBER) {
      versionInfo.build = parseInt(process.env.BUILD_NUMBER, 10);
    } else if (process.env.VERCEL_GIT_COMMIT_SHA) {
      // Use first 8 chars of commit SHA as build number (for Vercel)
      versionInfo.build = parseInt(process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 8), 16) % 100000;
    } else {
      // Fallback: increment existing build number
      versionInfo.build = (versionInfo.build || 0) + 1;
    }
  }

  // Set build date
  versionInfo.buildDate = new Date().toISOString();

  // Write to both locations
  fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  fs.writeFileSync(publicVersionPath, JSON.stringify(versionInfo, null, 2));

  console.log(`Version updated: v${versionInfo.version}`);
  console.log(`Build: ${versionInfo.build}`);
  console.log(`Commit: ${versionInfo.lastCommit?.substring(0, 7) || 'unknown'}`);
  console.log(`Build date: ${versionInfo.buildDate}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}