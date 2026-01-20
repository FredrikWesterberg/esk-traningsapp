# ESK Träningsapp - Projektdokumentation

## Översikt
En webbapp för fotbollslaget ESK där tränare kan skapa träningar med övningar, bilder och videos, och spelare kan förbereda sig inför träningar.

## Tech Stack
- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Databas:** PostgreSQL + Sequelize ORM
- **Autentisering:** express-session + bcrypt + connect-pg-simple
- **Filuppladdning:** multer

## Projektstruktur
```
ESK/
├── src/
│   ├── server.js          # Express-server med alla routes
│   ├── migrate-data.js    # Script för att migrera JSON -> PostgreSQL
│   ├── db/
│   │   └── index.js       # Sequelize-modeller och databasanslutning
│   └── public/
│       ├── css/style.css  # All CSS
│       ├── js/
│       │   ├── app.js     # Spelarvy-logik
│       │   └── admin.js   # Admin-logik
│       ├── index.html     # Spelarvy (kalender)
│       ├── admin.html     # Admin-panel
│       ├── login.html     # Inloggning
│       └── register.html  # Registrering
├── data/                  # Lokala uppladdningar (ej i git)
├── package.json
└── README.md
```

## Funktioner
- **Autentisering:** Inloggning krävs för alla sidor
- **Inbjudningssystem:** Endast inbjudna kan registrera sig
- **Roller:** Admin och vanlig användare
- **Träningar:** Skapa träningar med datum, tid, plats
- **Övningar:** Skapa övningar med beskrivning, bilder, video/YouTube
- **Kalender:** Spelare ser kommande träningar

## API Endpoints
### Auth
- `POST /api/auth/login` - Logga in
- `POST /api/auth/register` - Registrera (kräver inbjudningskod)
- `POST /api/auth/logout` - Logga ut
- `GET /api/auth/me` - Hämta inloggad användare

### Träningar (kräver auth, admin för ändring)
- `GET /api/trainings` - Lista träningar
- `POST /api/trainings` - Skapa träning
- `PUT /api/trainings/:id` - Uppdatera
- `DELETE /api/trainings/:id` - Ta bort

### Övningar (kräver auth, admin för ändring)
- `GET /api/exercises` - Lista övningar
- `POST /api/exercises` - Skapa övning
- `PUT /api/exercises/:id` - Uppdatera
- `DELETE /api/exercises/:id` - Ta bort

### Användare & Inbjudningar (admin only)
- `GET /api/users` - Lista användare
- `PUT /api/users/:id/role` - Ändra roll
- `DELETE /api/users/:id` - Ta bort användare
- `GET /api/invites` - Lista inbjudningar
- `POST /api/invites` - Skapa inbjudningskod
- `DELETE /api/invites/:id` - Ta bort inbjudan

## Miljövariabler
- `DATABASE_URL` - PostgreSQL connection string (krävs)
- `SESSION_SECRET` - Hemlig nyckel för sessions (valfri, har default)
- `PORT` - Serverport (default: 3000)
- `RENDER` - Sätts automatiskt på Render för SSL-cookies

## Deployment
Appen är deployad på Render: https://esk-traningsapp.onrender.com

GitHub repo: https://github.com/FredrikWesterberg/esk-traningsapp

### Setup på Render
1. Skapa en PostgreSQL-databas på Render (gratis tier)
2. Lägg till `DATABASE_URL` som miljövariabel i din Web Service
3. Deploy - tabeller skapas automatiskt vid första start

### Migrera befintlig data
Om du har data i JSON-filer och vill migrera till PostgreSQL:
```bash
DATABASE_URL=postgres://... npm run migrate
```

## Initial inbjudningskod
Servern skapar automatiskt `ESKADMIN1` om det inte finns användare.
Första användaren blir automatiskt admin.

## Nästa steg
- [x] Migrera till PostgreSQL för persistent lagring
- [x] Lägg till session-store (connect-pg-simple)
- [ ] Eventuellt: Glömt lösenord-funktion
- [ ] Eventuellt: PWA-stöd för mobilanvändning
