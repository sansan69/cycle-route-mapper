import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_ROUTES_KEY = '@saved_routes';

interface Location {
  latitude: number;
  longitude: number;
}

interface GoogleDirectionsStep {
  html_instructions: string;
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
  polyline: { points: string };
  maneuver?: string;
}

export interface SavedRoute {
  id: string; // Unique ID generated *before* saving
  name: string;
  distance: number;
  duration?: number; // Optional total duration in seconds
  startLocation: Location;
  endLocation: Location;
  coordinates: [number, number][];
  steps?: GoogleDirectionsStep[]; // Optional array of turn-by-turn steps
  rating?: number;
  tags?: string[];
  createdAt?: string; // ISO string when saved
  bounds?: { // Optional map bounds
    northeast: Location;
    southwest: Location;
  };
}

/**
 * Retrieves all saved routes from AsyncStorage.
 * @returns {Promise<SavedRoute[]>} A promise that resolves with the array of saved routes.
 */
export const getSavedRoutes = async (): Promise<SavedRoute[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(SAVED_ROUTES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to fetch saved routes from storage", e);
    return []; // Return empty array on error
  }
};

/**
 * Saves a new route or updates an existing one in AsyncStorage.
 * Routes are identified by their unique `id`.
 * @param {SavedRoute} routeToSave The route object to save. Must include a unique `id`.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export const saveRoute = async (routeToSave: SavedRoute): Promise<void> => {
  if (!routeToSave.id) {
      console.error("Attempted to save route without an ID");
      throw new Error("Route must have an ID to be saved.");
  }
  try {
    const existingRoutes = await getSavedRoutes();
    const routeIndex = existingRoutes.findIndex(route => route.id === routeToSave.id);

    if (routeIndex > -1) {
      // Update existing route
      existingRoutes[routeIndex] = routeToSave;
    } else {
      // Add new route
      existingRoutes.push(routeToSave);
    }

    const jsonValue = JSON.stringify(existingRoutes);
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to save route to storage", e);
    throw e; // Re-throw error to be handled by the caller
  }
};

/**
 * Deletes a specific route from AsyncStorage by its ID.
 * @param {string} routeId The ID of the route to delete.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export const deleteRoute = async (routeId: string): Promise<void> => {
  try {
    const existingRoutes = await getSavedRoutes();
    const updatedRoutes = existingRoutes.filter(route => route.id !== routeId);
    const jsonValue = JSON.stringify(updatedRoutes);
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to delete route from storage", e);
    throw e; // Re-throw error
  }
};

export const clearSavedRoutes = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SAVED_ROUTES_KEY);
  } catch (error) {
    console.error('Error clearing saved routes:', error);
    throw error;
  }
}; 