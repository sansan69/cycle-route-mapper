import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import RouteItem from '@/components/RouteItem';

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

export default function RoutesScreen() {
  const { routes: routesParam } = useLocalSearchParams();
  const routes: Route[] = routesParam ? JSON.parse(routesParam as string) : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generated Routes</Text>
      <FlatList
        data={routes}
        renderItem={({ item }) => <RouteItem route={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    padding: 20,
    color: '#1e293b',
  },
  listContent: {
    padding: 20,
  },
});