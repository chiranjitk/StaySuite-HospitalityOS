/**
 * Booking Events
 * 
 * Event definitions for booking lifecycle events.
 * These events are emitted when booking state changes occur.
 */

export type BookingStatus = 
  | 'draft'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export interface BookingEventBase {
  bookingId: string;
  tenantId: string;
  propertyId: string;
  confirmationCode: string;
  guestId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  roomTypeId: string;
  roomTypeName: string;
  roomId?: string;
  roomNumber?: string;
  checkIn: Date;
  checkOut: Date;
  timestamp: Date;
  performedBy?: string;
}

export interface BookingCheckedInEvent extends BookingEventBase {
  eventType: 'booking.checked_in';
  actualCheckIn: Date;
  assignedRoomId: string;
  assignedRoomNumber: string;
}

export interface BookingCheckedOutEvent extends BookingEventBase {
  eventType: 'booking.checked_out';
  actualCheckOut: Date;
  totalAmount: number;
  paidAmount: number;
}

export interface BookingConfirmedEvent extends BookingEventBase {
  eventType: 'booking.confirmed';
  totalAmount: number;
  source: string;
}

export interface BookingCancelledEvent extends BookingEventBase {
  eventType: 'booking.cancelled';
  cancellationReason?: string;
  cancelledAt: Date;
}

export interface BookingNoShowEvent extends BookingEventBase {
  eventType: 'booking.no_show';
}

export interface BookingModifiedEvent extends BookingEventBase {
  eventType: 'booking.modified';
  changes: Record<string, { oldValue: unknown; newValue: unknown }>;
}

export type BookingEvent = 
  | BookingCheckedInEvent
  | BookingCheckedOutEvent
  | BookingConfirmedEvent
  | BookingCancelledEvent
  | BookingNoShowEvent
  | BookingModifiedEvent;

/**
 * Event handlers registry
 */
type EventHandler<T extends BookingEvent> = (event: T) => Promise<void> | void;

class BookingEventEmitter {
  private handlers: Map<string, EventHandler<BookingEvent>[]> = new Map();

  /**
   * Subscribe to a booking event
   */
  on<T extends BookingEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): void {
    const existingHandlers = this.handlers.get(eventType) || [];
    existingHandlers.push(handler as EventHandler<BookingEvent>);
    this.handlers.set(eventType, existingHandlers);
  }

  /**
   * Unsubscribe from a booking event
   */
  off<T extends BookingEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): void {
    const existingHandlers = this.handlers.get(eventType) || [];
    const index = existingHandlers.indexOf(handler as EventHandler<BookingEvent>);
    if (index > -1) {
      existingHandlers.splice(index, 1);
      this.handlers.set(eventType, existingHandlers);
    }
  }

  /**
   * Emit a booking event to all subscribers
   */
  async emit<T extends BookingEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    // Execute all handlers, catching errors to prevent one handler from blocking others
    const results = await Promise.allSettled(
      handlers.map(handler => handler(event))
    );

    // Log any errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `Error in booking event handler for ${event.eventType}:`,
          result.reason
        );
      }
    });
  }

  /**
   * Remove all handlers for a specific event type
   */
  removeAllHandlers(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}

// Singleton instance
export const bookingEventEmitter = new BookingEventEmitter();

/**
 * Helper functions to emit specific events
 */
export async function emitBookingCheckedIn(
  data: Omit<BookingCheckedInEvent, 'eventType' | 'timestamp'>
): Promise<void> {
  await bookingEventEmitter.emit({
    ...data,
    eventType: 'booking.checked_in',
    timestamp: new Date(),
  } as BookingCheckedInEvent);
}

export async function emitBookingCheckedOut(
  data: Omit<BookingCheckedOutEvent, 'eventType' | 'timestamp'>
): Promise<void> {
  await bookingEventEmitter.emit({
    ...data,
    eventType: 'booking.checked_out',
    timestamp: new Date(),
  } as BookingCheckedOutEvent);
}

export async function emitBookingConfirmed(
  data: Omit<BookingConfirmedEvent, 'eventType' | 'timestamp'>
): Promise<void> {
  await bookingEventEmitter.emit({
    ...data,
    eventType: 'booking.confirmed',
    timestamp: new Date(),
  } as BookingConfirmedEvent);
}

export async function emitBookingCancelled(
  data: Omit<BookingCancelledEvent, 'eventType' | 'timestamp'>
): Promise<void> {
  await bookingEventEmitter.emit({
    ...data,
    eventType: 'booking.cancelled',
    timestamp: new Date(),
  } as BookingCancelledEvent);
}

export async function emitBookingNoShow(
  data: Omit<BookingNoShowEvent, 'eventType' | 'timestamp'>
): Promise<void> {
  await bookingEventEmitter.emit({
    ...data,
    eventType: 'booking.no_show',
    timestamp: new Date(),
  } as BookingNoShowEvent);
}

export async function emitBookingModified(
  data: Omit<BookingModifiedEvent, 'eventType' | 'timestamp'>
): Promise<void> {
  await bookingEventEmitter.emit({
    ...data,
    eventType: 'booking.modified',
    timestamp: new Date(),
  } as BookingModifiedEvent);
}
