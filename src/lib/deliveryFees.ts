/**
 * Delivery Zone Pricing Configuration
 * 
 * Fixed delivery fees based on state selection.
 * Each state is treated as a delivery zone.
 */

export interface DeliveryZone {
  state: string;
  city: string;
  fee: number;
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    state: "Bayelsa",
    city: "Yenagoa",
    fee: 2000,
  },
  {
    state: "Rivers",
    city: "Port Harcourt",
    fee: 2000,
  },
  {
    state: "Abuja (FCT)",
    city: "Abuja",
    fee: 2500,
  },
  {
    state: "Lagos",
    city: "Lagos",
    fee: 3000,
  },
];

/**
 * Get delivery fee for a given state
 * @param state - The selected state name
 * @returns The delivery fee in NGN, or 0 if state not found
 */
export function getDeliveryFeeByState(state: string): number {
  const normalizedState = state.trim();
  const zone = DELIVERY_ZONES.find(
    (z) => z.state.toLowerCase() === normalizedState.toLowerCase()
  );
  return zone?.fee || 0;
}

/**
 * Get delivery zone information for a given state
 * @param state - The selected state name
 * @returns The delivery zone object, or null if not found
 */
export function getDeliveryZoneByState(state: string): DeliveryZone | null {
  const normalizedState = state.trim();
  return (
    DELIVERY_ZONES.find(
      (z) => z.state.toLowerCase() === normalizedState.toLowerCase()
    ) || null
  );
}

/**
 * Get all available states for dropdown
 * @returns Array of state names
 */
export function getAvailableStates(): string[] {
  return DELIVERY_ZONES.map((zone) => zone.state);
}

