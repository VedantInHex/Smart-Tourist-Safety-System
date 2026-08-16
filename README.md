# Smart-Tourist-Safety-System

## HTTPS and real mobile GPS

Browser geolocation works on `localhost` during development, but a phone opening a deployed site requires HTTPS. The recommended production setup is TLS termination at Nginx:

1. Build and run the app: `npm run build` then `npm run start:prod`.
2. Replace `example.com` in [the Nginx config](deployment/nginx/tourist-safety-system.conf) with your domain and install it as an enabled Nginx site.
3. Obtain a trusted certificate, for example with Certbot: `sudo certbot --nginx -d your-domain.com -d www.your-domain.com`.
4. Open `https://your-domain.com` on the phone, then approve the browser's location permission.

Nginx proxies both the web app and `/api` through the same HTTPS domain, which avoids mixed-content and cross-origin GPS/API problems.

### Direct Node HTTPS (optional)

If a reverse proxy is not available, copy `server/.env.example` to `server/.env` and set `HTTPS_ENABLED=true`, `HTTPS_PORT`, `HTTPS_KEY_PATH`, and `HTTPS_CERT_PATH` to a trusted certificate/key pair. Then start with `npm run start:prod`.

Do not use self-signed certificates for phone testing: mobile browsers will reject or warn about them, and location access may remain blocked.
