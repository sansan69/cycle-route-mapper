import * as polyline from '@mapbox/polyline';

const GOOGLE_API_KEY = 'AIzaSyDoCRiWM2oL2ka68KFtrUCw-RqIcDXU6zs';

interface Location {
  latitude: number;
  longitude: number;
}

interface Route {
  id: string;
  name: string;
  distance: number;
  startLocation: Location;
  endLocation: Location;
  coordinates: [number, number][];
}

interface GoogleDirectionsLeg {
  distance: {
    value: number;
  };
  start_location: {
    lat: number;
    lng: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  polyline: {
    points: string;
  };
}

interface GoogleDirectionsRoute {
  overview_polyline: {
    points: string;
  };
  legs: GoogleDirectionsLeg[];
}

interface GoogleDirectionsResponse {
  status: string;
  routes: GoogleDirectionsRoute[];
}

interface RouteSegment {
  start: [number, number];
  end: [number, number];
}

/**
 * Calculates the distance between two points in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateAngle(center: Location, point: Location): number {
  return Math.atan2(
    point.longitude - center.longitude,
    point.latitude - center.latitude
  );
}

function findRepeatedSegments(coordinates: [number, number][]): RouteSegment[] {
  const segments = new Map<string, RouteSegment>();
  const repeated: RouteSegment[] = [];
  const tolerance = 0.0001; // Approximately 10 meters

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const key = `${start[0]},${start[1]}-${end[0]},${end[1]}`;
    
    if (segments.has(key)) {
      repeated.push({ start, end });
    } else {
      segments.set(key, { start, end });
    }
  }

  return repeated;
}

async function tryAlternativePath(
  startLocation: Location,
  waypoints: Location[],
  apiKey: string
): Promise<GoogleDirectionsResponse | null> {
  // Try different waypoint orderings
  const shuffledWaypoints = [...waypoints].sort(() => Math.random() - 0.5);
  const waypointsString = shuffledWaypoints
    .map(point => `${point.latitude},${point.longitude}`)
    .join('|');

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${startLocation.latitude},${startLocation.longitude}&destination=${startLocation.latitude},${startLocation.longitude}&waypoints=optimize:true|${waypointsString}&mode=driving&avoid=tolls|ferries|highways&key=${apiKey}`
    );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error trying alternative path:', error);
    return null;
  }
}

function hasPathOverlap(path1: [number, number][], path2: [number, number][]): boolean {
  const TOLERANCE = 0.0001; // Approximately 10 meters
  let overlapCount = 0;
  let totalSegments = 0;

  // Check each segment of path1 against path2
  for (let i = 0; i < path1.length - 1; i++) {
    const start1 = path1[i];
    const end1 = path1[i + 1];
    totalSegments++;

    for (let j = 0; j < path2.length - 1; j++) {
      const start2 = path2[j];
      const end2 = path2[j + 1];

      // Check if segments are close enough to be considered overlapping
      if (
        Math.abs(start1[0] - start2[0]) < TOLERANCE &&
        Math.abs(start1[1] - start2[1]) < TOLERANCE &&
        Math.abs(end1[0] - end2[0]) < TOLERANCE &&
        Math.abs(end1[1] - end2[1]) < TOLERANCE
      ) {
        overlapCount++;
        break;
      }
    }
  }

  return (overlapCount / totalSegments) > 0.4; // More than 40% overlap
}

function generateRandomWaypoints(startLocation: Location, radius: number): Location[] {
  const numWaypoints = Math.floor(Math.random() * 5) + 8; // 8-12 waypoints
  const waypoints: Location[] = [];
  const usedPoints = new Set<string>();

  // Generate unique waypoints with more spread
  while (waypoints.length < numWaypoints) {
    const point = generateRandomPoint(startLocation, radius);
    const pointKey = `${point.latitude},${point.longitude}`;
    
    if (!usedPoints.has(pointKey)) {
      waypoints.push(point);
      usedPoints.add(pointKey);
    }
  }

  // Sort waypoints by angle from center for circular layout
  waypoints.sort((a, b) => {
    const angleA = calculateAngle(startLocation, a);
    const angleB = calculateAngle(startLocation, b);
    return angleA - angleB;
  });

  return waypoints;
}

/**
 * Generates cycling routes using Google Maps Directions API
 * @param startLocation Starting point coordinates
 * @param radius Radius in kilometers
 * @returns Array of generated routes
 */
export async function generateRoutes(
  startLocation: Location,
  radius: number,
  maxRoutes: number = 20
): Promise<Route[]> {
  const routes: Route[] = [];
  const maxAttempts = 50;
  let attempts = 0;
  const uniqueRoutes = new Set<string>();

  while (routes.length < maxRoutes && attempts < maxAttempts) {
    attempts++;
    const waypoints = generateRandomWaypoints(startLocation, radius);
    const waypointsString = waypoints
      .map((wp: Location) => `via:${wp.latitude},${wp.longitude}`)
      .join('|');

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLocation.latitude},${startLocation.longitude}&destination=${startLocation.latitude},${startLocation.longitude}&waypoints=${waypointsString}&mode=driving&key=${GOOGLE_API_KEY}&avoid=tolls|ferries|highways`;

    try {
      const response = await fetch(url);
      const data: GoogleDirectionsResponse = await response.json();

      // Check API response status and routes
      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        console.warn('Invalid response from Google Maps API:', data.status);
        continue;
      }

      // Check polyline data
      if (
        !data.routes[0] ||
        !data.routes[0].overview_polyline ||
        !data.routes[0].overview_polyline.points
      ) {
        console.warn('No valid polyline returned by Google Maps. Skipping route.');
        continue;
      }

      const decodedPath = polyline.decode(data.routes[0].overview_polyline.points);
      const totalDistance = data.routes[0].legs.reduce(
        (sum, leg) => sum + leg.distance.value,
        0
      ) / 1000; // Convert to km

      if (totalDistance < 10) {
        console.warn('Route too short:', totalDistance, 'km');
        continue;
      }

      // Create a unique hash for the route coordinates
      const routeHash = decodedPath
        .map(coord => `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`)
        .join('|');

      if (uniqueRoutes.has(routeHash)) {
        console.warn('Duplicate route detected, skipping');
        continue;
      }

      const route: Route = {
        id: `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: `Route ${routes.length + 1}`,
        distance: totalDistance,
        startLocation,
        endLocation: startLocation,
        coordinates: decodedPath,
      };

