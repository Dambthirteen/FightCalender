# App-Icon & Splashscreen

Hier kommen die Quellbilder rein, aus denen Capacitor automatisch alle
benötigten iOS-Icon- und Splash-Größen generiert.

Lege ab:

- `icon.png` — **1024 × 1024 px**, kein Transparenz-/Alpha-Rand (App-Icon)
- `splash.png` — **2732 × 2732 px**, Motiv mittig (Startbildschirm)
  - optional: `splash-dark.png` für den Dark-Mode

Danach generieren:

```bash
npm run ios:icons
```

Das schreibt die fertigen Assets direkt in das `ios/`-Xcode-Projekt
(`@capacitor/assets` muss installiert sein, siehe IOS_SETUP.md).

> Tipp: Wenn du noch kein Icon hast, kannst du erstmal mit dem
> Standard-Icon starten — die App läuft auch ohne diesen Schritt.
