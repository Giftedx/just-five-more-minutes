import './ui/style.css';
import { runMmoDev } from './devmmo';
import { runRoomDev } from './devroom';
import { runHostDev } from './devhost';
import { Game } from './game';

const params = new URLSearchParams(location.search);
const speed = Math.max(0.1, Number(params.get('speed') ?? '1') || 1);
const startAt = Math.max(0, Number(params.get('t') ?? '0') || 0);
const skipTitle = params.get('skipTitle') === '1';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

if (params.get('dev') === 'mmo') {
  runMmoDev(app, speed);
} else if (params.get('dev') === 'room') {
  runRoomDev(app);
} else if (params.get('dev') === 'host') {
  runHostDev(app, speed);
} else {
  const game = new Game(app, { speed, startAt, skipTitle });
  (window as unknown as Record<string, unknown>)['__game'] = game;
  game.start();
}
