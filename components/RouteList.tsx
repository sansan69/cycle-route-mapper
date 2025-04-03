import { View, Text, StyleSheet, FlatList } from 'react-native';
import RouteItem from './RouteItem';

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

interface RouteListProps {
  routes: Route[];
}

export default function RouteList({ routes }: RouteListProps) {
  if (routes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No routes available</Text>
        <Text style={styles.emptySubtext}>Select a location and radius to generate routes</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={routes}
      renderItem={({ item }) => <RouteItem route={item} />}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});