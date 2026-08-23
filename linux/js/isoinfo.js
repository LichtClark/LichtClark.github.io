/*
 * isoinfo.js — erkennt vor dem Booten, ob eine ISO überhaupt in v86 laufen kann.
 *
 * v86 emuliert einen 32-Bit-x86-Prozessor. Eine reine amd64-ISO (z. B. jedes
 * aktuelle Ubuntu/Xubuntu) kann darauf nicht starten — sie würde ohne Meldung
 * hängen bleiben. Statt den Nutzer minutenlang raten zu lassen, wird die ISO
 * vorher untersucht.
 *
 * Vorgehen (ohne die ganze Datei zu lesen, nur gezielte Slices):
 *   1. ISO9660 Primary Volume Descriptor bei Sektor 16 (Offset 0x8000), Kennung "CD001"
 *   2. Wurzelverzeichnis daraus lesen und den Verzeichnisbaum gezielt ablaufen
 *   3. /EFI/BOOT/ auswerten:  BOOTIA32.EFI -> 32 Bit,  BOOTX64.EFI -> 64 Bit
 *   4. Kernel suchen (/casper/vmlinuz, /live/vmlinuz, /boot/vmlinuz*) und dessen
 *      bzImage-Kopf prüfen: Magic "HdrS" bei 0x202, xloadflags bei 0x236,
 *      Bit 0 (XLF_KERNEL_64) gesetzt = 64-Bit-Kernel
 */

