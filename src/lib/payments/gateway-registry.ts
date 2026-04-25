/**
 * Payment Gateway Registry
 * Manages multiple payment gateways with health monitoring and priority-based routing
 */

import { db } from '@/lib/db';
import { decrypt, isEncrypted } from '@/lib/encryption';
import {
  PaymentGateway,
  GatewayConfig,
  GatewayHealth,
  HealthError,
  GatewayType,
  RoutingRule,
  RoutingContext,
  RoutingDecision,
  FailoverConfig,
} from './types';
import {
  StripeGateway,
  PayPalGateway,
  ManualGateway,
  createStripeGateway,
  createPayPalGateway,
  createManualGateway,
} from './gateways';

// ============================================
// Default Failover Configuration
// ============================================

const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  maxRetryDelayMs: 10000,
  failoverOnErrors: [
    'api_connection_error',
    'api_error',
    'rate_limit_error',
    'card_declined',
  ],
  healthCheckIntervalMs: 60000, // 1 minute
  consecutiveFailureThreshold: 5,
};

// ============================================
// Gateway Registry Class
// ============================================

/**
 * Payment Gateway Registry
 * Central manager for all payment gateways
 */
export class GatewayRegistry {
  private static instance: GatewayRegistry | null = null;
  private gateways: Map<GatewayType, PaymentGateway> = new Map();
  private healthStatus: Map<GatewayType, GatewayHealth> = new Map();
  private failoverConfig: FailoverConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private tenantId: string | null = null;
  
  private constructor() {
    this.failoverConfig = DEFAULT_FAILOVER_CONFIG;
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): GatewayRegistry {
    if (!GatewayRegistry.instance) {
      GatewayRegistry.instance = new GatewayRegistry();
    }
    return GatewayRegistry.instance;
  }
  
  /**
   * Initialize registry with tenant's configured gateways
   */
  async initialize(tenantId: string): Promise<void> {
    this.tenantId = tenantId;
    
    // Load gateway configurations from database
    const gatewayConfigs = await this.loadGatewayConfigs(tenantId);
    
    // Clear existing gateways
    this.gateways.clear();
    this.healthStatus.clear();
    
    // Register each configured gateway
    for (const config of gatewayConfigs) {
      if (config.isActive) {
        await this.registerGateway(config);
      }
    }
    
    // Start health monitoring
    this.startHealthMonitoring();
  }
  
  /**
   * Register a gateway
   */
  async registerGateway(config: GatewayConfig): Promise<void> {
    let gateway: PaymentGateway;
    
    switch (config.type) {
      case 'stripe':
        gateway = createStripeGateway(config);
        break;
      case 'paypal':
        gateway = createPayPalGateway(config);
        break;
      case 'manual':
        gateway = createManualGateway(config);
        break;
      case 'square':
        // Square would be implemented similarly
        throw new Error('Square gateway not yet implemented');
      default:
        throw new Error(`Unknown gateway type: ${config.type}`);
    }
    
    // Validate configuration
    const validation = gateway.validateConfig();
    if (!validation.valid) {
      console.warn(`Gateway ${config.name} has invalid configuration:`, validation.errors);
      config.healthStatus = 'unhealthy';
    }
    
    this.gateways.set(config.type, gateway);
    
    // Initialize health status
    this.healthStatus.set(config.type, {
      gatewayId: config.id,
      gatewayType: config.type,
      status: config.healthStatus,
      latency: 0,
      lastCheck: new Date(),
      uptime: 100,
      errorRate: 0,
      recentErrors: [],
    });
  }
  
  /**
   * Unregister a gateway
   */
  unregisterGateway(type: GatewayType): void {
    this.gateways.delete(type);
    this.healthStatus.delete(type);
  }
  
  /**
   * Get a gateway by type
   */
  getGateway(type: GatewayType): PaymentGateway | undefined {
    return this.gateways.get(type);
  }
  
  /**
   * Get all registered gateways
   */
  getAllGateways(): PaymentGateway[] {
    return Array.from(this.gateways.values());
  }
  
  /**
   * Get all gateway configurations
   */
  getAllConfigs(): GatewayConfig[] {
    return this.getAllGateways().map(g => g.getConfig());
  }
  
