# Captain Nawab Panel — upgraded starter

A responsive, bilingual-ready PKR service-request panel with Captain Nawab's supplied portrait on both the login page and customer dashboard.

## Included
- Customer registration and login using Pakistani mobile numbers
- Password hashing with bcrypt
- SQLite-backed sessions and data
- CSRF tokens on form submissions
- Customer wallet overview, order history, and manual deposit requests
- Admin-only deposit review, order status updates, and service creation
- Responsive navy-and-gold layout
- Supplied profile photo at `public/captain-nawab.jpg`

## Requirements
- Node.js 20 or newer
- npm
- Persistent disk storage for `data/` when deployed

## Run locally
1. Copy `.env.example` to `.env`.
2. Set a random `SESSION_SECRET` (at least 32 characters), a private `ADMIN_PASSWORD` (at least 10 characters), and your own admin phone.
3. Run:

```bash
npm install
npm run seed
npm start
```

Open `http://localhost:3000`.

The admin seed script creates the admin only once. If the admin account already exists, it does not reset the password.

## Deployment notes
- Set the start command to `npm start`.
- Use Node.js 20+.
- Set `NODE_ENV=production`.
- Configure all `.env.example` values as private environment variables in the hosting provider.
- Attach persistent storage for the `data/` directory. Without persistent storage, SQLite data and sessions may be lost on redeploy/restart.
- Do not upload `.env`, database files, or real customer information to GitHub.
- This project is a starter and has not undergone a production security audit. Before accepting payments, arrange security review, backups, HTTPS, rate limiting, and suitable payment-provider verification.

## Important service-use note
This project records customer requests for services that the administrator has explicitly configured. It does not contain a provider API integration or guarantee delivery. Only configure lawful, platform-authorized services; do not offer fake engagement, spam, or services that violate social platforms' rules. Deposits are manually checked by an administrator. Never ask customers for payment PINs, OTPs, or passwords.
