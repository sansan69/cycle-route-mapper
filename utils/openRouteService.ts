import * as polyline from '@mapbox/polyline';
import { v4 as uuid } from 'uuid';

const GOOGLE_API_KEY = 'AIzaSyDoCRiWM2oL2ka68KFtrUCw-RqIcDXU6zs'; // API key updated

interface Location {
  latitude: number;
  longitude: number;
}

// Interface for a single step in Google Directions
interface GoogleDirectionsStep {
  html_instructions: string;
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
  polyline: { points: string };
  maneuver?: string; // e.g., "turn-left", "merge", "roundabout-exit"
}

// Interface for a leg of the route (between waypoints)
interface GoogleDirectionsLeg {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
  start_address: string;
  end_address: string;
  steps: GoogleDirectionsStep[];
}

// Interface for the overall route from Google Directions
interface GoogleDirectionsRoute {
  summary: string; // e.g., "US-101 N"
  overview_polyline: { points: string };
  legs: GoogleDirectionsLeg[];
  copyrights: string;
  warnings: string[];
  waypoint_order: number[];
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

// Interface for the API response
interface GoogleDirectionsResponse {
  status: string;
  routes: GoogleDirectionsRoute[];
  geocoded_waypoints?: { geocoder_status: string; place_id: string; types: string[] }[];
}

// Interface for a segment, potentially used by helper functions
interface RouteSegment {
  start: [number, number];
  end: [number, number];
}

// Our application's Route interface, now including steps
interface Route {
  id: string;
  name: string;
  description: string;
  distance: number;
  duration: number;
  points: string;
  startLocation: Location;
  waypoints: Location[];
  steps: GoogleDirectionsStep[];
  bounds: {
    northeast: { latitude: number; longitude: number };
    southwest: { latitude: number; longitude: number };
  };
  createdAt: string;
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

function generateRandomPoint(center: Location, radiusInKm: number): Location {
    const earthRadiusKm = 6371;
    const lat1Rad = center.latitude * (Math.PI / 180);
    const lon1Rad = center.longitude * (Math.PI / 180);
    
    // Bias distance towards outer 70% of the radius
    const minFraction = 0.3; // Start from 30% of the radius outward
    const randomFraction = minFraction + Math.random() * (1 - minFraction); // Random value between minFraction and 1.0
    const angularDistance = (radiusInKm / earthRadiusKm) * randomFraction;
    
    const bearing = Math.random() * 2 * Math.PI; // Random angle

    const lat2Rad = Math.asin(Math.sin(lat1Rad) * Math.cos(angularDistance) +
                           Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearing));
    const lon2Rad = lon1Rad + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1Rad),
                                  Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad));

    return {
      latitude: lat2Rad * (180 / Math.PI),
      longitude: lon2Rad * (180 / Math.PI),
    };
}

function generateRandomWaypoints(startLocation: Location, radius: number, numWaypoints: number): Location[] {
  const waypoints: Location[] = [];
  const usedPoints = new Set<string>();
  const minWaypointDistanceKm = radius * 0.1; // Ensure waypoints aren't too close

  let waypointAttempts = 0;
  const maxWaypointAttempts = numWaypoints * 5; // Limit attempts to avoid infinite loops

  while (waypoints.length < numWaypoints && waypointAttempts < maxWaypointAttempts) {
    waypointAttempts++;
    const point = generateRandomPoint(startLocation, radius);
    const pointKey = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

    // Check if too close to existing waypoints or start location
    let tooClose = false;
    const pointsToCheck = [startLocation, ...waypoints];
    for (const existingPoint of pointsToCheck) {
        if (calculateDistance(point.latitude, point.longitude, existingPoint.latitude, existingPoint.longitude) < minWaypointDistanceKm) {
            tooClose = true;
            break;
        }
    }

    if (!usedPoints.has(pointKey) && !tooClose) {
      waypoints.push(point);
      usedPoints.add(pointKey);
    }
  }

  // Sort waypoints by angle for a more circular path suggestion to the API
  waypoints.sort((a, b) => {
    const angleA = calculateAngle(startLocation, a);
    const angleB = calculateAngle(startLocation, b);
    return angleA - angleB;
  });

  console.log(`Generated ${waypoints.length} waypoints after ${waypointAttempts} attempts.`);
  return waypoints;
}

