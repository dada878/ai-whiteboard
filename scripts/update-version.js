#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const versionPath = path.join(__dirname, '../version.json');
const publicVersionPath = path.join(__dirname, '../public/version.json');

try {
  // Read current version
  let versionInfo = {
    version: "1.0.0",
    build: 1,
    lastCommit: "",
    buildDate: ""
  };

  if (fs.existsSync(versionPath)) {
    versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  }

  // Get current git commit hash
  try {
    const gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    versionInfo.lastCommit = gitCommit;
  } catch (error) {
    console.log('Warning: Could not get git commit hash');
  }

  // Get current git commit count for build number
  try {
    const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    versionInfo.build = parseInt(commitCount, 10);
  } catch (error) {
    console.log('Warning: Could not get git commit count, incrementing build number');
    versionInfo.build = (versionInfo.build || 0) + 1;
  }

  // Set build date
  versionInfo.buildDate = new Date().toISOString();

  // Write to both locations
  fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  fs.writeFileSync(publicVersionPath, JSON.stringify(versionInfo, null, 2));

  console.log(`Version updated: v${versionInfo.version}.${versionInfo.build}`);
  console.log(`Commit: ${versionInfo.lastCommit?.substring(0, 7) || 'unknown'}`);
  console.log(`Build date: ${versionInfo.buildDate}`);

} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}