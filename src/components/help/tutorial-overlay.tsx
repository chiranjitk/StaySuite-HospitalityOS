'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  X, ChevronLeft, ChevronRight, Check, HelpCircle, 
  Lightbulb, Target, Loader2, Play, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for the target element
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: string; // Optional action description
  highlight?: boolean;
}

interface TutorialConfig {
  key: string;
  title: string;
  description: string;
  steps: TutorialStep[];
}

interface TutorialProgress {
  id: string;
  tutorialKey: string;
  completed: boolean;
  currentStep: number;
  totalSteps: number;
  completedAt: string | null;
}

// Predefined tutorials
const tutorials: Record<string, TutorialConfig> = {
  'first-booking': {
    key: 'first-booking',
    title: 'Create Your First Booking',
    description: 'Learn how to create and manage bookings in StaySuite',
    steps: [
      {
        id: 'step-1',
        title: 'Welcome to Bookings',
        description: 'The booking module is where you manage all reservations. Let\'s learn how to create a new booking.',
        position: 'bottom',
      },
      {
        id: 'step-2',
        title: 'Navigate to Bookings',
        description: 'Click on "Bookings" in the sidebar to access the booking management section.',
        target: '[data-tour="bookings-menu"]',
        position: 'right',
        highlight: true,
      },
      {
        id: 'step-3',
        title: 'Create New Booking',
        description: 'Click the "New Booking" button to start creating a reservation. You\'ll need guest details and room preferences.',
        position: 'bottom',
        action: 'Click "New Booking" button',
      },
      {
        id: 'step-4',
        title: 'Fill Guest Details',
        description: 'Enter the guest\'s personal information including name, contact details, and any special requests.',
        position: 'bottom',
      },
      {
        id: 'step-5',
        title: 'Select Room',
        description: 'Choose an available room for the guest. You can see real-time availability and room status.',
        position: 'bottom',
      },
      {
        id: 'step-6',
        title: 'Complete Booking',
        description: 'Review the booking details and click "Confirm" to complete the reservation. Great job! You\'ve created your first booking.',
        position: 'bottom',
      },
    ],
  },
  'guest-checkin': {
    key: 'guest-checkin',
    title: 'Guest Check-In Process',
    description: 'Learn the complete check-in workflow',
    steps: [
      {
        id: 'step-1',
        title: 'Welcome to Front Desk',
        description: 'The Front Desk module helps you manage guest arrivals and departures efficiently.',
        position: 'bottom',
      },
      {
        id: 'step-2',
        title: 'View Arrivals',
        description: 'Check the "Upcoming Arrivals" panel to see guests expected to check in today.',
        target: '[data-tour="arrivals-panel"]',
        position: 'left',
        highlight: true,
      },
      {
        id: 'step-3',
        title: 'Verify Guest Identity',
        description: 'Always verify the guest\'s identity by checking their ID documents before proceeding.',
        position: 'bottom',
      },
      {
        id: 'step-4',
        title: 'Assign Room',
        description: 'Select an available room that matches the guest\'s preferences and booking details.',
        position: 'bottom',
      },
      {
        id: 'step-5',
        title: 'Generate Key Card',
        description: 'Create a key card for the guest. For digital keys, the guest can use their mobile app.',
        position: 'bottom',
      },
      {
        id: 'step-6',
        title: 'Complete Check-In',
        description: 'Click "Complete Check-In" to finalize. The room status will update automatically.',
        position: 'bottom',
      },
    ],
  },
  'dashboard-tour': {
    key: 'dashboard-tour',
    title: 'Dashboard Overview',
    description: 'Get familiar with the main dashboard',
    steps: [
      {
        id: 'step-1',
        title: 'Welcome to StaySuite',
        description: 'This is your main dashboard where you can see key metrics and manage daily operations.',
        position: 'bottom',
      },
      {
        id: 'step-2',
        title: 'KPI Cards',
        description: 'View today\'s occupancy, revenue, and other key performance indicators at a glance.',
        target: '[data-tour="kpi-cards"]',
        position: 'bottom',
        highlight: true,
      },
      {
        id: 'step-3',
        title: 'Quick Actions',
        description: 'Use quick action buttons to perform common tasks like check-ins, check-outs, and new bookings.',
        target: '[data-tour="quick-actions"]',
        position: 'left',
        highlight: true,
      },
      {
        id: 'step-4',
        title: 'Charts & Analytics',
        description: 'View revenue trends, occupancy charts, and other visual analytics.',
        target: '[data-tour="charts"]',
        position: 'top',
        highlight: true,
      },
      {
        id: 'step-5',
        title: 'Ready to Go!',
        description: 'You\'re all set! Explore the sidebar to discover more features like PMS, Bookings, and Reports.',
        position: 'bottom',
      },
    ],
  },
};

interface TutorialOverlayProps {
  tutorialKey: string;
  userId: string;
  tenantId?: string; // Optional - will be derived from auth session on server
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
}

