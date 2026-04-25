import { db } from './db';

/**
 * Calculate inspection score based on passed required items.
 * Score = (passed required items / total required items) * 100
 * If no required items exist, return 100 (perfect score).
 */
export function calculateInspectionScore(
  items: Array<{ passed: boolean; required: boolean }>
): number {
  const requiredItems = items.filter((i) => i.required);
  if (requiredItems.length === 0) return 100;
  const passedRequired = requiredItems.filter((i) => i.passed).length;
  return Math.round((passedRequired / requiredItems.length) * 100);
}

export interface InspectionItemInput {
  templateItemId: string;
  name: string;
  passed: boolean;
  required: boolean;
  notes?: string;
  photoUrl?: string;
}

export interface ProcessInspectionResultParams {
  tenantId: string;
  propertyId: string;
  roomId: string;
  taskId?: string;
  templateId: string;
  inspectorId: string;
  items: InspectionItemInput[];
  notes?: string;
}

/**
 * Process a completed inspection result.
 *
 * 1. Validate template exists and belongs to tenant
 * 2. Validate room belongs to property in tenant
 * 3. Calculate score and determine pass/fail
 * 4. Create InspectionResult record
 * 5. If failed + has taskId:
 *    a. Re-assign task back to cleaner with failed items list
 *    b. Mark result as reAssigned
 *    c. Keep room status as-is
 * 6. If passed:
 *    a. Update room: housekeepingStatus = 'inspected', lastInspectedAt, inspectedBy
 * 7. Return the created result
 */
export async function processInspectionResult(
  params: ProcessInspectionResultParams
) {
  const {
    tenantId,
    propertyId,
    roomId,
    taskId,
    templateId,
    inspectorId,
    items,
    notes,
  } = params;

  // 1. Validate template exists and belongs to tenant
  const template = await db.inspectionTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.tenantId !== tenantId) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }

  // 2. Validate room exists on the correct property
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { property: { select: { id: true, tenantId: true } } },
  });

  if (!room || room.propertyId !== propertyId || room.property.tenantId !== tenantId) {
    throw new Error('ROOM_NOT_FOUND');
  }

  // 3. Calculate score
  const score = calculateInspectionScore(items);
  const passed = score === 100;

  // Build items JSON with only the fields we store
  const itemsJson = JSON.stringify(
    items.map((item) => ({
      templateItemId: item.templateItemId,
      name: item.name,
      passed: item.passed,
      notes: item.notes || null,
      photoUrl: item.photoUrl || null,
    }))
  );

  // Find failed required items for re-assignment
  const failedRequiredItems = items.filter(
    (item) => item.required && !item.passed
  );

  // 4-6. Execute in a transaction for consistency
  const result = await db.$transaction(async (tx) => {
    // 4. Create InspectionResult record
    const inspectionResult = await tx.inspectionResult.create({
      data: {
        tenantId,
        propertyId,
        roomId,
        taskId,
        templateId,
        inspectorId,
        score,
        passed,
        items: itemsJson,
        notes,
        completedAt: new Date(),
        reAssigned: false,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    // 5. If failed and has taskId → re-assign task
    if (!passed && taskId) {
      // Re-assign task back to pending with failed items in notes
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'pending',
          priority: 'high',
          notes: `Re-inspection failed (score: ${score}). Failed required items:\n${failedRequiredItems.map((i) => `- ${i.name}${i.notes ? ': ' + i.notes : ''}`).join('\n')}`,
        },
      });

      // Mark result as re-assigned
      await tx.inspectionResult.update({
        where: { id: inspectionResult.id },
        data: { reAssigned: true },
      });

      inspectionResult.reAssigned = true;
    }

    // 6. If passed → update room
    if (passed) {
      await tx.room.update({
        where: { id: roomId },
        data: {
          housekeepingStatus: 'inspected',
          lastInspectedAt: new Date(),
          inspectedBy: inspectorId,
        },
      });
    } else {
      // Even on failure, update the inspection tracking fields
      await tx.room.update({
        where: { id: roomId },
        data: {
          lastInspectedAt: new Date(),
          inspectedBy: inspectorId,
        },
      });
    }

    return inspectionResult;
  });

  return result;
}
