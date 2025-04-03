import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Heart, ArrowLeft, Star, Tag, Bookmark, Navigation } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { saveRoute, getSavedRoutes } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';

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

const onSaveRoute = async (routeData: Route) => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) return;
  await saveRoute(routeData);
  Toast.show({ type: 'success', text1: 'Route saved locally' });
};

export default function RouteDetailsScreen() {
  const router = useRouter();
  const { route: routeParam } = useLocalSearchParams();
  const routeData: Route = routeParam ? JSON.parse(routeParam as string) : null;
  const [rating, setRating] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [liked, setLiked] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [watcher, setWatcher] = useState<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  const handleBack = () => {
    if (watcher) {
      watcher.remove();
    }
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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid rating between 1 and 5',
      });
      return;
    }

    try {
      const routeToSave = {
        ...routeData,
        id: uuidv4(),
        rating: ratingNum,
        tags: selectedTags,
        createdAt: new Date().toISOString(),
      };
      await onSaveRoute(routeToSave);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save route',
      });
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  useEffect(() => {
    loadSavedRoutes();
    return () => {
      if (watcher) {
        watcher.remove();
      }
    };
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const routes = await getSavedRoutes();
      setSavedRoutes(routes);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load saved routes',
      });
    }
  };

  if (!routeData) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft color="#2563eb" size={24} />
        </TouchableOpacity>
        <Text style={styles.errorText}>Route not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <ArrowLeft color="#2563eb" size={24} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navigationButton, watcher && styles.navigationButtonActive]}
        onPress={async () => {
          if (!watcher) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              Toast.show({ 
                type: 'error', 
                text1: 'Location permission denied',
                text2: 'Please enable location access in your device settings'
              });
              return;
            }

            const subscription = await Location.watchPositionAsync(
              { 
                accuracy: Location.Accuracy.High, 
                timeInterval: 2000, 
                distanceInterval: 10 
              },
              (location) => {
                const coords = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                };
                setUserLocation(coords);
                mapRef.current?.animateToRegion({
                  ...coords,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }, 1000);
              }
            );

            setWatcher(subscription);
            Toast.show({ 
              type: 'success', 
              text1: 'Navigation started',
              text2: 'Following your location'
            });
          } else {
            watcher.remove();
            setWatcher(null);
            Toast.show({ 
              type: 'info', 
              text1: 'Navigation stopped',
              text2: 'Map controls restored'
            });
          }
        }}
      >
        <Navigation color="#ffffff" size={20} style={styles.navigationIcon} />
        <Text style={styles.navigationButtonText}>
          {watcher ? 'Stop Navigation' : 'Start Navigation'}
        </Text>
      </TouchableOpacity>
      
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        followsUserLocation={watcher !== null}
        showsMyLocationButton
        scrollEnabled={!watcher}
        zoomEnabled={!watcher}
        initialRegion={{
          latitude: routeData.startLocation.latitude,
          longitude: routeData.startLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Polyline
          coordinates={routeData.coordinates.map(coord => ({
            latitude: coord[0],
            longitude: coord[1],
          }))}
          strokeColor="#1E90FF"
          strokeWidth={4}
        />
        <Marker coordinate={routeData.startLocation} />
        <Marker coordinate={routeData.endLocation} />
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="You"
            pinColor="blue"
          />
        )}
      </MapView>

      <ScrollView style={styles.infoContainer}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeName}>{routeData.name}</Text>
          <Text style={styles.routeDistance}>{routeData.distance.toFixed(1)} km</Text>
        </View>

        <View style={styles.ratingContainer}>
          <Star color="#2563eb" size={20} />
          <TextInput
            style={styles.ratingInput}
            placeholder="Rate (1-5)"
            value={rating}
            onChangeText={setRating}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.tagsContainer}>
          <Tag color="#2563eb" size={20} />
          <Text style={styles.tagsLabel}>Tags:</Text>
          <View style={styles.tagsList}>
            {AVAILABLE_TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  selectedTags.includes(tag) && styles.tagSelected
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[
                  styles.tagText,
                  selectedTags.includes(tag) && styles.tagTextSelected
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.button, liked && styles.buttonLiked]} 
            onPress={handleLike}
          >
            <Heart color={liked ? "#ef4444" : "#2563eb"} size={24} />
            <Text style={[styles.buttonText, liked && styles.buttonTextLiked]}>
              {liked ? 'Unlike Route' : 'Rate this Route'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSaveRoute}
          >
            <Bookmark color="#2563eb" size={24} />
            <Text style={styles.buttonText}>Save Route</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationButtonActive: {
    backgroundColor: '#ef4444',
  },
  navigationIcon: {
    marginRight: 8,
  },
  navigationButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  routeInfo: {
    padding: 16,
  },
  routeName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  routeDistance: {
    fontSize: 16,
    color: '#64748b',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  ratingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
  },
  tagsContainer: {
    padding: 16,
    paddingTop: 0,
  },
  tagsLabel: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 8,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  tagText: {
    color: '#64748b',
    fontSize: 14,
  },
  tagTextSelected: {
    color: '#2563eb',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 0,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  buttonLiked: {
    backgroundColor: '#fef2f2',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2563eb',
  },
  buttonTextLiked: {
    color: '#ef4444',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 20,
  },
}); 