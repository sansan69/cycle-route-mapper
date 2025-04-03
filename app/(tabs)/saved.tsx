import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import RouteItem from '@/components/RouteItem';
import { getSavedRoutes, deleteRoute, SavedRoute } from '@/utils/storage';
import { Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

export default function SavedScreen() {
  const router = useRouter();
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);

  useEffect(() => {
    loadSavedRoutes();
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

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await deleteRoute(routeId);
      setSavedRoutes(prev => prev.filter(route => route.id !== routeId));
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Route deleted successfully',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete route',
      });
    }
  };

  const renderRouteItem = ({ item }: { item: SavedRoute }) => (
    <View style={styles.routeItemContainer}>
      <TouchableOpacity 
        style={styles.routeItem}
        onPress={() => router.push({
          pathname: '/RouteDetailsScreen',
          params: { route: JSON.stringify(item) }
        })}
      >
        <RouteItem route={item} />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteRoute(item.id)}
      >
        <Trash2 color="#ef4444" size={20} />
      </TouchableOpacity>
    </View>
  );

  if (savedRoutes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No saved routes yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Routes</Text>
      <FlatList
        data={savedRoutes}
        renderItem={renderRouteItem}
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
  routeItemContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  routeItem: {
    flex: 1,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
}); 