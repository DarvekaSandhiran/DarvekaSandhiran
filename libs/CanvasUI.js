import {
    Mesh,
    CanvasTexture,
    MeshBasicMaterial,
    PlaneGeometry,
    Matrix4,
    Raycaster,
    Scene,
    WebGLRenderer,
    Vector3,
    Quaternion,
    IcosahedronBufferGeometry
} from './three/three.module.js';
import { CanvasKeyboard } from './CanvasKeyboard.js';

/**
 * CanvasUI - A flexible UI panel rendered on a canvas and mapped to a THREE.js mesh.
 */
class CanvasUI {
    constructor(content, config) {
        this._initConfig(config);
        this._initCanvas();
        this._initMesh();
        this._initContent(content);
        this._initKeyboard();
        this._initControllersIfNeeded();
        this.selectedElements = [undefined, undefined];
        this.selectPressed = [false, false];
        this.scrollData = [undefined, undefined];
        this.intersects = [undefined, undefined];
        this.needsUpdate = true;
        this.update();
    }

    _initConfig(config) {
        const defaults = {
            panelSize: { width: 1, height: 1 },
            width: 512,
            height: 512,
            opacity: 0.7,
            body: {
                fontFamily: 'Arial',
                fontSize: 30,
                padding: 20,
                backgroundColor: '#000',
                fontColor: '#fff',
                borderRadius: 6
            }
        };
        this.config = Object.assign({}, defaults, config);
        this.config.body = Object.assign({}, defaults.body, this.config.body || {});
        // Normalize element configs
        Object.entries(this.config).forEach(([name, value]) => {
            if (typeof value === 'object' && name !== 'panelSize' && !(value instanceof WebGLRenderer) && !(value instanceof Scene)) {
                value.position = Object.assign({ x: 0, y: 0 }, value.position || {});
                if (value.position.left !== undefined && value.position.x === undefined) value.position.x = value.position.left;
                if (value.position.top !== undefined && value.position.y === undefined) value.position.y = value.position.top;
                const width = value.width !== undefined ? value.width : this.config.width;
                const height = value.height !== undefined ? value.height : this.config.height;
                if (value.position.right !== undefined && value.position.x === undefined)
                    value.position.x = this.config.width - value.position.right - width;
                if (value.position.bottom !== undefined && value.position.y === undefined)
                    value.position.y = this.config.height - value.position.bottom - height;
                if (value.position.x === undefined) value.position.x = 0;
                if (value.position.y === undefined) value.position.y = 0;
                if (value.type === undefined) value.type = 'text';
            }
        });
    }

