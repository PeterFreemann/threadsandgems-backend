# Threads & Gems API

Express 5 + MongoDB (Mongoose) backend for the Threads & Gems store and admin. Clerk handles sign-in, Stripe takes payments, Cloudinary stores product photos. Deploys to Render.

## 1. Accounts you need (all have free plans)

**MongoDB Atlas** (database)
1. Create a free cluster at cloud.mongodb.com.
2. Database Access: add a database user with a password.
3. Network Access: add `0.0.0.0/0`. Render's free plan has no fixed IP address, so this is needed. The username and password still protect the database.
4. Connect → Drivers → copy the connection string. Put the database name before the `?`, e.g. `...mongodb.net/threadsandgems?retryWrites=true&w=majority`.

**Cloudinary** (product photos): sign up at cloudinary.com and copy the cloud name, API key and API secret from the dashboard.

**Stripe** and **Clerk**: use the same accounts as the storefront.

## 2. Run it on your Mac

```bash
npm install
cp .env.example .env      # then fill in the values
npm run seed              # loads the 27 products, 4 categories and settings
npm run dev               # http://localhost:4000
```

To upload the store's product photos to Cloudinary while seeding, point `IMAGES_DIR` at the storefront's `images` folder:

```bash
IMAGES_DIR=../threadsandgems/images npm run seed -- --force
```

Check it's working: open http://localhost:4000/health (should say `ok`) and http://localhost:4000/api/products (your products).

In the admin's `.env.local`, set `NEXT_PUBLIC_API_URL=http://localhost:4000` and restart the admin.

### Stripe webhook on your Mac

Orders only become "paid" when Stripe calls the webhook. Locally, use the Stripe CLI:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

It prints a `whsec_...` secret. Put it in `.env` as `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.

## 3. Deploy to Render

1. Push this folder to its own GitHub repository.
2. Render → New → Blueprint → pick the repo. It reads `render.yaml`.
3. Fill in the environment variables it asks for. `CORS_ORIGINS` must list your live store and admin addresses, e.g. `https://threadsandgems.co.uk,https://admin.threadsandgems.co.uk`.
4. After it deploys, copy the URL (e.g. `https://threadsandgems-api.onrender.com`) into the admin's and storefront's `NEXT_PUBLIC_API_URL`.
5. Stripe dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://threadsandgems-api.onrender.com/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Copy its signing secret into Render as `STRIPE_WEBHOOK_SECRET`.
6. Run the seed once against the live database: `npm run seed` on your Mac with the production `MONGODB_URI` in `.env`.

**Free plan note:** Render puts free services to sleep after 15 minutes without traffic. The first request after that takes up to a minute. Stripe retries webhooks, so no orders are lost, but a shopper may wait on the first page load. The paid Starter plan keeps it awake.

## Roles

Roles live in each Clerk user's `publicMetadata.role`, and the Clerk session token must include `{ "metadata": "{{user.public_metadata}}" }`. Grant the first super admin with:

```bash
npm run make-super-admin -- you@example.com
```

After that, use the Team page in the admin. Every `/api/admin` route checks the role on the server (see `src/lib/roles.js`).

## API for the storefront

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products?category=ankara&featured=true&q=&page=&limit=` | Live products only |
| GET | `/api/products/:key` | `key` = old number (`1`), Mongo id or slug. Includes `related` |
| GET | `/api/categories` | For the shop's filter tabs |
| GET | `/api/settings/public` | VAT, shipping and countries for the cart |
| POST | `/api/checkout` | See below. Returns `clientSecret` for Stripe's Payment Element |
| GET | `/api/orders/me` | Signed-in shopper's orders (send the Clerk token) |
| GET | `/api/orders/confirmation/:paymentIntentId` | For `/order-confirmed?payment_intent=pi_...` |
| POST | `/api/contact` | `{ name, email, subject, message, website }` (`website` is a hidden spam trap; leave empty) |
| POST | `/api/newsletter` | `{ email, source: 'home' \| 'shop' \| 'contact' \| 'footer' }` |

Products come back with both `pricePence` (use this going forward) and `price` as `"£45.00"`, plus `id` as the old number, so the current cart code keeps working while you switch over.

### Checkout request

```json
{
  "orderId": "optional: the orderId from a previous response, to update it instead of starting a new order",
  "items": [{ "productId": 1, "quantity": 2, "size": "M" }],
  "customer": { "email": "a@b.com", "firstName": "Ada", "lastName": "Obi", "phone": "07..." },
  "shippingAddress": { "line1": "1 High St", "line2": "", "city": "London", "postalCode": "E1 1AA", "country": "GB" }
}
```

The browser never sends prices. The server looks up each product, checks stock, applies VAT and shipping from the settings, creates the order as "pending", and creates the Stripe payment. When Stripe confirms payment, the webhook marks the order "paid" and reduces stock.

## API for the admin

All `/api/admin/*` routes match the contract in the admin project's README: stats, orders (with refunds), products, categories, photo upload signing, customers, messages, subscribers, settings, team and activity log. Errors always come back as `{ "error": "Readable message" }`.

## Project structure

```
src/
  server.js            starts the server after connecting to MongoDB
  app.js               middleware, CORS, Clerk, routes
  config/              env, database, Stripe, Cloudinary
  models/              Product, Category, Order, Counter, ContactMessage, Subscriber, Setting, AuditLog
  middleware/          role checks, validation, error handling
  lib/                 roles, pricing, activity log, helpers
  routes/admin/        everything the admin calls
  routes/public/       everything the storefront calls
  routes/webhooks/     Stripe webhook
scripts/
  seed.js              loads the store's products
  make-super-admin.js  grants the super admin role
render.yaml            Render deployment settings
```