      // Check for path overlap with existing routes
      const hasOverlap = routes.some(existingRoute => 
        hasPathOverlap(decodedPath, existingRoute.coordinates)
      );

      if (hasOverlap) {
        console.warn('Route has too much overlap with existing routes');
        continue;
      }

      uniqueRoutes.add(routeHash);
      routes.push(route);
    } catch (error) {
      console.error('Error generating route:', error);
    }
  }

  return routes;
}

/**
 * Generates a random point within a given radius
 * @param center Center point coordinates
 * @param radiusInKm Radius in kilometers
 * @returns Random point coordinates within the radius
 */
function generateRandomPoint(center: Location, radiusInKm: number): Location {
  const adjustedRadius = radiusInKm * 0.3;
  const radiusInDeg = adjustedRadius / 111.32;

  const u = Math.random();
  const v = Math.random();

  const w = radiusInDeg * Math.sqrt(u);
  const t = 2 * Math.PI * v;

  const x = w * Math.cos(t);
  const y = w * Math.sin(t);

  const newLat = Math.max(-90, Math.min(90, center.latitude + y));
  const newLng = Math.max(-180, Math.min(180, center.longitude + x / Math.cos(center.latitude * Math.PI / 180)));

  return {
    latitude: newLat,
    longitude: newLng,
  };
}