export function TutorialOverlay({
  tutorialKey,
  userId,
  tenantId, // Not used client-side, server derives from session
  onComplete,
  onSkip,
  autoStart = true,
}: TutorialOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const tutorial = tutorials[tutorialKey];

  useEffect(() => {
    if (autoStart && tutorial) {
      fetchProgress();
    }
  }, [tutorialKey, autoStart, tutorial]);

  useEffect(() => {
    if (!tutorial) return;
    
    const step = tutorial.steps[currentStep];
    if (step?.target) {
      const element = document.querySelector(step.target) as HTMLElement;
      setTargetElement(element);
      
      // Scroll to element if it exists
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetElement(null);
    }
  }, [currentStep, tutorial]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('userId', userId);
      params.append('tutorialKey', tutorialKey);

      const response = await fetch(`/api/tutorials/progress?${params}`);
      const data = await response.json();

      if (data.success) {
        setProgress(data.data);
        if (!data.data.completed) {
          setCurrentStep(data.data.currentStep || 0);
          setIsOpen(true);
        }
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = useCallback(async (step: number, completed: boolean = false) => {
    try {
      await fetch('/api/tutorials/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tutorialKey,
          currentStep: step,
          totalSteps: tutorial?.steps.length || 0,
        }),
      });

      if (completed) {
        await fetch('/api/tutorials/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            tutorialKey,
            action: 'complete',
          }),
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }, [userId, tutorialKey, tutorial?.steps.length]);

  const handleNext = async () => {
    if (!tutorial) return;

    const nextStep = currentStep + 1;
    if (nextStep >= tutorial.steps.length) {
      // Complete tutorial
      await updateProgress(nextStep, true);
      setIsOpen(false);
      toast.success('Tutorial completed! 🎉');
      onComplete?.();
    } else {
      setCurrentStep(nextStep);
      await updateProgress(nextStep);
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      await updateProgress(prevStep);
    }
  };

  const handleSkip = async () => {
    await updateProgress(currentStep);
    setIsOpen(false);
    onSkip?.();
  };

  const handleReset = async () => {
    try {
      await fetch('/api/tutorials/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tutorialKey,
          action: 'reset',
        }),
      });
      setCurrentStep(0);
      await updateProgress(0);
    } catch (error) {
      console.error('Error resetting progress:', error);
    }
  };

  const startTutorial = () => {
    setIsOpen(true);
    setCurrentStep(0);
  };

  if (!tutorial) {
    return null;
  }

  const step = tutorial.steps[currentStep];
  const progressPercent = ((currentStep + 1) / tutorial.steps.length) * 100;

  // Calculate position for the tooltip
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetElement) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const padding = 16;
    const tooltipWidth = 360;

    switch (step?.position) {
      case 'left':
        return {
          position: 'fixed',
          top: rect.top,
          left: rect.left - tooltipWidth - padding,
        };
      case 'right':
        return {
          position: 'fixed',
          top: rect.top,
          left: rect.right + padding,
        };
      case 'top':
        return {
          position: 'fixed',
          top: rect.top - padding,
          left: rect.left,
          transform: 'translateY(-100%)',
        };
      case 'bottom':
      default:
        return {
          position: 'fixed',
          top: rect.bottom + padding,
          left: rect.left,
        };
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="w-72 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm">Loading tutorial...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already completed
  if (progress?.completed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="w-72 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-sm">{tutorial.title}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Restart Tutorial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tutorial start prompt
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="w-72 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full bg-teal-100 dark:bg-teal-900 p-2">
                <Lightbulb className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="font-medium text-sm">{tutorial.title}</p>
                <p className="text-xs text-muted-foreground">{tutorial.steps.length} steps</p>
              </div>
            </div>
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={startTutorial}
            >
              <Play className="h-3 w-3 mr-2" />
              Start Tutorial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active tutorial overlay
  return (
    <>
      {/* Backdrop with spotlight */}
      {targetElement && (
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Highlight the target element */}
      {targetElement && step?.highlight && (
        <div
          className="fixed z-40 pointer-events-none ring-4 ring-emerald-500 ring-offset-2 rounded-lg"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
          }}
        />
      )}

      {/* Tutorial Card */}
      <Card 
        className="fixed z-50 w-[360px] shadow-xl"
        style={getTooltipStyle()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <Badge variant="outline">
                Step {currentStep + 1} of {tutorial.steps.length}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progressPercent} className="h-1" />
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <CardTitle className="text-base">{step?.title}</CardTitle>
            <CardDescription className="mt-1">
              {step?.description}
            </CardDescription>
          </div>

          {step?.action && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium">{step.action}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
            >
              Skip Tutorial
            </Button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleNext}
              >
                {currentStep === tutorial.steps.length - 1 ? (
                  <>
                    Complete
                    <Check className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Export tutorials for external use
export { tutorials };