function calculateRouteOverlap(polyline1: string, polyline2: string): number {
  const points1 = polyline.decode(polyline1);
  const points2 = polyline.decode(polyline2);
  
  // Calculate the total length of both routes
  const length1 = calculatePolylineLength(points1);
  const length2 = calculatePolylineLength(points2);
  
  // Calculate the overlapping segments
  let overlapLength = 0;
  const threshold = 0.0001; // Approximately 11 meters
  
  for (let i = 0; i < points1.length - 1; i++) {
    const segment1Start = points1[i];
    const segment1End = points1[i + 1];
    
    for (let j = 0; j < points2.length - 1; j++) {
      const segment2Start = points2[j];
      const segment2End = points2[j + 1];
      
      // Check if segments are close enough to be considered overlapping
      if (
        Math.abs(segment1Start[0] - segment2Start[0]) < threshold &&
        Math.abs(segment1Start[1] - segment2Start[1]) < threshold &&
        Math.abs(segment1End[0] - segment2End[0]) < threshold &&
        Math.abs(segment1End[1] - segment2End[1]) < threshold
      ) {
        overlapLength += calculateSegmentLength(segment1Start, segment1End);
        break;
      }
    }
  }
  
  // Return the overlap ratio (0 to 1)
  return overlapLength / Math.max(length1, length2);
}

function calculatePolylineLength(points: [number, number][]): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += calculateSegmentLength(points[i], points[i + 1]);
  }
  return length;
}

function calculateSegmentLength(start: [number, number], end: [number, number]): number {
  const R = 6371; // Earth's radius in kilometers
  const lat1 = start[0] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const dLat = (end[0] - start[0]) * Math.PI / 180;
  const dLon = (end[1] - start[1]) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1) * Math.cos(lat2) *
           Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Generates cycling routes using Google Maps Directions API.
 */
export async function generateRoutes(
  startLocation: Location,
  radiusKm: number = 10,
  numRoutes: number = 10,
  minDistanceKm: number = 10,
  maxDistanceKm: number = 50
): Promise<Route[]> {
  console.log(`Generating ${numRoutes} routes within ${radiusKm}km radius...`);
  console.log(`Target distance range: ${minDistanceKm}-${maxDistanceKm}km`);

  const routes: Route[] = [];
  let attempts = 0;
  const maxAttempts = 100; // Increased from 50 to 100

  while (routes.length < numRoutes && attempts < maxAttempts) {
    attempts++;
    console.log(`\nAttempt ${attempts}/${maxAttempts}`);

    try {
      // Generate waypoints with improved separation
      const waypoints = generateRandomWaypoints(startLocation, radiusKm, 3);
      console.log('Generated waypoints:', waypoints);

      // Build the URL with proper parameters
      const waypointsParam = waypoints
        .map(wp => `${wp.latitude},${wp.longitude}`)
        .join('|');

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${
        startLocation.latitude
      },${startLocation.longitude}&destination=${
        startLocation.latitude
      },${startLocation.longitude}&waypoints=optimize:true|${waypointsParam}&mode=driving&avoid=highways&key=${GOOGLE_API_KEY}`;

      console.log('Requesting route from Google Directions API...');
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.log(`Route rejected: API returned status "${data.status}"`);
        continue;
      }

      const route = data.routes[0];
      const distanceInMeters = route.legs.reduce(
        (total: number, leg: any) => total + leg.distance.value,
        0
      );
      const distanceInKm = distanceInMeters / 1000;

      console.log(`Route distance: ${distanceInKm.toFixed(2)}km`);

      // Check if route meets distance criteria
      if (distanceInKm < minDistanceKm || distanceInKm > maxDistanceKm) {
        console.log(
          `Route rejected: Distance ${distanceInKm.toFixed(2)}km outside target range ${minDistanceKm}-${maxDistanceKm}km`
        );
        continue;
      }

      // Check for route overlap (if we have any routes)
      if (routes.length > 0) {
        const isOverlapping = routes.some(existingRoute => {
          const overlap = calculateRouteOverlap(
            existingRoute.points,
            route.overview_polyline.points
          );
          return overlap > 0.7; // 70% overlap threshold
        });

        if (isOverlapping) {
          console.log('Route rejected: Too similar to existing routes');
          continue;
        }
      }

      // Extract steps and format them
      const steps = route.legs.flatMap((leg: any) =>
        leg.steps.map((step: any) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance.text,
          duration: step.duration.text,
          maneuver: step.maneuver || 'straight',
          location: {
            latitude: step.start_location.lat,
            longitude: step.start_location.lng,
          },
        }))
      );

      // Create route object with all required fields
      const newRoute: Route = {
        id: uuid(),
        name: `Route ${routes.length + 1}`,
        description: `A ${distanceInKm.toFixed(1)}km cycling route`,
        distance: distanceInKm,
        duration: route.legs.reduce(
          (total: number, leg: any) => total + leg.duration.value,
          0
        ),
        points: route.overview_polyline.points,
        startLocation,
        waypoints,
        steps,
        bounds: route.bounds,
        createdAt: new Date().toISOString(),
      };

      routes.push(newRoute);
      console.log(`Route ${routes.length} accepted!`);
    } catch (error) {
      console.error('Error generating route:', error);
    }
  }

  console.log(`\nGenerated ${routes.length} routes after ${attempts} attempts`);
  return routes;
}