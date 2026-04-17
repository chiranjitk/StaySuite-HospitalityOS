'use client';
import { lazy } from 'react';

const TasksList = lazy(() => import('@/components/housekeeping/tasks-list').then(m => ({ default: m.TasksList })));
const KanbanBoard = lazy(() => import('@/components/housekeeping/kanban-board').then(m => ({ default: m.KanbanBoard })));
const RoomStatus = lazy(() => import('@/components/housekeeping/room-status').then(m => ({ default: m.RoomStatus })));
const Maintenance = lazy(() => import('@/components/housekeeping/maintenance').then(m => ({ default: m.Maintenance })));
const Assets = lazy(() => import('@/components/housekeeping/assets').then(m => ({ default: m.Assets })));
const HousekeepingAutomation = lazy(() => import('@/components/housekeeping/housekeeping-automation').then(m => ({ default: m.HousekeepingAutomation })));
const InspectionChecklists = lazy(() => import('@/components/housekeeping/inspection-checklists').then(m => ({ default: m.InspectionChecklists })));

export const housekeepingSections: Record<string, React.LazyExoticComponent<any>> = {
  TasksList,
  KanbanBoard,
  RoomStatus,
  Maintenance,
  Assets,
  HousekeepingAutomation,
  InspectionChecklists,
};
