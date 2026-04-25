FROM node:22-bookworm

WORKDIR /app

ENV EXPO_NO_INTERACTIVE=1
ENV CI=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 8090

CMD ["npx", "expo", "start", "--web", "--host", "0.0.0.0", "--port", "8090"]
