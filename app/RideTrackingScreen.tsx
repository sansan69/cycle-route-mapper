import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Play, Pause, Square } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Location {
  latitude: number;
  longitude: number;
}

interface Ride {
  id: string;
  distance: number;
  path: [number, number][];
  startTime: string;
  endTime: string;
  averageSpeed: number;
  duration: number;
}

const LOCATION_UPDATE_INTERVAL = 2000; // 2 seconds
const LOCATION_UPDATE_DISTANCE = 10; // 10 meters

// Haversine formula to calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function RideTrackingScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [isRiding, setIsRiding] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ridePath, setRidePath] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [averageSpeed, setAverageSpeed] = useState(0);
  const [locationWatcher, setLocationWatcher] = useState<Location.LocationSubscription | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRiding && !isPaused) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRiding, isPaused]);

  useEffect(() => {
    return () => {
      if (locationWatcher) {
        locationWatcher.remove();
      }
    };
  }, []);

  const handleStartRide = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Location permission denied',
          text2: 'Please enable location access in your device settings'
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(coords);
      setRidePath([[coords.latitude, coords.longitude]]);
      setStartTime(new Date());
      setDistance(0);
      setElapsedTime(0);
      setAverageSpeed(0);
      setIsRiding(true);
      setIsPaused(false);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: LOCATION_UPDATE_DISTANCE,
        },
        (location) => {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(coords);
          setRidePath(prev => {
            const newPath: [number, number][] = [...prev, [coords.latitude, coords.longitude]];
            const lastPoint = prev[prev.length - 1];
            const newDistance = calculateDistance(
              lastPoint[0],
              lastPoint[1],
              coords.latitude,
              coords.longitude
            );
            setDistance(prev => prev + newDistance);
            setAverageSpeed(prev => {
              const speed = (prev + newDistance) / (elapsedTime / 3600);
              return speed;
            });
            return newPath;
          });
        }
      );

      setLocationWatcher(subscription);
      Toast.show({
        type: 'success',
        text1: 'Ride started',
        text2: 'Tracking your location'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start ride tracking'
      });
    }
  };

  const handlePauseRide = () => {
    if (locationWatcher) {
      locationWatcher.remove();
      setLocationWatcher(null);
    }
    setIsPaused(true);
    Toast.show({
      type: 'info',
      text1: 'Ride paused',
      text2: 'Tracking stopped'
    });
  };

  const handleResumeRide = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: LOCATION_UPDATE_DISTANCE,
        },
        (location) => {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(coords);
          setRidePath(prev => {
            const newPath: [number, number][] = [...prev, [coords.latitude, coords.longitude]];
            const lastPoint = prev[prev.length - 1];
            const newDistance = calculateDistance(
              lastPoint[0],
              lastPoint[1],
              coords.latitude,
              coords.longitude
            );
            setDistance(prev => prev + newDistance);
            setAverageSpeed(prev => {
              const speed = (prev + newDistance) / (elapsedTime / 3600);
              return speed;
            });
            return newPath;
          });
        }
      );

      setLocationWatcher(subscription);
      setIsPaused(false);
      Toast.show({
        type: 'success',
        text1: 'Ride resumed',
        text2: 'Tracking your location'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to resume ride tracking'
      });
    }
  };

  const handleStopRide = async () => {
    if (locationWatcher) {
      locationWatcher.remove();
      setLocationWatcher(null);
    }

    const endTime = new Date();
    setEndTime(endTime);
    setIsRiding(false);
    setIsPaused(false);

    try {
      const ride: Ride = {
        id: uuidv4(),
        distance,
        path: ridePath,
        startTime: startTime!.toISOString(),
        endTime: endTime.toISOString(),
        averageSpeed,
        duration: elapsedTime,
      };

      const savedRides = await AsyncStorage.getItem('rides');
      const rides = savedRides ? JSON.parse(savedRides) : [];
      rides.push(ride);
      await AsyncStorage.setItem('rides', JSON.stringify(rides));

      Toast.show({
        type: 'success',
        text1: 'Ride saved',
        text2: `Distance: ${distance.toFixed(2)}km, Duration: ${formatTime(elapsedTime)}`
      });

      router.back();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save ride'
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        followsUserLocation={isRiding && !isPaused}
        showsMyLocationButton
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : undefined
        }
      >
        {ridePath.length > 0 && (
          <Polyline
            coordinates={ridePath.map(coord => ({
              latitude: coord[0],
              longitude: coord[1],
            }))}
            strokeColor="#1E90FF"
            strokeWidth={4}
          />
        )}
        {ridePath.length > 0 && (
          <Marker
            coordinate={{
              latitude: ridePath[0][0],
              longitude: ridePath[0][1],
            }}
            title="Start"
            pinColor="green"
          />
        )}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Current Location"
            pinColor="blue"
          />
        )}
      </MapView>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Speed</Text>
          <Text style={styles.statValue}>{averageSpeed.toFixed(1)} km/h</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {!isRiding ? (
          <TouchableOpacity style={styles.button} onPress={handleStartRide}>
            <Play color="#ffffff" size={24} />
            <Text style={styles.buttonText}>Start Ride</Text>
          </TouchableOpacity>
        ) : isPaused ? (
          <TouchableOpacity style={styles.button} onPress={handleResumeRide}>
            <Play color="#ffffff" size={24} />
            <Text style={styles.buttonText}>Resume</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={[styles.button, styles.pauseButton]} onPress={handlePauseRide}>
              <Pause color="#ffffff" size={24} />
              <Text style={styles.buttonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={handleStopRide}>
              <Square color="#ffffff" size={24} />
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  statsContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 