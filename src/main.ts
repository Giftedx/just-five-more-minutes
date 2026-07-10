import './ui/style.css';
import { runMmoDev } from './devmmo';
import { runRoomDev } from './devroom';
import { runHostDev } from './devhost';
import { Game, type GameOptions } from './game';
import { parseSessionSeed } from './session';
import { installGate, type DeviceBlockReason } from './ui/gate';

const params = new URLSearchParams(location.search);
const speed = Math.max(0.1, Number(params.get('speed') ?? '1') || 1);
const startAt = Math.max(0, Number(params.get('t') ?? '0') || 0);
const skipTitle = params.get('skipTitle') === '1';
const seed = parseSessionSeed(params.get('seed'));

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

if (params.get('dev') === 'mmo') {
  runMmoDev(app, speed);
} else if (params.get('dev') === 'room') {
  runRoomDev(app);
} else if (params.get('dev') === 'host') {
  runHostDev(app, speed);
} else {
  const gameOptions: GameOptions = seed === undefined
    ? { speed, startAt, skipTitle }
    : { speed, startAt, skipTitle, seed };
  const debugWindow = window as unknown as Record<string, unknown>;
  let game: Game | null = null;
  let blockReason: DeviceBlockReason | null = null;

  const startGame = (): void => {
    if (game || blockReason !== null) return;
    game = new Game(app, gameOptions, restartGame);
    debugWindow['__game'] = game;
    game.start();
  };
  const stopGame = (): void => {
    const current = game;
    game = null;
    delete debugWindow['__game'];
    current?.dispose();
  };
  const restartGame = (): void => {
    stopGame();
    startGame();
  };

  const disposeGate = installGate(document.body, (reason) => {
    blockReason = reason;
    if (reason === null) startGame();
    else stopGame();
  });
  import.meta.hot?.dispose(() => {
    disposeGate();
    stopGame();
  });
}
