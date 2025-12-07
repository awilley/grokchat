## Grok Chat Front-End

This project hosts the front-end experience for the Grok chat interface. The UI mirrors the AI Trainer page from the Open Workout System while adopting the dark, atmospheric aesthetic from grok.com. The interface centers on a single threaded conversation that continuously tags and surfaces relevant context signals.

### Key Traits

- React + Vite + Tailwind stack running in Node.js
- Collapsible sidebar styled after the Open Workout System AI Trainer, showing context categories and recent threads
- Chat surface tuned for dark mode with Grok-inspired gradients, quick prompts, and typing indicators

### Getting Started

```pwsh
cd grokchat
npm install
npm run dev
```

The development server opens on `http://localhost:5173`. Make your API integrations and data fetching logic inside the React components under `src/`.

### Configure Grok API Access

1. Copy `.env.example` to `.env.local` and add your xAI key:

   ```pwsh
   cp .env.example .env.local
   notepad .env.local
   ```

   Set `VITE_GROK_API_KEY` to your Grok API key. Optionally adjust `VITE_GROK_API_MODEL` or `VITE_GROK_API_BASE_URL` if you proxy requests through a local service.

2. Restart `npm run dev` after editing environment variables so Vite can pick them up.

> ⚠️ For production or shared deployments, proxy Grok traffic through a secure backend instead of exposing the API key to the browser. The current setup is intended for local prototyping only.
