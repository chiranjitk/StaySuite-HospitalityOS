import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
// GET /api/tutorials/progress - Get tutorial progress for a user
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const tutorialKey = searchParams.get('tutorialKey');
    const userId = user.id;
    const tenantId = user.tenantId;

    // If specific tutorial key is requested
    if (tutorialKey) {
      const progress = await db.userTutorial.findUnique({
        where: {
          userId_tutorialKey: {
            userId,
            tutorialKey,
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: progress || {
          userId,
          tutorialKey,
          completed: false,
          currentStep: 0,
          totalSteps: 0,
        },
      });
    }

    // Get all tutorial progress for the user
    const allProgress = await db.userTutorial.findMany({
      where: {
        tenantId,
        userId,
      },
    });

    // Calculate stats
    const stats = {
      total: allProgress.length,
      completed: allProgress.filter((p) => p.completed).length,
      inProgress: allProgress.filter((p) => !p.completed && p.currentStep > 0).length,
      notStarted: allProgress.filter((p) => p.currentStep === 0).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        progress: allProgress,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching tutorial progress:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch tutorial progress' } },
      { status: 500 }
    );
  }
}

// POST /api/tutorials/progress - Start or update tutorial progress
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      tutorialKey,
      currentStep = 0,
      totalSteps = 0,
    } = body;

    const userId = user.id;
    const tenantId = user.tenantId;

    if (!tutorialKey) {
      return NextResponse.json(
        { success: false, error: { message: 'Tutorial key is required' } },
        { status: 400 }
      );
    }

    // Validate tutorial key format (alphanumeric with hyphens and underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(tutorialKey)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid tutorial key format' } },
        { status: 400 }
      );
    }

    // Validate step values
    if (currentStep < 0 || totalSteps < 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Step values must be non-negative' } },
        { status: 400 }
      );
    }

    // Upsert tutorial progress
    const progress = await db.userTutorial.upsert({
      where: {
        userId_tutorialKey: {
          userId,
          tutorialKey,
        },
      },
      update: {
        currentStep,
        totalSteps,
        ...(currentStep >= totalSteps && totalSteps > 0
          ? { completed: true, completedAt: new Date() }
          : {}),
      },
      create: {
        tenantId,
        userId,
        tutorialKey,
        currentStep,
        totalSteps,
        completed: currentStep >= totalSteps && totalSteps > 0,
        completedAt: currentStep >= totalSteps && totalSteps > 0 ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Error updating tutorial progress:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update tutorial progress' } },
      { status: 500 }
    );
  }
}

// PUT /api/tutorials/progress - Complete a tutorial step
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      tutorialKey,
      action, // 'advance', 'complete', 'reset'
    } = body;

    const userId = user.id;
    const tenantId = user.tenantId;

    if (!tutorialKey || !action) {
      return NextResponse.json(
        { success: false, error: { message: 'Tutorial key and action are required' } },
        { status: 400 }
      );
    }

    // Validate action
    if (!['advance', 'complete', 'reset'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid action. Must be "advance", "complete", or "reset"' } },
        { status: 400 }
      );
    }

    const existing = await db.userTutorial.findUnique({
      where: {
        userId_tutorialKey: {
          userId,
          tutorialKey,
        },
      },
    });

    if (!existing && action !== 'reset') {
      return NextResponse.json(
        { success: false, error: { message: 'Tutorial progress not found' } },
        { status: 404 }
      );
    }

    let updateData: {
      currentStep?: number;
      completed?: boolean;
      completedAt?: Date | null;
    } = {};

    switch (action) {
      case 'advance':
        if (existing) {
          const newStep = existing.currentStep + 1;
          const isComplete = newStep >= existing.totalSteps && existing.totalSteps > 0;
          updateData = {
            currentStep: newStep,
            completed: isComplete,
            completedAt: isComplete ? new Date() : undefined,
          };
        }
        break;
      case 'complete':
        updateData = {
          completed: true,
          completedAt: new Date(),
          ...(existing ? { currentStep: existing.totalSteps } : {}),
        };
        break;
      case 'reset':
        updateData = {
          currentStep: 0,
          completed: false,
          completedAt: null,
        };
        break;
    }

    const progress = await db.userTutorial.upsert({
      where: {
        userId_tutorialKey: {
          userId,
          tutorialKey,
        },
      },
      update: updateData,
      create: {
        tenantId,
        userId,
        tutorialKey,
        ...updateData,
        totalSteps: existing?.totalSteps || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Error updating tutorial progress:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update tutorial progress' } },
      { status: 500 }
    );
  }
}

// DELETE /api/tutorials/progress - Reset tutorial progress
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const tutorialKey = searchParams.get('tutorialKey');
    const userId = user.id;

    if (tutorialKey) {
      // Delete specific tutorial progress
      await db.userTutorial.deleteMany({
        where: {
          userId,
          tutorialKey,
        },
      });
    } else {
      // Delete all tutorial progress for the user
      await db.userTutorial.deleteMany({
        where: { userId },
      });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Tutorial progress reset successfully' },
    });
  } catch (error) {
    console.error('Error resetting tutorial progress:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to reset tutorial progress' } },
      { status: 500 }
    );
  }
}
