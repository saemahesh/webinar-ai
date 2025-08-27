#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate timestamp for versioning
const timestamp = Date.now();

console.log(`🔄 Adding cache busting with timestamp: ${timestamp}`);

// Function to find all HTML files recursively
function findHtmlFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findHtmlFiles(fullPath, files);
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to update file references in HTML content
function updateFileReferences(htmlContent) {
  let updatedContent = htmlContent;
  
  // Update CSS file references (local files only)
  updatedContent = updatedContent.replace(
    /href=["']((?:\/)?(?:css\/[^"'?]+\.css))(?:\?v=\d+)?["']/g,
    `href="$1?v=${timestamp}"`
  );
  
  // Update JS file references (local files only, exclude external CDNs)
  updatedContent = updatedContent.replace(
    /src=["']((?:\/)?(?:js\/[^"'?]+\.js))(?:\?v=\d+)?["']/g,
    `src="$1?v=${timestamp}"`
  );
  
  return updatedContent;
}

// Function to process HTML files
function processHtmlFiles() {
  // Find all HTML files in the public directory
  const publicDir = path.join(__dirname, 'public');
  
  if (!fs.existsSync(publicDir)) {
    console.log('❌ Public directory not found');
    return;
  }
  
  const htmlFiles = findHtmlFiles(publicDir);
  
  console.log(`📁 Found ${htmlFiles.length} HTML files to process:`);
  
  htmlFiles.forEach(filePath => {
    try {
      // Read the HTML file
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      
      // Update file references
      const updatedContent = updateFileReferences(htmlContent);
      
      // Write back only if content changed
      if (updatedContent !== htmlContent) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        console.log(`✅ Updated: ${path.relative(__dirname, filePath)}`);
      } else {
        console.log(`⏭️  Skipped: ${path.relative(__dirname, filePath)} (no changes needed)`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  });
}

// Main execution
try {
  console.log('🚀 Starting cache busting script...');
  processHtmlFiles();
  console.log(`✨ Cache busting completed with timestamp: ${timestamp}`);
} catch (error) {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
}
