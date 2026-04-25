'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  CheckCircle,
  Clock,
  Target,
  RotateCcw,
  Rocket,
  Calendar,
  Wrench,
  DollarSign,
  Users,
  BarChart3,
  Play,
  ChevronRight,
  Check,
  Sparkles,
  Loader2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TutorialStep {
  id: string;
  title: string;
  description: string;
}

interface Tutorial {
  key: string;
  title: string;
  description: string;
  estimatedTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  steps: TutorialStep[];
  icon: string;
}

interface UserTutorial {
  id: string;
  tutorialKey: string;
  completed: boolean;
  currentStep: number;
  totalSteps: number;
  completedAt: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'staysuite-tutorial-steps';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Calendar,
  Wrench,
  DollarSign,
  Users,
  BarChart3,
};

const difficultyColors: Record<string, string> = {
  Beginner:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  Intermediate:
    'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  Advanced:
    'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

const tutorials: Tutorial[] = [
  {
    key: 'getting-started',
    title: 'Getting Started with StaySuite',
    description:
      'Learn the fundamentals of StaySuite — navigate the dashboard, understand the sidebar, configure your profile, and get oriented with key modules.',
    estimatedTime: '15 min',
    difficulty: 'Beginner',
    steps: [
      {
        id: 'gs-1',
        title: 'Welcome to StaySuite',
        description:
          'Get an overview of the platform, its key features, and how it streamlines hotel operations.',
      },
      {
        id: 'gs-2',
        title: 'Navigating the Dashboard',
        description:
          'Understand the main dashboard layout — KPI cards, quick actions, charts, and the activity feed.',
      },
      {
        id: 'gs-3',
        title: 'Understanding the Sidebar',
        description:
          'Learn how the sidebar organizes modules: PMS, Bookings, Housekeeping, Reports, and more.',
      },
      {
        id: 'gs-4',
        title: 'Setting Up Your Profile',
        description:
          'Configure your user profile, notification preferences, and display settings.',
      },
      {
        id: 'gs-5',
        title: 'Property Overview',
        description:
          'Explore your property details, room inventory, and basic configuration options.',
      },
    ],
    icon: 'Rocket',
  },
  {
    key: 'booking-management',
    title: 'Booking Management',
    description:
      'Master the complete booking lifecycle — from creating reservations and assigning rooms to handling modifications, cancellations, and check-ins.',
    estimatedTime: '20 min',
    difficulty: 'Beginner',
    steps: [
      {
        id: 'bm-1',
        title: 'Creating a New Booking',
        description:
          'Step-by-step guide to creating a reservation: guest details, room selection, dates, and special requests.',
      },
      {
        id: 'bm-2',
        title: 'Searching Available Rooms',
        description:
          'Use the availability calendar to find the right room based on dates, room type, and guest preferences.',
      },
      {
        id: 'bm-3',
        title: 'Modifying Reservations',
        description:
          'Change dates, switch rooms, add services, or update guest information on existing bookings.',
      },
      {
        id: 'bm-4',
        title: 'Handling Cancellations',
        description:
          'Process cancellation requests, apply cancellation policies, and manage refund workflows.',
      },
      {
        id: 'bm-5',
        title: 'Guest Check-In Process',
        description:
          'Walk through the complete check-in: verify identity, assign room, generate key, and update status.',
      },
      {
        id: 'bm-6',
        title: 'Guest Check-Out & Folio',
        description:
          'Process check-out: review charges, close the folio, collect payment, and release the room.',
      },
    ],
    icon: 'Calendar',
  },
  {
    key: 'housekeeping-ops',
    title: 'Housekeeping Operations',
    description:
      'Learn how to manage room cleaning schedules, assign tasks, conduct inspections, and track maintenance workflows efficiently.',
    estimatedTime: '25 min',
    difficulty: 'Intermediate',
    steps: [
      {
        id: 'hk-1',
        title: 'Housekeeping Dashboard',
        description:
          'Overview of the housekeeping module — room status board, task queue, and daily priorities.',
      },
      {
        id: 'hk-2',
        title: 'Creating Cleaning Tasks',
        description:
          'Create and assign cleaning tasks manually or let the system auto-generate them based on check-outs.',
      },
      {
        id: 'hk-3',
        title: 'Room Inspection Checklists',
        description:
          'Use inspection templates to conduct quality checks. Learn how to create, customize, and fill checklists.',
      },
      {
        id: 'hk-4',
        title: 'Managing Maintenance Requests',
        description:
          'Report, assign, and track maintenance work orders from issue detection to resolution.',
      },
      {
        id: 'hk-5',
        title: 'Lost & Found Management',
        description:
          'Log found items, match them to guest reports, and manage the return or disposal process.',
      },
    ],
    icon: 'Wrench',
  },
  {
    key: 'revenue-pricing',
    title: 'Revenue & Pricing Strategy',
    description:
      'Understand how to set up room rates, create seasonal pricing rules, manage promotional offers, and analyze revenue performance.',
    estimatedTime: '20 min',
    difficulty: 'Intermediate',
    steps: [
      {
        id: 'rp-1',
        title: 'Understanding Rate Plans',
        description:
          'Learn about different rate plans: BAR, corporate, packages, and promotional rates.',
      },
      {
        id: 'rp-2',
        title: 'Setting Base Rates',
        description:
          'Configure base prices for each room type, including weekday and weekend differentials.',
      },
      {
        id: 'rp-3',
        title: 'Seasonal & Event Pricing',
        description:
          'Create pricing rules for high/low seasons, holidays, and special events.',
      },
      {
        id: 'rp-4',
        title: 'Promotional Offers',
        description:
          'Set up discount codes, flash sales, and package deals to drive bookings.',
      },
      {
        id: 'rp-5',
        title: 'Revenue Reports',
        description:
          'Interpret RevPAR, ADR, and occupancy reports to make data-driven pricing decisions.',
      },
    ],
    icon: 'DollarSign',
  },
  {
    key: 'guest-relations',
    title: 'Guest Relations & Communication',
    description:
      'Build strong guest relationships through effective communication, feedback management, and loyalty programs.',
    estimatedTime: '15 min',
    difficulty: 'Beginner',
    steps: [
      {
        id: 'gr-1',
        title: 'Guest Profile Management',
        description:
          'Create and maintain detailed guest profiles with preferences, history, and special notes.',
      },
      {
        id: 'gr-2',
        title: 'Communication Templates',
        description:
          'Set up automated email/SMS templates for confirmations, reminders, and post-stay follow-ups.',
      },
      {
        id: 'gr-3',
        title: 'Handling Guest Feedback',
        description:
          'Respond to reviews, manage complaints, and turn negative experiences into positive outcomes.',
      },
      {
        id: 'gr-4',
        title: 'VIP & Loyalty Programs',
        description:
          'Configure VIP tiers, loyalty point rules, and personalized perks for repeat guests.',
      },
    ],
    icon: 'Users',
  },
  {
    key: 'reports-analytics',
    title: 'Reports & Business Analytics',
    description:
      'Harness the power of data — learn to generate, customize, and interpret reports for better decision-making.',
    estimatedTime: '20 min',
    difficulty: 'Advanced',
    steps: [
      {
        id: 'ra-1',
        title: 'Report Types Overview',
        description:
          'Explore all available reports: occupancy, revenue, guest demographics, housekeeping, and more.',
      },
      {
        id: 'ra-2',
        title: 'Custom Report Builder',
        description:
          'Create custom reports by selecting metrics, date ranges, and visualization types.',
      },
      {
        id: 'ra-3',
        title: 'Dashboard Widgets',
        description:
          'Customize your dashboard with the most relevant KPIs and chart widgets.',
      },
      {
        id: 'ra-4',
        title: 'Exporting & Scheduling',
        description:
          'Export reports as PDF/CSV and set up automated scheduled report delivery.',
      },
      {
        id: 'ra-5',
        title: 'Benchmarking & Trends',
        description:
          'Compare performance across time periods, properties, and industry benchmarks.',
      },
    ],
    icon: 'BarChart3',
  },
];

// ─── LocalStorage Helpers ────────────────────────────────────────────────────

function getCompletedSteps(tutorialKey: string): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data[tutorialKey] || [];
  } catch {
    return [];
  }
}

