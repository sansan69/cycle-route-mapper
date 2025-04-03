import { useEffect, useState } from 'react';
import { StyleSheet, View, TextInput, Text } from 'react-native';
import { MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface Location {
  latitude: number;
  longitude: number;
}

interface MapPickerProps {
  onLocationSelect: (location: Location) => void;
}

export default function MapPicker({ onLocationSelect }: MapPickerProps) {
  const [location, setLocation] = useState<Location | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Toast.show({
            type: 'error',
            text1: 'Permission denied',
            text2: 'Please enter coordinates manually'
          });
          // Set default location (e.g., New York City)
          const defaultLocation = {
            latitude: 40.7128,
            longitude: -74.0060,
          };
          setLocation(defaultLocation);
          onLocationSelect(defaultLocation);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        const newLocation = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setLocation(newLocation);
        onLocationSelect(newLocation);
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Failed to get location. Please enter coordinates manually.'
        });
      }
    })();
  }, []);

  const handleManualLocationSubmit = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Coordinates',
        text2: 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180)'
      });
      return;
    }

    const newLocation = { latitude: lat, longitude: lon };
    setLocation(newLocation);
    onLocationSelect(newLocation);
  };

  const handleMapPress = (event: any) => {
    const newLocation = event.nativeEvent.coordinate;
    setLocation(newLocation);
    onLocationSelect(newLocation);
  };

  if (!location) {
    return <View style={styles.container} />;
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
      >
        {location && (
          <Marker coordinate={location}>
            <MapPin color="#2563eb" size={24} />
          </Marker>
        )}
      </MapView>
      <View style={styles.coordsInput}>
        <Text style={styles.coordsLabel}>Manual Coordinates:</Text>
        <View style={styles.coordsRow}>
          <TextInput
            style={styles.coordInput}
            placeholder="Latitude"
            value={manualLat}
            onChangeText={setManualLat}
            keyboardType="numeric"
            onSubmitEditing={handleManualLocationSubmit}
          />
          <TextInput
            style={styles.coordInput}
            placeholder="Longitude"
            value={manualLon}
            onChangeText={setManualLon}
            keyboardType="numeric"
            onSubmitEditing={handleManualLocationSubmit}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
  },
  map: {
    flex: 1,
  },
  coordsInput: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  coordsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#1e293b',
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
  },
});