# Используем Node.js 18 Alpine
FROM node:18-alpine

# Устанавливаем зависимости для Canvas (намного легче чем Puppeteer!)
RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    && rm -rf /var/cache/apk/*

# Переменные окружения (убираем Puppeteer env)
ENV NODE_ENV=production

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем нужные файлы (обновляем под Canvas)
COPY canvas-server.js ./
COPY .env* ./

# Создаем непривилегированного пользователя (сохраняем безопасность)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S carousel -u 1001 -G nodejs

# Меняем владельца файлов
RUN chown -R carousel:nodejs /app
USER carousel

# Открываем порт (сохраняем 3001)
EXPOSE 3001

# Health check (сохраняем, но делаем быстрее)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Запускаем приложение (обновляем под Canvas)
CMD ["node", "canvas-server.js"]