function saveCompletedStep(tutorialKey: string, stepId: string) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!data[tutorialKey]) data[tutorialKey] = [];
    if (!data[tutorialKey].includes(stepId)) data[tutorialKey].push(stepId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function saveAllCompletedSteps(tutorialKey: string, stepIds: string[]) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data[tutorialKey] = stepIds;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function clearAllProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTutorialStatus(
  completedStepsCount: number,
  totalSteps: number
): 'Not Started' | 'In Progress' | 'Completed' {
  if (completedStepsCount === 0) return 'Not Started';
  if (completedStepsCount >= totalSteps) return 'Completed';
  return 'In Progress';
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
    case 'In Progress':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TutorialProgressPage() {
  const [userProgress, setUserProgress] = useState<UserTutorial[]>([]);
  const [completedStepsMap, setCompletedStepsMap] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markingStep, setMarkingStep] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [justCompletedTutorial, setJustCompletedTutorial] = useState<
    string | null
  >(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Load progress from API + localStorage
  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch server-side progress
      const response = await fetch('/api/tutorials/progress');
      const data = await response.json();
      if (data.success) {
        setUserProgress(data.data);
      }

      // Load completed steps from localStorage
      const stepsMap: Record<string, string[]> = {};
      tutorials.forEach((t) => {
        stepsMap[t.key] = getCompletedSteps(t.key);
      });
      setCompletedStepsMap(stepsMap);
    } catch {
      // Fallback: load everything from localStorage
      const stepsMap: Record<string, string[]> = {};
      tutorials.forEach((t) => {
        stepsMap[t.key] = getCompletedSteps(t.key);
      });
      setCompletedStepsMap(stepsMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // ─── Computed Stats ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let completedCount = 0;
    let inProgressCount = 0;
    let totalStepsAll = 0;
    let completedStepsAll = 0;

    tutorials.forEach((tutorial) => {
      const stepsDone = (completedStepsMap[tutorial.key] || []).length;
      const status = getTutorialStatus(stepsDone, tutorial.steps.length);

      if (status === 'Completed') completedCount++;
      else if (status === 'In Progress') inProgressCount++;

      totalStepsAll += tutorial.steps.length;
      completedStepsAll += stepsDone;
    });

    const overallPercentage =
      totalStepsAll > 0
        ? Math.round((completedStepsAll / totalStepsAll) * 100)
        : 0;

    return {
      total: tutorials.length,
      completed: completedCount,
      inProgress: inProgressCount,
      overallPercentage,
    };
  }, [completedStepsMap]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleOpenTutorial = (tutorial: Tutorial) => {
    setJustCompletedTutorial(null);
    setSelectedTutorial(tutorial);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedTutorial(null);
    setJustCompletedTutorial(null);
  };

  const handleMarkStepComplete = async (tutorialKey: string, stepId: string) => {
    setMarkingStep(stepId);
    try {
      // Call API
      await fetch('/api/tutorials/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialKey, stepId }),
      });

      // Save to localStorage as fallback
      saveCompletedStep(tutorialKey, stepId);

      // Update local state
      setCompletedStepsMap((prev) => ({
        ...prev,
        [tutorialKey]: [...(prev[tutorialKey] || []), stepId],
      }));

      // Check if tutorial is now fully completed
      const tutorial = tutorials.find((t) => t.key === tutorialKey);
      if (tutorial) {
        const updatedSteps = [...(completedStepsMap[tutorialKey] || []), stepId];
        if (updatedSteps.length >= tutorial.steps.length) {
          setJustCompletedTutorial(tutorial.title);
          toast.success(`You've completed "${tutorial.title}"! 🎉`);
        }
      }

      toast.success('Step marked as complete');
    } catch {
      // Still save locally even if API fails
      saveCompletedStep(tutorialKey, stepId);
      setCompletedStepsMap((prev) => ({
        ...prev,
        [tutorialKey]: [...(prev[tutorialKey] || []), stepId],
      }));
      toast.success('Step marked as complete');
    } finally {
      setMarkingStep(null);
    }
  };

  const handleMarkAllComplete = async (tutorialKey: string) => {
    setMarkingAll(true);
    try {
      const tutorial = tutorials.find((t) => t.key === tutorialKey);
      if (!tutorial) return;

      const allStepIds = tutorial.steps.map((s) => s.id);

      // Call API
      await fetch('/api/tutorials/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialKey, completed: true }),
      });

      // Save to localStorage
      saveAllCompletedSteps(tutorialKey, allStepIds);

      // Update local state
      setCompletedStepsMap((prev) => ({
        ...prev,
        [tutorialKey]: allStepIds,
      }));

      setJustCompletedTutorial(tutorial.title);
      toast.success(`You've completed "${tutorial.title}"! 🎉`);
    } catch {
      // Fallback: still save locally
      const tutorial = tutorials.find((t) => t.key === tutorialKey);
      if (tutorial) {
        const allStepIds = tutorial.steps.map((s) => s.id);
        saveAllCompletedSteps(tutorialKey, allStepIds);
        setCompletedStepsMap((prev) => ({
          ...prev,
          [tutorialKey]: allStepIds,
        }));
        setJustCompletedTutorial(tutorial.title);
        toast.success(`You've completed "${tutorial.title}"! 🎉`);
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const handleResetAll = async () => {
    setConfirmReset(false);
    try {
      // Clear localStorage
      clearAllProgress();
      setCompletedStepsMap({});
      setJustCompletedTutorial(null);
      toast.success('All tutorial progress has been reset');
    } catch {
      toast.error('Failed to reset progress');
    }
  };

  const handleContinueToNext = () => {
    if (!selectedTutorial) return;

    const currentIndex = tutorials.findIndex(
      (t) => t.key === selectedTutorial.key
    );
    const nextTutorial = tutorials[currentIndex + 1];

    if (nextTutorial) {
      setJustCompletedTutorial(null);
      setSelectedTutorial(nextTutorial);
    } else {
      handleCloseDialog();
      toast.info("You've completed all available tutorials! 🏆");
    }
  };

  // ─── Render Helpers ─────────────────────────────────────────────────────

  const getTutorialCompletedCount = (tutorialKey: string) => {
    return (completedStepsMap[tutorialKey] || []).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Tutorial Progress
          </h1>
          <p className="text-muted-foreground">
            Track your learning journey and master StaySuite features
          </p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Are you sure?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleResetAll}
            >
              Yes, Reset
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setConfirmReset(true)}
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All Progress
          </Button>
        )}
      </div>

      {/* ── Overview Stats Row ────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Tutorials Available
                </p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Completed
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  In Progress
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.inProgress}
                </p>
              </div>
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950 dark:to-fuchsia-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Overall Progress
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.overallPercentage}%
                </p>
              </div>
              <Target className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
            </div>
            <Progress
              value={stats.overallPercentage}
              className="mt-3 h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Available Tutorials Section ───────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Available Tutorials</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tutorials.map((tutorial) => {
            const completedCount = getTutorialCompletedCount(tutorial.key);
            const totalSteps = tutorial.steps.length;
            const progressPct =
              totalSteps > 0
                ? Math.round((completedCount / totalSteps) * 100)
                : 0;
            const status = getTutorialStatus(completedCount, totalSteps);
            const IconComponent = iconMap[tutorial.icon] || BookOpen;

            return (
              <Card
                key={tutorial.key}
                className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                onClick={() => handleOpenTutorial(tutorial)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${difficultyColors[tutorial.difficulty]}`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold leading-tight">
                          {tutorial.title}
                        </CardTitle>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 mt-1">
                    {tutorial.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={difficultyColors[tutorial.difficulty]}
                    >
                      {tutorial.difficulty}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {tutorial.estimatedTime}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={getStatusBadgeClasses(status)}
                    >
                      {status === 'Completed' && (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {status}
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {completedCount} of {totalSteps} steps
                      </span>
                      <span className="font-medium text-muted-foreground">
                        {progressPct}%
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                  </div>

                  {/* Action button */}
                  <Button
                    variant={status === 'Not Started' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenTutorial(tutorial);
                    }}
                  >
                    {status === 'Not Started' && (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Tutorial
                      </>
                    )}
                    {status === 'In Progress' && (
                      <>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Continue
                      </>
                    )}
                    {status === 'Completed' && (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Review Tutorial
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Tutorial Detail Dialog ───────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedTutorial && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${difficultyColors[selectedTutorial.difficulty]}`}
                  >
                    {(() => {
                      const IconComp =
                        iconMap[selectedTutorial.icon] || BookOpen;
                      return <IconComp className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <DialogTitle className="text-xl">
                      {selectedTutorial.title}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={difficultyColors[selectedTutorial.difficulty]}
                      >
                        {selectedTutorial.difficulty}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {selectedTutorial.estimatedTime}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {justCompletedTutorial ? (
                /* ── Completion Celebration ──────────────────────────────── */
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="relative inline-flex">
                      <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                      <div className="relative rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 p-6">
                        <Trophy className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Congratulations!
                      </h3>
                      <p className="text-muted-foreground text-lg">
                        You&apos;ve completed{' '}
                        <span className="font-semibold text-foreground">
                          {justCompletedTutorial}
                        </span>
                      </p>
                    </div>

                    {/* Confetti-like dots */}
                    <div className="flex justify-center gap-2">
                      {['bg-emerald-400', 'bg-amber-400', 'bg-cyan-400', 'bg-rose-400', 'bg-purple-400'].map(
                        (color, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${color} animate-bounce`}
                            style={{ animationDelay: `${i * 100}ms` }}
                          />
                        )
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <Button
                        onClick={handleContinueToNext}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Continue to Next Tutorial
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                      <Button variant="outline" onClick={handleCloseDialog}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Tutorial Steps ──────────────────────────────────────── */
                <>
                  {/* Progress overview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">
                        Progress
                      </span>
                      <span className="font-semibold">
                        {getTutorialCompletedCount(selectedTutorial.key)} of{' '}
                        {selectedTutorial.steps.length} steps completed
                      </span>
                    </div>
                    <Progress
                      value={
                        selectedTutorial.steps.length > 0
                          ? Math.round(
                              (getTutorialCompletedCount(
                                selectedTutorial.key
                              ) /
                                selectedTutorial.steps.length) *
                                100
                            )
                          : 0
                      }
                      className="h-2.5"
                    />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {selectedTutorial.description}
                  </p>

                  <Separator />

                  {/* Steps list */}
                  <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-4 pb-4">
                      {selectedTutorial.steps.map((step, index) => {
                        const isCompleted = (
                          completedStepsMap[selectedTutorial.key] || []
                        ).includes(step.id);

                        return (
                          <div
                            key={step.id}
                            className={`relative rounded-lg border p-4 transition-colors ${
                              isCompleted
                                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                : 'border-border bg-card'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              {/* Step number circle */}
                              <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
                                  isCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {isCompleted ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  index + 1
                                )}
                              </div>

                              {/* Step content */}
                              <div className="flex-1 min-w-0">
                                <h4
                                  className={`font-medium ${
                                    isCompleted
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : ''
                                  }`}
                                >
                                  {step.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {step.description}
                                </p>
                              </div>

                              {/* Mark complete button */}
                              {isCompleted ? (
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <CheckCircle className="h-5 w-5" />
                                  <span className="text-xs font-medium hidden sm:inline">
                                    Done
                                  </span>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
                                  disabled={markingStep === step.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkStepComplete(
                                      selectedTutorial.key,
                                      step.id
                                    );
                                  }}
                                >
                                  {markingStep === step.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                  )}
                                  Mark Complete
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  <Separator />

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCloseDialog}
                      className="flex-1 sm:flex-none"
                    >
                      Close
                    </Button>
                    {getTutorialCompletedCount(selectedTutorial.key) <
                      selectedTutorial.steps.length && (
                      <Button
                        onClick={() =>
                          handleMarkAllComplete(selectedTutorial.key)
                        }
                        disabled={markingAll}
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
                      >
                        {markingAll ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Mark All Complete
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
