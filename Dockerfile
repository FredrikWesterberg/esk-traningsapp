FROM node:20-alpine

WORKDIR /app

# Kopiera package-filer och installera dependencies
COPY package*.json ./
RUN npm ci --only=production

# Kopiera resten av projektet
COPY . .

# Skapa mappar för data och uppladdningar
RUN mkdir -p data src/public/images src/public/videos

# Exponera port
EXPOSE 3000

# Starta appen
CMD ["npm", "start"]
