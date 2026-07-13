import * as THREE from 'three';

function makeRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for woven rug');

  ctx.fillStyle = '#773f43';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#4b2830';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.ellipse(128, 96, 112, 80, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#9b5240';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(128, 96, 99, 68, 0, 0, Math.PI * 2);
  ctx.stroke();

  const diamond = (cx: number, cy: number, rx: number, ry: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
    ctx.fill();
  };
  diamond(128, 96, 58, 42, '#a76548');
  diamond(128, 96, 39, 29, '#4d6172');
  diamond(128, 96, 22, 17, '#c39b69');
  diamond(128, 96, 9, 7, '#71363f');
  for (const x of [50, 206]) {
    diamond(x, 96, 18, 28, '#84444a');
    diamond(x, 96, 8, 14, '#b07c55');
  }

  for (let y = 1; y < canvas.height; y += 3) {
    ctx.fillStyle = y % 6 === 1 ? 'rgba(255,236,198,0.055)' : 'rgba(50,20,24,0.045)';
    ctx.fillRect(0, y, canvas.width, 1);
  }
  for (let x = 2; x < canvas.width; x += 4) {
    ctx.fillStyle = x % 8 === 2 ? 'rgba(255,220,180,0.035)' : 'rgba(35,18,23,0.03)';
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makeSurfaceGeometry(): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(0.91, 32);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    position.setZ(i, radius < 0.01 ? 0 : 0.0022 * Math.sin(angle * 6));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makeBraidGeometry(): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(0.91, 0.018, 6, 32);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const angle = Math.atan2(position.getY(i), position.getX(i));
    const color = new THREE.Color(Math.sin(angle * 16) >= 0 ? 0x4b2830 : 0x6b3539);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function makeWovenRug(): THREE.Group {
  const rug = new THREE.Group();
  rug.name = 'room-rug';
  rug.position.set(0.1, 0, 0.4);

  const surface = new THREE.Mesh(
    makeSurfaceGeometry(),
    new THREE.MeshLambertMaterial({ map: makeRugTexture() }),
  );
  surface.name = 'room-rug-surface';
  surface.rotation.x = -Math.PI / 2;
  surface.scale.y = 0.76;
  surface.position.y = 0.006;
  rug.add(surface);

  const braid = new THREE.Mesh(
    makeBraidGeometry(),
    new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  );
  braid.name = 'room-rug-braid';
  braid.rotation.x = -Math.PI / 2;
  braid.scale.y = 0.76;
  braid.position.y = 0.022;
  rug.add(braid);
  return rug;
}
