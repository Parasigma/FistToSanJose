import {
  Color3,
  Constants,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scalar,
  Scene,
  SpotLight,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
  Vector4,
} from "@babylonjs/core";

const EYE = 1.62;

export class Player {
  camera: UniversalCamera;
  enabled = false;
  /** Modo alternativo cuando el navegador no permite capturar el puntero. */
  dragLook = false;
  /** Fija la altura de la cámara (se suelta en cinemáticas como la tele). */
  lockY = true;
  flashOn = false;
  /** Agachado ([C]): más lento, más silencioso, cámara baja. */
  crouched = false;
  sprinting = false;
  onStep: (() => void) | null = null;

  private canvas: HTMLCanvasElement;
  private baseSpeed = 0.3;
  private bobPhase = 0;
  private lastPos: Vector3;
  private dragging = false;
  private eyeCur = 1.62;
  private keys = new Set<string>();
  private sensMult = 1;
  private spot!: SpotLight;
  private lensMat!: StandardMaterial;
  private flashRoot!: TransformNode;
  private beam!: Mesh;
  private flashHidden = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, spawn: Vector3, yaw: number) {
    this.canvas = canvas;
    const cam = new UniversalCamera("cam", spawn.clone(), scene);
    cam.minZ = 0.05;
    cam.maxZ = 140;
    cam.fov = 1.15;
    cam.rotation.y = yaw;
    cam.inertia = 0.62;
    cam.speed = this.baseSpeed;
    cam.checkCollisions = true;
    cam.applyGravity = false;
    // El colisionador se centra ellipsoid.y POR DEBAJO de la cámara (la cámara
    // va arriba del elipsoide): con la cámara a 1.62, esto lo deja apoyado en
    // el suelo (0.02..1.62) en vez de hundido en él, que causaba atascos.
    cam.ellipsoid = new Vector3(0.42, 0.8, 0.42);
    // Ni ratón ni teclado de Babylon: la vista la lleva nuestro mousemove y el
    // movimiento es planar propio (el de Babylon empuja hacia donde MIRAS,
    // y mirando al suelo te frena contra él).
    cam.inputs.removeByType("FreeCameraMouseInput");
    cam.inputs.removeByType("FreeCameraKeyboardMoveInput");
    this.camera = cam;
    this.lastPos = cam.position.clone();
    this.buildFlashlight(scene, cam);

    document.addEventListener("keydown", (e) => this.keys.add(e.code));
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("mousedown", () => (this.dragging = true));
    window.addEventListener("mouseup", () => (this.dragging = false));
    window.addEventListener("blur", () => (this.dragging = false));
    document.addEventListener("mousemove", (e) => {
      if (!this.enabled) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !(this.dragLook && this.dragging)) return;
      const sens = 0.0021 * this.sensMult;
      cam.rotation.y += e.movementX * sens;
      cam.rotation.x = Scalar.Clamp(cam.rotation.x + e.movementY * sens, -1.45, 1.45);
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "ShiftLeft") {
        cam.speed = this.baseSpeed * 1.75;
        this.sprinting = true;
      }
      // Agacharse es CONMUTADOR: [C] agacha y [C] vuelve a levantar, no hay
      // que mantenerla pulsada. (Va en [C] y no en CTRL porque mantener CTRL
      // y pulsar W es Ctrl+W, atajo del navegador que cierra la pestaña.)
      if (e.code === "KeyC" && !e.repeat) this.crouched = !this.crouched;
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "ShiftLeft") {
        cam.speed = this.baseSpeed;
        this.sprinting = false;
      }
    });
    window.addEventListener("blur", () => {
      // el agachado se conserva al volver a la ventana: es un estado, no una tecla
      this.sprinting = false;
    });

    scene.onBeforeRenderObservable.add(() => {
      // movimiento planar estilo FPS: solo cuenta el yaw, nunca el pitch
      if (this.enabled) {
        let f = 0;
        let s = 0;
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) f += 1;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) f -= 1;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) s += 1;
        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) s -= 1;
        if (f !== 0 || s !== 0) {
          const yaw = cam.rotation.y;
          // velocidad proporcional al delta (a 60 fps equivale al input clásico
          // de Babylon, pero sin depender de getFps, que se dispara con tirones)
          const dt = Math.min(scene.getEngine().getDeltaTime(), 50);
          const frameSpeed = cam.speed * (this.crouched ? 0.5 : 1) * dt * 0.00316;
          const sp = frameSpeed / Math.hypot(f, s);
          cam.cameraDirection.x += (Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
          cam.cameraDirection.z += (Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
        }
      }
      const p = cam.position;
      const dx = p.x - this.lastPos.x;
      const dz = p.z - this.lastPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.003 && this.enabled) {
        const prev = this.bobPhase;
        this.bobPhase += dist * 3.2;
        if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) this.onStep?.();
      }
      this.lastPos.copyFrom(p);
      const dtE = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
      const eyeTarget = this.crouched ? 1.04 : EYE;
      this.eyeCur += (eyeTarget - this.eyeCur) * Math.min(1, dtE * 9);
      // agachado el cuerpo también encoge: así se cuela por huecos bajos
      cam.ellipsoid.y = this.crouched ? 0.5 : 0.8;
      if (this.lockY) p.y = this.eyeCur + Math.sin(this.bobPhase) * (this.crouched ? 0.025 : 0.045);
      // balanceo de la linterna + parpadeo sutil del haz
      this.flashRoot.position.x = 0.3 + Math.sin(this.bobPhase * 0.5) * 0.005;
      this.flashRoot.position.y = -0.26 + Math.sin(this.bobPhase) * 0.009;
      if (this.flashOn && !this.flashHidden) this.spot.intensity = 1.9 + (Math.random() - 0.5) * 0.14;
    });
  }

  private buildFlashlight(scene: Scene, cam: UniversalCamera) {
    // Ángulo amplio + exponente alto: la luz cae gradualmente hacia el borde
    // (círculo difuminado, sin aro duro) y se funde con el haz visible.
    const spot = new SpotLight(
      "flashSpot",
      new Vector3(0.18, -0.14, 0.25),
      new Vector3(0.03, -0.05, 1),
      1.1,
      30,
      scene
    );
    spot.parent = cam;
    spot.intensity = 0;
    spot.range = 28;
    spot.diffuse = new Color3(1, 0.95, 0.82);
    spot.specular = new Color3(0.08, 0.08, 0.08);
    this.spot = spot;

    const root = new TransformNode("flashRoot", scene);
    root.parent = cam;
    root.position.set(0.3, -0.26, 0.62);
    root.rotation.set(-0.06, -0.08, 0);
    this.flashRoot = root;

    const mBody = new StandardMaterial("flashBody", scene);
    mBody.diffuseColor = new Color3(0.16, 0.17, 0.18);
    mBody.specularColor = Color3.Black();
    mBody.maxSimultaneousLights = 10;

    const body = MeshBuilder.CreateCylinder("flashB", { diameter: 0.05, height: 0.18, tessellation: 10 }, scene);
    body.rotation.x = Math.PI / 2;
    body.material = mBody;
    body.parent = root;

    const head = MeshBuilder.CreateCylinder(
      "flashH",
      { diameterTop: 0.075, diameterBottom: 0.05, height: 0.06, tessellation: 10 },
      scene
    );
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.11;
    head.material = mBody;
    head.parent = root;

    const lensMat = new StandardMaterial("flashLens", scene);
    lensMat.diffuseColor = new Color3(0.1, 0.1, 0.08);
    lensMat.specularColor = Color3.Black();
    this.lensMat = lensMat;

    const lens = MeshBuilder.CreateCylinder("flashL", { diameter: 0.066, height: 0.012, tessellation: 10 }, scene);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.142;
    lens.material = lensMat;
    lens.parent = root;

    // la linterna se dibuja encima de todo (grupo propio con limpieza de profundidad)
    for (const m of [body, head, lens]) {
      m.renderingGroupId = 1;
      m.isPickable = false;
    }
    scene.setRenderingAutoClearDepthStencil(1, true);

    // haz volumétrico: cono aditivo que se difumina hacia el extremo lejano
    const beamTex = new DynamicTexture("beamTex", { width: 8, height: 128 }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
    const bctx = beamTex.getContext() as unknown as CanvasRenderingContext2D;
    bctx.clearRect(0, 0, 8, 128);
    const grad = bctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "rgba(0,0,0,0)"); // extremo lejano: se desvanece
    grad.addColorStop(0.55, "rgba(120,110,88,0.16)");
    grad.addColorStop(1, "rgba(255,240,205,0.42)"); // junto a la lente
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, 8, 128);
    beamTex.update();
    beamTex.hasAlpha = true;

    const beamMat = new StandardMaterial("beamMat", scene);
    beamMat.emissiveTexture = beamTex;
    beamMat.opacityTexture = beamTex;
    beamMat.diffuseColor = Color3.Black();
    beamMat.specularColor = Color3.Black();
    beamMat.disableLighting = true;
    beamMat.alphaMode = Constants.ALPHA_ADD;
    beamMat.backFaceCulling = false;

    // caras: [0]=tapa inferior, [1]=tubo, [2]=tapa superior → tapas mapeadas a zona transparente
    const capUV = new Vector4(0, 0.98, 0.02, 1);
    const beam = MeshBuilder.CreateCylinder(
      "flashBeam",
      {
        diameterTop: 4.2,
        diameterBottom: 0.07,
        height: 8.5,
        tessellation: 20,
        faceUV: [capUV, new Vector4(0, 0, 1, 1), capUV],
      },
      scene
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, 0, 0.15 + 4.25);
    beam.material = beamMat;
    beam.parent = root;
    beam.isPickable = false;
    beam.setEnabled(false);
    this.beam = beam;
  }

  /** El foco de la linterna (para efectos que dependen de su cono de luz). */
  get spotLight(): SpotLight {
    return this.spot;
  }

  /** Guarda la linterna durante una cinemática o puzle (se restaura igual). */
  setFlashlightHidden(hidden: boolean) {
    this.flashHidden = hidden;
    this.flashRoot.setEnabled(!hidden);
    this.spot.setEnabled(!hidden);
    this.beam.setEnabled(!hidden && this.flashOn);
  }

  toggleFlashlight() {
    this.flashOn = !this.flashOn;
    this.spot.intensity = this.flashOn ? 1.9 : 0;
    this.beam.setEnabled(this.flashOn);
    this.lensMat.emissiveColor = this.flashOn
      ? new Color3(1, 0.95, 0.72)
      : Color3.Black();
  }

  setControl(on: boolean) {
    this.enabled = on;
    if (!on) this.keys.clear();
  }

  setSensitivity(mult: number) {
    this.sensMult = mult;
  }
}
