// Category loader: Automation
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'automation-workflow':
    case 'automation-workflows':
      return import('@/components/automation/workflow-builder');
    case 'automation-rules':
      return import('@/components/automation/rules-engine');
    case 'automation-templates':
      return import('@/components/automation/templates');
    case 'automation-logs':
      return import('@/components/automation/execution-logs');
    default:
      throw new Error(`Unknown automation section: ${section}`);
  }
}
