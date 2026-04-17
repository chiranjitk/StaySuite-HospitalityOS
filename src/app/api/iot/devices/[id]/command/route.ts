import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/iot/devices/[id]/command - Get command history and status for a device
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'devices.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Verify device exists and belongs to user's tenant
    const device = await db.ioTDevice.findUnique({
      where: { id },
    });

    if (!device) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
    }

    if (device.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    const where: Record<string, unknown> = { deviceId: id };
    if (status) {
      where.status = status;
    }

    const commands = await db.ioTCommand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Aggregate status counts
    const statusCounts = await db.ioTCommand.groupBy({
      by: ['status'],
      where: { deviceId: id },
      _count: { id: true },
    });

    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: commands.map(c => ({
        ...c,
        parameters: c.parameters ? JSON.parse(c.parameters) : {},
      })),
      summary: statusSummary,
    });
  } catch (error) {
    console.error('Error fetching command history:', error);
    return NextResponse.json({ error: 'Failed to fetch command history' }, { status: 500 });
  }
}

// POST /api/iot/devices/[id]/command - Send a command to a device
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'iot.control') && !hasPermission(user, 'devices.control')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const data = await request.json();
    
    const {
      command,
      parameters = {},
      source = 'manual',
      triggeredBy
    } = data;

    // Validate command BEFORE creating DB record
    const executableCommands = [
      'turn_on', 'turn_off', 'set_temperature', 'set_brightness',
      'lock', 'unlock', 'open', 'close', 'set_mode'
    ];

    if (!command) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Command is required' }
      }, { status: 400 });
    }

    if (!executableCommands.includes(command)) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid command. Supported commands: ${executableCommands.join(', ')}` }
      }, { status: 400 });
    }

    // Check if device exists and belongs to user's tenant
    const device = await db.ioTDevice.findUnique({
      where: { id }
    });

    if (!device) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
    }

    if (device.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    // Validate command parameters based on command type
    if (command === 'set_temperature' && (parameters.temperature === undefined || parameters.temperature < 10 || parameters.temperature > 35)) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Temperature must be between 10 and 35' }
      }, { status: 400 });
    }
    if (command === 'set_brightness' && (parameters.brightness === undefined || parameters.brightness < 0 || parameters.brightness > 100)) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Brightness must be between 0 and 100' }
      }, { status: 400 });
    }
    if (command === 'set_mode' && !parameters.mode) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Mode parameter is required' }
      }, { status: 400 });
    }

    // Create the command record (validation passed)
    const ioTCommand = await db.ioTCommand.create({
      data: {
        deviceId: id,
        command,
        parameters: JSON.stringify(parameters),
        status: 'pending',
        source,
        triggeredBy
      }
    });

    // Attempt real device communication via HTTP
    let commandStatus = 'executed';
    let deviceResponse: string | null = null;
    const deviceIpAddress = device.ipAddress;
    const deviceProtocol = device.protocol;

    if (device.status === 'online' && deviceIpAddress) {
      // Attempt HTTP-based command to the IoT device
      try {
        const controller = new AbortController();
        const timeoutMs = 5000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const protocolPort = deviceProtocol === 'zigbee' ? 8081 : deviceProtocol === 'z-wave' ? 8082 : deviceProtocol === 'bluetooth' ? 8083 : 8080;
        const commandUrl = `http://${deviceIpAddress}:${protocolPort}/api/command`;

        const deviceRes = await fetch(commandUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, parameters, deviceId: id }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (deviceRes.ok) {
          const responseData = await deviceRes.json();
          deviceResponse = JSON.stringify(responseData);
          commandStatus = 'executed';
        } else {
          commandStatus = 'failed';
          deviceResponse = `Device returned status ${deviceRes.status}`;
        }
      } catch (commError) {
        // Device unreachable or timeout - mark as sent (pending execution confirmation)
        commandStatus = 'sent';
        deviceResponse = `Communication timeout: device at ${deviceIpAddress} unreachable`;
      }
    } else if (device.status === 'offline') {
      commandStatus = 'queued';
      deviceResponse = 'Device offline - command queued for delivery';
    }

    // Update command status
    const executedCommand = await db.ioTCommand.update({
      where: { id: ioTCommand.id },
      data: {
        status: commandStatus,
        executedAt: commandStatus === 'executed' ? new Date() : undefined,
        response: deviceResponse,
      }
    });

    // Update device state based on command
    let newState: Record<string, unknown> = device.currentState ? JSON.parse(device.currentState) : {};

    switch (command) {
      case 'turn_on':
        newState.power = 'on';
        newState.isOn = true;
        break;
      case 'turn_off':
        newState.power = 'off';
        newState.isOn = false;
        break;
      case 'set_temperature':
        newState.temperature = parameters.temperature;
        break;
      case 'set_brightness':
        newState.brightness = parameters.brightness;
        break;
      case 'lock':
        newState.locked = true;
        break;
      case 'unlock':
        newState.locked = false;
        break;
      case 'set_mode':
        newState.mode = parameters.mode;
        break;
    }

    // Update device current state
    await db.ioTDevice.update({
      where: { id },
      data: {
        currentState: JSON.stringify(newState),
        lastHeartbeat: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...executedCommand,
        parameters: JSON.parse(executedCommand.parameters)
      }
    });
  } catch (error) {
    console.error('Error sending command to IoT device:', error);
    return NextResponse.json({ error: 'Failed to send command' }, { status: 500 });
  }
}
