export class HtmlCloth extends ArrivalScript {
    static scriptName = "HtmlCloth";

    width = 2.6;
    height = 2.6;
    segmentsX = 20;
    segmentsY = 20;
    clothMass = 1.2;
    clothDamping = 0.04;
    clothFriction = 0.8;
    clothStiffness = 0.9;
    gravity = 9.8;
    collisionMargin = 0.04;
    colliderDistance = 100;
    physicsHz = 120;
    physicsSubSteps = 8;
    metalness = 0;
    glossiness = 0.5;
    debugFreeze = false;
    playerProxyHeight = 2.4;
    playerProxyWidth = 0.2;
    textureWidth = 512;
    textureHeight = 512;

    static properties = {
        width: { title: "Width", min: 0.5, max: 6, step: 0.1 },
        height: { title: "Height", min: 0.5, max: 8, step: 0.1 },
        segmentsX: { title: "Segments X", min: 2, max: 24, step: 1 },
        segmentsY: { title: "Segments Y", min: 2, max: 32, step: 1 },
        clothMass: { title: "Mass", min: 0.1, max: 10, step: 0.1 },
        clothDamping: { title: "Damping", min: 0, max: 1, step: 0.01 },
        clothFriction: { title: "Friction", min: 0, max: 2, step: 0.05 },
        clothStiffness: { title: "Stiffness", min: 0.1, max: 1, step: 0.05 },
        gravity: { title: "Gravity", min: 0, max: 20, step: 0.1 },
        collisionMargin: { title: "Collision Margin", min: 0.005, max: 0.2, step: 0.005 },
        colliderDistance: { title: "Collider Range", min: 0.5, max: 12, step: 0.1 },
        physicsHz: { title: "Physics Hz", min: 30, max: 480, step: 30 },
        physicsSubSteps: { title: "Physics Sub Steps", min: 1, max: 16, step: 1 },
        metalness: { title: "Metalness", min: 0, max: 1, step: 0.05 },
        glossiness: { title: "Glossiness", min: 0, max: 1, step: 0.05 },
        debugFreeze: { title: "Debug Freeze" },
        playerProxyHeight: { title: "Player Proxy Height", min: 0.5, max: 3, step: 0.05 },
        playerProxyWidth: { title: "Player Proxy Width", min: 0.01, max: 2, step: 0.05 },
        textureWidth: { title: "Texture Width (px)", min: 64, max: 2048, step: 64 },
        textureHeight: { title: "Texture Height (px)", min: 64, max: 2048, step: 64 },
    };

    _worldLayer = null;
    _mesh = null;
    _meshNode = null;
    _meshInstance = null;
    _material = null;
    _texture = null;
    _sourceEl = null;
    _hadLayoutSubtree = false;
    _paintHandler = null;
    _positions = null;
    _normals = null;
    _indices = null;
    _topEdgeLocalPoints = [];
    _colliderBodies = [];
    _anchorBodies = [];

    _dynamicsWorld = null;
    _softBodyHelpers = null;
    _clothBody = null;
    _worldGravity = null;

    _collisionConfiguration = null;
    _dispatcher = null;
    _broadphase = null;
    _solver = null;
    _softBodySolver = null;

    _tmpTransform = null;
    _tmpOrigin = null;
    _tmpRotation = null;
    _tmpScale = null;
    _tmpMat = new pc.Mat4();
    _tmpPoint = new pc.Vec3();

    _elapsed = 0;
    _boundPointerDown = null;
    _boundPointerMove = null;
    _boundPointerUp = null;
    _inputLocked = false;
    _hoveredTarget = null;
    _mouseDownTarget = null;
    _selAnchorNode = null;
    _selAnchorOffset = 0;
    _selReady = false;
    _dispatching = false;
    _highlightMarks = [];
    _gridEntity = null;
    _gridPrevEnabled = null;

    initialize() {
        this._enableGrid();
        if (this.app.loadTracker?.loadingSpace) {
            this.app.once("hideLoadingScreen", this._buildCurtain.bind(this));
        } else {
            this._buildCurtain();
        }
    }

    _enableGrid() {
        const grid = this.app.root.findByName("PerfectGridPlane");
        if (!grid) return;
        this._gridEntity = grid;
        this._gridPrevEnabled = grid.enabled;
        grid.enabled = true;
    }

    _restoreGrid() {
        if (this._gridEntity && this._gridPrevEnabled !== null) {
            this._gridEntity.enabled = this._gridPrevEnabled;
        }
        this._gridEntity = null;
        this._gridPrevEnabled = null;
    }

    update(dt) {
        if (!this._clothBody || !this._dynamicsWorld || !dt) {
            return;
        }

        this._syncAnchorBodies();
        this._syncColliderBodies();

        if (!this.debugFreeze) {
            const fixedStep = 1 / this.physicsHz;
            const clampedDt = Math.min(dt, this.physicsSubSteps * fixedStep);
            this._dynamicsWorld.stepSimulation(clampedDt, this.physicsSubSteps, fixedStep);
        }

        this._updateRenderMesh();

        if (this._sourceEl) {
            this._elapsed += dt;
            const t = this._elapsed;

            const clock = this._sourceEl.querySelector("#htc-clock");
            if (clock) clock.textContent = new Date().toLocaleTimeString();

            const spinner = this._sourceEl.querySelector("#htc-spinner");
            if (spinner) spinner.style.transform = `rotate(${(t * 180) % 360}deg)`;

            const pulse = this._sourceEl.querySelector("#htc-pulse");
            if (pulse) pulse.style.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4));

