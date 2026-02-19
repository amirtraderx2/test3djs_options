import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// --- 1. UI STRUCTURE (HTML/CSS) ---
const layout = `
<div id="container" style="display: flex; flex-direction: column; height: 100vh; background: #000; font-family: 'Segoe UI', sans-serif; overflow: hidden;">
    <div id="viewport" style="flex: 7; position: relative; border-bottom: 2px solid #333;">
        <div id="overlay" style="position: absolute; top: 15px; left: 15px; z-index: 10; background: rgba(0,0,0,0.8); padding: 12px; border-radius: 6px; border: 1px solid #00f2ff; color: #00f2ff; pointer-events: none;">
            <b style="letter-spacing: 1px;">VOLATILITY SURFACE V1.0</b><br>
            <small style="color: #ccc;">Hover mesh to sync Table</small>
        </div>
        <button id="exportBtn" style="position: absolute; top: 15px; right: 15px; z-index: 10; background: #00f2ff; color: #000; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.3s;">
            EXPORT CSV
        </button>
    </div>
    
    <div id="dataframe-container" style="flex: 3; overflow-y: auto; background: #0a0a0a; color: #ddd; font-family: 'Consolas', monospace;">
        <table id="optionTable" style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead style="position: sticky; top: 0; background: #1a1a1a; color: #00f2ff; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">
                <tr>
                    <th style="padding: 10px; border-bottom: 1px solid #333; text-align: left;">STRIKE ($)</th>
                    <th style="padding: 10px; border-bottom: 1px solid #333; text-align: left;">DTE (DAYS)</th>
                    <th style="padding: 10px; border-bottom: 1px solid #333; text-align: left;">CALL IV (%)</th>
                    <th style="padding: 10px; border-bottom: 1px solid #333; text-align: left;">PUT IV (%)</th>
                </tr>
            </thead>
            <tbody id="tableBody"></tbody>
        </table>
    </div>
</div>
`;
document.body.innerHTML = layout;

// --- 2. THREE.JS SCENE SETUP ---
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
camera.position.set(15, 12, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
scene.add(new THREE.GridHelper(20, 20, 0x222222, 0x111111));

// --- 3. DATA & SURFACE GENERATION ---
const strikeSteps = 20;
const daySteps = 15;
const tableBody = document.getElementById('tableBody');
const csvRows = [["Strike", "DTE", "CallIV", "PutIV"]];
const tableRowRefs = [];

const calcIV = (x, z, type) => {
    const smile = 0.08 * Math.pow(x, 2);
    const skew = type === 'put' ? x * -0.12 : x * -0.04;
    return 0.15 + smile + skew + (z + 5) * 0.03;
};

const callGeo = new THREE.PlaneGeometry(10, 10, strikeSteps - 1, daySteps - 1);
const callPos = callGeo.attributes.position;

for (let i = 0; i < callPos.count; i++) {
    const x = callPos.getX(i);
    const z = callPos.getZ(i);
    
    const callIv = calcIV(x, z, 'call');
    const putIv = calcIV(x, z, 'put');
    const strike = (100 + x * 5).toFixed(2);
    const days = Math.round((z + 5) * 30);

    callPos.setY(i, callIv * 3); // Height mapping

    // Build Dataframe View
    const row = document.createElement('tr');
    row.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #222;">${strike}</td>
        <td style="padding: 8px; border-bottom: 1px solid #222;">${days}</td>
        <td style="padding: 8px; border-bottom: 1px solid #222; color: #00ff88;">${(callIv * 100).toFixed(2)}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #222; color: #ff3366;">${(putIv * 100).toFixed(2)}%</td>
    `;
    tableBody.appendChild(row);
    tableRowRefs.push(row);
    csvRows.push([strike, days, callIv, putIv]);
}
callGeo.computeVertexNormals();

const callSurface = new THREE.Mesh(callGeo, new THREE.MeshPhongMaterial({
    color: 0x00f2ff, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.8
}));
callSurface.rotation.x = -Math.PI / 2;
scene.add(callSurface);

// --- 4. EXPORT LOGIC ---
document.getElementById('exportBtn').onclick = () => {
    let csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "options_chain_data.csv");
    document.body.appendChild(link);
    link.click();
};

// --- 5. RAYCASTING & SYNC ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({color: 0xffffff}));
scene.add(dot);

viewport.addEventListener('mousemove', (e) => {
    const rect = viewport.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / viewport.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / viewport.clientHeight) * 2 + 1;
});

let activeIdx = -1;
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(callSurface);

    if (intersects.length > 0) {
        const idx = intersects[0].face.a; // Use vertex A of the intersected face
        dot.position.copy(intersects[0].point);
        dot.visible = true;

        if (idx !== activeIdx) {
            if (activeIdx !== -1) tableRowRefs[activeIdx].style.background = 'transparent';
            const row = tableRowRefs[idx];
            row.style.background = '#223344';
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            activeIdx = idx;
        }
    } else {
        dot.visible = false;
    }
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
});

animate();