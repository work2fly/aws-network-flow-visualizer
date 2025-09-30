#!/usr/bin/env node

/**
 * AWS Integration Validation Script
 * 
 * This script validates that the AWS integration build was successful
 * and provides guidance for testing.
 */

const fs = require('fs');
const path = require('path');

async function validateBuild() {
  console.log('AWS Network Flow Visualizer - Build Validation');
  console.log('==============================================\n');

  const distPath = path.join(__dirname, '..', 'dist');
  const mainPath = path.join(distPath, 'main', 'main.js');
  const preloadPath = path.join(distPath, 'main', 'preload.js');
  const rendererPath = path.join(distPath, 'renderer', 'renderer.js');

  let allValid = true;

  // Check if main process was built
  if (fs.existsSync(mainPath)) {
    const stats = fs.statSync(mainPath);
    console.log(`✅ Main process built successfully (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log('❌ Main process build not found');
    allValid = false;
  }

  // Check if preload script was built
  if (fs.existsSync(preloadPath)) {
    const stats = fs.statSync(preloadPath);
    console.log(`✅ Preload script built successfully (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log('❌ Preload script build not found');
    allValid = false;
  }

  // Check if renderer was built
  if (fs.existsSync(rendererPath)) {
    const stats = fs.statSync(rendererPath);
    console.log(`✅ Renderer process built successfully (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log('❌ Renderer process build not found');
    allValid = false;
  }

  // Check for AWS SDK dependencies in the build
  if (fs.existsSync(mainPath)) {
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    const hasAWSSDK = mainContent.includes('@aws-sdk') || mainContent.includes('aws-sdk');
    if (hasAWSSDK) {
      console.log('✅ AWS SDK integration detected in build');
    } else {
      console.log('⚠️  AWS SDK integration not clearly detected in build');
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allValid) {
    console.log('✅ Build validation passed!');
    console.log('\nNext steps for testing:');
    console.log('1. Start the application: npm run electron');
    console.log('2. Click "Debug IPC" button for integration tests');
    console.log('3. Configure AWS credentials for real testing');
    console.log('\nFor detailed testing instructions, see:');
    console.log('docs/aws-integration-testing.md');
  } else {
    console.log('❌ Build validation failed!');
    console.log('\nRun the following to rebuild:');
    console.log('npm run build');
  }

  return allValid;
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('AWS Integration Validation Script');
  console.log('');
  console.log('Usage: node scripts/test-aws-integration.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h               Show this help message');
  console.log('');
  console.log('This script validates that the AWS integration build was successful.');
  console.log('For actual testing, use the application\'s built-in debug tools.');
  process.exit(0);
}

// Run the validation
validateBuild().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});