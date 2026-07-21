// This script creates placeholder React components for all required UI files.
import { promises as fs } from 'fs';
import * as path from 'path';

const baseDir = path.resolve(__dirname, '..', 'src', 'components');

const components = [
  // auth
  'auth/RoleGuard.tsx',
  // layout
  'layout/AppLayout.tsx',
  'layout/AppSidebar.tsx',
  'layout/Topbar.tsx',
  // shared
  'shared/DataTable.tsx',
  'shared/PageHeader.tsx',
  'shared/StatCard.tsx',
  'shared/StatusBadge.tsx',
  // ui (list all files)
  'ui/accordion.tsx',
  'ui/alert-dialog.tsx',
  'ui/alert.tsx',
  'ui/aspect-ratio.tsx',
  'ui/avatar.tsx',
  'ui/badge.tsx',
  'ui/breadcrumb.tsx',
  'ui/button.tsx',
  'ui/calendar.tsx',
  'ui/card.tsx',
  'ui/carousel.tsx',
  'ui/chart.tsx',
  'ui/checkbox.tsx',
  'ui/collapsible.tsx',
  'ui/command.tsx',
  'ui/context-menu.tsx',
  'ui/dialog.tsx',
  'ui/drawer.tsx',
  'ui/dropdown-menu.tsx',
  'ui/form.tsx',
  'ui/hover-card.tsx',
  'ui/input-otp.tsx',
  'ui/input.tsx',
  'ui/label.tsx',
  'ui/menubar.tsx',
  'ui/navigation-menu.tsx',
  'ui/pagination.tsx',
  'ui/popover.tsx',
  'ui/progress.tsx',
  'ui/radio-group.tsx',
  'ui/resizable.tsx',
  'ui/scroll-area.tsx',
  'ui/select.tsx',
  'ui/separator.tsx',
  'ui/sheet.tsx',
  'ui/sidebar.tsx',
  'ui/skeleton.tsx',
  'ui/slider.tsx',
  'ui/sonner.tsx',
  'ui/switch.tsx',
  'ui/table.tsx',
  'ui/tabs.tsx',
  'ui/textarea.tsx',
  'ui/toast.tsx',
  'ui/toaster.tsx',
  'ui/toggle-group.tsx',
  'ui/toggle.tsx',
  'ui/tooltip.tsx',
  'ui/use-toast.tsx',
  // misc
  'NavLink.tsx',
];

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function createComponent(file: string) {
  const fullPath = path.join(baseDir, file);
  await ensureDir(fullPath);
  const componentName = path.basename(file, '.tsx');
  const content = `import React from 'react';\n\nexport function ${componentName}(props: React.ComponentProps<'div'>) {\n  return <div {...props}>${componentName} placeholder</div>;\n}\n`;
  await fs.writeFile(fullPath, content, 'utf8');
}

async function main() {
  for (const comp of components) {
    await createComponent(comp);
  }
  console.log("Placeholder components generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