const IsoInfo = (function () {
  "use strict";

  const SECTOR = 2048;

  async function readAt(file, offset, length) {
    if (offset + length > file.size) length = Math.max(0, file.size - offset);
    if (length <= 0) return new Uint8Array(0);
    return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
  }

  function le32(b, o) {
    return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
  }

  function ascii(b, o, n) {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]);
    return s;
  }

  /* Ein ISO9660-Verzeichnis einlesen -> [{ name, lba, size, isDir }] */
  async function readDir(file, lba, size) {
    const data = await readAt(file, lba * SECTOR, size);
    const entries = [];
    let p = 0;
    while (p < data.length) {
      const len = data[p];
      if (len === 0) {
        // Rest des Sektors ist Füllmaterial
        p = (Math.floor(p / SECTOR) + 1) * SECTOR;
        if (p >= data.length) break;
        continue;
      }
      const extent = le32(data, p + 2);
      const dataLen = le32(data, p + 10);
      const flags = data[p + 25];
      const nameLen = data[p + 32];
      let name = ascii(data, p + 33, nameLen);
      if (nameLen === 1 && (data[p + 33] === 0 || data[p + 33] === 1)) {
        name = data[p + 33] === 0 ? "." : "..";
      } else {
        name = name.split(";")[0];
      }
      entries.push({ name, upper: name.toUpperCase(), lba: extent, size: dataLen, isDir: !!(flags & 0x02) });
      p += len;
    }
    return entries;
  }

  async function findChild(file, dir, wanted) {
    const want = wanted.toUpperCase();
    for (const e of dir) {
      if (e.upper === want) return e;
    }
    return null;
  }

  async function walk(file, root, pathParts) {
    let dir = root;
    let entry = null;
    for (const part of pathParts) {
      entry = await findChild(file, dir, part);
      if (!entry) return null;
      if (entry.isDir) dir = await readDir(file, entry.lba, entry.size);
    }
    return entry;
  }

  /* bzImage-Kopf auswerten -> 'i386' | 'amd64' | null */
  async function kernelArch(file, entry) {
    const head = await readAt(file, entry.lba * SECTOR, 0x300);
    if (head.length < 0x240) return null;
    if (ascii(head, 0x202, 4) !== "HdrS") return null;      // kein bzImage
    const version = head[0x206] | (head[0x207] << 8);
    if (version < 0x0207) return "i386";                     // xloadflags gibt es erst ab 2.07
    const xloadflags = head[0x236] | (head[0x237] << 8);
    return xloadflags & 0x01 ? "amd64" : "i386";             // Bit 0 = XLF_KERNEL_64
  }

  return {
    /**
     * Untersucht eine ISO-Datei.
     * Liefert { arch, bootable, details[] } mit arch aus
     * 'i386' | 'amd64' | 'both' | 'unknown'.
     */
    async inspect(file) {
      const details = [];
      const out = { arch: "unknown", bootable: null, details, label: null };

      const pvd = await readAt(file, 16 * SECTOR, SECTOR);
      if (pvd.length < SECTOR || ascii(pvd, 1, 5) !== "CD001") {
        details.push("Kein ISO9660-Dateisystem gefunden — vermutlich ein Festplattenabbild.");
        return out;
      }
      out.label = ascii(pvd, 40, 32).trim();

      // Wurzelverzeichnis steckt als 34-Byte-Eintrag im PVD ab Offset 156
      const rootLba = le32(pvd, 156 + 2);
      const rootSize = le32(pvd, 156 + 10);
      const root = await readDir(file, rootLba, rootSize);
      details.push("Wurzelverzeichnis: " + root.filter((e) => e.name !== "." && e.name !== "..")
        .map((e) => e.name).slice(0, 12).join(", "));

      // ── EFI-Bootloader
      let ia32 = false, x64 = false;
      const efi = await findChild(file, root, "EFI");
      if (efi && efi.isDir) {
        const efiDir = await readDir(file, efi.lba, efi.size);
        const bootDir = await findChild(file, efiDir, "BOOT");
        if (bootDir && bootDir.isDir) {
          const files = await readDir(file, bootDir.lba, bootDir.size);
          const names = files.map((f) => f.upper);
          ia32 = names.some((n) => n.includes("IA32"));
          x64 = names.some((n) => n.includes("X64"));
          details.push("EFI/BOOT: " + files.filter((f) => f.name !== "." && f.name !== "..")
            .map((f) => f.name).join(", "));
        }
      }

      // ── Kernel suchen und dessen Architektur bestimmen.
      // Erst die üblichen Pfade, dann die Bootverzeichnisse nach kernelartigen
      // Dateinamen durchsehen (ältere Abbilder heißen z. B. /boot/isolinux/linux24).
      const KERNEL_RE = /^(VMLINUZ|LINUX|BZIMAGE|KERNEL)/;
      const dirsToScan = [[], ["CASPER"], ["LIVE"], ["BOOT"], ["BOOT", "ISOLINUX"],
                          ["ISOLINUX"], ["BOOT", "GRUB"], ["SYSLINUX"]];
      let kArch = null;
      for (const dirPath of dirsToScan) {
        let dir = root;
        let ok = true;
        for (const part of dirPath) {
          const e = await findChild(file, dir, part);
          if (!e || !e.isDir) { ok = false; break; }
          dir = await readDir(file, e.lba, e.size);
        }
        if (!ok) continue;
        for (const e of dir) {
          if (e.isDir || !KERNEL_RE.test(e.upper)) continue;
          const a = await kernelArch(file, e);
          if (a) {
            kArch = a;
            details.push(`Kernel /${[...dirPath, e.name].join("/")}: ${a === "amd64" ? "64 Bit" : "32 Bit"}`);
            break;
          }
        }
        if (kArch) break;
      }

      // ── Gesamturteil
      if (kArch === "amd64" && !ia32) out.arch = "amd64";
      else if (kArch === "i386") out.arch = ia32 || !x64 ? "i386" : "both";
      else if (ia32 && x64) out.arch = "both";
      else if (ia32) out.arch = "i386";
      else if (x64) out.arch = "amd64";
      else out.arch = "unknown";

      // El Torito: gibt es überhaupt einen BIOS-Bootsektor?
      const brvd = await readAt(file, 17 * SECTOR, SECTOR);
      if (brvd.length >= 7 && brvd[0] === 0 && ascii(brvd, 1, 5) === "CD001") {
        out.bootable = ascii(brvd, 7, 23).startsWith("EL TORITO SPECIFICATION");
        if (out.bootable) details.push("El-Torito-Bootkatalog vorhanden (BIOS-startfähig).");
      } else {
        out.bootable = false;
        details.push("Kein El-Torito-Bootkatalog — die ISO ist nicht per BIOS startbar.");
      }

      return out;
    },
  };
})();
