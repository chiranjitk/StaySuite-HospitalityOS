/**
 * StaySuite Health Check API
 * 
 * Provides comprehensive health status for all services
 * Works in both sandbox and production environments
 */

import { NextResponse } from 'next/server';
import { getConfig, getServiceStatus } from '@/lib/config/env';
import { getAllServicesHealth, areCriticalServicesAvailable, getSandboxLimitations } from '@/lib/config/services';
import { db } from '@/lib/db';

// Simple cache for health check responses
let lastHealthCheck: { timestamp: number; data: unknown } | null = null;
const HEALTH_CHECK_CACHE_TTL = 5000; // 5 seconds

export async function GET(request: Request) {
  const url = new URL(request.url);
  const detailed = url.searchParams.get('detailed') === 'true';
  const service = url.searchParams.get('service');

  // Check cache
  const now = Date.now();
  if (!detailed && lastHealthCheck && now - lastHealthCheck.timestamp < HEALTH_CHECK_CACHE_TTL) {
    return NextResponse.json(lastHealthCheck.data);
  }

  try {
    // Basic health status
    const config = getConfig();
    const servicesHealth = getAllServicesHealth();
    const criticalStatus = areCriticalServicesAvailable();
    
    // Database health check
    let dbHealth = 'healthy';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await db.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      dbHealth = 'unhealthy';
      console.error('[Health] Database check failed:', error);
    }

    // Build response
    const healthData = {
      status: criticalStatus.available ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.env,
      
      // Environment info
      environmentInfo: {
        isProduction: config.isProduction,
        isSandbox: config.isSandbox,
        isDevelopment: config.isDevelopment,
        database: config.database.type,
      },
      
      // Database
      database: {
        status: dbHealth,
        type: config.database.type,
        latency: dbLatency,
      },
      
      // Services
      services: servicesHealth,
      
      // Critical services check
      criticalServices: {
        available: criticalStatus.available,
        missing: criticalStatus.missing,
      },
      
      // Sandbox limitations
      limitations: config.isSandbox ? getSandboxLimitations() : [],
    };

    // Detailed mode includes extra info
    if (detailed) {
      const serviceStatus = getServiceStatus();
      
      const detailedData = {
        ...healthData,
        serviceStatus,
        config: {
          redis: config.redis.enabled,
          queue: config.queue.enabled,
          realtime: config.realtime.enabled,
          email: config.email.enabled,
          sms: config.sms.enabled,
          radius: config.radius.enabled,
        },
        features: config.features,
        uptime: process.uptime(),
      };
      
      return NextResponse.json(detailedData);
    }

    // Service-specific check
    if (service) {
      const serviceHealth = servicesHealth.find(s => 
        s.name.toLowerCase().replace(' ', '') === service.toLowerCase()
      );
      
      if (!serviceHealth) {
        return NextResponse.json(
          { error: `Service '${service}' not found` },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        status: serviceHealth.enabled ? 'healthy' : 'unavailable',
        service: serviceHealth,
      });
    }

    // Cache the response
    lastHealthCheck = { timestamp: now, data: healthData };

    return NextResponse.json(healthData);
  } catch (error) {
    console.error('[Health] Error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}

// HEAD request for simple health check
export async function HEAD() {
  try {
    const criticalStatus = areCriticalServicesAvailable();
    
    if (criticalStatus.available) {
      return new NextResponse(null, { status: 200 });
    }
    
    return new NextResponse(null, { status: 503 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
