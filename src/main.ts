import './ui/style.css';
import { runMmoDev } from './devmmo';
import { runRoomDev } from './devroom';
import { runHostDev } from './devhost';

const params = new URLSearchParams(location.search);
const speed = Math.max(0.1, Number(params.get('speed') ?? '1') || 1);

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

if (params.get('dev') === 'mmo') {
  runMmoDev(app, speed);
} else if (params.get('dev') === 'room') {
  runRoomDev(app);
} else if (params.get('dev') === 'host') {
  runHostDev(app, speed);
} else {
  app.textContent = 'Just Five More Minutes — full game lands in Phase 7.';
}
