import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const firebaseConfig = {
    apiKey:            env.VITE_FIREBASE_API_KEY,
    authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             env.VITE_FIREBASE_APP_ID,
  }

  const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __firebase_config: hasFirebaseConfig
        ? JSON.stringify(JSON.stringify(firebaseConfig))
        : 'undefined',
      __app_id: JSON.stringify(env.VITE_APP_ID || 'finance-planner-pro-v1'),
      __initial_auth_token: 'undefined',
    },
  }
})
