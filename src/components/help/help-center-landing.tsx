'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Rocket,
  Calendar,
  Users,
  DollarSign,
  Wrench,
  BarChart3,
  ChevronDown,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Mail,
  Clock,
  BookOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Data Types ────────────────────────────────────────────────────────────────

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  status: string;
  createdAt: string;
  publishedAt: string | null;
}

// ─── Category Colors ───────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  'getting-started': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'bookings': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'guests': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'reports': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'settings': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'integrations': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

// ─── Quick Access Cards Data ───────────────────────────────────────────────────

const quickAccessCards = [
  {
    icon: Rocket,
    title: 'Getting Started',
    description: 'Set up your property, configure rooms, and start managing bookings',
    gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    border: 'border-amber-200/60 dark:border-amber-800/40',
  },
  {
    icon: Calendar,
    title: 'Booking Management',
    description: 'Create, modify, and track reservations from inquiry to checkout',
    gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
  },
  {
    icon: Users,
    title: 'Guest Relations',
    description: 'Guest profiles, communication, VIP management, and loyalty programs',
    gradient: 'from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/50',
    border: 'border-cyan-200/60 dark:border-cyan-800/40',
  },
  {
    icon: DollarSign,
    title: 'Revenue & Billing',
    description: 'Pricing strategies, invoicing, payments, and financial reports',
    gradient: 'from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-900/50',
    border: 'border-rose-200/60 dark:border-rose-800/40',
  },
  {
    icon: Wrench,
    title: 'Housekeeping & Maintenance',
    description: 'Room cleaning schedules, inspections, and maintenance workflows',
    gradient: 'from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    border: 'border-purple-200/60 dark:border-purple-800/40',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Occupancy trends, revenue analysis, and performance dashboards',
    gradient: 'from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-900/50',
    border: 'border-teal-200/60 dark:border-teal-800/40',
  },
];

// ─── FAQ Data ──────────────────────────────────────────────────────────────────

