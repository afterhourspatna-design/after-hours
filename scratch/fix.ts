import fs from 'fs';

let content = fs.readFileSync('components/snacks/SnacksDashboard.tsx', 'utf-8');

content = content.replace('interface SnackOrder {', `export interface SnackOrderItem {
  id: string;
  amount: string;
  notes: string | null;
  addedBy: { name: string } | null;
  createdAt: string;
}

interface SnackOrder {`);

content = content.replace(`user?: {
    name: string;
    phone: string;
  };
}`, `user?: {
    name: string;
    phone: string;
  };
  items?: SnackOrderItem[];
}`);

fs.writeFileSync('components/snacks/SnacksDashboard.tsx', content);
