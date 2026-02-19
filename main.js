import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// --- 0. UI INJECTION (Control Icon & Dropdown) ---
const uiHTML = `
<div id="ui-wrapper" style="position: absolute; top: 20px; left: 20px; z-index: 1000; font-family: sans-serif;">
    <div id="control-icon" style="cursor: pointer; background: #222; padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; box-shadow: 0 0 10px rgba(0,0,0,0.5); border: 1px solid #444;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffcc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    </div>
    <div id="settings-panel" style="display: none; margin-top: 10px; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 8px; border: 1px solid #444; color: white;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px;">LINE COLOR</label>
        <select id="colorPicker" style="background: #333; color: #00ffcc; border: 1px solid #00ffcc; padding: 5px; width: 100%; outline: none; border-radius: 4px;">
            <option value="0x00ffcc">Cyan</option>
            <option value="0xff3366">Pink</option>
            <option value="0xffff00">Yellow</option>
            <option value="0x00ff00">Green</option>
            <option value="0xffffff">White</option>
        </select>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', uiHTML);

// UI Toggle Logic
const icon = document.getElementById('control-icon');
const panel = document.getElementById('settings-panel');
icon.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };

// 1. SCENE & RENDERER SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. CAMERA
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 10, 10);

// 3. CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 4. LIGHTING
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 200);
pointLight.position.set(5, 10, 5);
scene.add(pointLight);

// 5. DATA GENERATION
const strikes = [80, 90, 100, 110, 120];
const expiries = [1, 2, 3, 4, 5];

const getIV = (strike, time) => {
    const smile = Math.pow((strike - 100), 2) / 500;
    return (smile + (time * 0.1) + 0.2);
};

// 6. GEOMETRY
const segments = strikes.length - 1;
const geometry = new THREE.PlaneGeometry(10, 10, segments, expiries.length - 1);

const positions = geometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
    const xIndex = i % (segments + 1);
    const zIndex = Math.floor(i / (segments + 1));
    const ivValue = getIV(strikes[xIndex], expiries[zIndex]);
    positions.setY(i, ivValue * 4); 
}
geometry.computeVertexNormals();

// 7. MATERIAL & MESH
const material = new THREE.MeshPhongMaterial({
    color: 0x00ffcc,
    side: THREE.DoubleSide,
    wireframe: true,
});

const surface = new THREE.Mesh(geometry, material);
surface.rotation.x = -Math.PI / 2;
scene.add(surface);

// Color Picker Listener
document.getElementById('colorPicker').onchange = (e) => {
    material.color.setHex(parseInt(e.target.value));
    icon.querySelector('svg').setAttribute('stroke', e.target.value.replace('0x', '#'));
};

// 8. HELPERS
scene.add(new THREE.GridHelper(20, 20, 0x333333, 0x222222));
scene.add(new THREE.AxesHelper(5));

// 9. ANIMATION LOOP
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();