'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Zap, Plus, ArrowRight, Play, Pause, Trash2, Settings, 
  Mail, MessageSquare, Bell, Tag, Calendar, User, Building,
  ChevronDown, ChevronUp, Copy, Save, X, Check
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface Workflow {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  nodes: WorkflowNode[];
  edges: { from: string; to: string }[];
}

const triggerOptions = [
  { value: 'booking.created', label: 'Booking Created', icon: Calendar },
  { value: 'booking.confirmed', label: 'Booking Confirmed', icon: Check },
  { value: 'booking.cancelled', label: 'Booking Cancelled', icon: X },
  { value: 'guest.check_in', label: 'Guest Check-in', icon: User },
  { value: 'guest.check_out', label: 'Guest Check-out', icon: User },
  { value: 'payment.received', label: 'Payment Received', icon: Tag },
  { value: 'feedback.received', label: 'Feedback Received', icon: MessageSquare },
];

const actionOptions = [
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { value: 'send_notification', label: 'Push Notification', icon: Bell },
  { value: 'add_tag', label: 'Add Tag to Guest', icon: Tag },
  { value: 'update_loyalty', label: 'Update Loyalty Points', icon: Zap },
  { value: 'create_task', label: 'Create Task', icon: Calendar },
];

const conditionOptions = [
  { value: 'loyalty_tier', label: 'Loyalty Tier' },
  { value: 'total_spent', label: 'Total Spent' },
  { value: 'total_stays', label: 'Total Stays' },
  { value: 'booking_value', label: 'Booking Value' },
  { value: 'stay_duration', label: 'Stay Duration' },
  { value: 'room_type', label: 'Room Type' },
];

