// localStorage key names, kept in their own module so both the storage layer
// and the cloud-sync layer can use them without importing each other.
export const KEYS = {
  workouts: 'll_w',
  prog: 'll_p',
  library: 'll_lib',
  wiz: 'll_wiz',
  customEx: 'll_custom_ex',
  savedProgs: 'll_saved_progs',
  // Sync bookkeeping
  syncedAt: 'll_synced_at',      // last SERVER updatedAt we have applied
  deletedProgs: 'll_deleted_progs',
  deviceId: 'll_device_id',
};
