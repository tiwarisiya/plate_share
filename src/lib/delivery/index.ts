// Courier delivery (roadmap item 11). Only the interface exists so far:
// booking needs DoorDash Drive / Uber Direct credentials, which must stay
// server-side (a Next.js route or Supabase Edge Function), never in the
// browser. Until a provider is configured the app offers self pickup only.

export type PickupMethod = "self" | "courier";

export const PICKUP_METHODS: [PickupMethod, string][] = [
  ["self", "Shelter picks up"],
  ["courier", "Courier delivers to the shelter"],
];

export type DeliveryStop = {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  instructions?: string;
};

export type DeliveryQuoteRequest = {
  externalId: string; // our request id
  pickup: DeliveryStop;
  dropoff: DeliveryStop;
  pickupReadyAt: string; // ISO time
  dropoffDeadline?: string; // ISO time, e.g. the offer's use-by
  orderValueCents?: number;
};

export type DeliveryQuote = {
  provider: string;
  quoteId: string;
  feeCents: number;
  currency: string;
  expiresAt: string;
  estimatedDropoffAt?: string;
};

export type DeliveryStatus = "quoted" | "booked" | "driver_assigned" | "picked_up" | "delivered" | "cancelled" | "failed";

export type Delivery = {
  provider: string;
  providerDeliveryId: string;
  status: DeliveryStatus;
  feeCents: number;
  trackingUrl?: string;
};

export interface DeliveryProvider {
  name: string;
  quote(request: DeliveryQuoteRequest): Promise<DeliveryQuote>;
  book(quote: DeliveryQuote): Promise<Delivery>;
  cancel(providerDeliveryId: string): Promise<void>;
}

export class DeliveryNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} delivery is not configured`);
  }
}

function notConfigured(name: string): DeliveryProvider {
  const fail = async (): Promise<never> => {
    throw new DeliveryNotConfiguredError(name);
  };
  return { name, quote: fail, book: fail, cancel: fail };
}

// Stubs. Implementations will read their keys from server-side env vars
// (DOORDASH_DEVELOPER_ID / DOORDASH_KEY_ID / DOORDASH_SIGNING_SECRET,
// UBER_DIRECT_CUSTOMER_ID / UBER_DIRECT_CLIENT_ID / UBER_DIRECT_CLIENT_SECRET).
export const doorDashDrive: DeliveryProvider = notConfigured("DoorDash Drive");
export const uberDirect: DeliveryProvider = notConfigured("Uber Direct");

// Whether the UI should offer courier delivery. Flip on once a provider
// is implemented and the booking route exists.
export const COURIER_DELIVERY_AVAILABLE = process.env.NEXT_PUBLIC_COURIER_DELIVERY_ENABLED === "true";
