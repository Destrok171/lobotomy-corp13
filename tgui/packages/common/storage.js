/**
 * Browser-agnostic abstraction of key-value web storage.
 *
 * @file
 * @copyright 2020 Aleksej Komarov
 * @license MIT
 */

export const IMPL_MEMORY = 0;
export const IMPL_HUB_STORAGE = 1;
export const IMPL_INDEXED_DB = 2;

const INDEXED_DB_VERSION = 1;
const INDEXED_DB_NAME = 'tgui';
const INDEXED_DB_STORE_NAME = 'storage-v1';

const READ_ONLY = 'readonly';
const READ_WRITE = 'readwrite';

const testGeneric = testFn => () => {
  try {
    return Boolean(testFn());
  }
  catch {
    return false;
  }
};

const testHubStorage = testGeneric(
  () => window.hubStorage && window.hubStorage.getItem
);

class MemoryBackend {
  constructor() {
    this.impl = IMPL_MEMORY;
    this.store = {};
  }

  async get(key) {
    return this.store[key];
  }

  async set(key, value) {
    this.store[key] = value;
  }

  async remove(key) {
    this.store[key] = undefined;
  }

  async clear() {
    this.store = {};
  }
}

class HubStorageBackend {
  constructor() {
    this.impl = IMPL_HUB_STORAGE;
  }

  async get(key) {
    const value = await window.hubStorage.getItem(key);
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
  }

  async set(key, value) {
    window.hubStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key) {
    window.hubStorage.removeItem(key);
  }

  async clear() {
    window.hubStorage.clear();
  }
}

/*
class IndexedDbBackend {
  constructor() {
    this.impl = IMPL_INDEXED_DB;
    /** @type {Promise<IDBDatabase>} *
    this.dbPromise = new Promise((resolve, reject) => {
      const indexedDB = window.indexedDB || window.msIndexedDB;
      const req = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore(INDEXED_DB_STORE_NAME);
        }
        catch (err) {
          reject(new Error('Failed to upgrade IDB: ' + req.error));
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        reject(new Error('Failed to open IDB: ' + req.error));
      };
    });
  }

  getStore(mode) {
    return this.dbPromise.then(db => db
      .transaction(INDEXED_DB_STORE_NAME, mode)
      .objectStore(INDEXED_DB_STORE_NAME));
  }

  async get(key) {
    const store = await this.getStore(READ_ONLY);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key, value) {
    // The reason we don't _save_ null is because IE 10 does
    // not support saving the `null` type in IndexedDB. How
    // ironic, given the bug below!
    // See: https://github.com/mozilla/localForage/issues/161
    if (value === null) {
      value = undefined;
    }
    // NOTE: We deliberately make this operation transactionless
    const store = await this.getStore(READ_WRITE);
    store.put(value, key);
  }

  async remove(key) {
    // NOTE: We deliberately make this operation transactionless
    const store = await this.getStore(READ_WRITE);
    store.delete(key);
  }

  async clear() {
    // NOTE: We deliberately make this operation transactionless
    const store = await this.getStore(READ_WRITE);
    store.clear();
  }
}
*/

/**
 * Web Storage Proxy object, which selects the best backend available
 * depending on the environment.
 */
export class StorageProxy {
  constructor() {
    this.backendPromise = (async () => {
      if (!Byond.TRIDENT) {
        /*
        if (Byond.storageCdn) {
          const iframe = new IFrameIndexedDbBackend();
          await iframe.ready();

          if ((await iframe.ping()) === true) {
            return iframe;
          }

          iframe.destroy();
        }
          */

        if (!testHubStorage()) {
          Byond.winset(null, 'browser-options', '+byondstorage');

          return new Promise(resolve => {
            const listener = () => {
              document.removeEventListener('byondstorageupdated', listener);
              resolve(new HubStorageBackend());
            };

            document.addEventListener('byondstorageupdated', listener);
          });
        }
        return new HubStorageBackend();
      }
      console.warn(
        'No supported storage backend found. Using in-memory storage.'
      );
      return new MemoryBackend();
    })();
  }

  async get(key) {
    const backend = await this.backendPromise;
    return backend.get(key);
  }

  async set(key, value) {
    const backend = await this.backendPromise;
    return backend.set(key, value);
  }

  async remove(key) {
    const backend = await this.backendPromise;
    return backend.remove(key);
  }

  async clear() {
    const backend = await this.backendPromise;
    return backend.clear();
  }
}

export const storage = new StorageProxy();
