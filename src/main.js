import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./styles.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <canvas class="scene" aria-label="3D animated cloth portfolio scene"></canvas>
  <div class="loader" id="loader">Loading 3D Portfolio</div>
  <div class="hud">
    <div class="brand">
      <strong>M.Shahzaib Wajid</strong>
      <span>Creative Developer | 3D Web Portfolio</span>
    </div>
    <div class="status">WebGL cloth online</div>
    <div class="hint">Drag to look around. Scroll to zoom. The cloth is a live animated WebGL mesh with your name rendered into its texture.</div>
    <div class="actions">
      <button type="button" id="focusCloth" aria-label="Focus cloth">Focus</button>
      <a href="mailto:hello@example.com" aria-label="Email M.Shahzaib Wajid">Email</a>
    </div>
  </div>
`;

const canvas = document.querySelector(".scene");
const loader = document.querySelector("#loader");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9fbac2, 0.034);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.9, 2.6, 8.7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.set(0, 1.25, 0);
controls.minDistance = 4.2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minPolarAngle = Math.PI * 0.2;

const ambient = new THREE.HemisphereLight(0xcfefff, 0x7d5b55, 1.9);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff3df, 3.2);
keyLight.position.set(-4, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xef6a4f, 15, 18);
rimLight.position.set(4.5, 3.3, 2.8);
scene.add(rimLight);

createSky();
createFloor();
const cloth = createCloth();
const avatar = createAvatar();
scene.add(cloth.mesh, avatar);

window.addEventListener("resize", onResize);
document.querySelector("#focusCloth").addEventListener("click", focusCloth);

setTimeout(() => loader.classList.add("hidden"), 500);
renderer.setAnimationLoop(render);

function createSky() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 24;
  canvasTexture.height = 512;
  const ctx = canvasTexture.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasTexture.height);
  gradient.addColorStop(0, "#b7d3dc");
  gradient.addColorStop(0.46, "#c3c9c3");
  gradient.addColorStop(1, "#d78b56");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(48, 48, 24),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
  );
  scene.add(sky);
}

function createFloor() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      color: 0x69717a,
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.32;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(80, 80, 0xd7dde2, 0x8f9aa2);
  grid.position.y = -1.305;
  grid.material.transparent = true;
  grid.material.opacity = 0.33;
  scene.add(grid);
}

function createClothTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 1400;
  textureCanvas.height = 940;
  const ctx = textureCanvas.getContext("2d");

  ctx.fillStyle = "#ece8df";
  ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

  ctx.globalAlpha = 0.38;
  for (let i = 0; i < 2800; i++) {
    const shade = Math.random() > 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.035)`;
    ctx.fillRect(Math.random() * textureCanvas.width, Math.random() * textureCanvas.height, 1.8, 1.8);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#221c18";
  ctx.lineWidth = 12;
  ctx.strokeRect(72, 72, textureCanvas.width - 144, textureCanvas.height - 144);

  ctx.fillStyle = "#ef6a4f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 128px Arial, sans-serif";
  ctx.fillText("!", textureCanvas.width / 2, 215);

  ctx.fillStyle = "#231c18";
  ctx.font = "900 94px Arial, sans-serif";
  ctx.fillText("M.SHAHZAIB", textureCanvas.width / 2, 410);
  ctx.fillText("WAJID", textureCanvas.width / 2, 520);

  ctx.fillStyle = "rgba(35,28,24,0.72)";
  ctx.font = "500 40px Arial, sans-serif";
  ctx.fillText("3D Web Portfolio", textureCanvas.width / 2, 650);

  ctx.fillStyle = "#231c18";
  ctx.font = "800 34px Consolas, monospace";
  ctx.fillText("Three.js / Vercel / Interactive Cloth", textureCanvas.width / 2, 725);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function createCloth() {
  const cols = 54;
  const rows = 34;
  const geometry = new THREE.PlaneGeometry(7.2, 4.95, cols, rows);
  const basePositions = geometry.attributes.position.array.slice();
  const material = new THREE.MeshStandardMaterial({
    map: createClothTexture(),
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 1.8, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(7.55, 5.25, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xf2eee5,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  backing.position.set(0.02, 1.77, -0.055);
  backing.castShadow = true;
  backing.receiveShadow = true;
  scene.add(backing);

  return { mesh, basePositions, cols, rows };
}

function createAvatar() {
  const group = new THREE.Group();
  group.position.set(1.95, -0.55, 2.35);
  group.rotation.y = -0.22;

  const skin = new THREE.MeshStandardMaterial({ color: 0xf0b890, roughness: 0.55 });
  const hair = new THREE.MeshStandardMaterial({ color: 0xd8b14b, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.64 });
  const hoodie = new THREE.MeshStandardMaterial({ color: 0xf2f5f4, roughness: 0.68 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.92, 8, 18), hoodie);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 18), skin);
  head.position.y = 1.35;
  head.castShadow = true;
  group.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  hairCap.position.set(-0.03, 1.48, 0.02);
  hairCap.rotation.z = -0.18;
  hairCap.castShadow = true;
  group.add(hairCap);

  for (let i = 0; i < 34; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 8),
      new THREE.MeshStandardMaterial({ color: [0xef6a4f, 0x61d394, 0x74a7ff, 0xf4ce57, 0xaf7bf2][i % 5], roughness: 0.52 })
    );
    dot.position.set((Math.random() - 0.5) * 0.72, 0.18 + Math.random() * 0.78, 0.36 + Math.random() * 0.08);
    dot.castShadow = true;
    group.add(dot);
  }

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.75, 8, 14), dark);
  leftLeg.position.set(-0.17, -0.42, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.17;
  group.add(rightLeg);

  const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.5 });
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.46), shoeMaterial);
  leftShoe.position.set(-0.17, -0.9, 0.12);
  leftShoe.castShadow = true;
  group.add(leftShoe);

  const rightShoe = leftShoe.clone();
  rightShoe.position.x = 0.17;
  group.add(rightShoe);

  return group;
}

function animateCloth(time) {
  const position = cloth.mesh.geometry.attributes.position;
  const normal = cloth.mesh.geometry.attributes.normal;
  const array = position.array;

  for (let i = 0; i < array.length; i += 3) {
    const x = cloth.basePositions[i];
    const y = cloth.basePositions[i + 1];
    const u = (x / 7.2) + 0.5;
    const v = 1 - ((y / 4.95) + 0.5);
    const pinned = v < 0.035;
    const wave = Math.sin(time * 1.7 + u * 9.5 + v * 3.4) * 0.09;
    const ripple = Math.sin(time * 2.8 + u * 22.0) * 0.045 * v;
    const sag = Math.sin(u * Math.PI) * v * 0.26;

    array[i] = x + Math.sin(time * 1.2 + v * 5.6) * 0.025 * v;
    array[i + 1] = pinned ? y : y - sag;
    array[i + 2] = wave + ripple;
  }

  position.needsUpdate = true;
  normal.needsUpdate = true;
  cloth.mesh.geometry.computeVertexNormals();
}

function animateAvatar(time) {
  avatar.position.y = -0.55 + Math.sin(time * 1.4) * 0.025;
  avatar.rotation.y = -0.22 + Math.sin(time * 0.7) * 0.045;
}

function focusCloth() {
  camera.position.set(0.6, 2.4, 7.4);
  controls.target.set(0, 1.25, 0);
  controls.update();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function render(timeMs) {
  const time = timeMs * 0.001;
  animateCloth(time);
  animateAvatar(time);
  controls.update();
  renderer.render(scene, camera);
}
