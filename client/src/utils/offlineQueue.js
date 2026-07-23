const DB_NAME = 'rapidaid_offline_db';
const STORE_NAME = 'gps_queue';
const DB_VERSION = 1;

// Helper to open the DB
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

// Queue a new GPS coordinate
export const queueLocation = async (latitude, longitude) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const data = {
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      };
      
      const request = store.add(data);
      
      request.onsuccess = () => {
        console.log('[IndexedDB] Coordinate queued offline:', data);
        resolve(true);
      };
      
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to queue location in IndexedDB:', error);
  }
};

// Get all queued GPS coordinates
export const getQueuedLocations = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to get queued locations:', error);
    return [];
  }
};

// Clear the queued coordinates
export const clearQueuedLocations = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[IndexedDB] Offline queue cleared.');
        resolve(true);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to clear queued locations:', error);
  }
};

// Sync buffered locations
export const syncOfflineLocations = async (sendLocationFn) => {
  const queued = await getQueuedLocations();
  if (queued.length === 0) return;

  console.log(`[Offline Sync] Found ${queued.length} coordinates to sync...`);
  
  for (const loc of queued) {
    try {
      await sendLocationFn(loc.latitude, loc.longitude, loc.timestamp);
    } catch (err) {
      console.error('[Offline Sync] Failed to sync coordinate, pausing sync:', err);
      return; // Stop sync if server rejects
    }
  }

  // Clear on successful sync
  await clearQueuedLocations();
  console.log('[Offline Sync] All buffered coordinates synced.');
};
