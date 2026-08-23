/*
 * storage.js — persistente virtuelle Festplatten in IndexedDB.
 *
 * v86 bekommt eine Festplatte als ArrayBuffer übergeben und schreibt Gast-Zugriffe
 * direkt in genau diesen Puffer zurück. Damit eine Installation den Reload überlebt,
 * wird der Puffer hier in Blöcken abgelegt — und beim Sichern nur das geschrieben,
 * was sich tatsächlich geändert hat (Prüfsumme je Block).
 *
 * Alles bleibt im Browser: IndexedDB ist Speicher des Nutzers, kein Server im Spiel.
 */

const DiskStore = (function () {
  "use strict";

  const DB_NAME = "browserlinux";
  const DB_VERSION = 1;
  const STORE_CHUNKS = "chunks";   // key: "<diskId>/<index>"  value: Uint8Array
  const STORE_META = "meta";       // key: diskId              value: { size, chunkSize, digests[], ... }
  const CHUNK_SIZE = 4 * 1024 * 1024;

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) db.createObjectStore(STORE_CHUNKS);
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(db, stores, mode) {
    const t = db.transaction(stores, mode);
    return {
      t,
      store: (name) => t.objectStore(name),
      done: new Promise((res, rej) => {
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error || new Error("Transaktion abgebrochen"));
      }),
    };
  }

  function get(store, key) {
    return new Promise((res, rej) => {
      const r = store.get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  // Kurze, schnelle Prüfsumme (FNV-1a, 32 Bit) über einen Block.
  // Reicht, um "unverändert" zu erkennen, und ist deutlich schneller als SHA.
  function digest(bytes) {
    let h = 0x811c9dc5;
    // Nur jedes 7. Byte wäre zu lasch — hier voll, aber in 32-Bit-Schritten.
    const view = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >>> 2);
    for (let i = 0; i < view.length; i++) {
      h ^= view[i];
      h = Math.imul(h, 0x01000193);
    }
    const rest = bytes.byteLength & 3;
    for (let i = bytes.byteLength - rest; i < bytes.byteLength; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  return {
    CHUNK_SIZE,

    /** Speicherkontingent des Browsers abfragen. */
    async quota() {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    },

    /** Dauerhaften Speicher anfordern, damit der Browser die Daten nicht wegräumt. */
    async requestPersistence() {
      if (!navigator.storage || !navigator.storage.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return navigator.storage.persist();
    },

    /** Liste aller gespeicherten Platten. */
    async list() {
      const db = await open();
      const { store, done } = tx(db, [STORE_META], "readonly");
      const s = store(STORE_META);
      const out = await new Promise((res, rej) => {
        const items = [];
        const cur = s.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return res(items);
          items.push({ id: c.key, ...c.value });
          c.continue();
        };
        cur.onerror = () => rej(cur.error);
      });
      await done;
      return out;
    },

    async info(diskId) {
      const db = await open();
      const { store, done } = tx(db, [STORE_META], "readonly");
      const meta = await get(store(STORE_META), diskId);
      await done;
      return meta || null;
    },

    /**
     * Platte laden. Liefert einen ArrayBuffer der gespeicherten Größe,
     * oder null, wenn es sie nicht gibt.
     */
    async load(diskId, onProgress) {
      const db = await open();
      const { store, done } = tx(db, [STORE_META, STORE_CHUNKS], "readonly");
      const meta = await get(store(STORE_META), diskId);
      if (!meta) { await done; return null; }

      const buf = new ArrayBuffer(meta.size);
      const view = new Uint8Array(buf);
      const chunks = Math.ceil(meta.size / meta.chunkSize);
      const cs = store(STORE_CHUNKS);

      for (let i = 0; i < chunks; i++) {
        const data = await get(cs, `${diskId}/${i}`);
        if (data) view.set(new Uint8Array(data), i * meta.chunkSize);
        if (onProgress && (i % 8 === 0 || i === chunks - 1)) onProgress(i + 1, chunks);
      }
      await done;
      return buf;
    },

    /**
     * Platte sichern. Schreibt nur geänderte Blöcke.
     * Liefert { written, total, bytes }.
     */
    async save(diskId, arrayBuffer, label, onProgress) {
      const db = await open();
      const view = new Uint8Array(arrayBuffer);
      const size = view.byteLength;
      const chunks = Math.ceil(size / CHUNK_SIZE);

      const prev = await this.info(diskId);
      const oldDigests = (prev && prev.chunkSize === CHUNK_SIZE && prev.digests) || [];
      const digests = new Array(chunks);

      let written = 0;
      let bytes = 0;

      // In Paketen von 16 Blöcken schreiben — eine einzige Transaktion über
      // hunderte Blöcke würde den Hauptthread zu lange blockieren.
      const BATCH = 16;
      for (let start = 0; start < chunks; start += BATCH) {
        const end = Math.min(start + BATCH, chunks);
        const pending = [];

        for (let i = start; i < end; i++) {
          const from = i * CHUNK_SIZE;
          const to = Math.min(from + CHUNK_SIZE, size);
          const slice = view.subarray(from, to);
          const d = digest(slice);
          digests[i] = d;
          if (oldDigests[i] !== d) pending.push([i, slice.slice()]); // Kopie: IDB braucht eigenen Puffer
        }

        if (pending.length) {
          const { store, done } = tx(db, [STORE_CHUNKS], "readwrite");
          const cs = store(STORE_CHUNKS);
          for (const [i, data] of pending) {
            cs.put(data, `${diskId}/${i}`);
            written++;
            bytes += data.byteLength;
          }
          await done;
        }
        if (onProgress) onProgress(end, chunks);
        // Dem Browser Luft lassen
        await new Promise((r) => setTimeout(r, 0));
      }

      // Blöcke einer geschrumpften Platte entfernen
      if (prev && prev.size > size) {
        const oldChunks = Math.ceil(prev.size / prev.chunkSize);
        const { store, done } = tx(db, [STORE_CHUNKS], "readwrite");
        const cs = store(STORE_CHUNKS);
        for (let i = chunks; i < oldChunks; i++) cs.delete(`${diskId}/${i}`);
        await done;
      }

      const { store, done } = tx(db, [STORE_META], "readwrite");
      store(STORE_META).put(
        { size, chunkSize: CHUNK_SIZE, digests, label: label || diskId, updated: new Date().toISOString() },
        diskId
      );
      await done;

      return { written, total: chunks, bytes };
    },

    async remove(diskId) {
      const db = await open();
      const meta = await this.info(diskId);
      const chunks = meta ? Math.ceil(meta.size / meta.chunkSize) : 0;
      const { store, done } = tx(db, [STORE_META, STORE_CHUNKS], "readwrite");
      const cs = store(STORE_CHUNKS);
      for (let i = 0; i < chunks; i++) cs.delete(`${diskId}/${i}`);
      store(STORE_META).delete(diskId);
      await done;
    },
  };
})();
