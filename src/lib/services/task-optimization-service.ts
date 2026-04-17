/**
 * StaySuite Task Optimization Service
 * 
 * AI-based task assignment optimization for housekeeping operations.
 * Features:
 * - Optimal task assignment based on staff skills
 * - Workload balancing across staff
 * - Priority-based scheduling
 * - Location/zone optimization
 * - Time estimation for tasks
 */

import { db } from '@/lib/db';

// Types
export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
  skills: StaffSkill[];
  currentWorkload: number;
  efficiency: number;
  currentLocation?: { floor: number; zone: string };
}

export interface StaffSkill {
  skillName: string;
  skillLevel: number;
  category: string;
  certified: boolean;
}

export interface TaskForOptimization {
  id: string;
  type: string;
  category: string;
  title: string;
  priority: string;
  estimatedDuration: number;
  roomId?: string;
  room?: {
    id: string;
    number: string;
    floor: number;
    propertyId: string;
  };
  requiredSkills?: string[];
  zone?: string;
}

export interface AssignmentSuggestion {
  taskId: string;
  taskTitle: string;
  suggestedUserId: string;
  suggestedUserName: string;
  score: number;
  reason: string;
  factors: {
    skillMatch: number;
    workloadBalance: number;
    locationProximity: number;
    priorityMatch: number;
    efficiency: number;
  };
}

export interface OptimizationResult {
  suggestions: AssignmentSuggestion[];
  unassignedTasks: TaskForOptimization[];
  stats: {
    totalTasks: number;
    assignedTasks: number;
    staffUtilization: Record<string, number>;
    averageScore: number;
  };
}

export interface RouteOptimization {
  userId: string;
  userName: string;
  tasks: Array<{
    id: string;
    title: string;
    roomNumber?: string;
    floor: number;
    order: number;
    estimatedMinutes: number;
    distanceFromPrevious: number;
  }>;
  totalDistance: number;
  totalMinutes: number;
  zones: string[];
}

export interface WorkloadDistribution {
  userId: string;
  userName: string;
  totalTasks: number;
  totalMinutes: number;
  capacityMinutes: number;
  utilization: number;
  tasksByPriority: Record<string, number>;
  tasksByType: Record<string, number>;
}

// Weights for scoring factors
const SCORING_WEIGHTS = {
  skillMatch: 0.35,
  workloadBalance: 0.25,
  locationProximity: 0.20,
  priorityMatch: 0.15,
  efficiency: 0.05,
};

// Time estimates by task type (in minutes)
const DEFAULT_TIME_ESTIMATES: Record<string, number> = {
  cleaning: 30,
  deep_clean: 60,
  maintenance: 45,
  inspection: 15,
  turnover: 45,
  restocking: 20,
  other: 30,
};

// Priority multipliers for scheduling
const PRIORITY_WEIGHTS: Record<string, number> = {
  urgent: 4.0,
  high: 3.0,
  medium: 2.0,
  low: 1.0,
};

/**
 * Task Optimization Service Class
 */
