import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, TextInput, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Heart, ArrowLeft, Star, Tag, Bookmark, Navigation, MapPin, PlayCircle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { saveRoute, getSavedRoutes } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';

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

interface Route {
  id: string;
  name: string;
  distance: number;
  duration?: number;
  startLocation: Location;
  endLocation: Location;
  coordinates: [number, number][];
  steps?: GoogleDirectionsStep[];
  bounds?: {
    northeast: Location;
    southwest: Location;
  };
  rating?: number;
  tags?: string[];
  createdAt?: string;
}

const AVAILABLE_TAGS = ['Scenic', 'Offbeat', 'City Loop', 'Village Trail'];
const ROUTE_DEVIATION_THRESHOLD = 0.5; // 500 meters in kilometers

const requestStoragePermission = async () => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    Toast.show({ type: 'error', text1: 'Storage permission denied' });
    return false;
  }
  return true;
};

const onSaveRoute = async (routeToSave: Route) => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) return;
  await saveRoute(routeToSave);
  Toast.show({ type: 'success', text1: 'Route saved locally!' });
};

export default function RouteDetailsScreen() {
  const router = useRouter();
  const { route: routeParam } = useLocalSearchParams();
  const [routeData, setRouteData] = useState<Route | null>(null);
  const [rating, setRating] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [liked, setLiked] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [locationWatcher, setLocationWatcher] = useState<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (routeParam) {
      try {
        const parsedRoute: Route = JSON.parse(routeParam as string);
        setRouteData(parsedRoute);
        if (parsedRoute.rating) setRating(String(parsedRoute.rating));
        if (parsedRoute.tags) setSelectedTags(parsedRoute.tags);
      } catch (e) {
        console.error("Failed to parse route data from params", e);
        Toast.show({ type: 'error', text1: 'Error loading route details' });
      }
    }
  }, [routeParam]);

  useEffect(() => {
    return () => {
      if (locationWatcher) {
        locationWatcher.remove();
      }
    };
  }, [locationWatcher]);

  const handleBack = () => {
    router.back();
  };

  const handleLike = () => {
    setLiked(!liked);
    Toast.show({
      type: 'success',
      text1: liked ? 'Route unliked' : 'Route liked!',
      text2: liked ? 'You unliked this route' : 'You liked this route!',
    });
  };

  const handleSaveRoute = async () => {
    if (!routeData) return;

    const ratingNum = parseFloat(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      Toast.show({ type: 'error', text1: 'Invalid Rating', text2: 'Please enter a rating between 1 and 5' });
      return;
    }

    try {
      const idToUse = routeData.id.startsWith('route-') ? uuidv4() : routeData.id;

      const routeToSave: Route = {
        ...routeData,
        id: idToUse,
        rating: ratingNum,
        tags: selectedTags,
        createdAt: routeData.createdAt || new Date().toISOString(),
        steps: routeData.steps,
        duration: routeData.duration,
        bounds: routeData.bounds,
      };
      await onSaveRoute(routeToSave);
      if(idToUse !== routeData.id) {
          setRouteData(prev => prev ? { ...prev, id: idToUse, createdAt: routeToSave.createdAt } : null);
      }
    } catch (error) {
      console.error("Error in handleSaveRoute:", error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save route' });
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleToggleFollowing = async () => {
    if (!locationWatcher) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location Permission Denied' });
        return;
      }
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 10 },
        (location) => {
          const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          setUserLocation(coords);
          mapRef.current?.animateToRegion({
            ...coords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      );
      setLocationWatcher(subscription);
      Toast.show({ type: 'info', text1: 'Following Your Location' });
    } else {
      locationWatcher.remove();
      setLocationWatcher(null);
      Toast.show({ type: 'info', text1: 'Stopped Following' });
    }
  };

  const handleStartTurnByTurn = () => {
    if (!routeData) {
      Toast.show({ type: 'error', text1: 'Route data not loaded' });
      return;
    }
    if (!routeData.steps || routeData.steps.length === 0) {
      Alert.alert(
          "Navigation Not Available",
          "Detailed turn-by-turn steps are not available for this route. Cannot start navigation."
      );
      return;
    }

    router.push({
      pathname: '/RideTrackingScreen',
      params: { routeToNavigate: JSON.stringify(routeData) },
    });
  };

  if (!routeData) {
    return <Text style={styles.loadingText}>Loading route details...</Text>;
  }

  const initialMapRegion = routeData.bounds
    ? {
        latitude: (routeData.bounds.northeast.latitude + routeData.bounds.southwest.latitude) / 2,
        longitude: (routeData.bounds.northeast.longitude + routeData.bounds.southwest.longitude) / 2,
        latitudeDelta: Math.abs(routeData.bounds.northeast.latitude - routeData.bounds.southwest.latitude) * 1.5,
        longitudeDelta: Math.abs(routeData.bounds.northeast.longitude - routeData.bounds.southwest.longitude) * 1.5,
      }
    : {
        latitude: routeData.startLocation.latitude,
        longitude: routeData.startLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{routeData.name || 'Route Details'}</Text>
        <TouchableOpacity onPress={handleLike} style={styles.iconButton}>
          <Heart size={24} color={liked ? '#ef4444' : '#000'} fill={liked ? '#ef4444' : 'none'} />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation
          showsMyLocationButton={false}
          scrollEnabled={!locationWatcher}
          zoomEnabled={!locationWatcher}
          pitchEnabled={!locationWatcher}
          rotateEnabled={!locationWatcher}
          initialRegion={initialMapRegion}
          onMapReady={() => {
            if (routeData.bounds) {
              mapRef.current?.fitToCoordinates([
                { latitude: routeData.bounds.northeast.latitude, longitude: routeData.bounds.northeast.longitude },
                { latitude: routeData.bounds.southwest.latitude, longitude: routeData.bounds.southwest.longitude },
              ], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
            }
          }}
        >
          <Polyline
            coordinates={routeData.coordinates.map(coord => ({ latitude: coord[0], longitude: coord[1] }))}
            strokeColor="#1E90FF"
            strokeWidth={4}
          />
          <Marker coordinate={routeData.startLocation} title="Start" pinColor="green"/>
          <Marker coordinate={routeData.endLocation} title="End" pinColor="red"/>
          {userLocation && locationWatcher && (
            <Marker coordinate={userLocation} title="You" pinColor="blue" />
          )}
        </MapView>

        <TouchableOpacity
          style={[styles.mapButton, styles.followButton]}
          onPress={handleToggleFollowing}
        >
          <MapPin color="#ffffff" size={20}/>
          <Text style={styles.mapButtonText}>{locationWatcher ? 'Stop Following' : 'Follow Me'}</Text>
        </TouchableOpacity>

         <TouchableOpacity
          style={[styles.mapButton, styles.startButton]}
          onPress={handleStartTurnByTurn}
          disabled={!routeData.steps || routeData.steps.length === 0}
        >
          <PlayCircle color="#ffffff" size={20}/>
          <Text style={styles.mapButtonText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.distanceText}>
            {routeData.distance.toFixed(1)} km
            {routeData.duration && `  ·  ${Math.round(routeData.duration / 60)} min`}
        </Text>

        <View style={styles.ratingContainer}>
          <Text style={styles.label}>Rate this Route (1-5):</Text>
          <TextInput
            style={styles.ratingInput}
            keyboardType="numeric"
            value={rating}
            onChangeText={setRating}
            maxLength={1}
            placeholder="-"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.tagsContainer}>
          <Text style={styles.label}>Tags:</Text>
          <View style={styles.tagSelection}>
            {AVAILABLE_TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]}
                onPress={() => toggleTag(tag)}
              >
                <Tag size={16} color={selectedTags.includes(tag) ? '#ffffff' : '#64748b'} style={styles.tagIcon}/>
                <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveRoute}>
          <Bookmark size={20} color="#ffffff" style={styles.saveIcon}/>
          <Text style={styles.saveButtonText}>Save Route</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
      flex: 1,
      textAlign: 'center',
      marginTop: 50,
      fontSize: 18,
      color: '#64748b'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  iconButton: {
    padding: 8,
  },
  mapContainer: {
      position: 'relative',
      height: 350,
      width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapButton: {
    position: 'absolute',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  followButton: {
    bottom: 20,
    left: 20,
  },
  startButton: {
    bottom: 20,
    right: 20,
    backgroundColor: '#2563eb',
  },
  mapButtonText: {
      marginLeft: 6,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    marginTop: -10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 25,
    textAlign: 'center',
    color: '#374151',
  },
  ratingContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#1f2937',
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  tagsContainer: {
    marginBottom: 25,
  },
  tagSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tagSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tagIcon: {
    marginRight: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#4b5563',
  },
  tagTextSelected: {
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 