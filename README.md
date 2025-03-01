# BBB Slide Presentation Downloader

**BBB Slide Presentation Downloader** позволяет скачивать презентации из BigBlueButton (BBB) в формате PDF. Это удобный инструмент для сохранения слайдов с вебинаров или онлайн-курсов.

**Внимание:** Основной задачей было познакомиться с GitHub Actions Workflow, а не написать идеально рабочее приложение

## Основные функции

- Скачивание всех слайдов презентации.
- Выбор начального и конечного слайдов для скачивания.
- Автоматическая конвертация SVG слайдов в PDF.
- Поддержка темной и светлой темы интерфейса.

## Установка и запуск

### Требования

#### Запуск через Node.JS (Local)

1. Установите Node.JS.
2. Клонируйте репозиторий:

```bash
git clone https://github.com/dauxdu/bbb_spd.git
```

3. Перейдите в папку с проектом и запустите командой:

```bash
node service.js
```

4. Перейдите в браузере по адресу: http://127.0.0.1:3000

#### Запуск через Docker (Local)

1. Установить Docker
2. Клонируйте репозиторий:

```bash
git clone https://github.com/dauxdu/bbb_spd.git
```

3. Перейдите в папку с проектом и соберите Docker-образ

```bash
docker build -t bbb-spd .
```

4. Запустите контейнер

```bash
docker run -d -p 3000:3000/tcp --name bbb-spd bbb-spd
```

5. Перейдите в браузере по адресу: http://127.0.0.1:3000

#### Запуск с помощью Docker Compose (Self-Hosting)

1. Установить Docker

2. Клонируйте репозиторий:

```bash
git clone https://github.com/dauxdu/bbb_spd.git
```

3. Экспортируйте переменные для `docker-compose.yml` файла или вручную измените их

```bash
export EMAIL=*email@mail.domain*
export DOMAIN=*your.domain*
```

4. Создайте сеть

```bash
docker network create traefik-public
```

5. Перейдите в папку с проектом и запустите контейнеры:

```bash
 docker compose up -d
```

6. Откройте веб-интерфейс в браузере

HTTP: http://your.domain

HTTPS: https://your.domain

## Использование

1. Вставьте ссылку на презентацию BigBlueButton в поле "Ссылка на презентацию".

   Пример ссылки https://example.com/bigbluebutton/presentation/id

2. Выберите, хотите ли вы скачать все слайды или указать начальный и конечный слайды.
3. Укажите имя файла для сохранения.
4. Нажмите "Скачать презентацию".

## Структура проекта

```
bbb-spd/
├── public/
│ ├── index.html
│ ├── script.js
│ ├── styles.css
├── docker-compose.yml
├── Dockerfile
└── server.js
```

## TO DO:

Интеграционные тесты
Юнит-тесты

## Лицензия

Этот проект распространяется под лицензией MIT. Подробности см. в файле LICENSE.
