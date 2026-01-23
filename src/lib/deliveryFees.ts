/**
 * Delivery Zone Pricing Configuration
 * 
 * Landmark-based delivery zones for Bayelsa state.
 * Each landmark maps to a specific zone with a fixed delivery fee.
 */

export interface DeliveryZone {
  state: string;
  city: string;
  fee: number;
}

export interface Landmark {
  name: string;
  zone: number;
  fee: number;
}

// Landmark-based delivery zones for Bayelsa
export const BAYELSA_LANDMARKS: Landmark[] = [
  // Zone 1 - ₦1,500
  { name: "Azikoro", zone: 1, fee: 1500 },
  { name: "Swali", zone: 1, fee: 1500 },
  { name: "Prosco", zone: 1, fee: 1500 },
  { name: "Kpansia", zone: 1, fee: 1500 },
  { name: "Yenezuegene", zone: 1, fee: 1500 },
  
  // Zone 2 - ₦1,000
  { name: "Ekeki", zone: 2, fee: 1000 },
  { name: "Amarata", zone: 2, fee: 1000 },
  { name: "Ovom", zone: 2, fee: 1000 },
  { name: "Biogbolo", zone: 2, fee: 1000 },
  { name: "Opolo", zone: 2, fee: 1000 },
  
  // Zone 3 - ₦1,500
  { name: "Etegwe", zone: 3, fee: 1500 },
  { name: "Tombia", zone: 3, fee: 1500 },
  { name: "Edepie", zone: 3, fee: 1500 },
  { name: "Agudama", zone: 3, fee: 1500 },
  { name: "Akenfa", zone: 3, fee: 1500 },
  
  // Zone 4 - ₦2,000
  { name: "Yenegwe", zone: 4, fee: 2000 },
  { name: "Okaki", zone: 4, fee: 2000 },
  { name: "Igbogene", zone: 4, fee: 2000 },
];

// State-based zones (only Bayelsa is available)
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    state: "Bayelsa",
    city: "Yenagoa",
    fee: 1500, // Default fee, but should use landmark-based pricing
  },
];

/**
 * Get delivery fee for a landmark in Bayelsa
 * @param landmark - The selected landmark name
 * @returns The delivery fee in NGN, or 0 if landmark not found
 */
export function getDeliveryFeeByLandmark(landmark: string): number {
  const normalizedLandmark = landmark.trim();
  const landmarkData = BAYELSA_LANDMARKS.find(
    (l) => l.name.toLowerCase() === normalizedLandmark.toLowerCase()
  );
  return landmarkData?.fee || 0;
}

/**
 * Get delivery zone number for a landmark
 * @param landmark - The selected landmark name
 * @returns The zone number, or null if landmark not found
 */
export function getZoneByLandmark(landmark: string): number | null {
  const normalizedLandmark = landmark.trim();
  const landmarkData = BAYELSA_LANDMARKS.find(
    (l) => l.name.toLowerCase() === normalizedLandmark.toLowerCase()
  );
  return landmarkData?.zone || null;
}

/**
 * Get landmark information
 * @param landmark - The selected landmark name
 * @returns The landmark object, or null if not found
 */
export function getLandmarkInfo(landmark: string): Landmark | null {
  const normalizedLandmark = landmark.trim();
  return (
    BAYELSA_LANDMARKS.find(
      (l) => l.name.toLowerCase() === normalizedLandmark.toLowerCase()
    ) || null
  );
}

/**
 * Get all available landmarks for dropdown
 * @returns Array of landmark names sorted alphabetically
 */
export function getAvailableLandmarks(): string[] {
  return BAYELSA_LANDMARKS.map((landmark) => landmark.name).sort();
}

/**
 * Get landmarks grouped by zone
 * @returns Object with zone numbers as keys and arrays of landmark names as values
 */
export function getLandmarksByZone(): Record<number, string[]> {
  const grouped: Record<number, string[]> = {};
  BAYELSA_LANDMARKS.forEach((landmark) => {
    if (!grouped[landmark.zone]) {
      grouped[landmark.zone] = [];
    }
    grouped[landmark.zone].push(landmark.name);
  });
  return grouped;
}

/**
 * Get delivery fee for a given state (legacy function for non-Bayelsa states)
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
 * Get delivery zone information for a given state (legacy function)
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
 * Currently only Bayelsa is available
 * @returns Array of state names (only Bayelsa)
 */
export function getAvailableStates(): string[] {
  return ["Bayelsa"];
}
