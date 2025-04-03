import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_ROUTES_KEY = '@saved_routes';

export interface SavedRoute {
  id: string;
  name: string;
  distance: number;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation: {
    latitude: number;
    longitude: number;
  };
  coordinates: [number, number][];
  rating?: number;
  tags?: string[];
  createdAt?: string;
}

export const saveRoute = async (route: SavedRoute): Promise<void> => {
  try {
    const existingRoutes = await getSavedRoutes();
    const updatedRoutes = [...existingRoutes, route];
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updatedRoutes));
  } catch (error) {
    console.error('Error saving route:', error);
    throw error;
  }
};

export const getSavedRoutes = async (): Promise<SavedRoute[]> => {
  try {
    const routesJson = await AsyncStorage.getItem(SAVED_ROUTES_KEY);
    return routesJson ? JSON.parse(routesJson) : [];
  } catch (error) {
    console.error('Error getting saved routes:', error);
    return [];
  }
};

export const deleteRoute = async (routeId: string): Promise<void> => {
  try {
    const existingRoutes = await getSavedRoutes();
    const updatedRoutes = existingRoutes.filter(route => route.id !== routeId);
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updatedRoutes));
  } catch (error) {
    console.error('Error deleting route:', error);
    throw error;
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