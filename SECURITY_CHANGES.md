# Security Changes (Bina API Key wale features)

Ye changes sirf code se kiye gaye hain. Koi third-party API key chahiye nahi.

## Backend

| File | Change | Kaam | Kaise kaam karega |
|---|---|---|---|
| `backend/package.json` | Added `express-mongo-sanitize`, `hpp` | Dependencies add kiye | NoSQL injection aur HTTP parameter pollution rokne ke liye |
| `backend/server.js` | `app.disable('x-powered-by')`, `mongoSanitize()`, `hpp()` added. Helmet tighten kiya. CORS stricter logic. | Core hardening | `express-mongo-sanitize` `req.body/query/params` se `$` operators hata deta hai. `hpp` same query key duplicate hone par control karta hai. Helmet se basic secure headers add hote hain. |
| `backend/middlewares/validateObjectId.js` (NEW) | Naya middleware | ObjectId validation | `mongoose.Types.ObjectId.isValid` se check karta hai. Invalid ObjectId par `400 Invalid ID format` return karta hai. |
| `backend/middlewares/rateLimit.middleware.js` | IP from `req.ip`, headers add kiye (`X-RateLimit-*`, `Retry-After`) | Rate limiting improve | Ab IP sahi se identify hota hai (`trust proxy` ke saath). Headers se client ko limit clear dikhega. |
| `backend/middlewares/error.middleware.js` | Prod me stack trace hide + console.error in dev/non-prod better handling | Error hardening | Production me 500 par `Internal server error` dikhega. Stack trace user ko nahi dikhega. |
| `backend/routes/lead.routes.js` | `validateObjectId('id')` on PATCH/DELETE | Route protection | `/leads/:id` update/delete par invalid ID block ho jayega. |
| `backend/routes/link.routes.js` | `validateObjectId('id')` on DELETE | Route protection | `/links/:id` delete par invalid ID block ho jayega. |
| `backend/routes/meeting.routes.js` | `validateObjectId('id')` on reschedule/cancel | Route protection | Meetings reschedule/cancel par invalid ID block ho jayega. |
| `backend/controllers/lead.controller.js` | Honeypot check added | Spam protection | Agar `website/hp/company_url/url_check` field bhara hua aaya toh request `200` jesa respond karke lead save nahi karega. |
| `backend/controllers/public.controller.js` | Honeypot check added on public bot lead capture | Spam protection | Widget/Public form se bots ko silent reject karega. |

## Frontend

| File | Change | Kaam | Kaise kaam karega |
|---|---|---|---|
| `frontend/package.json` | Added `dompurify` | Dependency | HTML sanitize karne ke liye |
| `frontend/src/utils/safeHtml.js` (NEW) | `sanitizeHtml`, `escapeText` helpers | Safe rendering utility | DOMPurify se sirf safe tags allow hote hain (`b,strong,i,em,br,ul,ol,li,p,span`). `script`, inline events remove ho jate hain. |
| `frontend/src/components/chatbot/ChatPreview.jsx` | Use `sanitizeHtml` for bot messages | XSS hardening | Chatbot preview me bot replies ab sanitized render honge. |
| `frontend/src/pages/WidgetChat.jsx` | Use `sanitizeHtml` for bot messages | XSS hardening | Embeddable widget me bhi bot replies sanitized render honge. |
| `frontend/public/widget.js` | Origin allowlist for `postMessage`, stricter checks | Widget security | Widget sirf apne loader origin + page origin se aaye messages accept karega. Dusri site se fake postMessage block hoga. |
| `frontend/src/pages/PublicLeadForm.jsx` | Added honeypot field `website` (hidden) + send empty in body | Spam protection | Bots auto-fill kar lete hain, backend honeypot check se reject karega. Insaan ko ye field nahi dikhega. |

## Test Notes
- Backend syntax: `node --check` pass
- Frontend build: `npm run build` pass
- Honeypot: agar hidden field bhara hua ho toh lead save nahi hoga (silent)
- ObjectId: invalid ID par 400
- Sanitize: script tags filter ho jayenge
- CORS/Headers: production me strict, dev me flexible

**Koi API key use nahi hui hai. Sab code level security fixes hain.**