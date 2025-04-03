import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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

interface RouteItemProps {
  route: Route;
}

export default function RouteItem({ route }: RouteItemProps) {
  const router = useRouter();

  const openDetailScreen = () => {
    router.push({
      pathname: '/RouteDetailsScreen',
      params: { route: JSON.stringify(route) }
    });
  };

  return (
    <TouchableOpacity style={styles.container} onPress={openDetailScreen}>
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: route.startLocation.latitude,
            longitude: route.startLocation.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Polyline
            coordinates={route.coordinates.map(coord => ({
              latitude: coord[0],
              longitude: coord[1],
            }))}
            strokeColor="#2563eb"
            strokeWidth={3}
          />
          <Marker coordinate={route.startLocation} />
          <Marker coordinate={route.endLocation} />
        </MapView>
      </View>
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.name}>{route.name}</Text>
          <Text style={styles.distance}>{route.distance.toFixed(1)} km</Text>
        </View>
        <ExternalLink color="#2563eb" size={24} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  mapContainer: {
    height: 200,
  },
  map: {
    flex: 1,
  },
  content: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: '#64748b',
  },
});