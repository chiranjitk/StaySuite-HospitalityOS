'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Zap, Mail, MessageSquare, Bell, Star, Calendar, 
  User, Gift, Clock, AlertTriangle, CheckCircle, Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: string;
  actions: Array<{ type: string; description: string }>;
  icon: React.ReactNode;
  popular?: boolean;
  premium?: boolean;
}

const templates: Template[] = [
  {
    id: 'welcome-email',
    name: 'Welcome Email Sequence',
    description: 'Send a personalized welcome email to guests after their first booking',
    category: 'Guest Communication',
    trigger: 'booking.created',
    actions: [
      { type: 'send_email', description: 'Send welcome email with property info' },
      { type: 'add_tag', description: 'Tag guest as "new guest"' },
    ],
    icon: <Mail className="h-5 w-5" />,
    popular: true,
  },
  {
    id: 'pre-arrival',
    name: 'Pre-Arrival Reminder',
    description: 'Send check-in instructions and reminders 24 hours before arrival',
    category: 'Guest Communication',
    trigger: 'scheduled.daily',
    actions: [
      { type: 'send_email', description: 'Send pre-arrival email' },
      { type: 'send_sms', description: 'Send check-in reminder SMS' },
    ],
    icon: <Calendar className="h-5 w-5" />,
    popular: true,
  },
  {
    id: 'post-stay-feedback',
    name: 'Post-Stay Feedback Request',
    description: 'Request guest feedback 24 hours after check-out',
    category: 'Guest Communication',
    trigger: 'guest.check_out',
    actions: [
      { type: 'send_email', description: 'Send feedback request email' },
    ],
    icon: <Star className="h-5 w-5" />,
    popular: true,
  },
  {
    id: 'loyalty-upgrade',
    name: 'Loyalty Tier Upgrade',
    description: 'Celebrate and notify guests when they reach a new loyalty tier',
    category: 'Loyalty',
    trigger: 'loyalty.tier_upgraded',
    actions: [
      { type: 'send_email', description: 'Send congratulations email' },
      { type: 'send_notification', description: 'Push notification about new benefits' },
      { type: 'update_loyalty', description: 'Apply tier upgrade bonus points' },
    ],
    icon: <Gift className="h-5 w-5" />,
    premium: true,
  },
  {
    id: 'birthday-greeting',
    name: 'Birthday Greeting',
    description: 'Send personalized birthday wishes with special offer',
    category: 'Loyalty',
    trigger: 'guest.birthday',
    actions: [
      { type: 'send_email', description: 'Send birthday email with discount' },
      { type: 'add_tag', description: 'Tag as "birthday campaign sent"' },
    ],
    icon: <Gift className="h-5 w-5" />,
  },
  {
    id: 'abandoned-booking',
    name: 'Abandoned Booking Recovery',
    description: 'Follow up with guests who started but didn\'t complete booking',
    category: 'Revenue',
    trigger: 'booking.abandoned',
    actions: [
      { type: 'send_email', description: 'Send reminder email with incentive' },
    ],
    icon: <AlertTriangle className="h-5 w-5" />,
    premium: true,
  },
  {
    id: 'payment-receipt',
    name: 'Payment Receipt',
    description: 'Automatically send payment confirmation and receipt',
    category: 'Billing',
    trigger: 'payment.received',
    actions: [
      { type: 'send_email', description: 'Send payment receipt email' },
      { type: 'send_notification', description: 'Push notification confirmation' },
    ],
    icon: <CheckCircle className="h-5 w-5" />,
  },
  {
    id: 'checkin-followup',
    name: 'Check-in Follow-up',
    description: 'Check on guest satisfaction 2 hours after check-in',
    category: 'Guest Communication',
    trigger: 'guest.check_in',
    actions: [
      { type: 'send_notification', description: 'Send satisfaction check notification' },
      { type: 'create_task', description: 'Create front desk follow-up task' },
    ],
    icon: <User className="h-5 w-5" />,
  },
  {
    id: 'room-ready',
    name: 'Room Ready Notification',
    description: 'Notify guests when their room is ready for early check-in',
    category: 'Guest Communication',
    trigger: 'room.status_changed',
    actions: [
      { type: 'send_sms', description: 'Send room ready SMS' },
      { type: 'send_notification', description: 'Push notification' },
    ],
    icon: <Bell className="h-5 w-5" />,
  },
  {
    id: 'maintenance-alert',
    name: 'Maintenance Alert',
    description: 'Create urgent task when maintenance issue reported',
    category: 'Operations',
    trigger: 'feedback.received',
    actions: [
      { type: 'create_task', description: 'Create high-priority maintenance task' },
      { type: 'send_notification', description: 'Alert maintenance team' },
    ],
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    id: 'checkout-reminder',
    name: 'Check-out Reminder',
    description: 'Remind guests of check-out time and process',
    category: 'Guest Communication',
    trigger: 'scheduled.daily',
    actions: [
      { type: 'send_sms', description: 'Send check-out reminder' },
    ],
    icon: <Clock className="h-5 w-5" />,
  },
  {
    id: 'vip-welcome',
    name: 'VIP Welcome Package',
    description: 'Special welcome workflow for VIP guests',
    category: 'VIP',
    trigger: 'booking.confirmed',
    actions: [
      { type: 'create_task', description: 'Create VIP welcome setup task' },
      { type: 'send_email', description: 'Send VIP welcome email' },
      { type: 'add_tag', description: 'Tag as VIP guest' },
    ],
    icon: <Star className="h-5 w-5" />,
    premium: true,
  },
];

const categories = ['All', 'Guest Communication', 'Loyalty', 'Revenue', 'Billing', 'Operations', 'VIP'];

export default function Templates() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const filteredTemplates = selectedCategory === 'All'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleUseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setCustomName(template.name);
    setCustomDescription(template.description);
    setCustomizeDialogOpen(true);
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          description: customDescription,
          triggerEvent: selectedTemplate.trigger,
          actions: JSON.stringify(selectedTemplate.actions.map(a => ({
            type: a.type,
            config: {},
          }))),
          isActive: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Automation created from template');
        setCustomizeDialogOpen(false);
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error creating from template:', error);
      toast.error('Failed to create automation');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Guest Communication': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
      'Loyalty': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
      'Revenue': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
      'Billing': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
      'Operations': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'VIP': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Automation Templates</h1>
        <p className="text-muted-foreground">
          Pre-built automation templates to get you started quickly
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={selectedCategory === category ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow relative">
            {template.popular && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-amber-500 text-white">Popular</Badge>
              </div>
            )}
            {template.premium && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-purple-500 text-white">Premium</Badge>
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900 p-2">
                  {template.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <Badge className={getCategoryColor(template.category)} variant="secondary">
                    {template.category}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Trigger:</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {template.trigger.replace(/_/g, ' ').replace(/\./g, ' - ')}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Actions:</p>
                <div className="space-y-1">
                  {template.actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      {action.description}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleUseTemplate(template)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customize Template Dialog */}
      <Dialog open={customizeDialogOpen} onOpenChange={setCustomizeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Template</DialogTitle>
            <DialogDescription>
              Give your automation a name and description
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Automation name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="What this automation does"
                rows={3}
              />
            </div>

            {selectedTemplate && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Template includes:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Trigger: {selectedTemplate.trigger}</li>
                  <li>• {selectedTemplate.actions.length} action(s)</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFromTemplate} className="bg-emerald-600 hover:bg-emerald-700">
              Create Automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              Try selecting a different category
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
