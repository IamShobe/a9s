#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const indexPath = path.join(process.cwd(), 'dist/src/index.js');

try {
  let content = fs.readFileSync(indexPath, 'utf-8');

  // Don't add shebang if it already exists
  if (content.startsWith('#!/')) {
    console.log('✓ Shebang already present');
    process.exit(0);
  }

  // Add shebang
  content = '#!/usr/bin/env node\n' + content;
  fs.writeFileSync(indexPath, content);

  console.log('✓ Added shebang to dist/src/index.js');
} catch (error) {
  console.error('✗ Failed to add shebang:', error.message);
  process.exit(1);
}
