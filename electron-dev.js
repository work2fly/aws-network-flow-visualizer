const { spawn } = require('child_process');
const path = require('path');

// Simple script to test Electron in development
const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
const mainPath = path.join(__dirname, 'dist', 'main', 'main.js');

console.log('Starting Electron application...');
console.log('Main process:', mainPath);

const electron = spawn(electronPath, [mainPath], {
  stdio: 'inherit'
});

electron.on('close', (code) => {
  console.log(`Electron process exited with code ${code}`);
});

electron.on('error', (err) => {
  console.error('Failed to start Electron:', err);
});