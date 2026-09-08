# Публикация MODULTHON на modulthon.com

DNS уже настроен: `modulthon.com` и `www.modulthon.com` смотрят на
`34.45.82.165`. Сертификат Let's Encrypt, выпущенный 8 сентября 2026, уже
покрывает оба этих имени — новый выпускать не нужно.

Меняется одно: до сих пор `modulthon.com` отдавал 301 на nusathon.com, а
теперь у него собственный сайт.

```
nusathon.com   ──▶ /home/inclt/inclt-webapp/nusathon/
modulthon.com  ──▶ /home/inclt/modulthon/      ← было 301
```

Все команды — на сервере под root (`sudo -i` сразу после подключения).

---

## Шаг 1. Забрать код

```bash
sudo -iu inclt git -C /home/inclt/modulthon pull
```

```bash
ls /home/inclt/modulthon
```

---

## Шаг 2. Переписать конфиг nusathon без редиректа

> Шаги 2, 3 и 4 делаются подряд, без перерыва. Между ними у обоих
> доменов нет блока на 443: HTTPS отвечает дефолтный сервер с
> сертификатом `clt.dariapimenova.com`, и браузер показывает
> предупреждение. Шаг 4 это чинит.

Certbot дописал в этот файл блоки для 443 — их не надо править руками,
проще положить файл заново в исходном виде и в шаге 4 дать certbot'у
проставить TLS повторно.

```bash
sudo tee /etc/nginx/sites-available/nusathon > /dev/null <<'NGINX'
server {
    listen 80;
    server_name nusathon.com www.nusathon.com;

    root /home/inclt/inclt-webapp/nusathon;
    index index.html;

    location /assets/ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
NGINX
```

---

## Шаг 3. Добавить конфиг modulthon

```bash
sudo tee /etc/nginx/sites-available/modulthon > /dev/null <<'NGINX'
server {
    listen 80;
    server_name modulthon.com www.modulthon.com;

    root /home/inclt/modulthon;
    index index.html;

    location /assets/ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Главная — это витрина обратного отсчёта, и она обязана быть свежей:
    # закэшированная копия покажет вчерашнее число дней и будет врать.
    # Правило по расширению, а не по списку имён: со списком английские
    # страницы под /en/ молча выпадали бы из него.
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }
    location = / {
        add_header Cache-Control "no-cache";
    }
    location = /en/ {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
NGINX
```

Включить и проверить синтаксис:

```bash
sudo ln -sf /etc/nginx/sites-available/modulthon /etc/nginx/sites-enabled/modulthon && sudo nginx -t && sudo systemctl reload nginx
```

Кавычки вокруг `'NGINX'` существенны: без них шелл съест `$uri` ещё до
записи файла.

---

## Шаг 4. Вернуть HTTPS в оба конфига

Сертификат уже есть и покрывает все четыре имени — certbot должен лишь
заново вписать его в переписанные файлы:

```bash
sudo certbot --nginx -d nusathon.com -d www.nusathon.com -d modulthon.com -d www.modulthon.com --cert-name nusathon.com
```

Спросит, что делать с существующим сертификатом — выбирайте
**1 (Attempt to reinstall)**, выпускать заново нечего. На вопрос про
перенаправление HTTP → HTTPS — снова **2 (Redirect)**.

---

## Шаг 5. Проверить

1. `https://modulthon.com` — чёрная страница с отсчётом по-русски, **без прокрутки**.
2. `https://modulthon.com/en/` — она же по-английски.
3. `https://modulthon.com/register.html` и `/en/register.html` — форма.
4. `https://nusathon.com` — портал на месте: чёрный, по-русски.
4. `https://nusathon.com/en/` — английская версия, тоже чёрная.
5. `https://buildinclt.com` — основной сайт не задет.

---

## Обновление

```bash
sudo -iu inclt git -C /home/inclt/modulthon pull
```

Сборки нет, nginx перезапускать не нужно.
