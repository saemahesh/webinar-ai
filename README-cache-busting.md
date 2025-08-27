# Cache Busting Script

This script automatically adds versioning to all CSS and JS file references in HTML files to prevent browser caching issues.

## Usage

### Manual Execution
```bash
# Run the script manually
node add-versioning.js

# Or use npm script
npm run add-versioning
```

### Automatic Execution (Git Hook)
The script is set up to run automatically on git commits via a pre-commit hook.

When you run `git add` and then `git commit`, the script will:
1. Find all HTML files in the `public/` directory
2. Update CSS and JS file references to include a timestamp
3. Add the updated files to your commit

## What it does

The script updates file references like:
- `href="css/main.css"` → `href="css/main.css?v=1756296947515"`
- `src="js/app.js"` → `src="js/app.js?v=1756296947515"`

It only affects local files (CSS and JS files in your project), not external CDN resources.

## Files affected
- `public/index.html`
- Any HTML files in `public/views/` subdirectories

## Note
The timestamp is generated fresh each time the script runs, ensuring unique versioning for each deployment.