export default function WorkflowBuilder() {
  const [workflow, setWorkflow] = useState<Workflow>({
    name: '',
    description: '',
    isActive: true,
    nodes: [],
    edges: [],
  });
  const [savedWorkflows, setSavedWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [nodeType, setNodeType] = useState<'trigger' | 'condition' | 'action'>('trigger');

  // Form state for nodes
  const [nodeForm, setNodeForm] = useState({
    name: '',
    config: {} as Record<string, unknown>,
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/rules');
      const data = await response.json();

      if (data.success) {
        // Convert automation rules to workflow format
        const workflows: Workflow[] = data.data.rules.map((rule: {
          id: string;
          name: string;
          description: string | null;
          triggerEvent: string;
          actions: string;
          isActive: boolean;
        }) => ({
          id: rule.id,
          name: rule.name,
          description: rule.description || '',
          isActive: rule.isActive,
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger',
              name: rule.triggerEvent,
              config: { event: rule.triggerEvent },
              position: { x: 0, y: 0 },
            },
            ...JSON.parse(rule.actions).map((action: { type: string; config: Record<string, unknown> }, i: number) => ({
              id: `action-${i + 1}`,
              type: 'action' as const,
              name: action.type,
              config: action.config || {},
              position: { x: 0, y: (i + 1) * 100 },
            })),
          ],
          edges: (() => {
            const edges: { from: string; to: string }[] = [];
            const allNodes = [
              { id: 'trigger-1' },
              ...JSON.parse(rule.actions).map((_: unknown, i: number) => ({ id: `action-${i + 1}` })),
            ];
            for (let i = 0; i < allNodes.length - 1; i++) {
              edges.push({ from: allNodes[i].id, to: allNodes[i + 1].id });
            }
            return edges;
          })(),
        }));

        setSavedWorkflows(workflows);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast.error('Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  };

  const createNewWorkflow = () => {
    setWorkflow({
      name: '',
      description: '',
      isActive: true,
      nodes: [],
      edges: [],
    });
  };

  const addNode = (type: 'trigger' | 'condition' | 'action') => {
    setNodeType(type);
    setNodeForm({ name: '', config: {} });
    setNodeDialogOpen(true);
  };

  const saveNode = () => {
    if (!nodeForm.name) {
      toast.error('Please select an option');
      return;
    }

    const newNode: WorkflowNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      name: nodeForm.name,
      config: nodeForm.config,
      position: { x: 0, y: workflow.nodes.length * 100 },
    };

    const newNodes = [...workflow.nodes, newNode];
    let newEdges = [...workflow.edges];

    // Auto-connect to previous node
    if (workflow.nodes.length > 0) {
      const lastNode = workflow.nodes[workflow.nodes.length - 1];
      newEdges.push({ from: lastNode.id, to: newNode.id });
    }

    setWorkflow({
      ...workflow,
      nodes: newNodes,
      edges: newEdges,
    });

    setNodeDialogOpen(false);
    setNodeForm({ name: '', config: {} });
  };

  const removeNode = (nodeId: string) => {
    const newNodes = workflow.nodes.filter(n => n.id !== nodeId);
    const newEdges = workflow.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    setWorkflow({ ...workflow, nodes: newNodes, edges: newEdges });
  };

  const saveWorkflow = async () => {
    if (!workflow.name) {
      toast.error('Workflow name is required');
      return;
    }

    if (workflow.nodes.length === 0) {
      toast.error('Add at least one node to the workflow');
      return;
    }

    try {
      // Extract trigger and actions
      const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
      const actionNodes = workflow.nodes.filter(n => n.type === 'action');

      if (!triggerNode) {
        toast.error('Workflow must have a trigger');
        return;
      }

      if (actionNodes.length === 0) {
        toast.error('Workflow must have at least one action');
        return;
      }

      // Extract condition nodes and serialize them
      const conditionNodes = workflow.nodes.filter(n => n.type === 'condition');

      const payload = {
        name: workflow.name,
        description: workflow.description,
        triggerEvent: triggerNode.config.event || triggerNode.name,
        triggerConditions: conditionNodes.length > 0
          ? JSON.stringify(conditionNodes.map(c => ({
              type: c.name,
              config: c.config,
            })))
          : null,
        actions: JSON.stringify(actionNodes.map(a => ({
          type: a.name,
          config: a.config,
        }))),
        isActive: workflow.isActive,
      };

      const url = workflow.id ? '/api/automation/rules' : '/api/automation/rules';
      const method = workflow.id ? 'PUT' : 'POST';
      const body = workflow.id ? { ...payload, id: workflow.id } : payload;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(workflow.id ? 'Workflow updated' : 'Workflow created');
        fetchWorkflows();
        createNewWorkflow();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    }
  };

  const getNodeIcon = (type: string, name: string) => {
    if (type === 'trigger') {
      return triggerOptions.find(t => t.value === name)?.icon || Zap;
    }
    if (type === 'action') {
      return actionOptions.find(a => a.value === name)?.icon || Zap;
    }
    return Settings;
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'trigger': return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950';
      case 'condition': return 'border-amber-500 bg-amber-50 dark:bg-amber-950';
      case 'action': return 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Workflow Builder</h1>
        <p className="text-muted-foreground">
          Create automated workflows with triggers and actions
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Saved Workflows */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Saved Workflows</CardTitle>
              <Button size="sm" variant="outline" onClick={createNewWorkflow}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                </div>
              ) : savedWorkflows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No workflows yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedWorkflows.map((wf) => (
                    <div
                      key={wf.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        workflow.id === wf.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                          : 'hover:border-gray-400'
                      }`}
                      onClick={() => setWorkflow(wf)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{wf.name}</span>
                        <Badge variant={wf.isActive ? 'default' : 'secondary'} className="text-xs">
                          {wf.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {wf.description || wf.nodes[0]?.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Workflow Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Input
                  placeholder="Workflow Name"
                  value={workflow.name}
                  onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                  className="text-lg font-semibold border-none px-0 h-auto focus-visible:ring-0"
                />
                <Input
                  placeholder="Description (optional)"
                  value={workflow.description}
                  onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                  className="text-sm border-none px-0 h-auto focus-visible:ring-0"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={createNewWorkflow}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={saveWorkflow} className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Workflow Canvas */}
            <div className="min-h-[400px] border-2 border-dashed rounded-lg p-4">
              {workflow.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                  <Zap className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Start Building Your Workflow</p>
                  <p className="text-sm mb-4">Add triggers and actions to automate your processes</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => addNode('trigger')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Trigger
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {workflow.nodes.map((node, index) => {
                    const NodeIcon = getNodeIcon(node.type, node.name);
                    return (
                      <div key={node.id}>
                        <div
                          className={`p-4 rounded-lg border-2 ${getNodeColor(node.type)} cursor-pointer hover:shadow-md transition-shadow`}
                          onClick={() => setSelectedNode(node)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-white dark:bg-gray-800 p-2">
                                <NodeIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                              </div>
                              <div>
                                <Badge variant="outline" className="mb-1">
                                  {node.type}
                                </Badge>
                                <p className="font-medium">
                                  {triggerOptions.find(t => t.value === node.name)?.label ||
                                   actionOptions.find(a => a.value === node.name)?.label ||
                                   node.name}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNode(node.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                            </Button>
                          </div>
                        </div>

                        {/* Add Node Button */}
                        {index === workflow.nodes.length - 1 && node.type !== 'action' && (
                          <div className="flex justify-center my-4">
                            <div className="flex flex-col items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                              <div className="flex gap-2">
                                {node.type === 'trigger' && (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => addNode('condition')}>
                                      <Settings className="h-4 w-4 mr-1" />
                                      Condition
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => addNode('action')}>
                                      <Zap className="h-4 w-4 mr-1" />
                                      Action
                                    </Button>
                                  </>
                                )}
                                {node.type === 'condition' && (
                                  <Button variant="outline" size="sm" onClick={() => addNode('action')}>
                                    <Zap className="h-4 w-4 mr-1" />
                                    Action
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {index < workflow.nodes.length - 1 && (
                          <div className="flex justify-center my-2">
                            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Another Action */}
                  {workflow.nodes.length > 0 && workflow.nodes[workflow.nodes.length - 1].type === 'action' && (
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => addNode('action')}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Another Action
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            {workflow.nodes.length > 0 && (
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <span>{workflow.nodes.filter(n => n.type === 'trigger').length} trigger(s)</span>
                <span>{workflow.nodes.filter(n => n.type === 'condition').length} condition(s)</span>
                <span>{workflow.nodes.filter(n => n.type === 'action').length} action(s)</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Node Dialog */}
      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}</DialogTitle>
            <DialogDescription>
              Configure the {nodeType} for your workflow
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select {nodeType}</label>
              <Select value={nodeForm.name} onValueChange={(v) => setNodeForm({ ...nodeForm, name: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose a ${nodeType}`} />
                </SelectTrigger>
                <SelectContent>
                  {(nodeType === 'trigger' ? triggerOptions : actionOptions).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Config options based on selection */}
            {nodeType === 'action' && nodeForm.name === 'send_email' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Template</label>
                <Select onValueChange={(v) => setNodeForm({ ...nodeForm, config: { ...nodeForm.config, template: v } })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome Email</SelectItem>
                    <SelectItem value="confirmation">Booking Confirmation</SelectItem>
                    <SelectItem value="checkout">Check-out Summary</SelectItem>
                    <SelectItem value="feedback">Feedback Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {nodeType === 'action' && nodeForm.name === 'send_sms' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Message Template</label>
                <Textarea
                  placeholder="Enter SMS message..."
                  onChange={(e) => setNodeForm({ ...nodeForm, config: { ...nodeForm.config, message: e.target.value } })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNode} className="bg-emerald-600 hover:bg-emerald-700">
              Add {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
