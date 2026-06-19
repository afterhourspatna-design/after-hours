import fs from 'fs';

let content = fs.readFileSync('components/snacks/SnacksDashboard.tsx', 'utf-8');

// The file should already have SnackOrderItem exported at the top because of the previous git commit!
// Wait, I reverted the file to the last commit which HAS SnackOrderItem exported!
// The problem was ONLY `items?: SnackOrderItem[];` inside SnackOrder.

content = content.replace(`  user?: {
    name: string;
    phone: string;
  };
}`, `  user?: {
    name: string;
    phone: string;
  };
  items?: SnackOrderItem[];
}`);

fs.writeFileSync('components/snacks/SnacksDashboard.tsx', content);