  /**
   * Get primary gateway
   */
  getPrimaryGateway(): PaymentGateway | undefined {
    const gateways = this.getAllGateways();
    return gateways.find(g => g.getConfig().isPrimary && g.getConfig().isActive);
  }
  
  /**
   * Get active gateways sorted by priority
   */
  getActiveGateways(): PaymentGateway[] {
    return this.getAllGateways()
      .filter(g => g.getConfig().isActive)
      .sort((a, b) => a.getConfig().priority - b.getConfig().priority);
  }
  
  /**
   * Get healthy gateways sorted by priority
   */
  getHealthyGateways(): PaymentGateway[] {
    return this.getActiveGateways()
      .filter(g => {
        const health = this.healthStatus.get(g.type);
        return health && health.status !== 'unhealthy';
      });
  }
  
  /**
   * Get gateway health status
   */
  getHealthStatus(type: GatewayType): GatewayHealth | undefined {
    return this.healthStatus.get(type);
  }
  
  /**
   * Get all health statuses
   */
  getAllHealthStatuses(): GatewayHealth[] {
    return Array.from(this.healthStatus.values());
  }
  
  /**
   * Determine best gateway for routing
   */
  determineRouting(context: RoutingContext): RoutingDecision {
    const healthyGateways = this.getHealthyGateways();
    
    if (healthyGateways.length === 0) {
      // Fall back to manual if no healthy gateways
      const manualGateway = this.getGateway('manual');
      if (manualGateway) {
        return {
          primaryGateway: 'manual',
          fallbackGateways: [],
          reason: 'No healthy automated gateways available, using manual fallback',
        };
      }
      
      return {
        primaryGateway: 'stripe', // Default
        fallbackGateways: [],
        reason: 'No gateways available',
      };
    }
    
    // Filter by currency support
    const currencySupported = healthyGateways.filter(g => 
      g.supportsCurrency(context.currency)
    );
    
    if (currencySupported.length === 0) {
      // Use manual gateway for unsupported currencies
      const manualGateway = this.getGateway('manual');
      if (manualGateway) {
        return {
          primaryGateway: 'manual',
          fallbackGateways: [],
          reason: `No gateways support currency ${context.currency}`,
        };
      }
    }
    
    // Filter by amount support
    const amountSupported = currencySupported.filter(g => 
      g.supportsAmount(context.amount, context.currency)
    );
    
    if (amountSupported.length === 0) {
      const manualGateway = this.getGateway('manual');
      if (manualGateway) {
        return {
          primaryGateway: 'manual',
          fallbackGateways: [],
          reason: `No gateways support amount ${context.amount} ${context.currency}`,
        };
      }
    }
    
    // Apply custom routing rules
    const applicableGateways = this.applyRoutingRules(amountSupported, context);
    
    // Exclude previously failed gateways
    const availableGateways = applicableGateways.filter(g => 
      !context.previousFailures?.includes(g.type)
    );
    
    // Sort by priority
    availableGateways.sort((a, b) => a.getConfig().priority - b.getConfig().priority);
    
    if (availableGateways.length === 0) {
      // All gateways have failed
      return {
        primaryGateway: 'manual',
        fallbackGateways: [],
        reason: 'All gateways have failed for this transaction',
        appliedRules: ['all_failed'],
      };
    }
    
    const primary = availableGateways[0];
    const fallbacks = availableGateways.slice(1).map(g => g.type);
    
    return {
      primaryGateway: primary.type,
      fallbackGateways: fallbacks,
      reason: `Selected ${primary.name} as primary gateway (priority ${primary.getConfig().priority})`,
      appliedRules: this.getAppliedRules(primary, context),
    };
  }
  
