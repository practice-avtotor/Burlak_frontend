# ============================================
# Dockerfile для Burlak Frontend (Vue 3 + Vite)
# ============================================

# Стадия 1: Сборка
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходники и собираем проект
COPY . .
RUN npm run build

# Стадия 2: Сервер для статики
FROM node:20-alpine

WORKDIR /app

# Устанавливаем serve для раздачи статики
RUN npm install -g serve

# Копируем собранный проект
COPY --from=builder /app/dist /app/dist

# Открываем порт (Vite preview порт)
EXPOSE 5173

# Запускаем сервер
CMD ["serve", "-s", "dist", "-l", "5173"]
