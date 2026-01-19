# ESK Träningsapp

En lokal webbapplikation för att hantera fotbollsträningar med övningar, bilder och videos.

## Funktioner

- **Kalender** - Spelarna ser kommande träningar sorterade efter datum
- **Träningsvy** - Se alla övningar för en specifik träning
- **Övningsdetaljer** - Beskrivning, bilder och video för varje övning
- **Admin-sida** - Skapa och redigera träningar och övningar
- **Filuppladdning** - Ladda upp bilder och videos till övningar

## Installation

```bash
cd /home/asolwefr1/test-claude-project/ESK
npm install
```

## Starta appen

```bash
npm start
```

Appen körs på `http://localhost:3000`

- **Spelarvy (kalender):** http://localhost:3000
- **Admin-sida:** http://localhost:3000/admin

## Åtkomst för spelare

Spelare på samma nätverk kan komma åt appen via din dators IP-adress:

1. Ta reda på din IP-adress:
   - Windows: `ipconfig` i terminalen
   - Linux/Mac: `ip addr` eller `ifconfig`

2. Spelarna öppnar: `http://DIN-IP:3000` (t.ex. `http://192.168.1.100:3000`)

## Projektstruktur

```
ESK/
├── data/                   # JSON-datafiler
│   ├── trainings.json      # Träningsdata
│   └── exercises.json      # Övningsdata
├── src/
│   ├── server.js           # Express-server
│   └── public/             # Frontend-filer
│       ├── css/
│       │   └── style.css
│       ├── js/
│       │   ├── app.js      # Spelarvy-logik
│       │   └── admin.js    # Admin-logik
│       ├── images/         # Uppladdade bilder
│       ├── videos/         # Uppladdade videos
│       ├── index.html      # Spelarvy
│       └── admin.html      # Admin-sida
├── package.json
└── README.md
```

## API-endpoints

| Metod  | Endpoint              | Beskrivning                |
|--------|-----------------------|----------------------------|
| GET    | /api/trainings        | Hämta alla träningar       |
| GET    | /api/trainings/:id    | Hämta en träning           |
| POST   | /api/trainings        | Skapa ny träning           |
| PUT    | /api/trainings/:id    | Uppdatera träning          |
| DELETE | /api/trainings/:id    | Ta bort träning            |
| GET    | /api/exercises        | Hämta alla övningar        |
| GET    | /api/exercises/:id    | Hämta en övning            |
| POST   | /api/exercises        | Skapa ny övning            |
| PUT    | /api/exercises/:id    | Uppdatera övning           |
| DELETE | /api/exercises/:id    | Ta bort övning             |
| POST   | /api/upload           | Ladda upp fil (bild/video) |
