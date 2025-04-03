import { View, StyleSheet, TouchableOpacity, Text, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { generateRoutes } from '@/utils/openRouteService';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

interface Location {
  latitude: number;
  longitude: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<Location | null>(null);
  const [radius, setRadius] = useState('10');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Location permission is required to generate routes',
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  const handleMapPress = (event: any) => {
    setLocation({
      latitude: event.nativeEvent.coordinate.latitude,
      longitude: event.nativeEvent.coordinate.longitude,
    });
  };

  const handleGenerateRoutes = async () => {
    if (!location) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a start location on the map',
      });
      return;
    }

    const radiusNum = parseFloat(radius);
    if (isNaN(radiusNum) || radiusNum <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid radius',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const routes = await generateRoutes(location, radiusNum);
      if (routes.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'No valid routes found. Try adjusting the radius.',
        });
        return;
      }
      router.push({
        pathname: '/generated',
        params: { routes: JSON.stringify(routes) },
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to generate routes',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!location) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={location}
          draggable
          onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)}
        />
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.instructions}>
          Drag the pin or tap on the map to set start location
        </Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.radiusInput}
            placeholder="Radius (km)"
            value={radius}
            onChangeText={setRadius}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isGenerating && styles.buttonDisabled]}
          onPress={handleGenerateRoutes}
          disabled={isGenerating}
        >
          <Text style={styles.buttonText}>
            {isGenerating ? 'Generating Routes...' : 'Generate Routes'}
          </Text>
        </TouchableOpacity>
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
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  instructions: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  radiusInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
  },
});