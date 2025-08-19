# APULINK CRITICAL CONFIGURATIONS

## 🔑 ENVIRONMENT VARIABLES NEEDED

### Firebase
- NEXT_PUBLIC_FIREBASE_API_KEY ✅
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ✅
- NEXT_PUBLIC_FIREBASE_PROJECT_ID ✅
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ✅
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ✅
- NEXT_PUBLIC_FIREBASE_APP_ID ✅
- NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ✅

### Resend Email Service
- RESEND_API_KEY ⚠️ NEED TO COPY
- RESEND_FROM_EMAIL ⚠️ NEED TO COPY
- RESEND_DOMAIN ⚠️ NEED TO COPY

### Trullo Chatbot
- TRULLO_API_KEY ⚠️ NEED TO FIND
- TRULLO_WEBHOOK_URL ⚠️ NEED TO FIND
- TRULLO_BOT_ID ⚠️ NEED TO FIND

### OpenAI (if used)
- OPENAI_API_KEY ⚠️ CHECK IF USED

### Stripe (if payment processing)
- STRIPE_PUBLIC_KEY ⚠️ CHECK IF USED
- STRIPE_SECRET_KEY ⚠️ CHECK IF USED

### Google (Maps, Analytics, etc)
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ⚠️ CHECK IF USED
- NEXT_PUBLIC_GA_MEASUREMENT_ID ⚠️ CHECK IF USED

### Database URLs
- DATABASE_URL ⚠️ FOR POSTGRESQL
- DIRECT_URL ⚠️ FOR MIGRATIONS

## 📧 EMAIL TEMPLATES TO MIGRATE
- Welcome email
- Password reset
- Project invitation
- Grant approval notification
- Payment confirmation
- Team member added
- Milestone completed
- Document uploaded
- PIA Assistant notifications

## 🤖 TRULLO CHATBOT FEATURES
- Welcome message
- PIA guidance
- Budget calculator integration
- FAQ responses
- Support ticket creation
- Multi-language (IT/EN)

## 📱 THIRD-PARTY INTEGRATIONS
- Resend (Email)
- Trullo (Chatbot)
- Firebase (Auth & DB)
- Vercel/Netlify (Hosting)
- Google Analytics
- Stripe (Payments)
- Uploadthing/Cloudinary (Files)