  /**
   * Perform health check on all gateways
   */
  async checkAllHealth(): Promise<Map<GatewayType, GatewayHealth>> {
    const checks = Array.from(this.gateways.entries()).map(async ([type, gateway]) => {
      const startTime = Date.now();
      
      try {
        const isHealthy = await gateway.isHealthy();
        const latency = Date.now() - startTime;
        const config = gateway.getConfig();
        
        const existingHealth = this.healthStatus.get(type);
        const recentErrors = existingHealth?.recentErrors || [];
        
        // Calculate error rate
        const totalTx = config.totalTransactions || 1;
        const errorRate = (config.failedTransactions / totalTx) * 100;
        
        // Calculate uptime
        const uptime = 100 - errorRate;
        
        const health: GatewayHealth = {
          gatewayId: config.id,
          gatewayType: type,
          status: isHealthy ? 'healthy' : 'unhealthy',
          latency,
          lastCheck: new Date(),
          uptime,
          errorRate,
          recentErrors: recentErrors.slice(-10), // Keep last 10 errors
        };
        
        this.healthStatus.set(type, health);
        
        // Update config in registry
        gateway.updateConfig({
          healthStatus: health.status,
          lastHealthCheck: health.lastCheck,
        });
        
        return [type, health] as [GatewayType, GatewayHealth];
      } catch (error) {
        const health: GatewayHealth = {
          gatewayId: gateway.getConfig().id,
          gatewayType: type,
          status: 'unhealthy',
          latency: Date.now() - startTime,
          lastCheck: new Date(),
          uptime: 0,
          errorRate: 100,
          recentErrors: [{
            timestamp: new Date(),
            errorCode: 'HEALTH_CHECK_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          }],
        };
        
        this.healthStatus.set(type, health);
        return [type, health] as [GatewayType, GatewayHealth];
      }
    });
    
    await Promise.all(checks);
    return this.healthStatus;
  }
  
  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Initial health check
    this.checkAllHealth().catch(console.error);
    
    // Periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.checkAllHealth().catch(console.error);
    }, this.failoverConfig.healthCheckIntervalMs);
  }
  
  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  /**
   * Get failover configuration
   */
  getFailoverConfig(): FailoverConfig {
    return { ...this.failoverConfig };
  }
  
  /**
   * Update failover configuration
   */
  updateFailoverConfig(config: Partial<FailoverConfig>): void {
    this.failoverConfig = { ...this.failoverConfig, ...config };
    
    // Restart health monitoring with new interval
    if (config.healthCheckIntervalMs) {
      this.startHealthMonitoring();
    }
  }
  
  /**
   * Record a gateway error
   */
  recordError(type: GatewayType, error: HealthError): void {
    const health = this.healthStatus.get(type);
    if (health) {
      health.recentErrors.push(error);
      if (health.recentErrors.length > 10) {
        health.recentErrors.shift();
      }
      
      // Update error rate
      const gateway = this.gateways.get(type);
      if (gateway) {
        const config = gateway.getConfig();
        const totalTx = config.totalTransactions || 1;
        health.errorRate = (config.failedTransactions / totalTx) * 100;
      }
    }
  }
  
  /**
   * Update gateway configuration
   */
  async updateGatewayConfig(type: GatewayType, updates: Partial<GatewayConfig>): Promise<boolean> {
    const gateway = this.gateways.get(type);
    if (!gateway) {
      return false;
    }
    
    gateway.updateConfig(updates);
    
    // Persist to database
    if (this.tenantId) {
      try {
        await db.paymentGateway.updateMany({
          where: {
            tenantId: this.tenantId,
            provider: type,
          },
          data: {
            ...updates,
          } as any,
        });
      } catch (error) {
        console.error('Failed to update gateway config in database:', error);
      }
    }
    
    return true;
  }
  
  /**
   * Load gateway configurations from database
   */
  private async loadGatewayConfigs(tenantId: string): Promise<GatewayConfig[]> {
    try {
      const dbGateways = await db.paymentGateway.findMany({
        where: { tenantId },
        orderBy: { priority: 'asc' },
      });
      
      return dbGateways.map(g => ({
        id: g.id,
        name: g.name,
        type: g.provider as GatewayType,
        priority: g.priority,
        isActive: g.status === 'active',
        isPrimary: g.isPrimary,
        mode: g.mode as 'live' | 'test',
        apiKey: g.apiKey ? (isEncrypted(g.apiKey) ? (decrypt(g.apiKey) || g.apiKey) : g.apiKey) : '',
        secretKey: g.secretKey ? (isEncrypted(g.secretKey) ? (decrypt(g.secretKey) || g.secretKey) : g.secretKey) : '',
        merchantId: g.merchantId || undefined,
        webhookSecret: g.webhookSecret ? (isEncrypted(g.webhookSecret) ? (decrypt(g.webhookSecret) || g.webhookSecret) : g.webhookSecret) : undefined,
        feePercentage: g.feePercentage,
        feeFixed: g.feeFixed,
        supportedCurrencies: g.supportedCurrencies.split(',').filter(Boolean),
        supportedCardTypes: ['visa', 'mastercard', 'amex', 'discover'],
        supportsRefunds: true,
        supportsPartialRefunds: true,
        supportsTokenization: g.provider === 'stripe',
        supportsRecurring: true,
        healthStatus: 'unknown',
        consecutiveFailures: 0,
        totalTransactions: g.totalTransactions,
        successfulTransactions: 0,
        failedTransactions: 0,
        totalVolume: g.totalVolume,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }));
    } catch (error) {
      console.error('Failed to load gateway configs:', error);
      return [];
    }
  }
  
  /**
   * Apply custom routing rules
   */
  private applyRoutingRules(
    gateways: PaymentGateway[],
    context: RoutingContext
  ): PaymentGateway[] {
    const rules = this.getAllRoutingRules();
    
    for (const rule of rules) {
      const matches = this.evaluateRule(rule, context);
      if (matches && rule.targetGateway) {
        // Prioritize the target gateway
        const targetIndex = gateways.findIndex(g => g.type === rule.targetGateway);
        if (targetIndex > 0) {
          const target = gateways.splice(targetIndex, 1)[0];
          gateways.unshift(target);
        }
      }
    }
    
    return gateways;
  }
  
  /**
   * Get all routing rules
   */
  private getAllRoutingRules(): RoutingRule[] {
    // In a real implementation, these would come from database
    const rules: RoutingRule[] = [];
    
    // Default rule: prefer Stripe for USD
    rules.push({
      field: 'currency',
      operator: 'equals',
      value: 'USD',
      targetGateway: 'stripe',
      priority: 1,
    });
    
    return rules;
  }
  
  /**
   * Evaluate a routing rule
   */
  private evaluateRule(rule: RoutingRule, context: RoutingContext): boolean {
    let contextValue: string | number | undefined;
    
    switch (rule.field) {
      case 'currency':
        contextValue = context.currency;
        break;
      case 'amount':
        contextValue = context.amount;
        break;
      case 'card_type':
        contextValue = context.cardType;
        break;
      case 'country':
        contextValue = context.country;
        break;
    }
    
    if (contextValue === undefined) {
      return false;
    }
    
    switch (rule.operator) {
      case 'equals':
        return contextValue === rule.value;
      case 'not_equals':
        return contextValue !== rule.value;
      case 'greater_than':
        return typeof contextValue === 'number' && contextValue > (rule.value as number);
      case 'less_than':
        return typeof contextValue === 'number' && contextValue < (rule.value as number);
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(String(contextValue));
      case 'not_in':
        return Array.isArray(rule.value) && !rule.value.includes(String(contextValue));
      default:
        return false;
    }
  }
  
  /**
   * Get applied rules for logging
   */
  private getAppliedRules(gateway: PaymentGateway, context: RoutingContext): string[] {
    const rules = this.getAllRoutingRules();
    const applied: string[] = [];
    
    for (const rule of rules) {
      if (this.evaluateRule(rule, context) && rule.targetGateway === gateway.type) {
        applied.push(`${rule.field}:${rule.operator}:${rule.value}`);
      }
    }
    
    if (applied.length === 0) {
      applied.push('priority_order');
    }
    
    return applied;
  }
}

// ============================================
// Singleton Export
// ============================================

export const gatewayRegistry = GatewayRegistry.getInstance();

/**
 * Initialize the gateway registry for a tenant
 */
export async function initializeGateways(tenantId: string): Promise<void> {
  await gatewayRegistry.initialize(tenantId);
}

/**
 * Get the gateway registry instance
 */
export function getGatewayRegistry(): GatewayRegistry {
  return gatewayRegistry;
}
