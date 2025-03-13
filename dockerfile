# Usa Node.js 18 en variante Alpine (imagen oficial, ligera)
FROM node:18-alpine

# Crea y usa la carpeta /app en el contenedor
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala dependencias en modo producción
RUN npm ci --only=production

# Copia el resto del código
COPY . .

# Establece la variable de entorno para Node en producción
ENV NODE_ENV=production

# Expone el puerto 3000
EXPOSE 3000

# Comando para ejecutar al iniciar el contenedor
CMD ["node", "index.js"]
