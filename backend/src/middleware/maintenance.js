const { db } = require('../firebase');

// In-memory cache for maintenance settings (TTL: 15 seconds to minimize Firestore reads)
let maintenanceCache = {
  data: {
    enabled: false,
    message: 'System upgrade in progress. Regular services will resume shortly.',
    estimatedEndTime: '',
    updatedAt: null,
    updatedBy: 'Admin'
  },
  cachedAt: 0
};

const getMaintenanceConfig = async () => {
  const now = Date.now();
  if (maintenanceCache.cachedAt && (now - maintenanceCache.cachedAt < 15000)) {
    return maintenanceCache.data;
  }

  try {
    if (db) {
      const doc = await db.collection('settings').doc('system_maintenance').get();
      if (doc.exists) {
        const d = doc.data();
        maintenanceCache.data = {
          enabled: Boolean(d.enabled),
          message: d.message || 'System upgrade in progress. Regular services will resume shortly.',
          estimatedEndTime: d.estimatedEndTime || '',
          updatedAt: d.updatedAt || null,
          updatedBy: d.updatedBy || 'Admin'
        };
      } else {
        maintenanceCache.data = {
          enabled: false,
          message: 'System upgrade in progress. Regular services will resume shortly.',
          estimatedEndTime: '',
          updatedAt: null,
          updatedBy: 'Admin'
        };
      }
    }
  } catch (err) {
    console.warn('Could not read maintenance config from Firestore:', err.message);
  }
  maintenanceCache.cachedAt = now;
  return maintenanceCache.data;
};

const setMaintenanceCache = (data) => {
  maintenanceCache.data = data;
  maintenanceCache.cachedAt = Date.now();
};

module.exports = {
  getMaintenanceConfig,
  setMaintenanceCache
};
