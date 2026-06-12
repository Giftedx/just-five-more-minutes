import './ui/style.css';
import { runMmoDev } from './devmmo';

const params = new URLSearchParams(location.search);
const speed = Math.max(0.1, Number(params.get('speed') ?? '1') || 1);

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

if (params.get('dev') === 'mmo') {
  runMmoDev(app, speed);
} else {
  app.textContent = 'Just Five More Minutes — host scene lands in Phase 4.';
}