            const slider = this._sourceEl.querySelector("#htc-slider");
            if (slider) slider.style.transform = `translateX(${60 + 60 * Math.sin(t * 2)}px)`;

            this._drawVideoFrame();

            this._refreshTexture();
        }
    }

    onPropertyChanged(name, value) {
        if (name === "metalness" || name === "glossiness") {
            if (this._material) {
                this._material.metalness = this.metalness;
                this._material.gloss = this.glossiness;
                this._material.update();
            }
            return;
        }

        this._teardownCurtain();
        this._buildCurtain();
    }

    destroy() {
        this._teardownInteraction();
        this._teardownCurtain();
        this._restoreGrid();
        this.unlockInput();

        if (this._sourceEl?.parentNode) {
            this._sourceEl.parentNode.removeChild(this._sourceEl);
        }
        this._sourceEl = null;
    }

    _buildCurtain() {
        if (typeof Ammo === "undefined") {
            console.warn("[HtmlCloth] Ammo is required for cloth simulation.");
            return;
        }

        this._worldLayer = this.app.scene.layers.getLayerByName("World");
        this._createSourceElement();
        this._createBlankTexture();
        this._createPhysicsWorld();
        this._createRenderMesh();
        this._createClothBody();
        this._createAnchorBodies();
        this._createNearbyColliders();
        this._updateRenderMesh();
        this._scheduleTextureUpload();
        this._setupInteraction();
    }

    _createPhysicsWorld() {
        this._collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
        this._dispatcher = new Ammo.btCollisionDispatcher(this._collisionConfiguration);
        this._broadphase = new Ammo.btDbvtBroadphase();
        this._solver = new Ammo.btSequentialImpulseConstraintSolver();
        this._softBodySolver = new Ammo.btDefaultSoftBodySolver();
        this._dynamicsWorld = new Ammo.btSoftRigidDynamicsWorld(
            this._dispatcher,
            this._broadphase,
            this._solver,
            this._collisionConfiguration,
            this._softBodySolver
        );

        this._worldGravity = new Ammo.btVector3(0, -this.gravity, 0);
        this._dynamicsWorld.setGravity(this._worldGravity);

        const worldInfo = this._dynamicsWorld.getWorldInfo();
        worldInfo.set_m_broadphase(this._broadphase);
        worldInfo.set_m_dispatcher(this._dispatcher);
        worldInfo.set_m_gravity(this._worldGravity);
        if (typeof worldInfo.get_m_sparsesdf === "function") {
            const sparseSdf = worldInfo.get_m_sparsesdf();
            if (sparseSdf && typeof sparseSdf.Initialize === "function") {
                sparseSdf.Initialize();
            }
        }

        this._softBodyHelpers = new Ammo.btSoftBodyHelpers();

        this._tmpTransform = new Ammo.btTransform();
        this._tmpOrigin = new Ammo.btVector3(0, 0, 0);
        this._tmpRotation = new Ammo.btQuaternion(0, 0, 0, 1);
        this._tmpScale = new Ammo.btVector3(1, 1, 1);
    }

    _createRenderMesh() {
        const cols = this._segmentCountX();
        const rows = this._segmentCountY();
        const pointCount = (cols + 1) * (rows + 1);

        this._positions = new Float32Array(pointCount * 3);
        this._normals = new Float32Array(pointCount * 3);
        this._uvs = new Float32Array(pointCount * 2);
        this._indices = [];
        this._topEdgeLocalPoints = [];

        for (let y = 0; y <= rows; y++) {
            for (let x = 0; x <= cols; x++) {
                const vertexIndex = y * (cols + 1) + x;

                if (y === 0) {
                    this._topEdgeLocalPoints.push(this._localGridPoint(x, 0));
                }

                const uvIndex = vertexIndex * 2;
                this._uvs[uvIndex] = x / cols;
                this._uvs[uvIndex + 1] = y / rows;

                if (x === cols || y === rows) {
                    continue;
                }

                const i0 = y * (cols + 1) + x;
                const i1 = i0 + 1;
                const i2 = i0 + cols + 1;
                const i3 = i2 + 1;

                this._indices.push(i0, i2, i1);
                this._indices.push(i1, i2, i3);
            }
        }

        this._mesh = new pc.Mesh(this.app.graphicsDevice);
        this._mesh.setPositions(this._positions);
        this._mesh.setNormals(this._normals);
        this._mesh.setUvs(0, this._uvs);
        this._mesh.setIndices(this._indices);
        this._mesh.update(pc.PRIMITIVE_TRIANGLES);

        this._material = new pc.StandardMaterial();
        this._material.useLighting = true;
        this._material.useMetalness = true;
        this._material.cull = pc.CULLFACE_NONE;
        this._material.diffuseMap = this._texture;
        this._material.diffuse = new pc.Color(1, 1, 1);
        this._material.emissive = new pc.Color(0, 0, 0);
        this._material.metalness = this.metalness;
        this._material.gloss = this.glossiness;
        this._material.update();

        this._meshNode = new pc.GraphNode("HtmlClothCurtain");
        this._meshInstance = new pc.MeshInstance(this._mesh, this._material, this._meshNode);
        this._meshInstance.cull = false;
        this._meshInstance.castShadow = true;

        if (this._worldLayer) {
            this._worldLayer.addMeshInstances([this._meshInstance]);
        }
    }

    _createClothBody() {
        const worldInfo = this._dynamicsWorld.getWorldInfo();

        const topLeft = this._toWorldPoint(this._localGridPoint(0, 0));
        const topRight = this._toWorldPoint(this._localGridPoint(this._segmentCountX(), 0));
        const bottomLeft = this._toWorldPoint(this._localGridPoint(0, this._segmentCountY()));
        const bottomRight = this._toWorldPoint(this._localGridPoint(this._segmentCountX(), this._segmentCountY()));

        const c00 = new Ammo.btVector3(topLeft.x, topLeft.y, topLeft.z);
        const c01 = new Ammo.btVector3(topRight.x, topRight.y, topRight.z);
        const c10 = new Ammo.btVector3(bottomLeft.x, bottomLeft.y, bottomLeft.z);
        const c11 = new Ammo.btVector3(bottomRight.x, bottomRight.y, bottomRight.z);

        this._clothBody = this._softBodyHelpers.CreatePatch(
            worldInfo,
            c00,
            c01,
            c10,
            c11,
            this._segmentCountX() + 1,
            this._segmentCountY() + 1,
            0,
            true
        );

        Ammo.destroy(c00);
        Ammo.destroy(c01);
        Ammo.destroy(c10);
        Ammo.destroy(c11);

        const config = this._clothBody.get_m_cfg();
        config.set_viterations(8);
        config.set_piterations(8);
        config.set_diterations(8);
        config.set_kDP(this.clothDamping);
        config.set_kDF(this.clothFriction);

        const material = this._clothBody.get_m_materials().at(0);
        material.set_m_kLST(this.clothStiffness);
        material.set_m_kAST(this.clothStiffness);

        this._clothBody.setTotalMass(this.clothMass, false);
        Ammo.castObject(this._clothBody, Ammo.btCollisionObject).getCollisionShape().setMargin(this.collisionMargin);
        this._clothBody.setActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);

        this._dynamicsWorld.addSoftBody(this._clothBody, 1, -1);
    }

    _createAnchorBodies() {
        for (let i = 0; i < this._topEdgeLocalPoints.length; i++) {
            const worldPoint = this._toWorldPoint(this._topEdgeLocalPoints[i]);

            /// add a small error so cloth falls more naturally instead of perfectly flat at the start
            worldPoint.z += Math.random() * 0.01 - 0.005;
            worldPoint.x += Math.random() * 0.01 - 0.005;

            const anchor = this._createStaticBoxBody(worldPoint, 0.015);
            this._anchorBodies.push(anchor);
            this._clothBody.appendAnchor(i, anchor.body, true, 1);
        }
    }

    _createNearbyColliders() {
        const center = this.entity.getPosition();
        const maxDistanceSq = this.colliderDistance * this.colliderDistance;
        const collisionComponents = this.app.root.findComponents("collision");

        for (const collision of collisionComponents) {
            if (!collision?.entity || collision.entity === this.entity) {
                continue;
            }

            if(!collision.enabled) {
                continue;
            }

            if(!collision?.entity?.rigidbody || !collision?.entity.enabled) {
                continue;
            }

            const pos = collision.entity.getPosition();
            const dx = pos.x - center.x;
            const dy = pos.y - center.y;
            const dz = pos.z - center.z;

            if ((dx * dx) + (dy * dy) + (dz * dz) > maxDistanceSq) {
                continue;
            }

            const proxy = this._createColliderProxy(collision);
            if (proxy) {
                this._colliderBodies.push(proxy);
            }
        }
    }

    _createColliderProxy(collision) {
        const type = collision.type;
        const entity = collision.entity;
        const entityScale = entity.getScale();
        const maxScale = Math.max(Math.abs(entityScale.x), Math.abs(entityScale.y), Math.abs(entityScale.z));
        const isPlayer = entity.name === "CharacterController" || !!entity.script?.characterController;
        let shape = null;
        let usesScale = false;

        if (isPlayer) {
            shape = new Ammo.btCapsuleShape(this.playerProxyWidth, this.playerProxyHeight);
        } else{

            return null; // only support player proxy for now, can add more shapes later if needed
        }

        shape.setMargin(this.collisionMargin);

        const transform = new Ammo.btTransform();
        transform.setIdentity();

        const motionState = new Ammo.btDefaultMotionState(transform);
        const inertia = new Ammo.btVector3(0, 0, 0);
        const info = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, inertia);
        const body = new Ammo.btRigidBody(info);

        body.setCollisionFlags(body.getCollisionFlags() | 2);
        body.setActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);

        this._dynamicsWorld.addRigidBody(body, 1, -1);

        const proxy = { body, entity, shape, transform, motionState, info, inertia, usesScale };
        this._syncRigidBody(proxy);
        return proxy;
    }

    _createStaticBoxBody(worldPoint, halfExtent) {
        const size = new Ammo.btVector3(halfExtent, halfExtent, halfExtent);
        const shape = new Ammo.btBoxShape(size);
        Ammo.destroy(size);
        shape.setMargin(this.collisionMargin);

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        const origin = new Ammo.btVector3(worldPoint.x, worldPoint.y, worldPoint.z);
        const rotation = new Ammo.btQuaternion(0, 0, 0, 1);
        transform.setOrigin(origin);
        transform.setRotation(rotation);
        Ammo.destroy(origin);
        Ammo.destroy(rotation);

        const motionState = new Ammo.btDefaultMotionState(transform);
        const inertia = new Ammo.btVector3(0, 0, 0);
        const info = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, inertia);
        const body = new Ammo.btRigidBody(info);

        body.setCollisionFlags(body.getCollisionFlags() | 2);
        body.setActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);

        this._dynamicsWorld.addRigidBody(body, 1, -1);

        const proxy = { body, shape, transform, motionState, info, inertia };
        return proxy;
    }

    _syncAnchorBodies() {
        for (let i = 0; i < this._anchorBodies.length; i++) {
            const worldPoint = this._toWorldPoint(this._topEdgeLocalPoints[i], this._tmpPoint);
            this._setBodyTransform(this._anchorBodies[i].body, worldPoint, pc.Quat.IDENTITY);
        }
    }

    _syncColliderBodies() {
        for (const proxy of this._colliderBodies) {
            this._syncRigidBody(proxy);
        }
    }

    _syncRigidBody(proxy) {
        if (proxy.usesScale) {
            const scale = proxy.entity.getScale();
            this._tmpScale.setValue(
                Math.max(0.001, Math.abs(scale.x)),
                Math.max(0.001, Math.abs(scale.y)),
                Math.max(0.001, Math.abs(scale.z))
            );
            proxy.shape.setLocalScaling(this._tmpScale);
        }

        this._setBodyTransform(proxy.body, proxy.entity.getPosition(), proxy.entity.getRotation());
    }

    _setBodyTransform(body, position, rotation) {
        this._tmpTransform.setIdentity();
        this._tmpOrigin.setValue(position.x, position.y, position.z);
        this._tmpRotation.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
        this._tmpTransform.setOrigin(this._tmpOrigin);
        this._tmpTransform.setRotation(this._tmpRotation);

        body.setWorldTransform(this._tmpTransform);

        const motionState = body.getMotionState();
        if (motionState) {
            motionState.setWorldTransform(this._tmpTransform);
        }
    }

    _updateRenderMesh() {
        const nodes = this._clothBody.get_m_nodes();
        const count = nodes.size();

        for (let i = 0; i < count; i++) {
            const node = nodes.at(i);
            const point = node.get_m_x();
            const baseIndex = i * 3;

            this._positions[baseIndex] = point.x();
            this._positions[baseIndex + 1] = point.y();
            this._positions[baseIndex + 2] = point.z();
        }

        this._mesh.setPositions(this._positions);
        this._recalculateNormals();
        this._mesh.setNormals(this._normals);
        this._mesh.update(pc.PRIMITIVE_TRIANGLES);
    }

    _recalculateNormals() {
        this._normals.fill(0);

        for (let i = 0; i < this._indices.length; i += 3) {
            const ia = this._indices[i] * 3;
            const ib = this._indices[i + 1] * 3;
            const ic = this._indices[i + 2] * 3;

            const ax = this._positions[ia];
            const ay = this._positions[ia + 1];
            const az = this._positions[ia + 2];

            const bx = this._positions[ib];
            const by = this._positions[ib + 1];
            const bz = this._positions[ib + 2];

            const cx = this._positions[ic];
            const cy = this._positions[ic + 1];
            const cz = this._positions[ic + 2];

            const abx = bx - ax;
            const aby = by - ay;
            const abz = bz - az;
            const acx = cx - ax;
            const acy = cy - ay;
            const acz = cz - az;

            const nx = (aby * acz) - (abz * acy);
            const ny = (abz * acx) - (abx * acz);
            const nz = (abx * acy) - (aby * acx);

            this._normals[ia] += nx;
            this._normals[ia + 1] += ny;
            this._normals[ia + 2] += nz;

            this._normals[ib] += nx;
            this._normals[ib + 1] += ny;
            this._normals[ib + 2] += nz;

            this._normals[ic] += nx;
            this._normals[ic + 1] += ny;
            this._normals[ic + 2] += nz;
        }

        for (let i = 0; i < this._normals.length; i += 3) {
            const nx = this._normals[i];
            const ny = this._normals[i + 1];
            const nz = this._normals[i + 2];
            const length = Math.sqrt((nx * nx) + (ny * ny) + (nz * nz));

            if (!length) {
                this._normals[i] = 0;
                this._normals[i + 1] = 0;
                this._normals[i + 2] = 1;
                continue;
            }

            const invLength = 1 / length;
            this._normals[i] = nx * invLength;
            this._normals[i + 1] = ny * invLength;
            this._normals[i + 2] = nz * invLength;
        }
    }

    /* ── HTML source element ──────────────────────────────── */

    _createSourceElement() {
        const canvas = this.app.graphicsDevice.canvas;

        if (canvas && !canvas.hasAttribute("layoutsubtree")) {
            canvas.setAttribute("layoutsubtree", "true");
            this._hadLayoutSubtree = true;
        }

        this._sourceEl = document.createElement("div");
        this._sourceEl.style.cssText = [
            `width:${this.textureWidth}px`, `height:${this.textureHeight}px`,
            "padding:16px", "box-sizing:border-box",
            "font-family:system-ui,sans-serif", "font-size:18px",
            "color:#222", "background:#fff",
            "pointer-events:none",
            "position:relative",
        ].join(";");

        this._sourceEl.innerHTML = [
            "Hello world!<br>",
            "I'm multi-line, <b>formatted</b>, rotated text ",
            "with emoji (&#128512;), RTL text ",
            '<span dir="rtl">\u0645\u0646 \u0641\u0627\u0631\u0633\u06CC \u0635\u062D\u0628\u062A \u0645\u06CC\u06A9\u0646\u0645</span>, ',
            "vertical text,",
            '<p style="writing-mode:vertical-rl;margin:8px 0;">\u8FD9\u662F\u5782\u76F4\u6587\u672C</p>',
            '<canvas id="htc-video-canvas" width="140" height="164" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:140px;height:164px;border-radius:8px;"></canvas>',
            '<div id="htc-clock" style="font-family:monospace;font-size:32px;color:#2c3e50;margin:8px 0;">00:00:00</div>',
            '<span id="htc-spinner" style="display:inline-block;font-size:28px;">\u2699\uFE0F</span> ',
            '<span id="htc-pulse" style="color:#e74c3c;font-weight:bold;">LIVE</span> ',
            '<span id="htc-slider" style="display:inline-block;background:#3498db;color:#fff;padding:2px 8px;border-radius:4px;font-size:14px;">sliding</span><br><br>',
            "and an inline ",
            '<svg width="50" height="50" style="vertical-align:middle">',
            '  <circle cx="25" cy="25" r="20" fill="green"/>',
            '  <text x="25" y="30" font-size="15" text-anchor="middle" fill="#fff">SVG</text>',
            "</svg>!",
            '<div style="position:absolute;bottom:24px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:12px;">',
            '  <button id="htc-btn" style="',
            '    font-size:18px;padding:12px 32px;border:none;border-radius:8px;',
            '    background:#3498db;color:#fff;cursor:pointer;',
            '    transition:background 0.2s,transform 0.2s;',
            '  ">Click Me</button>',
            '  <input id="htc-bg" type="color" value="#ffffff" style="',
            '    width:48px;height:48px;border:none;border-radius:8px;',
            '    background:transparent;cursor:pointer;padding:0;',
            '  ">',
            '</div>',
        ].join("");

        canvas.appendChild(this._sourceEl);

        const btn = this._sourceEl.querySelector("#htc-btn");
        if (btn) {
            btn.addEventListener("mouseenter", () => {
                btn.style.background = "#2980b9";
                btn.style.transform = "scale(1.05)";
            });
            btn.addEventListener("mouseleave", () => {
                btn.style.background = "#3498db";
                btn.style.transform = "scale(1)";
            });
            btn.addEventListener("click", () => {
                btn.textContent = "Clicked!";
            });
        }

        const bg = this._sourceEl.querySelector("#htc-bg");
        if (bg) {
            bg.addEventListener("input", () => {
                this._sourceEl.style.background = bg.value;
                this._refreshTexture();
            });
        }

        this._hiddenVideo = document.createElement("video");
        this._hiddenVideo.crossOrigin = "anonymous";
        this._hiddenVideo.src = "https://dzrmwng2ae8bq.cloudfront.net/42485456/1b8d44f227cc049d0e846b9852f254fd32ea54e83f805c5d54ff07c477dfb117_source-ezgif.com-gif-to-mp4-converter.mp4";
        this._hiddenVideo.muted = true;
        this._hiddenVideo.loop = true;
        this._hiddenVideo.playsInline = true;
        this._hiddenVideo.autoplay = true;
        // Must be on-screen (not display:none) or Chrome throttles decode.
        this._hiddenVideo.style.cssText = "position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:2147483647;";
        document.body.appendChild(this._hiddenVideo);
    }

    _drawVideoFrame() {
        const video = this._hiddenVideo;
        if (!video || video.readyState < 2 || !this._sourceEl) return;
        const videoCanvas = this._sourceEl.querySelector("#htc-video-canvas");
        if (!videoCanvas) return;

        // Toggle canvas.width each frame to invalidate the element's paint
        // record so texElementImage2D re-reads the bitmap.
        const baseW = video.videoWidth || 140;
        videoCanvas.width = baseW + ((this._videoTick = (this._videoTick || 0) + 1) & 1);
        videoCanvas.height = video.videoHeight || 140;
        videoCanvas.style.width = "140px";
        videoCanvas.style.height = `${140 * (videoCanvas.height / baseW)}px`;

        const ctx = videoCanvas.getContext("2d");
        if (ctx) ctx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);
    }

    /* ── texture ──────────────────────────────────────────── */

    _createBlankTexture() {
        const device = this.app.graphicsDevice;
        const w = this.textureWidth;
        const h = this.textureHeight;

        this._texture = new pc.Texture(device, {
            width: w,
            height: h,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        });

        const blank = new Uint8Array(w * h * 4);
        blank.fill(255);
        this._texture._levels[0] = blank;
        this._texture.upload();
    }

    _uploadTexture() {
        if (!this._texture || !this._sourceEl) return;

        const gl = this.app.graphicsDevice.gl;
        const glTexture = this._texture.impl?._glTexture ?? this._texture.impl?.glTexture;
        if (!glTexture) return;

        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        gl.texElementImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._sourceEl
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    _scheduleTextureUpload() {
        const canvas = this.app.graphicsDevice.canvas;

        this._paintHandler = () => {
            this._paintHandler = null;
            this._uploadTexture();
        };
        canvas.addEventListener("paint", this._paintHandler, { once: true });
        canvas.requestPaint();
    }

    _refreshTexture() {
        const canvas = this.app.graphicsDevice.canvas;
        if (!canvas || !this._texture) return;

        if (this._paintHandler) {
            canvas.removeEventListener("paint", this._paintHandler);
        }
        this._paintHandler = () => {
            this._paintHandler = null;
            this._uploadTexture();
        };
        canvas.addEventListener("paint", this._paintHandler, { once: true });
        canvas.requestPaint();
    }

    /* ── grid helpers ─────────────────────────────────────── */

    _localGridPoint(x, y) {
        const cols = this._segmentCountX();
        const rows = this._segmentCountY();
        const px = ((x / cols) - 0.5) * this.width;
        const py = -(y / rows) * this.height;
        return new pc.Vec3(px, py, 0);
    }

    _toWorldPoint(localPoint, out = new pc.Vec3()) {
        this._tmpMat.copy(this.entity.getWorldTransform());
        this._tmpMat.transformPoint(localPoint, out);
        return out;
    }

    _segmentCountX() {
        return Math.max(2, Math.floor(this.segmentsX));
    }

    _segmentCountY() {
        return Math.max(2, Math.floor(this.segmentsY));
    }

    /* ── teardown ─────────────────────────────────────────── */

    _teardownCurtain() {
        this._teardownInteraction();

        if (this._paintHandler) {
            const canvas = this.app.graphicsDevice.canvas;
            if (canvas) {
                canvas.removeEventListener("paint", this._paintHandler);
            }
            this._paintHandler = null;
        }

        if (this._worldLayer && this._meshInstance) {
            this._worldLayer.removeMeshInstances([this._meshInstance]);
        }

        if (this._clothBody && this._dynamicsWorld) {
            this._dynamicsWorld.removeSoftBody(this._clothBody);
            Ammo.destroy(this._clothBody);
            this._clothBody = null;
        }

        for (const anchor of this._anchorBodies) {
            this._destroyRigidBody(anchor);
        }
        this._anchorBodies = [];

        for (const proxy of this._colliderBodies) {
            this._destroyRigidBody(proxy);
        }
        this._colliderBodies = [];

        if (this._softBodyHelpers) {
            Ammo.destroy(this._softBodyHelpers);
            this._softBodyHelpers = null;
        }

        if (this._dynamicsWorld) {
            Ammo.destroy(this._dynamicsWorld);
            this._dynamicsWorld = null;
        }

        if (this._softBodySolver) {
            Ammo.destroy(this._softBodySolver);
            this._softBodySolver = null;
        }

        if (this._solver) {
            Ammo.destroy(this._solver);
            this._solver = null;
        }

        if (this._broadphase) {
            Ammo.destroy(this._broadphase);
            this._broadphase = null;
        }

        if (this._dispatcher) {
            Ammo.destroy(this._dispatcher);
            this._dispatcher = null;
        }

        if (this._collisionConfiguration) {
            Ammo.destroy(this._collisionConfiguration);
            this._collisionConfiguration = null;
        }

        if (this._worldGravity) {
            Ammo.destroy(this._worldGravity);
            this._worldGravity = null;
        }

        if (this._tmpScale) {
            Ammo.destroy(this._tmpScale);
            this._tmpScale = null;
        }

        if (this._tmpRotation) {
            Ammo.destroy(this._tmpRotation);
            this._tmpRotation = null;
        }

        if (this._tmpOrigin) {
            Ammo.destroy(this._tmpOrigin);
            this._tmpOrigin = null;
        }

        if (this._tmpTransform) {
            Ammo.destroy(this._tmpTransform);
            this._tmpTransform = null;
        }

        if (this._material) {
            this._material.destroy();
            this._material = null;
        }

        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }

        if (this._mesh?.destroy) {
            this._mesh.destroy();
        }

        this._mesh = null;
        this._meshNode = null;
        this._meshInstance = null;
        this._positions = null;
        this._normals = null;
        this._indices = null;
        this._topEdgeLocalPoints = [];
        this._worldLayer = null;

        if (this._hiddenVideo) {
            this._hiddenVideo.pause();
            this._hiddenVideo.src = "";
            if (this._hiddenVideo.parentNode) this._hiddenVideo.parentNode.removeChild(this._hiddenVideo);
            this._hiddenVideo = null;
        }

        if (this._sourceEl?.parentNode) {
            this._sourceEl.parentNode.removeChild(this._sourceEl);
        }
        this._sourceEl = null;

        if (this._hadLayoutSubtree) {
            const canvas = this.app.graphicsDevice.canvas;
            if (canvas) {
                canvas.removeAttribute("layoutsubtree");
            }
            this._hadLayoutSubtree = false;
        }
    }

    /* ── interaction ──────────────────────────────────────── */

    _setupInteraction() {
        this._boundPointerDown = (e) => this._handlePointer(e, "mousedown");
        this._boundPointerMove = (e) => this._handlePointer(e, "mousemove");
        this._boundPointerUp = (e) => this._handlePointer(e, "mouseup");

        window.addEventListener("mousedown", this._boundPointerDown, true);
        window.addEventListener("mousemove", this._boundPointerMove, true);
        window.addEventListener("mouseup", this._boundPointerUp, true);
    }

    _teardownInteraction() {
        if (this._boundPointerDown) window.removeEventListener("mousedown", this._boundPointerDown, true);
        if (this._boundPointerMove) window.removeEventListener("mousemove", this._boundPointerMove, true);
        if (this._boundPointerUp) window.removeEventListener("mouseup", this._boundPointerUp, true);
        this._boundPointerDown = null;
        this._boundPointerMove = null;
        this._boundPointerUp = null;
        if (this._inputLocked) {
            this.unlockInput();
            this._inputLocked = false;
        }
        this._selecting = false;
        this._hoveredTarget = null;
    }

    _handlePointer(e, type) {
        if (!this._sourceEl || this._dispatching) return;

        const uv = this._raycastMeshUV(e.clientX, e.clientY);

        if (!uv) {
            if (this._hoveredTarget) {
                this._sourceEl.style.pointerEvents = "auto";
                this._hoveredTarget.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
                this._sourceEl.style.pointerEvents = "none";
                this._hoveredTarget = null;
                this.app.graphicsDevice.canvas.style.cursor = "";
                this._refreshTexture();
            }
            if (this._inputLocked && !this._selecting) {
                this.unlockInput();
                this._inputLocked = false;
            }
            if (type === "mouseup") {
                this._selecting = false;
                if (this._inputLocked) {
                    this.unlockInput();
                    this._inputLocked = false;
                }
            }
            return;
        }

        if (!this._inputLocked) {
            this.lockInput();
            this._inputLocked = true;
        }

        const rect = this._sourceEl.getBoundingClientRect();
        const clientX = rect.left + uv.u * rect.width;
        const clientY = rect.top + uv.v * rect.height;

        this._sourceEl.style.pointerEvents = "auto";
        this._sourceEl.style.zIndex = "999999";
        this._sourceEl.style.position = "relative";

        const target = document.elementFromPoint(clientX, clientY) || this._sourceEl;

        if (target !== this._hoveredTarget) {
            if (this._hoveredTarget) {
                this._hoveredTarget.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
            }
            target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
            this._hoveredTarget = target;
        }

        const canvas = this.app.graphicsDevice.canvas;
        const tag = target.tagName;
        const inputType = tag === "INPUT" ? (target.type || "").toLowerCase() : "";
        const textInputTypes = new Set(["text", "password", "email", "number", "search", "tel", "url", ""]);
        if (tag === "BUTTON" || tag === "A") {
            canvas.style.cursor = "pointer";
        } else if (tag === "INPUT" && !textInputTypes.has(inputType)) {
            canvas.style.cursor = "default";
        } else {
            canvas.style.cursor = "text";
        }

        this._dispatching = true;
        target.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true,
            clientX, clientY,
            button: e.button, buttons: e.buttons,
        }));
        this._dispatching = false;

        if (type === "mousedown") {
            this.lockInput();
            this._inputLocked = true;
            this._mouseDownTarget = target;
            this._clearHighlight();

            const range = document.caretRangeFromPoint(clientX, clientY);
            if (range && this._sourceEl.contains(range.startContainer)) {
                this._selAnchorNode = range.startContainer;
                this._selAnchorOffset = range.startOffset;
                this._selReady = true;
            }
        } else if (type === "mousemove" && (this._selecting || this._selReady)) {
            if (this._selReady && !this._selecting) {
                this._selecting = true;
                this._selReady = false;
            }
            this._clearHighlight();

            const range = document.caretRangeFromPoint(clientX, clientY);
            if (range && this._selAnchorNode && this._sourceEl.contains(range.startContainer)) {
                const newRange = document.createRange();
                try {
                    const cmp = this._selAnchorNode.compareDocumentPosition
                        ? this._selAnchorNode.compareDocumentPosition(range.startContainer) : 0;
                    const anchorBefore = (cmp & Node.DOCUMENT_POSITION_FOLLOWING) ||
                        (this._selAnchorNode === range.startContainer && this._selAnchorOffset <= range.startOffset);

                    if (anchorBefore) {
                        newRange.setStart(this._selAnchorNode, this._selAnchorOffset);
                        newRange.setEnd(range.startContainer, range.startOffset);
                    } else {
                        newRange.setStart(range.startContainer, range.startOffset);
                        newRange.setEnd(this._selAnchorNode, this._selAnchorOffset);
                    }
                    if (!newRange.collapsed) this._applyHighlight(newRange);
                } catch (ex) {}
            }
        } else if (type === "mouseup" && this._mouseDownTarget && !this._selecting) {
            this._dispatching = true;
            target.dispatchEvent(new MouseEvent("click", {
                bubbles: true, cancelable: true, clientX, clientY, button: e.button,
            }));
            this._dispatching = false;
            this._mouseDownTarget = null;
        } else if (type === "mouseup") {
            this._selecting = false;
            this._selReady = false;
            this._mouseDownTarget = null;
        }

        this._sourceEl.style.pointerEvents = "none";
        this._sourceEl.style.zIndex = "";
        this._refreshTexture();
    }

    /* ── selection highlight ──────────────────────────────── */

    _applyHighlight(range) {
        this._clearHighlight();
        const textNodes = [];
        const walker = document.createTreeWalker(
            range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                ? range.commonAncestorContainer.parentNode
                : range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT
        );
        let node;
        while ((node = walker.nextNode())) {
            if (range.intersectsNode(node)) textNodes.push(node);
        }
        for (const textNode of textNodes) {
            const start = textNode === range.startContainer ? range.startOffset : 0;
            const end = textNode === range.endContainer ? range.endOffset : textNode.length;
            if (start >= end) continue;
            const selectedPart = textNode.splitText(start);
            selectedPart.splitText(end - start);
            const mark = document.createElement("mark");
            mark.style.cssText = "background:#338fff;color:#fff;";
            selectedPart.parentNode.insertBefore(mark, selectedPart);
            mark.appendChild(selectedPart);
            this._highlightMarks.push(mark);
        }
    }

    _clearHighlight() {
        for (const mark of this._highlightMarks) {
            const parent = mark.parentNode;
            if (!parent) continue;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            parent.normalize();
        }
        this._highlightMarks = [];
    }

    /* ── mesh raycasting ──────────────────────────────────── */

    _raycastMeshUV(clientX, clientY) {
        if (!this._positions || !this._indices || !this._uvs) return null;

        const camEntity = ArrivalSpace.getCamera();
        if (!camEntity?.camera) return null;

        const cvs = this.app.graphicsDevice.canvas;
        const rect = cvs.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const cam = camEntity.camera;
        const rayOrigin = cam.screenToWorld(x, y, cam.nearClip);
        const rayFar = cam.screenToWorld(x, y, cam.farClip);
        const rayDir = new pc.Vec3().sub2(rayFar, rayOrigin).normalize();

        const pos = this._positions;
        const idx = this._indices;
        const uvs = this._uvs;

        let closestT = Infinity;
        let hitU = 0, hitV = 0;

        for (let i = 0; i < idx.length; i += 3) {
            const i0 = idx[i], i1 = idx[i + 1], i2 = idx[i + 2];

            // Triangle vertices (world space — cloth writes world positions).
            const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
            const bx = pos[i1 * 3], by = pos[i1 * 3 + 1], bz = pos[i1 * 3 + 2];
            const cx = pos[i2 * 3], cy = pos[i2 * 3 + 1], cz = pos[i2 * 3 + 2];

            // Möller–Trumbore ray-triangle intersection.
            const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
            const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

            const px = rayDir.y * e2z - rayDir.z * e2y;
            const py = rayDir.z * e2x - rayDir.x * e2z;
            const pz = rayDir.x * e2y - rayDir.y * e2x;

            const det = e1x * px + e1y * py + e1z * pz;
            if (Math.abs(det) < 1e-8) continue;

            const invDet = 1 / det;
            const tx = rayOrigin.x - ax, ty = rayOrigin.y - ay, tz = rayOrigin.z - az;

            const u = (tx * px + ty * py + tz * pz) * invDet;
            if (u < 0 || u > 1) continue;

            const qx = ty * e1z - tz * e1y;
            const qy = tz * e1x - tx * e1z;
            const qz = tx * e1y - ty * e1x;

            const v = (rayDir.x * qx + rayDir.y * qy + rayDir.z * qz) * invDet;
            if (v < 0 || u + v > 1) continue;

            const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
            if (t < 0 || t >= closestT) continue;

            closestT = t;

            // Interpolate UV from barycentric coordinates.
            const w = 1 - u - v;
            const uv0u = uvs[i0 * 2], uv0v = uvs[i0 * 2 + 1];
            const uv1u = uvs[i1 * 2], uv1v = uvs[i1 * 2 + 1];
            const uv2u = uvs[i2 * 2], uv2v = uvs[i2 * 2 + 1];

            hitU = w * uv0u + u * uv1u + v * uv2u;
            hitV = w * uv0v + u * uv1v + v * uv2v;
        }

        if (closestT === Infinity) return null;
        return { u: hitU, v: hitV };
    }

    _destroyRigidBody(proxy) {
        if (this._dynamicsWorld && proxy.body) {
            this._dynamicsWorld.removeRigidBody(proxy.body);
        }

        if (proxy.body) {
            Ammo.destroy(proxy.body);
        }

        if (proxy.info) {
            Ammo.destroy(proxy.info);
        }

        if (proxy.inertia) {
            Ammo.destroy(proxy.inertia);
        }

        if (proxy.motionState) {
            Ammo.destroy(proxy.motionState);
        }

        if (proxy.transform) {
            Ammo.destroy(proxy.transform);
        }

        if (proxy.shape) {
            Ammo.destroy(proxy.shape);
        }
    }
}
