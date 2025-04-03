import { View, StyleSheet, TouchableOpacity, Text, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Heart, Bookmark } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { saveRoute } from '../../utils/storage';

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

export default function RouteDetailsScreen() {
  const router = useRouter();
  const { route } = useLocalSearchParams<{ route: string }>();
  const routeData: Route = JSON.parse(route);

  const openInMaps = async () => {
    const { coordinates } = routeData;
    const limitedCoords = coordinates.slice(1, 20);
    const waypointsString = limitedCoords
      .map(coord => `${coord[0]},${coord[1]}`)
      .join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${coordinates[0][0]},${coordinates[0][1]}&destination=${coordinates[0][0]},${coordinates[0][1]}&travelmode=driving&waypoints=${waypointsString}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please install Google Maps to view the route',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open maps application',
      });
    }
  };

  const handleSaveRoute = async () => {
    try {
      await saveRoute(routeData);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Route saved successfully',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save route',
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: routeData.startLocation.latitude,
          longitude: routeData.startLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <Polyline
          coordinates={routeData.coordinates.map(coord => ({
            latitude: coord[0],
            longitude: coord[1],
          }))}
          strokeColor="#2563eb"
          strokeWidth={3}
        />
        <Marker coordinate={routeData.startLocation} />
        <Marker coordinate={routeData.endLocation} />
      </MapView>

      <View style={styles.infoContainer}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeName}>{routeData.name}</Text>
          <Text style={styles.routeDistance}>{routeData.distance.toFixed(1)} km</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.button} onPress={openInMaps}>
            <Heart color="#2563eb" size={24} />
            <Text style={styles.buttonText}>Like this Route</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleSaveRoute}>
            <Bookmark color="#2563eb" size={24} />
            <Text style={styles.buttonText}>Save Route</Text>
          </TouchableOpacity>
        </View>
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
  infoContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  routeInfo: {
    marginBottom: 16,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
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
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2563eb',
  },
}); 