    _initCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        this.context = this.canvas.getContext('2d');
        this.context.save();
    }

    _initMesh() {
        const opacity = this.config.opacity !== undefined ? this.config.opacity : 0.7;
        this.panelSize = this.config.panelSize || { width: 1, height: 1 };
        const geometry = new PlaneGeometry(this.panelSize.width, this.panelSize.height);
        const material = new MeshBasicMaterial({ transparent: true, opacity });
        this.mesh = new Mesh(geometry, material);
        this.texture = new CanvasTexture(this.canvas);
        this.mesh.material.map = this.texture;
        this.scene = this.config.scene;
    }

    _initContent(content) {
        if (!content) {
            this.content = { body: "" };
            this.config.body.type = "text";
        } else {
            this.content = content;
        }
    }

    _initKeyboard() {
        const hasInput = Object.values(this.config).some(v => v.type === "input-text");
        if (hasInput) {
            this.keyboard = new CanvasKeyboard(this.panelSize.width, this.config.renderer);
            this.keyboard.mesh.position.set(0, -0.3, 0.2);
            this.mesh.add(this.keyboard.mesh);
        }
    }

    _initControllersIfNeeded() {
        const needsController = Object.values(this.config).some(
            v => v.type === "button" || v.overflow === "scroll" || v.type === "input-text"
        );
        if (needsController && this.config.renderer) {
            this.renderer = this.config.renderer;
            this._setupControllers();
        } else if (needsController) {
            console.warn("CanvasUI: button, scroll or input-text in the config but no renderer");
        }
    }

    _setupControllers() {
        this.vec3 = new Vector3();
        this.mat4 = new Matrix4();
        this.raycaster = new Raycaster();
        const self = this;

        function onSelect(event) {
            const idx = event.target === self.controller ? 0 : 1;
            const elm = self.selectedElements[idx];
            if (!elm) return;
            if (elm.type === "button") {
                self.select(idx);
            } else if (elm.type === "input-text" && self.keyboard) {
                if (self.keyboard.visible) {
                    self.keyboard.linkedUI = undefined;
                    self.keyboard.linkedText = undefined;
                    self.keyboard.linkedElement = undefined;
                    self.keyboard.visible = false;
                } else {
                    self.keyboard.linkedUI = self;
                    let name;
                    Object.entries(self.config).forEach(([prop, value]) => {
                        if (value === elm) name = prop;
                    });
                    const y = (0.5 - ((elm.position.y + elm.height + self.config.body.padding) / self.config.height)) * self.panelSize.height;
                    const h = Math.max(self.panelSize.width, self.panelSize.height) / 2;
                    self.keyboard.position.set(0, -h / 1.5 - y, 0.1);
                    self.keyboard.linkedText = self.content[name];
                    self.keyboard.linkedName = name;
                    self.keyboard.linkedElement = elm;
                    self.keyboard.visible = true;
                }
            }
        }

        function onSelectStart(event) {
            const idx = event.target === self.controller ? 0 : 1;
            self.selectPressed[idx] = true;
            if (self.selectedElements[idx] && self.selectedElements[idx].overflow === "scroll") {
                const elm = self.selectedElements[idx];
                self.scrollData[idx] = { scrollY: elm.scrollY, rayY: self.getIntersectY(idx) };
            }
        }

        function onSelectEnd(event) {
            const idx = event.target === self.controller ? 0 : 1;
            self.selectPressed[idx] = false;
            if (self.selectedElements[idx] && self.selectedElements[idx].overflow === "scroll") {
                self.scrollData[idx] = undefined;
            }
        }

        this.controller = this.renderer.xr.getController(0);
        this.controller1 = this.renderer.xr.getController(1);
        [this.controller, this.controller1].forEach(ctrl => {
            ctrl.addEventListener('select', onSelect);
            ctrl.addEventListener('selectstart', onSelectStart);
            ctrl.addEventListener('selectend', onSelectEnd);
        });

        if (this.scene) {
            const radius = 0.015;
            const geometry = new IcosahedronBufferGeometry(radius);
            const material = new MeshBasicMaterial({ color: 0x0000aa });
            this.intersectMesh = [
                new Mesh(geometry, material),
                new Mesh(geometry, material)
            ];
            this.intersectMesh.forEach(mesh => {
                mesh.visible = false;
                this.scene.add(mesh);
            });
        }
    }

    getIntersectY(index) {
        const height = this.config.height || 512;
        const intersect = this.intersects[index];
        if (!intersect || !intersect.uv) return 0;
        return (1 - intersect.uv.y) * height;
    }

    setClip(elm) {
        const ctx = this.context;
        ctx.restore();
        ctx.save();
        if (elm.clipPath) {
            ctx.clip(new Path2D(elm.clipPath));
        } else {
            const pos = elm.position || { x: 0, y: 0 };
            const borderRadius = elm.borderRadius || 0;
            const width = elm.width || this.config.width;
            const height = elm.height || this.config.height;
            ctx.beginPath();
            if (borderRadius) {
                // Rounded rectangle
                ctx.moveTo(pos.x + borderRadius, pos.y);
                ctx.arc(pos.x + borderRadius, pos.y + borderRadius, borderRadius, Math.PI, 1.5 * Math.PI);
                ctx.lineTo(pos.x + width - borderRadius, pos.y);
                ctx.arc(pos.x + width - borderRadius, pos.y + borderRadius, borderRadius, 1.5 * Math.PI, 0);
                ctx.lineTo(pos.x + width, pos.y + height - borderRadius);
                ctx.arc(pos.x + width - borderRadius, pos.y + height - borderRadius, borderRadius, 0, 0.5 * Math.PI);
                ctx.lineTo(pos.x + borderRadius, pos.y + height);
                ctx.arc(pos.x + borderRadius, pos.y + height - borderRadius, borderRadius, 0.5 * Math.PI, Math.PI);
                ctx.closePath();
                ctx.clip();
            } else {
                ctx.rect(pos.x, pos.y, width, height);
                ctx.clip();
            }
        }
    }

    setPosition(x, y, z) {
        if (this.mesh) this.mesh.position.set(x, y, z);
    }

    setRotation(x, y, z) {
        if (this.mesh) this.mesh.rotation.set(x, y, z);
    }

    updateElement(name, content) {
        if (!(name in this.content)) {
            console.warn(`CanvasUI.updateElement: No ${name} found`);
            return;
        }
        if (typeof this.content[name] === 'object') {
            this.content[name].content = content;
        } else {
            this.content[name] = content;
        }
        this.needsUpdate = true;
    }

    get panel() {
        return this.mesh;
    }

    getElementAtLocation(x, y) {
        for (const [name, elm] of Object.entries(this.config)) {
            if (
                typeof elm === 'object' &&
                name !== 'panelSize' &&
                name !== 'body' &&
                !(elm instanceof WebGLRenderer) &&
                !(elm instanceof Scene)
            ) {
                const pos = elm.position;
                const width = elm.width !== undefined ? elm.width : this.config.width;
                const height = elm.height !== undefined ? elm.height : this.config.height;
                if (x >= pos.x && x < pos.x + width && y >= pos.y && y < pos.y + height) {
                    return elm;
                }
            }
        }
        return null;
    }

    updateConfig(name, property, value) {
        if (!(name in this.config)) {
            console.warn(`CanvasUI.updateConfig: No ${name} found`);
            return;
        }
        this.config[name][property] = value;
        this.needsUpdate = true;
    }

    hover(index = 0, uv) {
        if (!uv) {
            if (this.selectedElements[index]) {
                this.selectedElements[index] = undefined;
                this.needsUpdate = true;
            }
        } else {
            const x = uv.x * (this.config.width || 512);
            const y = (1 - uv.y) * (this.config.height || 512);
            const elm = this.getElementAtLocation(x, y);
            if (!elm) {
                if (this.selectedElements[index]) {
                    this.selectedElements[index] = undefined;
                    this.needsUpdate = true;
                }
            } else if (this.selectedElements[index] !== elm) {
                this.selectedElements[index] = elm;
                this.needsUpdate = true;
            }
        }
    }

    select(index = 0) {
        const elm = this.selectedElements[index];
        if (!elm) return;
        if (elm.onSelect) elm.onSelect();
        if (elm.type === 'input-text' && this.keyboard) {
            this.keyboard.mesh.visible = true;
        } else {
            this.selectedElements[index] = undefined;
        }
    }

    scroll(index) {
        const elm = this.selectedElements[index];
        if (!elm) {
            if (this.intersectMesh) this.intersectMesh[index].visible = false;
            return;
        }
        if (elm.overflow !== 'scroll') return;
        if (this.selectPressed[index]) {
            const scrollData = this.scrollData[index];
            if (scrollData) {
                if (this.intersectMesh) {
                    this.intersectMesh[index].visible = true;
                    this.intersectMesh[index].position.copy(this.intersects[index].point);
                }
                const rayY = this.getIntersectY(index);
                const offset = rayY - scrollData.rayY;
                elm.scrollY = Math.min(Math.max(elm.minScrollY, scrollData.scrollY + offset), 0);
                this.needsUpdate = true;
            }
        } else {
            if (this.intersectMesh) this.intersectMesh[index].visible = false;
        }
    }

    handleController(controller, index) {
        this.mat4.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.mat4);
        const intersects = this.raycaster.intersectObject(this.mesh);
        if (intersects.length > 0) {
            this.hover(index, intersects[0].uv);
            this.intersects[index] = intersects[0];
            this.scroll(index);
        } else {
            this.hover(index);
            this.intersects[index] = undefined;
            this.scroll(index);
        }
    }

    update() {
        if (!this.mesh) return;
        if (this.controller) this.handleController(this.controller, 0);
        if (this.controller1) this.handleController(this.controller1, 1);
        if (this.keyboard && this.keyboard.visible) this.keyboard.update();
        if (!this.needsUpdate) return;

        const ctx = this.context;
        ctx.clearRect(0, 0, this.config.width, this.config.height);

        // Draw background
        const bgColor = this.config.body.backgroundColor || "#000";
        this.setClip(this.config.body);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.config.width, this.config.height);

        // Draw elements
        Object.entries(this.content).forEach(([name, content]) => {
            const cfg = this.config[name] || this.config.body;
            if ((cfg.display || 'block') === 'none') return;
            const pos = cfg.position || { x: 0, y: 0 };
            const width = cfg.width !== undefined ? cfg.width : this.config.width;
            const height = cfg.height !== undefined ? cfg.height : this.config.height;
            if (cfg.type === "button" && !content.toLowerCase().startsWith("<path>")) {
                if (cfg.borderRadius === undefined) cfg.borderRadius = 6;
                if (cfg.textAlign === undefined) cfg.textAlign = "center";
            }
            this.setClip(cfg);

            const svgPath = typeof content === "string" && content.toLowerCase().startsWith("<path>");
            const hover = (this.selectedElements[0] === cfg || this.selectedElements[1] === cfg);

            // Background
            if (cfg.backgroundColor) {
                ctx.fillStyle = hover && cfg.type === "button" && cfg.hover ? cfg.hover : cfg.backgroundColor;
                ctx.fillRect(pos.x, pos.y, width, height);
            }

            // Text/Button/Input
            if (["text", "button", "input-text"].includes(cfg.type)) {
                let stroke = false;
                if (hover) {
                    ctx.fillStyle = !svgPath && cfg.type === "button"
                        ? (cfg.fontColor || this.config.body.fontColor)
                        : (cfg.hover || cfg.fontColor || this.config.body.fontColor);
                    stroke = !cfg.hover;
                } else {
                    ctx.fillStyle = cfg.fontColor || this.config.body.fontColor;
                }
                if (svgPath) {
                    const code = content.toUpperCase().substring(6, content.length - 7);
                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.fill(new Path2D(code));
                    ctx.restore();
                } else {
                    this._drawWrappedText(name, content);
                }
                if (stroke) {
                    ctx.beginPath();
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 2;
                    ctx.rect(pos.x, pos.y, width, height);
                    ctx.stroke();
                }
            } else if (cfg.type === "img") {
                if (!cfg.img) {
                    this._loadImage(content).then(img => {
                        cfg.img = img;
                        this.needsUpdate = true;
                        this.update();
                    }).catch(console.error);
                } else {
                    const aspect = cfg.img.width / cfg.img.height;
                    const h = width / aspect;
                    ctx.drawImage(cfg.img, pos.x, pos.y, width, h);
                }
            }
        });

        this.needsUpdate = false;
        this.texture.needsUpdate = true;
    }

    _loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = err => reject(err);
            img.src = src;
        });
    }

    fillRoundedRect(x, y, w, h, radius) {
        const ctx = this.context;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    lookAt(pos) {
        if (!this.mesh) return;
        if (!(pos instanceof Vector3)) {
            console.error('CanvasUI lookAt: parameter not a THREE.Vector3');
            return;
        }
        this.mesh.lookAt(pos);
    }

    get visible() {
        return this.mesh ? this.mesh.visible : false;
    }

    set visible(val) {
        if (this.mesh) this.mesh.visible = val;
    }

    get position() {
        return this.mesh ? this.mesh.position : undefined;
    }

    set position(val) {
        if (!this.mesh) return;
        if (!(val instanceof Vector3)) {
            console.error('CanvasUI: position must be a THREE.Vector3');
            return;
        }
        this.mesh.position.copy(val);
    }

    get quaternion() {
        return this.mesh ? this.mesh.quaternion : undefined;
    }

    set quaternion(val) {
        if (!this.mesh) return;
        if (!(val instanceof Quaternion)) {
            console.error('CanvasUI: quaternion must be a THREE.Quaternion');
            return;
        }
        this.mesh.quaternion.copy(val);
    }

    _drawWrappedText(name, txt) {
        const config = this.config[name] || this.config.body;
        const width = config.width !== undefined ? config.width : this.config.width;
        const height = config.height !== undefined ? config.height : this.config.height;
        const pos = config.position || { x: 0, y: 0 };
        const padding = config.padding !== undefined ? config.padding : (this.config.body.padding !== undefined ? this.config.body.padding : 10);
        const paddingTop = config.paddingTop !== undefined ? config.paddingTop : padding;
        const paddingLeft = config.paddingLeft !== undefined ? config.paddingLeft : padding;
        const paddingBottom = config.paddingBottom !== undefined ? config.paddingBottom : padding;
        const paddingRight = config.paddingRight !== undefined ? config.paddingRight : padding;
        const rect = {
            x: pos.x + paddingLeft,
            y: pos.y + paddingTop,
            width: width - paddingLeft - paddingRight,
            height: height - paddingTop - paddingBottom
        };
        const textAlign = config.textAlign || this.config.body.textAlign || "left";
        const fontSize = config.fontSize !== undefined ? config.fontSize : (this.config.body.fontSize !== undefined ? this.config.body.fontSize : 30);
        const fontFamily = config.fontFamily || this.config.body.fontFamily || 'Arial';
        const leading = config.leading !== undefined ? config.leading : (this.config.body.leading !== undefined ? this.config.body.leading : 8);
        const lineHeight = fontSize + leading;
        const ctx = this.context;
        ctx.textAlign = textAlign;
        ctx.font = `${fontSize}px '${fontFamily}'`;

        const words = txt.split(' ');
        let line = '';
        const lines = [];
        words.forEach(word => {
            let testLine = (words.length > 1) ? `${line}${word} ` : word;
            let metrics = ctx.measureText(testLine);
            if (metrics.width > rect.width && word.length > 1) {
                if (line.length === 0 && metrics.width > rect.width) {
                    while (metrics.width > rect.width) {
                        let count = 0;
                        do {
                            count++;
                            testLine = word.substr(0, count);
                            metrics = ctx.measureText(testLine);
                        } while (metrics.width < rect.width && count < (word.length - 1));
                        count--;
                        testLine = word.substr(0, count);
                        lines.push(testLine);
                        word = word.substr(count);
                        if (count <= 1) break;
                        metrics = ctx.measureText(word);
                    }
                    if (word !== "") lines.push(word);
                } else {
                    lines.push(line);
                    line = `${word} `;
                }
            } else {
                line = testLine;
            }
        });
        if (line !== '') lines.push(line);

        const textHeight = lines.length * lineHeight;
        let scrollY = 0;
        if (textHeight > rect.height && config.overflow === 'scroll') {
            if (config.scrollY === undefined) config.scrollY = 0;
            ctx.fillStyle = "#aaa";
            this.fillRoundedRect(pos.x + width - 12, pos.y, 12, height, 6);
            ctx.fillStyle = "#666";
            const scale = rect.height / textHeight;
            const thumbHeight = scale * height;
            const thumbY = -config.scrollY * scale;
            this.fillRoundedRect(pos.x + width - 12, pos.y + thumbY, 12, thumbHeight, 6);
            ctx.fillStyle = config.fontColor || this.config.body.fontColor;
            scrollY = config.scrollY;
            config.minScrollY = rect.height - textHeight;
        }

        let y = scrollY + rect.y + fontSize / 2;
        let x;
        switch (textAlign) {
            case "center":
                x = rect.x + rect.width / 2;
                break;
            case "right":
                x = rect.x + rect.width;
                break;
            default:
                x = rect.x;
        }
        lines.forEach(line => {
            if ((y + lineHeight) > 0) ctx.fillText(line, x, y);
            y += lineHeight;
        });
    }
}

export {