export class TaskOptimizationService {
  /**
   * Get optimal task assignments using AI-based algorithm
   */
  async getOptimizedAssignments(
    tenantId: string,
    propertyId?: string,
    options?: {
      excludeAssigned?: boolean;
      considerSkills?: boolean;
      balanceWorkload?: boolean;
      optimizeLocation?: boolean;
    }
  ): Promise<OptimizationResult> {
    const opts = {
      excludeAssigned: true,
      considerSkills: true,
      balanceWorkload: true,
      optimizeLocation: true,
      ...options,
    };

    // Get unassigned tasks
    const tasks = await this.getTasksForOptimization(tenantId, propertyId, opts.excludeAssigned);
    
    // Get available staff with their skills and workload
    const staff = await this.getAvailableStaff(tenantId, propertyId);

    if (staff.length === 0) {
      return {
        suggestions: [],
        unassignedTasks: tasks,
        stats: {
          totalTasks: tasks.length,
          assignedTasks: 0,
          staffUtilization: {},
          averageScore: 0,
        },
      };
    }

    const suggestions: AssignmentSuggestion[] = [];
    const unassignedTasks: TaskForOptimization[] = [];
    const staffUtilization: Record<string, number> = {};

    // Initialize staff utilization
    staff.forEach(s => {
      staffUtilization[s.id] = s.currentWorkload;
    });

    // Sort tasks by priority (urgent first)
    const sortedTasks = this.sortTasksByPriority(tasks);

    for (const task of sortedTasks) {
      let bestMatch: { userId: string; score: number; reason: string; factors: AssignmentSuggestion['factors'] } | null = null;

      for (const member of staff) {
        const score = this.calculateAssignmentScore(task, member, staffUtilization[member.id], opts);
        
        if (!bestMatch || score.score > bestMatch.score) {
          bestMatch = {
            userId: member.id,
            score: score.score,
            reason: score.reason,
            factors: score.factors,
          };
        }
      }

      if (bestMatch && bestMatch.score >= 30) { // Minimum threshold
        const member = staff.find(s => s.id === bestMatch!.userId)!;
        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          suggestedUserId: bestMatch.userId,
          suggestedUserName: `${member.firstName} ${member.lastName}`,
          score: bestMatch.score,
          reason: bestMatch.reason,
          factors: bestMatch.factors,
        });

        // Update staff utilization
        staffUtilization[bestMatch.userId] += task.estimatedDuration;
      } else {
        unassignedTasks.push(task);
      }
    }

    // Calculate stats
    const totalCapacity = staff.reduce((sum, s) => sum + 480, 0); // 8 hours per staff
    const totalAssigned = Object.values(staffUtilization).reduce((sum, w) => sum + w, 0);
    
    const utilization: Record<string, number> = {};
    Object.entries(staffUtilization).forEach(([id, minutes]) => {
      utilization[id] = Math.round((minutes / 480) * 100);
    });

    return {
      suggestions,
      unassignedTasks,
      stats: {
        totalTasks: tasks.length,
        assignedTasks: suggestions.length,
        staffUtilization: utilization,
        averageScore: suggestions.length > 0 
          ? suggestions.reduce((sum, s) => sum + s.score, 0) / suggestions.length 
          : 0,
      },
    };
  }

  /**
   * Run optimization and store suggestions in database
   */
  async runOptimization(
    tenantId: string,
    propertyId?: string
  ): Promise<{ suggestionsCreated: number; suggestions: AssignmentSuggestion[] }> {
    // Clear old pending suggestions
    await db.taskAssignmentSuggestion.updateMany({
      where: {
        tenantId,
        status: 'pending',
      },
      data: {
        status: 'expired',
      },
    });

    // Get optimized assignments
    const result = await this.getOptimizedAssignments(tenantId, propertyId);

    // Store suggestions in database
    const suggestionsToCreate = result.suggestions.map(s => ({
      tenantId,
      taskId: s.taskId,
      suggestedUserId: s.suggestedUserId,
      score: s.score,
      reason: s.reason,
      factors: JSON.stringify(s.factors),
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    }));

    if (suggestionsToCreate.length > 0) {
      await db.taskAssignmentSuggestion.createMany({
        data: suggestionsToCreate,
      });
    }

    return {
      suggestionsCreated: suggestionsToCreate.length,
      suggestions: result.suggestions,
    };
  }

  /**
   * Apply accepted suggestions to tasks
   */
  async applySuggestions(
    tenantId: string,
    suggestionIds?: string[]
  ): Promise<{ applied: number; errors: string[] }> {
    const errors: string[] = [];
    let applied = 0;

    const where = suggestionIds
      ? { tenantId, id: { in: suggestionIds }, status: 'pending' }
      : { tenantId, status: 'pending' };

    const suggestions = await db.taskAssignmentSuggestion.findMany({ where });

    for (const suggestion of suggestions) {
      try {
        // Update task with suggested assignee
        await db.task.update({
          where: { id: suggestion.taskId },
          data: { assignedTo: suggestion.suggestedUserId },
        });

        // Mark suggestion as accepted
        await db.taskAssignmentSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: 'accepted',
            acceptedAt: new Date(),
          },
        });

        applied++;
      } catch (error) {
        errors.push(`Failed to apply suggestion ${suggestion.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { applied, errors };
  }

  /**
   * Get optimal routes for staff
   */
  async getOptimalRoutes(
    tenantId: string,
    propertyId: string,
    date?: Date
  ): Promise<RouteOptimization[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get tasks assigned for the date
    const tasks = await db.task.findMany({
      where: {
        tenantId,
        propertyId,
        assignedTo: { not: null },
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['pending', 'in_progress'] },
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Group tasks by assignee
    const tasksByAssignee = new Map<string, typeof tasks>();

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      
      const existing = tasksByAssignee.get(task.assignedTo) || [];
      existing.push(task);
      tasksByAssignee.set(task.assignedTo, existing);
    }

    const routes: RouteOptimization[] = [];

    for (const [userId, userTasks] of tasksByAssignee) {
      const firstTask = userTasks[0];
      const userName = firstTask.assignee 
        ? `${firstTask.assignee.firstName} ${firstTask.assignee.lastName}` 
        : 'Unknown';

      // Sort tasks by floor and room number for optimal route
      const sortedTasks = this.optimizeTaskRoute(userTasks);

      let totalDistance = 0;
      let totalMinutes = 0;
      const zones = new Set<string>();
      let previousFloor = 0;

      const routeTasks = sortedTasks.map((task, index) => {
        const floor = task.room?.floor || 0;
        const distanceFromPrevious = index === 0 ? floor : Math.abs(floor - previousFloor);
        const timeEstKey = task.type as string;
        const estimatedMinutes = (task.estimatedDuration as number | undefined) || DEFAULT_TIME_ESTIMATES[timeEstKey] || 30;

        totalDistance += distanceFromPrevious + (index > 0 ? 1 : 0); // Add 1 for room-to-room movement
        totalMinutes += estimatedMinutes;
        previousFloor = floor;

        if (floor > 0) {
          zones.add(`Floor ${floor}`);
        }

        return {
          id: task.id,
          title: task.title,
          roomNumber: (task.room as { number?: string } | null)?.number,
          floor,
          order: index + 1,
          estimatedMinutes,
          distanceFromPrevious,
        };
      });

      routes.push({
        userId,
        userName,
        tasks: routeTasks as RouteOptimization['tasks'],
        totalDistance,
        totalMinutes,
        zones: Array.from(zones),
      });
    }

    // Sort routes by total distance (most efficient first)
    return routes.sort((a, b) => a.totalDistance - b.totalDistance);
  }

  /**
   * Get workload distribution
   */
  async getWorkloadDistribution(
    tenantId: string,
    propertyId?: string,
    date?: Date
  ): Promise<WorkloadDistribution[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get tasks for the date
    const tasks = await db.task.findMany({
      where: {
        tenantId,
        propertyId: propertyId || undefined,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Group by assignee
    const byAssignee = new Map<string, {
      user: { id: string; firstName: string; lastName: string } | null;
      tasks: typeof tasks;
    }>();

    for (const task of tasks) {
      const key = task.assignedTo || 'unassigned';
      const existing = byAssignee.get(key) || { user: task.assignee, tasks: [] };
      existing.tasks.push(task);
      byAssignee.set(key, existing);
    }

    const distributions: WorkloadDistribution[] = [];

    for (const [userId, data] of byAssignee) {
      if (userId === 'unassigned') continue;

      const totalMinutes = data.tasks.reduce((sum, t) => 
        sum + (t.estimatedDuration || DEFAULT_TIME_ESTIMATES[t.type] || 30), 0
      );

      const tasksByPriority: Record<string, number> = {};
      const tasksByType: Record<string, number> = {};

      for (const task of data.tasks) {
        tasksByPriority[task.priority] = (tasksByPriority[task.priority] || 0) + 1;
        tasksByType[task.type] = (tasksByType[task.type] || 0) + 1;
      }

      // Get or create workload record
      let workload = await db.staffWorkload.findUnique({
        where: {
          userId_date: {
            userId,
            date: startOfDay,
          },
        },
      });

      if (!workload) {
        workload = await db.staffWorkload.create({
          data: {
            tenantId,
            userId,
            propertyId,
            date: startOfDay,
            totalTasks: data.tasks.length,
            totalMinutes,
            capacityMinutes: 480,
          },
        });
      }

      distributions.push({
        userId,
        userName: data.user 
          ? `${data.user.firstName} ${data.user.lastName}` 
          : 'Unknown',
        totalTasks: data.tasks.length,
        totalMinutes,
        capacityMinutes: workload.capacityMinutes,
        utilization: Math.round((totalMinutes / workload.capacityMinutes) * 100),
        tasksByPriority,
        tasksByType,
      });
    }

    return distributions.sort((a, b) => b.utilization - a.utilization);
  }

  /**
   * Rebalance workload across staff
   */
  async rebalanceWorkload(
    tenantId: string,
    propertyId: string,
    options?: {
      maxUtilization?: number;
      minUtilization?: number;
    }
  ): Promise<{ rebalanced: number; changes: Array<{ taskId: string; from: string; to: string }> }> {
    const opts = {
      maxUtilization: 90,
      minUtilization: 30,
      ...options,
    };

    const distribution = await this.getWorkloadDistribution(tenantId, propertyId);
    const changes: Array<{ taskId: string; from: string; to: string }> = [];

    // Find overloaded and underloaded staff
    const overloaded = distribution.filter(d => d.utilization > opts.maxUtilization);
    const underloaded = distribution.filter(d => d.utilization < opts.minUtilization);

    if (overloaded.length === 0 || underloaded.length === 0) {
      return { rebalanced: 0, changes: [] };
    }

    let rebalanced = 0;

    for (const over of overloaded) {
      // Get tasks that can be moved
      const tasksToMove = await db.task.findMany({
        where: {
          tenantId,
          propertyId,
          assignedTo: over.userId,
          status: 'pending',
          priority: { not: 'urgent' }, // Don't move urgent tasks
        },
        orderBy: { priority: 'asc' }, // Move lower priority tasks first
        take: Math.ceil((over.utilization - opts.maxUtilization) / 10),
      });

      for (const task of tasksToMove) {
        // Find best underloaded staff member
        const target = underloaded.reduce((best, u) => {
          const bestUtil = best?.utilization || 0;
          return u.utilization < bestUtil ? u : best;
        }, underloaded[0]);

        if (target && target.utilization < opts.maxUtilization) {
          // Reassign task
          await db.task.update({
            where: { id: task.id },
            data: { assignedTo: target.userId },
          });

          changes.push({
            taskId: task.id,
            from: over.userId,
            to: target.userId,
          });

          rebalanced++;

          // Update utilization
          over.utilization -= Math.round(((task.estimatedDuration || 30) / over.capacityMinutes) * 100);
          target.utilization += Math.round(((task.estimatedDuration || 30) / target.capacityMinutes) * 100);
        }
      }
    }

    return { rebalanced, changes };
  }

  /**
   * Update staff capacity
   */
  async updateStaffCapacity(
    tenantId: string,
    userId: string,
    date: Date,
    capacityMinutes: number
  ): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    await db.staffWorkload.upsert({
      where: {
        userId_date: {
          userId,
          date: startOfDay,
        },
      },
      create: {
        tenantId,
        userId,
        date: startOfDay,
        capacityMinutes,
      },
      update: {
        capacityMinutes,
      },
    });
  }

  // Private helper methods

  private async getTasksForOptimization(
    tenantId: string,
    propertyId?: string,
    excludeAssigned: boolean = true
  ): Promise<TaskForOptimization[]> {
    const tasks = await db.task.findMany({
      where: {
        tenantId,
        propertyId: propertyId || undefined,
        status: 'pending',
        assignedTo: excludeAssigned ? null : undefined,
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            propertyId: true,
          },
        },
      },
    });

    return tasks.map(task => ({
      id: task.id,
      type: task.type,
      category: task.category,
      title: task.title,
      priority: task.priority,
      estimatedDuration: task.estimatedDuration || DEFAULT_TIME_ESTIMATES[task.type] || 30,
      roomId: task.roomId || undefined,
      room: task.room || undefined,
      requiredSkills: this.getRequiredSkillsForTask(task.type, task.category),
    }));
  }

  private async getAvailableStaff(
    tenantId: string,
    propertyId?: string
  ): Promise<StaffMember[]> {
    // Get staff with housekeeping department or job title
    const users = await db.user.findMany({
      where: {
        tenantId,
        status: 'active',
        OR: [
          { department: 'housekeeping' },
          { department: 'maintenance' },
          { jobTitle: { contains: 'housekeep' } },
          { jobTitle: { contains: 'cleaner' } },
          { jobTitle: { contains: 'attendant' } },
        ],
      },
      include: {
        staffSkills: true,
      },
    });

    // Get current workload for each staff member
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const workloads = await db.staffWorkload.findMany({
      where: {
        tenantId,
        date: today,
      },
    });

    const workloadMap = new Map(workloads.map(w => [w.userId, w]));

    return users.map(user => {
      const workload = workloadMap.get(user.id);
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        jobTitle: user.jobTitle,
        skills: user.staffSkills.map(s => ({
          skillName: s.skillName,
          skillLevel: s.skillLevel,
          category: s.category,
          certified: s.certified,
        })),
        currentWorkload: workload?.totalMinutes || 0,
        efficiency: workload?.efficiency || 1.0,
      };
    });
  }

  private calculateAssignmentScore(
    task: TaskForOptimization,
    staff: StaffMember,
    currentWorkload: number,
    options: { considerSkills: boolean; balanceWorkload: boolean; optimizeLocation: boolean }
  ): { score: number; reason: string; factors: AssignmentSuggestion['factors'] } {
    const factors: AssignmentSuggestion['factors'] = {
      skillMatch: 0,
      workloadBalance: 0,
      locationProximity: 0,
      priorityMatch: 0,
      efficiency: staff.efficiency * 100,
    };

    const reasons: string[] = [];

    // Calculate skill match
    if (options.considerSkills && task.requiredSkills) {
      const matchedSkills = task.requiredSkills.filter(req =>
        staff.skills.some(s => 
          s.skillName.toLowerCase().includes(req.toLowerCase()) ||
          s.category.toLowerCase().includes(req.toLowerCase())
        )
      );
      factors.skillMatch = (matchedSkills.length / task.requiredSkills.length) * 100;
      
      if (matchedSkills.length > 0) {
        reasons.push(`Has ${matchedSkills.length} required skill(s)`);
      }
    } else {
      factors.skillMatch = 50; // Default if no skills required
    }

    // Calculate workload balance (prefer less loaded staff)
    if (options.balanceWorkload) {
      const capacityMinutes = 480;
      const utilization = (currentWorkload / capacityMinutes) * 100;
      factors.workloadBalance = Math.max(0, 100 - utilization);
      
      if (utilization < 50) {
        reasons.push(`Low current workload (${Math.round(utilization)}%)`);
      } else if (utilization > 80) {
        reasons.push(`High current workload (${Math.round(utilization)}%)`);
      }
    } else {
      factors.workloadBalance = 50;
    }

    // Calculate location proximity
    if (options.optimizeLocation && task.room) {
      // Prefer staff already on the same floor
      if (staff.currentLocation && staff.currentLocation.floor === task.room.floor) {
        factors.locationProximity = 100;
        reasons.push('Already on same floor');
      } else {
        // Score based on floor distance
        const floorDiff = staff.currentLocation 
          ? Math.abs(staff.currentLocation.floor - task.room.floor) 
          : task.room.floor;
        factors.locationProximity = Math.max(0, 100 - (floorDiff * 10));
      }
    } else {
      factors.locationProximity = 50;
    }

    // Calculate priority match
    const priorityWeight = PRIORITY_WEIGHTS[task.priority] || 1;
    factors.priorityMatch = (priorityWeight / 4) * 100; // Normalize to 0-100
    
    if (task.priority === 'urgent' || task.priority === 'high') {
      reasons.push(`Good fit for ${task.priority} priority task`);
    }

    // Calculate final score
    const score = 
      factors.skillMatch * SCORING_WEIGHTS.skillMatch +
      factors.workloadBalance * SCORING_WEIGHTS.workloadBalance +
      factors.locationProximity * SCORING_WEIGHTS.locationProximity +
      factors.priorityMatch * SCORING_WEIGHTS.priorityMatch +
      factors.efficiency * SCORING_WEIGHTS.efficiency;

    const reason = reasons.length > 0 
      ? reasons.join('. ') 
      : 'Available for assignment';

    return { score: Math.round(score), reason, factors };
  }

  private sortTasksByPriority(tasks: TaskForOptimization[]): TaskForOptimization[] {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...tasks].sort((a, b) => {
      const orderA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
      const orderB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
      return orderA - orderB;
    });
  }

  private optimizeTaskRoute(tasks: Array<{ room?: { floor: number } | null } & { id: string; [key: string]: unknown }>): typeof tasks {
    // Simple floor-based optimization - group by floor and sort
    return [...tasks].sort((a, b) => {
      const floorA = a.room?.floor || 0;
      const floorB = b.room?.floor || 0;
      return floorA - floorB;
    });
  }

  private getRequiredSkillsForTask(type: string, category: string): string[] {
    const skills: Record<string, string[]> = {
      cleaning: ['cleaning', 'housekeeping'],
      deep_clean: ['deep cleaning', 'detailing'],
      maintenance: ['maintenance', 'repair'],
      inspection: ['inspection', 'quality control'],
      turnover: ['turnover', 'cleaning', 'housekeeping'],
      restocking: ['inventory', 'restocking'],
    };

    return skills[type] || [category];
  }
}

// Export singleton instance
export const taskOptimizationService = new TaskOptimizationService();
