import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5174,
      proxy: {
        '/api': {
            target: 'http://localhost:3000',
            rewrite: (path) => {
                return path.replace('/api', '')
            }
        }
      }
  },
    preview: {
        port: 5154
    }
});
