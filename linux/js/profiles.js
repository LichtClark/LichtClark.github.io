/*
 * profiles.js — auswählbare Gastsysteme.
 *
 * Alle Abbilder liegen lokal unter images/ und werden von tools/fetch-assets.ps1
 * geholt. Zur Laufzeit lädt die Seite nichts von fremden Servern nach.
 *
 * Felder:
 *   console      "serial" -> Gast schreibt auf /dev/ttyS0, "vga" -> Bildschirm
 *   assets       Dateien, die vorhanden sein müssen (sonst klare Meldung statt Hänger)
 *   disk         "none" | "optional" | "recommended" — taugt das System für eine Festplatte?
 *   netUp        Befehl im Gast, der die Netzwerkkarte hochzieht
 *   recipes      vorbereitete Befehlsfolgen für die Werkzeugleiste
 *   build()      liefert die v86-Optionen
 *
 * Warum bei Alpine Kernel und initramfs direkt übergeben werden statt einfach die
 * ISO zu booten: über den ISO-Bootloader lässt sich die Kernel-Cmdline nicht setzen.
 * Ohne "random.trust_cpu=on" bleibt Alpine beim Start hängen — der Kernel wartet auf
 * Entropie, die es in einem Emulator ohne echte Hardware nicht gibt. Getestet: der
 * ISO-Boot bleibt reproduzierbar nach "Starting busybox mdev" stehen (CPU haltet,
 * 0,7 MIPS), mit gesetzter Cmdline läuft er durch.
 */

const ALPINE_ISO = "images/alpine-virt-3.24.1-x86.iso";
const V86_KERNEL_OPTS = "random.trust_cpu=on tsc=reliable mitigations=off";

/*
 * Autostart: Schritte, die nach dem Booten selbsttätig abgearbeitet werden.
 *
 *   vorher   Muster, auf das gewartet wird, BEVOR getippt wird
 *   warteMs  feste Wartezeit statt Muster — für Bootschirme im Grafikmodus,
 *            deren Text sich nicht aus dem VGA-Puffer lesen lässt
 *   tippen   die Befehlszeile ("" schickt nur Enter)
 *   nachher  Muster, das die Ausgabe liefern muss, damit es weitergeht
 *   ms       Geduld für diesen Schritt
 *
 * Wichtig bei den Markern: der getippte Befehl steht selbst auf dem Bildschirm.
 * Ein Marker wie FERTIG würde deshalb schon durch das Echo der Eingabe erfüllt.
 * Deshalb wird er im Befehl aufgetrennt geschrieben — echo A""UTO_NET erscheint
 * als Eingabe mit Anführungszeichen, in der Ausgabe aber als AUTO_NET.
 */
