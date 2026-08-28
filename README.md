# FM FASHION Premium Marketplace

## Structure
- `/` — public fashion store
- `/admin` — admin control panel
- `/api/*` — backend API
- `/uploads` — uploaded product images

## Deploy on Render
1. Push the whole project folder (do not flatten the folders) to GitHub.
2. In Render, create a Blueprint/Web Service from the repository and use `render.yaml`.
3. Set `ADMIN_PASSWORD` to your initial admin password.
4. Open the service URL for the shop. Open `/admin` for the admin panel.
5. Log in with `ADMIN_PASSWORD`, then use **Payments & Settings**, **Products**, and **Support Agents**.

The browser uses the same origin for shop, admin and API, so you do not need to edit API URLs.

## Important
The included SQLite database and uploaded images are stored on the server filesystem. For production, attach persistent storage or move data/uploads to a managed database/object storage service.
