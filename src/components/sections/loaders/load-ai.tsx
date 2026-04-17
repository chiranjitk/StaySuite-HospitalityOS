// Category loader: AI
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'ai-copilot':
      return import('@/components/ai/copilot');
    case 'ai-provider':
    case 'ai-settings':
      return import('@/components/ai/provider-settings');
    case 'ai-insights':
      return import('@/components/ai/insights');
    default:
      throw new Error(`Unknown ai section: ${section}`);
  }
}