const AUTO_ANMELDEN = { vorher: /login:/, tippen: "root", nachher: /[~/][ ]*[#$%]/, ms: 300000, text: "anmelden" };
const AUTO_NETZ = {
  // -t 10 -T 1 -n -q: bis zu 10 Versuche im Sekundentakt, danach aufgeben (-n)
  // bzw. nach erhaltenem Lease sofort beenden (-q). So haengt der Schritt nicht,
  // wenn kein DHCP-Server antwortet (z. B. Bruecke mit falscher MAC).
  tippen: 'ip link set eth0 up 2>/dev/null; udhcpc -i eth0 -t 10 -T 1 -n -q 2>&1 | tail -2; echo A""UTO_NET',
  nachher: /AUTO_NET/, ms: 150000, text: "Netz verbinden",
};
const AUTO_REPOS = {
  tippen: 'setup-apkrepos -1 >/dev/null 2>&1; apk update 2>&1 | tail -1; echo A""UTO_REPO',
  nachher: /AUTO_REPO/, ms: 300000, text: "Paketquellen",
};
const AUTO_CURL = {
  tippen: 'apk add --no-cache curl 2>&1 | tail -1; echo A""UTO_CURL',
  nachher: /AUTO_CURL/, ms: 300000, text: "curl installieren",
};

const PROFILES = [
  {
    id: "alpine",
    name: "Alpine Linux 3.24  ·  volles Linux mit apk",
    memory: 512,
    vga_memory: 8,
    console: "vga",
    disk: "recommended",
    assets: ["images/alpine/vmlinuz-virt", "images/alpine/initramfs-virt", ALPINE_ISO],
    netUp: "ip link set eth0 up; udhcpc -i eth0",
    hint:
      "Vollwertiges Linux mit Paketverwaltung: apk add bash curl git python3 gcc … " +
      "Läuft zunächst im Arbeitsspeicher. Mit einer Festplatte lässt es sich per " +
      "setup-alpine dauerhaft installieren.",
    autorun: [AUTO_ANMELDEN, AUTO_NETZ, AUTO_REPOS, AUTO_CURL],
    autorunText: "meldet an, holt eine Adresse, aktiviert die Paketquellen und installiert curl",
    recipes: [
      { label: "1 · Netz verbinden", cmd: "ip link set eth0 up; udhcpc -i eth0" },
      { label: "2 · Paketquellen", cmd: "setup-apkrepos -1 && apk update" },
      // Der häufigste erste Wunsch — deshalb ein eigener Knopf statt im Sammelpaket.
      { label: "curl holen", cmd: "apk add --no-cache curl && curl -s https://ip.me" },
      { label: "3 · Standardpakete", cmd: "apk add bash coreutils curl wget git nano htop python3" },
      {
        /*
         * Unbeaufsichtigte Installation auf /dev/sda: setup-disk partitioniert,
         * formatiert, kopiert das laufende System und schreibt den Bootloader.
         *
         * Zwei Nacharbeiten sind für v86 nötig, beide durch Messung belegt:
         *  · Kernel-Parameter — ohne "random.trust_cpu=on" wartet auch das
         *    installierte System beim Start auf Entropie, die es hier nicht gibt.
         *  · hwdrivers abschalten — der mdev-Hardwarescan reisst die Emulation
         *    reproduzierbar in einen Neustart (mitten in "Scanning hardware for
         *    mdev", danach haengt die CPU bei 0,4 MIPS). Die Hardware ist in v86
         *    ohnehin fest und die noetigen Treiber stecken im initramfs.
         */
        label: "4 · Auf Platte installieren",
        cmd:
          "apk add e2fsprogs syslinux sfdisk && yes | setup-disk -m sys /dev/sda; " +
          "mount /dev/sda3 /mnt && mount /dev/sda1 /mnt/boot && " +
          "sed -i 's|^default_kernel_opts=.*|default_kernel_opts=\"" + V86_KERNEL_OPTS +
          " console=tty0\"|' /mnt/etc/update-extlinux.conf; " +
          "grep -q random.trust_cpu /mnt/boot/extlinux.conf || " +
          // Einrueckung nicht fest annehmen: greift die APPEND-Zeile unabhaengig
          // von der Anzahl fuehrender Leerzeichen (sonst no-op -> Boot haengt).
          "sed -i 's|^\\([[:space:]]*APPEND .*\\)$|\\1 " + V86_KERNEL_OPTS + " console=tty0|' /mnt/boot/extlinux.conf; " +
          "rm -f /mnt/etc/runlevels/sysinit/hwdrivers; " +
          // Ohne hwdrivers laedt niemand mehr das Netzwerkmodul: fest eintragen.
          "printf 'ne2k-pci\\nvirtio_net\\n' >> /mnt/etc/modules; " +
          "sync; umount /mnt/boot; umount /mnt; echo INSTALLATION-FERTIG",
      },
      { label: "Hostname setzen", cmd: "setup-hostname browserlinux" },
      { label: "Zeitzone Berlin", cmd: "setup-timezone -z Europe/Berlin" },
    ],
    build: () => ({
      bzimage: { url: "images/alpine/vmlinuz-virt" },
      initrd: { url: "images/alpine/initramfs-virt" },
      cdrom: { url: ALPINE_ISO },
      cmdline:
        "modules=loop,squashfs,sd-mod,usb-storage,ata_piix,ata_generic,sr_mod,cdrom,isofs " +
        "console=tty0 nomodeset " + V86_KERNEL_OPTS,
      filesystem: {},
    }),
  },
  {
    id: "alpine-disk",
    name: "Alpine – von der Festplatte starten",
    memory: 512,
    vga_memory: 8,
    console: "vga",
    disk: "required",
    assets: [],
    netUp: "ip link set eth0 up; udhcpc -i eth0",
    hint:
      "Startet das mit setup-alpine installierte System von der virtuellen Platte – " +
      "ohne ISO, mit allem, was dort installiert wurde. Setzt eine bereits " +
      "installierte Platte voraus.",
    autorun: [AUTO_ANMELDEN, AUTO_NETZ],
    autorunText: "meldet an und verbindet das Netz",
    recipes: [
      { label: "Netz verbinden", cmd: "ip link set eth0 up; udhcpc -i eth0" },
      {
        label: "Netz dauerhaft einrichten",
        cmd: "setup-interfaces -a && rc-update add networking default && rc-service networking start",
      },
      { label: "Paketliste auffrischen", cmd: "apk update && apk upgrade" },
      {
        // Reparatur fuer Platten, die noch mit aktivem hwdrivers installiert wurden:
        // der mdev-Hardwarescan stuerzt v86 beim Start ab. Da danach niemand mehr
        // das Netzwerkmodul laedt, wird es gleich fest eingetragen.
        label: "Für v86 herrichten",
        cmd:
          "rc-update del hwdrivers sysinit 2>/dev/null; rm -f /etc/runlevels/sysinit/hwdrivers; " +
          "grep -qx ne2k-pci /etc/modules || printf 'ne2k-pci\\nvirtio_net\\n' >> /etc/modules; " +
          "rc-update add modules boot 2>/dev/null; modprobe ne2k-pci; sync; echo HERGERICHTET",
      },
    ],
    build: () => ({
      boot_order: 0x132, // Festplatte zuerst
      filesystem: {},
    }),
  },
  {
    id: "buildroot",
    name: "Buildroot Linux 6.8  ·  10 MB  ·  Konsole",
    memory: 128,
    vga_memory: 8,
    console: "serial",
    disk: "optional",
    assets: ["images/buildroot-bzimage68.bin"],
    netUp: "udhcpc",
    hint:
      "Minimales Linux mit BusyBox-Shell, Lua, ping und curl. Bootet in wenigen " +
      "Sekunden. Die Shell läuft auf der seriellen Konsole, der VGA-Schirm bleibt leer.",
    autorun: [
      { vorher: /~[ ]*%/, tippen: 'udhcpc 2>&1 | tail -1; echo A""UTO_NET', nachher: /AUTO_NET/, ms: 120000, text: "Netz verbinden" },
    ],
    autorunText: "holt eine Adresse per DHCP",
    recipes: [
      { label: "Netz verbinden", cmd: "udhcpc" },
      // api.ipify.org statt example.com: erlaubt CORS und antwortet ueber
      // reines HTTP — funktioniert damit auch im Fetch-Modus ohne Relay.
      { label: "Verbindung testen", cmd: "curl -s http://api.ipify.org && echo" },
    ],
    build: () => ({
      bzimage: { url: "images/buildroot-bzimage68.bin" },
      cmdline: V86_KERNEL_OPTS,
      filesystem: {},
    }),
  },
  {
    id: "dsl",
    name: "Damn Small Linux 4.11  ·  53 MB  ·  X11-Desktop",
    memory: 256,
    vga_memory: 8,
    console: "vga",
    disk: "optional",
    assets: ["images/dsl-4.11.rc2.iso"],
    netUp: "sudo pump -i eth0",
    hint:
      "Vollständige X11-Oberfläche mit Fenstermanager, Dateimanager und Terminal — " +
      "mit Maus bedienbar. Der Bootvorgang dauert einen Moment; danach mit der Maus " +
      "arbeiten. Die Rezepte tippen in ein geöffnetes Terminal (Rechtsklick → XShells).",
    // Der isolinux-Splash der ISO ist ein Grafikbild mit "boot:"-Prompt, der ohne
    // Enter unbegrenzt wartet — deshalb feste Wartezeit statt "vorher"-Muster.
    // Zwei Anlaeufe: geht der erste im BIOS unter, faengt der zweite ihn ab;
    // ein ueberzaehliges "dsl" verpufft im Kernel-Bootlog folgenlos.
    autorun: [
      { warteMs: 8000, tippen: "dsl", text: "Boot-Prompt bestätigen" },
      { warteMs: 8000, tippen: "dsl", text: "Boot-Prompt bestätigen (2. Versuch)" },
    ],
    autorunText: "bestätigt den Boot-Prompt, danach startet der X11-Desktop von selbst",
    recipes: [{ label: "Netz verbinden", cmd: "sudo pump -i eth0" }],
    build: () => ({
      cdrom: { url: "images/dsl-4.11.rc2.iso" },
      filesystem: {},
    }),
  },
  {
    id: "tinycore",
    name: "Tiny Core Linux 10.1  ·  18 MB  ·  FLTK-Desktop",
    memory: 256,
    vga_memory: 32,
    console: "vga",
    disk: "optional",
    assets: ["images/tinycore.iso"],
    netUp: "sudo udhcpc",
    hint:
      "Winziges, aber vollwertiges Linux mit grafischem Desktop (FLTK/flwm). " +
      "Nach dem Boot-Menü (übernimmt der Autostart) startet die Oberfläche von " +
      "selbst. Die Rezepte tippen in ein geöffnetes Terminal — dazu unten in der " +
      "Leiste „Term“ anklicken.",
    // Das isolinux-Menue der ISO wartet sonst 60 Sekunden — der Autostart
    // bestaetigt den Standardeintrag (GUI-Boot mit "cde") sofort per Enter.
    autorun: [
      { vorher: /TinyCore/, tippen: "", ms: 60000, text: "Boot-Menü bestätigen" },
    ],
    autorunText: "bestätigt das Boot-Menü, danach erscheint der Desktop von selbst",
    recipes: [
      { label: "Netz verbinden", cmd: "sudo udhcpc" },
      { label: "Verbindung testen", cmd: "wget -qO- http://api.ipify.org && echo" },
    ],
    build: () => ({
      cdrom: { url: "images/tinycore.iso" },
      boot_order: 0x123,
      filesystem: {},
    }),
  },
  {
    id: "kolibri",
    name: "KolibriOS  ·  1,4 MB  ·  grafisch, in Assembler",
    memory: 128,
    vga_memory: 32,
    console: "vga",
    disk: "none",
    assets: ["images/kolibri.img"],
    hint:
      "Ein komplettes grafisches Betriebssystem in Assembler — passt auf eine " +
      "Diskette und startet praktisch sofort. Mit der Maus bedienbar; kein Login, " +
      "keine Konsole. Enthält Editor, Dateimanager, Spiele und Demos.",
    autorunText: "startet direkt in den Desktop",
    recipes: [],
    build: () => ({
      fda: { url: "images/kolibri.img" },
      boot_order: 0x321,
    }),
  },
  {
    id: "freedos",
    name: "FreeDOS  ·  0,7 MB  ·  DOS-Eingabeaufforderung",
    memory: 64,
    vga_memory: 8,
    console: "vga",
    disk: "none",
    assets: ["images/freedos722.img"],
    hint:
      "Ein freies MS-DOS, bootet von der Diskette zur klassischen A:\\>-Eingabe" +
      "aufforderung. Startet sofort. Alte DOS-Befehle (dir, mem, edit, …) — und " +
      "drei Spiele sind auch dabei.",
    // Boot-getestet: das Abbild meldet sich mit A:\> und bringt die Spiele
    // invaders, snake und tetris mit ("Try 'invaders' or 'snake' ...").
    autorun: [
      { vorher: /A:\\>/, tippen: "dir /w", nachher: /bytes free/i, ms: 60000, text: "Disketteninhalt zeigen" },
    ],
    autorunText: "wartet auf A:\\> und zeigt den Disketteninhalt",
    recipes: [
      { label: "Verzeichnis anzeigen", cmd: "dir /w" },
      { label: "Speicher anzeigen", cmd: "mem" },
      { label: "DOS-Version", cmd: "ver" },
      { label: "Spiel: Invaders", cmd: "invaders" },
      { label: "Spiel: Snake", cmd: "snake" },
      { label: "Spiel: Tetris", cmd: "tetris" },
    ],
    build: () => ({
      fda: { url: "images/freedos722.img" },
      boot_order: 0x321,
    }),
  },
  {
    id: "custom",
    name: "Eigenes Abbild …",
    memory: 512,
    vga_memory: 8,
    console: "vga",
    disk: "optional",
    assets: [],
    source: "custom",
    netUp: "udhcpc",
    hint:
      "Eine ISO, ein Festplatten-Abbild oder ein bzImage von der eigenen Platte booten. " +
      "Die Datei wird nur gelesen und nie irgendwohin geschickt. ISOs werden vorher " +
      "auf ihre Architektur geprüft — v86 kann ausschließlich 32-Bit-x86.",
    recipes: [],
    build: () => ({}),
  },
];

const PROFILE_BY_ID = Object.fromEntries(PROFILES.map((p) => [p.id, p]));