const faqs = [
  {
    question: 'How do I create my first booking?',
    answer:
      'To create your first booking in StaySuite, navigate to the Bookings section from the main sidebar. Click the "New Booking" button, which will open the booking form. Fill in the guest details (name, email, phone), select the check-in and check-out dates, choose the desired room type, and assign a specific room if needed. You can also add special requests or notes. Once all details are filled in, review the booking summary including the total cost, and click "Confirm Booking." The system will automatically update room availability and send a confirmation notification to the guest if automated communications are enabled.',
  },
  {
    question: 'Can I manage multiple properties?',
    answer:
      'Yes, StaySuite fully supports multi-property management. You can add additional properties from the Settings > Properties section. Each property can have its own room types, pricing, staff assignments, and configurations. The system provides a centralized dashboard where you can switch between properties or view consolidated reports across all your properties. Room types, rate plans, and inventory can be managed independently per property, or you can use the Chain Management features to apply policies across selected or all properties simultaneously.',
  },
  {
    question: 'How does the housekeeping scheduling work?',
    answer:
      'The housekeeping module in StaySuite provides automated scheduling based on guest check-outs, stay-over preferences, and room status changes. When a guest checks out, the room is automatically flagged for cleaning. Housekeeping managers can assign tasks to staff members through the Kanban board or task list view. Each task includes room number, task type (cleaning, deep clean, inspection), priority level, and estimated duration. Staff can update task status in real-time from their mobile devices. The system also supports recurring cleaning schedules for public areas and preventive maintenance workflows.',
  },
  {
    question: 'What payment gateways are supported?',
    answer:
      'StaySuite integrates with several leading payment gateways including Stripe, PayPal, and Adyen. You can configure your preferred payment methods in Settings > Integrations > Payment Gateways. Each gateway supports various payment methods such as credit/debit cards, bank transfers, and digital wallets. StaySuite handles PCI compliance requirements so you don\'t have to store sensitive card data. You can enable split payments, process refunds, and set up automatic billing for long-stay guests. Multi-currency support is available for properties serving international guests.',
  },
  {
    question: 'How do I set up automated guest communications?',
    answer:
      'Navigate to Settings > Notifications to configure automated guest communications. StaySuite provides a template-based system where you can create email and SMS templates for various triggers such as booking confirmation, pre-arrival, check-in reminder, post-checkout thank you, and review requests. Each template supports dynamic variables like guest name, room number, check-in date, and Wi-Fi credentials. You can schedule communications based on timing rules (e.g., send check-in instructions 24 hours before arrival). The system also supports multi-language templates for international properties.',
  },
  {
    question: 'Can I export reports?',
    answer:
      'Yes, StaySuite provides comprehensive export capabilities for all reports. In the Reports section, you can generate reports on occupancy, revenue, guest demographics, booking sources, and more. Each report can be exported in multiple formats including PDF, Excel (XLSX), and CSV. You can also schedule automated report delivery to specified email addresses on a daily, weekly, or monthly basis. For advanced analytics, StaySuite offers a REST API that allows you to pull report data directly into your business intelligence tools such as Power BI, Tableau, or Google Data Studio.',
  },
  {
    question: 'How do I manage room rates and seasonal pricing?',
    answer:
      'Room rates and seasonal pricing are managed through the Revenue > Pricing Rules section. You can create rate plans for different seasons, events, or demand periods. The system supports base rates, percentage-based adjustments, and fixed-amount overrides. You can set up seasonal rate calendars where different rates apply automatically based on date ranges. StaySuite also features AI-powered demand forecasting that suggests optimal pricing based on historical occupancy data, local events, and market trends. Length-of-stay discounts, early bird rates, and last-minute deals can all be configured within the pricing rules engine.',
  },
  {
    question: 'What is the inspection checklist and how do I use it?',
    answer:
      'The inspection checklist is a quality control tool within the Housekeeping module. Navigate to Housekeeping > Inspections to access it. Managers can create customizable inspection templates with items categorized by area (bathroom, bedroom, amenities, etc.). Each item can be marked as pass/fail or given a rating. When inspecting a room, staff members go through the checklist on their device, marking each item. Failed items can automatically generate maintenance work orders. Inspection results are tracked over time, allowing management to identify trends and reward consistently high-performing staff. Templates can be customized per room type.',
  },
  {
    question: 'How do I handle overbooking situations?',
    answer:
      'StaySuite provides built-in overbooking protection and management tools. In Settings > Booking Rules, you can set overbooking thresholds per room type based on your historical no-show and cancellation rates. The system will alert you when approaching these limits. If an overbooking occurs, the platform suggests solutions such as upgrading guests to higher room categories, offering compensation, or rebooking at partner properties. The dashboard highlights overbooked dates in red, and you can use the Walk-in Management feature to reassign rooms efficiently. Automated notifications can be sent to affected guests with rebooking options.',
  },
  {
    question: 'Can I integrate with my existing PMS?',
    answer:
      'Yes, StaySuite offers extensive integration capabilities with existing Property Management Systems. Navigate to Settings > Integrations to view available connectors. We support two-way synchronization with popular PMS platforms, allowing you to sync bookings, guest profiles, room inventory, and rates in real-time. Additionally, StaySuite provides a REST API and webhook system for custom integrations. Channel managers like SiteMinder and Cloudbeds can be connected to synchronize availability across OTAs (Booking.com, Expedia, Airbnb, etc.). Our integration team can also assist with custom API development for proprietary systems.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HelpCenterLanding() {
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);

  // ── Fetch published articles ──────────────────────────────────────────────
  useEffect(() => {
    async function fetchArticles() {
      try {
        setArticlesLoading(true);
        const res = await fetch('/api/help/articles?status=published&limit=6');
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.articles)) {
          setArticles(data.data.articles);
        }
      } catch (err) {
        console.error('Error fetching help articles:', err);
        // Articles will stay empty — graceful empty state shown
      } finally {
        setArticlesLoading(false);
      }
    }
    fetchArticles();
  }, []);

  // ── Filter articles by search ────────────────────────────────────────────
  const filteredArticles = searchQuery
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : articles;

  // ── Format date helper ───────────────────────────────────────────────────
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ── Handle article feedback ──────────────────────────────────────────────
  const handleFeedback = async (articleId: string, helpful: boolean) => {
    try {
      const res = await fetch(`/api/help/articles/${articleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });
      if (res.ok) {
        setFeedbackSubmitted(articleId);
        toast.success(helpful ? 'Thanks for your feedback!' : 'Sorry to hear that. We\'ll improve this article.');
        // Update local article counts
        setSelectedArticle((prev) =>
          prev
            ? {
                ...prev,
                helpfulCount: prev.helpfulCount + (helpful ? 1 : 0),
                notHelpfulCount: prev.notHelpfulCount + (helpful ? 0 : 1),
              }
            : null
        );
      }
    } catch {
      toast.error('Failed to submit feedback. Please try again.');
    }
  };

  // ── Search handler with toast ────────────────────────────────────────────
  const handleSearch = () => {
    if (searchQuery.trim()) {
      toast.info(`Searching for "${searchQuery}" across all articles...`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50/80 dark:from-gray-950 dark:to-gray-900/80">
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* 1. Hero / Header Section                                            */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-gray-200/60 dark:border-gray-800/60">
        {/* Decorative background elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-100/40 dark:bg-amber-900/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-100/40 dark:bg-emerald-900/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Knowledge Base
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
            Help Center
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to get the most out of StaySuite
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search articles, guides, and tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-12 pr-4 py-6 text-base rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 focus:border-amber-400 dark:focus:border-amber-600 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* ────────────────────────────────────────────────────────────────── */}
        {/* 2. Quick Access Cards                                              */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Browse by Topic</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Find the help you need, organized by category
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickAccessCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.title}
                  className={`group relative overflow-hidden border ${card.border} bg-gradient-to-br ${card.gradient} hover:shadow-lg transition-all duration-300 cursor-pointer`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center`}
                      >
                        <Icon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                          {card.title}
                        </h3>
                        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 mt-1 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Separator className="max-w-xs mx-auto" />

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* 3. Popular Articles Section                                        */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Popular Articles</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Most viewed guides and tutorials from our knowledge base
            </p>
          </div>

          {articlesLoading ? (
            /* Loading Skeleton Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-5/6 mb-4" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            /* Empty State */
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery
                    ? `No results for "${searchQuery}". Try a different search term.`
                    : 'Published articles will appear here once they are created.'}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear search
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Articles Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArticles.map((article) => (
                <Card
                  key={article.id}
                  className="group cursor-pointer hover:shadow-md transition-all duration-200 border-gray-200 dark:border-gray-800"
                  onClick={() => {
                    setSelectedArticle(article);
                    setFeedbackSubmitted(null);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${categoryColors[article.category] || categoryColors['settings']}`}
                      >
                        {article.category.replace(/-/g, ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="text-base leading-snug group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors line-clamp-2">
                      {article.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {article.excerpt && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {article.viewCount} views
                      </span>
                      {article.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(article.publishedAt)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Separator className="max-w-xs mx-auto" />

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* 4. FAQ Accordion Section                                          */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Quick answers to common questions about using StaySuite
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === `faq-${index}`;
              return (
                <Collapsible
                  key={`faq-${index}`}
                  open={isOpen}
                  onOpenChange={(open) => setOpenFaq(open ? `faq-${index}` : null)}
                  className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden data-[state=open]:shadow-md transition-shadow"
                >
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <span className="font-medium text-sm sm:text-base pr-4 text-gray-900 dark:text-white">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                      <Separator className="mb-4" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </section>

        <Separator className="max-w-xs mx-auto" />

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* 5. Contact Support Card                                            */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <section>
          <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50">
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-rose-950/30">
              <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Still Need Help?</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
                  Our support team is here to assist you. Reach out through any of the channels below.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto">
                  {/* Contact Support */}
                  <Card className="border border-gray-200/80 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Contact Support</h3>
                      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                        Get in touch with our team directly for personalized assistance
                      </p>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="h-4 w-4" />
                          <span>[support email]</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          [phone number]
                        </p>
                      </div>
                      <Button variant="outline" className="mt-4 w-full" onClick={() => {
                        toast.info('Support contact details: [support email] / [phone number]');
                      }}>
                        Get in Touch
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Submit a Request */}
                  <Card className="border border-gray-200/80 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-4">
                        <Mail className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Submit a Request</h3>
                      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                        Fill out a support ticket form and we&apos;ll get back to you within 24 hours
                      </p>
                      <div className="mt-4">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Describe your issue, attach screenshots, and track your request status
                        </p>
                      </div>
                      <Button className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                        toast.info('Support request form would open here. Configure in Settings.');
                      }}>
                        Submit Request
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
                  [Your Organization Name] — Dedicated to your success
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* Article Viewer Dialog                                              */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedArticle}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedArticle(null);
            setFeedbackSubmitted(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {selectedArticle && (
            <>
              {/* Dialog Header */}
              <DialogHeader className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    className={`text-xs ${categoryColors[selectedArticle.category] || categoryColors['settings']}`}
                  >
                    {selectedArticle.category.replace(/-/g, ' ')}
                  </Badge>
                </div>
                <DialogTitle className="text-xl leading-snug">
                  {selectedArticle.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Article content and details
                </DialogDescription>
              </DialogHeader>

              {/* Dialog Body */}
              <ScrollArea className="flex-1 max-h-[calc(90vh-12rem)]">
                <div className="px-6 py-4">
                  <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedArticle.content}
                  </div>
                </div>
              </ScrollArea>

              {/* Dialog Footer — Meta & Feedback */}
              <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-gray-50/80 dark:bg-gray-900/80">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {selectedArticle.viewCount} views
                    </span>
                    {selectedArticle.publishedAt && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(selectedArticle.publishedAt)}
                      </span>
                    )}
                  </div>

                  {/* Feedback buttons */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                      Was this helpful?
                    </span>
                    <Button
                      variant={feedbackSubmitted === 'up' ? 'default' : 'outline'}
                      size="sm"
                      className={
                        feedbackSubmitted === 'up'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : ''
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeedback(selectedArticle.id, true);
                      }}
                      disabled={!!feedbackSubmitted}
                    >
                      <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                      {selectedArticle.helpfulCount + (feedbackSubmitted === 'up' ? 1 : 0)}
                    </Button>
                    <Button
                      variant={feedbackSubmitted === 'down' ? 'default' : 'outline'}
                      size="sm"
                      className={
                        feedbackSubmitted === 'down'
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : ''
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeedback(selectedArticle.id, false);
                      }}
                      disabled={!!feedbackSubmitted}
                    >
                      <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                      {selectedArticle.notHelpfulCount + (feedbackSubmitted === 'down' ? 1 : 0)}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
