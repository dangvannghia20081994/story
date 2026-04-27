FROM node:22-bookworm

WORKDIR /app

ENV EXPO_NO_INTERACTIVE=1
# Không set CI=1 — Metro sẽ bật “CI mode” và tắt reload/watch trong dev Docker.

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Metro (kể cả `expo start --web`) mặc định lắng nghe 8081; compose map host 8090 → 8081.
EXPOSE 8081

CMD ["npx", "expo", "start", "--web", "--host", "lan", "--port", "8081"]
